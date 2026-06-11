const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const pool = require('./config/db');

module.exports = (server) => {
  const io = new Server(server, {
    cors: { origin: '*' }
  });

  // ── JWT auth ──
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('No token'));
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) return next(new Error('Invalid token'));
      socket.user = decoded;
      next();
    });
  });

  io.on('connection', (socket) => {
    const { userId, username } = socket.user;
    console.log(`[socket] connected: ${username} (${userId})`);

    // personal notification channel — MUST be first thing after connect
    socket.join(`user:${userId}`);
    console.log(`[socket] ${username} joined personal channel user:${userId}`);

    // ── join a chat room ──
    socket.on('join_room', async ({ roomId }) => {
      try {
        const result = await pool.query(
          `SELECT id FROM room_members WHERE room_id = $1 AND user_id = $2`,
          [roomId, userId]
        );
        if (result.rows.length === 0) {
          return socket.emit('socket_error', { message: 'Not a member of this room' });
        }
        socket.join(roomId);
        console.log(`[socket] ${username} joined room ${roomId}`);
      } catch (err) {
        console.error('[socket] join_room error:', err.message);
      }
    });

    // ── send a message ──
    socket.on('send_message', async ({ roomId, content }) => {
      if (!content?.trim()) return;
      try {
        const membership = await pool.query(
          `SELECT id FROM room_members WHERE room_id = $1 AND user_id = $2`,
          [roomId, userId]
        );
        if (membership.rows.length === 0) {
          return socket.emit('socket_error', { message: 'Not a member of this room' });
        }
        const result = await pool.query(
          `INSERT INTO messages (room_id, sender_id, content)
           VALUES ($1, $2, $3) RETURNING id, content, sent_at`,
          [roomId, userId, content.trim()]
        );
        const message = { ...result.rows[0], sender_id: userId, sender_name: username };
        io.to(roomId).emit('new_message', message);
        console.log(`[socket] message broadcast to room ${roomId}`);
      } catch (err) {
        console.error('[socket] send_message error:', err.message);
        socket.emit('socket_error', { message: 'Failed to send: ' + err.message });
      }
    });

    // ── typing ──
    socket.on('typing',      ({ roomId }) => socket.to(roomId).emit('user_typing',      { username }));
    socket.on('stop_typing', ({ roomId }) => socket.to(roomId).emit('user_stop_typing', { username }));

    // ── join request: frontend tells backend to notify admin ──
    // Backend looks up the real adminId from DB — no trust in client-supplied adminId
    socket.on('join_request_notify', async ({ roomId, roomName }) => {
      try {
        // fetch admin's userId directly from DB — not from frontend payload
        const result = await pool.query(
          `SELECT user_id FROM room_members
           WHERE room_id = $1 AND role = 'admin'`,
          [roomId]
        );
        if (result.rows.length === 0) {
          console.log(`[socket] no admin found for room ${roomId}`);
          return;
        }
        const adminId = result.rows[0].user_id;
        console.log(`[socket] notifying admin ${adminId} of join request by ${username} for room ${roomId}`);
        io.to(`user:${adminId}`).emit('new_join_request', {
          roomId,
          roomName,
          username,
        });
      } catch (err) {
        console.error('[socket] join_request_notify error:', err.message);
      }
    });

    // ── admin responds: notify the waiting user ──
    socket.on('request_responded', ({ userId: targetUserId, roomId, roomName, action }) => {
      console.log(`[socket] responding to user ${targetUserId}: ${action} for room ${roomName}`);
      io.to(`user:${targetUserId}`).emit('join_request_response', { roomId, roomName, action });
    });

    // ── admin deleted a room: notify all members via personal channels ──
    socket.on('room_deleted', async ({ roomId }) => {
      console.log(`[socket] admin ${username} deleted room ${roomId}`);
      try {
        // fetch all members of this room from DB
        const result = await pool.query(
          `SELECT user_id FROM room_members WHERE room_id = $1`,
          [roomId]
        );
        // emit to every member's personal channel — works regardless of which room they have open
        result.rows.forEach(({ user_id }) => {
          io.to(`user:${user_id}`).emit('room_removed', { roomId });
          console.log(`[socket] notified user ${user_id} of room deletion`);
        });
        // also emit to the room channel for anyone currently inside it
        io.to(roomId).emit('room_removed', { roomId });
      } catch (err) {
        console.error('[socket] room_deleted error:', err.message);
      }
    });

    socket.on('disconnect', () => console.log(`[socket] disconnected: ${username}`));
  });

  return io;
};