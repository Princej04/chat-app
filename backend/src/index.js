const express = require('express');
const http = require('http');
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const messageRoutes = require('./routes/messages');
const initSocket = require('./socket');

const app = express();
const cors = require('cors');
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://chat-app-iota-rouge.vercel.app' // updated
  ]
}));

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/messages', messageRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Chat API is running!' });
});

const server = http.createServer(app);
initSocket(server);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});