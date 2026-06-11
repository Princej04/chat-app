const express = require('express');
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ───── CREATE A ROOM ─────
router.post('/', async (req, res) => {
  const { name } = req.body;
  const userId = req.user.userId;
  if (!name) return res.status(400).json({ error: 'Room name is required' });

  try {
    const roomResult = await pool.query(
      `INSERT INTO rooms (name, type, created_by)
       VALUES ($1, 'group', $2) RETURNING *`,
      [name, userId]
    );
    const room = roomResult.rows[0];
    await pool.query(
      `INSERT INTO room_members (room_id, user_id, role) VALUES ($1, $2, 'admin')`,
      [room.id, userId]
    );
    res.status(201).json({ room });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ───── GET MY ROOMS ─────
router.get('/', async (req, res) => {
  const userId = req.user.userId;
  try {
    const result = await pool.query(
      `SELECT r.id, r.name, r.type, r.created_at, r.created_by,
              rm.role
       FROM rooms r
       JOIN room_members rm ON rm.room_id = r.id
       WHERE rm.user_id = $1
       ORDER BY r.created_at DESC`,
      [userId]
    );
    res.json({ rooms: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ───── SEARCH ROOMS (by name or exact ID) ─────
router.get('/search', async (req, res) => {
  const { q } = req.query;
  const userId = req.user.userId;
  if (!q) return res.status(400).json({ error: 'Query required' });

  // Check if q looks like a UUID (exact ID search)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isUUID = uuidRegex.test(q.trim());

  try {
    const result = await pool.query(
      `SELECT r.id, r.name, r.created_at,
              COUNT(rm.user_id) AS member_count,
              EXISTS (
                SELECT 1 FROM room_members
                WHERE room_id = r.id AND user_id = $2
              ) AS is_member,
              EXISTS (
                SELECT 1 FROM join_requests
                WHERE room_id = r.id AND user_id = $2 AND status = 'pending'
              ) AS has_pending
       FROM rooms r
       LEFT JOIN room_members rm ON rm.room_id = r.id
       WHERE ${isUUID ? 'r.id = $1::uuid' : 'r.name ILIKE $1'}
       GROUP BY r.id
       ORDER BY member_count DESC`,
      [isUUID ? q.trim() : `%${q.trim()}%`, userId]
    );
    res.json({ rooms: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ───── SEND JOIN REQUEST ─────
router.post('/:roomId/request', async (req, res) => {
  const { roomId } = req.params;
  const userId = req.user.userId;

  try {
    // Check not already a member
    const member = await pool.query(
      `SELECT id FROM room_members WHERE room_id = $1 AND user_id = $2`,
      [roomId, userId]
    );
    if (member.rows.length > 0)
      return res.status(409).json({ error: 'Already a member' });

    // Insert request (ignore duplicate pending)
    const result = await pool.query(
      `INSERT INTO join_requests (room_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (room_id, user_id) DO UPDATE SET status = 'pending', created_at = NOW()
       RETURNING *`,
      [roomId, userId]
    );

    // Get requester's username and room name to notify admin via socket
    const meta = await pool.query(
      `SELECT u.username, r.name AS room_name, r.created_by
       FROM users u, rooms r
       WHERE u.id = $1 AND r.id = $2`,
      [userId, roomId]
    );

    res.json({ request: result.rows[0], meta: meta.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ───── GET PENDING REQUESTS (admin only) ─────
router.get('/:roomId/requests', async (req, res) => {
  const { roomId } = req.params;
  const userId = req.user.userId;

  try {
    // Verify requester is admin
    const admin = await pool.query(
      `SELECT id FROM room_members WHERE room_id = $1 AND user_id = $2 AND role = 'admin'`,
      [roomId, userId]
    );
    if (admin.rows.length === 0)
      return res.status(403).json({ error: 'Not an admin' });

    const result = await pool.query(
      `SELECT jr.id, jr.status, jr.created_at,
              u.id AS user_id, u.username
       FROM join_requests jr
       JOIN users u ON u.id = jr.user_id
       WHERE jr.room_id = $1 AND jr.status = 'pending'
       ORDER BY jr.created_at ASC`,
      [roomId]
    );
    res.json({ requests: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ───── RESPOND TO JOIN REQUEST (admin only) ─────
router.post('/requests/:requestId/respond', async (req, res) => {
  const { requestId } = req.params;
  const { action } = req.body; // 'accept' or 'reject'
  const userId = req.user.userId;

  if (!['accept', 'reject'].includes(action))
    return res.status(400).json({ error: 'Action must be accept or reject' });

  try {
    // Get the request
    const reqRow = await pool.query(
      `SELECT jr.*, r.created_by, r.name AS room_name, u.username
       FROM join_requests jr
       JOIN rooms r ON r.id = jr.room_id
       JOIN users u ON u.id = jr.user_id
       WHERE jr.id = $1`,
      [requestId]
    );
    if (reqRow.rows.length === 0)
      return res.status(404).json({ error: 'Request not found' });

    const joinReq = reqRow.rows[0];

    // Verify admin
    const admin = await pool.query(
      `SELECT id FROM room_members WHERE room_id = $1 AND user_id = $2 AND role = 'admin'`,
      [joinReq.room_id, userId]
    );
    if (admin.rows.length === 0)
      return res.status(403).json({ error: 'Not an admin' });

    // Update request status
    await pool.query(
      `UPDATE join_requests SET status = $1 WHERE id = $2`,
      [action === 'accept' ? 'accepted' : 'rejected', requestId]
    );

    // If accepted, add to room_members
    if (action === 'accept') {
      await pool.query(
        `INSERT INTO room_members (room_id, user_id, role)
         VALUES ($1, $2, 'member')
         ON CONFLICT (room_id, user_id) DO NOTHING`,
        [joinReq.room_id, joinReq.user_id]
      );
    }

    res.json({ success: true, action, joinReq });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ───── DELETE A ROOM (admin only) ─────
router.delete('/:roomId', async (req, res) => {
  const { roomId } = req.params;
  const userId = req.user.userId;

  try {
    const admin = await pool.query(
      `SELECT id FROM room_members
       WHERE room_id = $1 AND user_id = $2 AND role = 'admin'`,
      [roomId, userId]
    );
    if (admin.rows.length === 0)
      return res.status(403).json({ error: 'Only admin can delete this room' });

    await pool.query('DELETE FROM rooms WHERE id = $1', [roomId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ───── LEAVE A ROOM (members only, not admin) ─────
router.post('/:roomId/leave', async (req, res) => {
  const { roomId } = req.params;
  const userId = req.user.userId;

  try {
    // Admins cannot leave — they must delete
    const check = await pool.query(
      `SELECT role FROM room_members WHERE room_id = $1 AND user_id = $2`,
      [roomId, userId]
    );
    if (check.rows.length === 0)
      return res.status(404).json({ error: 'You are not in this room' });

    if (check.rows[0].role === 'admin')
      return res.status(403).json({ error: 'Admins cannot leave — delete the room instead' });

    await pool.query(
      `DELETE FROM room_members WHERE room_id = $1 AND user_id = $2`,
      [roomId, userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});
module.exports = router;