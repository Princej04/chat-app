const express = require('express');
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// ───── GET MESSAGES IN A ROOM ─────
router.get('/:roomId', async (req, res) => {
  const { roomId } = req.params;
  const userId = req.user.userId;

  try {
    // Make sure user is actually a member of this room
    const membership = await pool.query(
      `SELECT id FROM room_members
       WHERE room_id = $1 AND user_id = $2`,
      [roomId, userId]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this room' });
    }

    // Fetch last 50 messages with sender's username
    const result = await pool.query(
      `SELECT m.id, m.content, m.sent_at, m.is_deleted,
              u.username AS sender_name, u.id AS sender_id
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.room_id = $1
       ORDER BY m.sent_at ASC
       LIMIT 50`,
      [roomId]
    );

    res.json({ messages: result.rows });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;