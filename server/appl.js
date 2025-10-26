// backend/app.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const { signToken, verifyToken } = require('./auth');
const store = require('./storage');

const app = express();
const server = http.createServer(app);
const { Server } = require('socket.io');

const PORT = process.env.PORT || 4000;
const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean) || ['http://localhost:5173'];

app.use(express.json());
app.use(helmet());
app.use(cors({ origin: allowed }));
app.use(rateLimit({ windowMs: 60_000, max: 300 }));

// static upload folder
const uploadsDir = path.join(__dirname, 'uploads');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });
app.use('/uploads', express.static(uploadsDir));

// --- REST endpoints ---
// login (demo): { username } -> { token, user }
app.post('/api/login', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'username required' });
  const user = store.createUser(username, username === 'admin');
  const token = signToken({ id: user.id, username: user.username, isAdmin: user.isAdmin });
  res.json({ token, user });
});

// fetch messages
app.get('/api/rooms/:roomId/messages', (req, res) => {
  const roomId = req.params.roomId;
  const limit = parseInt(req.query.limit || '50', 10);
  const before = req.query.before ? parseInt(req.query.before, 10) : undefined;
  const messages = store.getMessages(roomId, { limit, before });
  res.json({ roomId, messages });
});

// file upload (multipart)
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });
  const url = `${req.protocol}://${req.get('host')}/uploads/${path.basename(req.file.path)}`;
  res.json({ url, filename: req.file.originalname, size: req.file.size });
});

// react (REST example) - accepts token in body or Authorization header
app.post('/api/rooms/:roomId/messages/:messageId/react', (req, res) => {
  const token = req.body.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
  const emoji = req.body.emoji;
  if (!token) return res.status(401).json({ error: 'token required' });
  try {
    const user = verifyToken(token);
    const msg = store.reactMessage(req.params.roomId, req.params.messageId, user.id, emoji);
    if (!msg) return res.status(404).json({ error: 'message not found' });
    return res.json({ message: msg });
  } catch (e) {
    return res.status(401).json({ error: 'invalid token' });
  }
});

// --- Socket.IO realtime ---
const io = new Server(server, {
  cors: { origin: allowed, methods: ['GET', 'POST'] }
});

// authenticate socket via handshake auth.token
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) return next(new Error('token required'));
  try {
    socket.user = verifyToken(token);
    return next();
  } catch (err) {
    return next(new Error('invalid token'));
  }
});

io.on('connection', (socket) => {
  const user = socket.user;
  socket.join('general'); // default room
  io.emit('user_online', { userId: user.id, username: user.username });

  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    socket.emit('joined_room', { roomId });
  });

  socket.on('leave_room', (roomId) => {
    socket.leave(roomId);
    socket.emit('left_room', { roomId });
  });

  socket.on('user_typing', ({ roomId = 'general', isTyping }) => {
    socket.to(roomId).emit('user_typing', { userId: user.id, username: user.username, isTyping });
  });

  socket.on('message', (payload) => {
    // payload: { roomId, content, type, meta }
    const msg = store.addMessage(payload.roomId || 'general', {
      senderId: user.id,
      content: payload.content,
      type: payload.type || 'text',
      meta: payload.meta || {}
    });
    io.to(msg.roomId).emit('message', msg);
  });

  socket.on('react_message', ({ roomId='general', messageId, emoji }) => {
    const msg = store.reactMessage(roomId, messageId, user.id, emoji);
    if (msg) io.to(roomId).emit('message_reaction', { messageId, reactions: msg.reactions });
  });

  socket.on('message_seen', ({ roomId='general', messageId }) => {
    const msg = store.markSeen(roomId, messageId, user.id);
    if (msg) io.to(roomId).emit('message_seen', { messageId, seenBy: msg.seenBy });
  });

  socket.on('edit_message', ({ roomId='general', messageId, newContent }) => {
    const msg = store.editMessage(roomId, messageId, user.id, newContent);
    if (msg) io.to(roomId).emit('message_edited', msg);
    else socket.emit('error', { error: 'edit_failed' });
  });

  socket.on('delete_message', ({ roomId='general', messageId }) => {
    const force = socket.user.isAdmin;
    const msg = store.deleteMessage(roomId, messageId, user.id, force);
    if (msg) io.to(roomId).emit('message_deleted', { messageId });
    else socket.emit('error', { error: 'delete_failed' });
  });

  socket.on('disconnect', () => {
    io.emit('user_offline', { userId: user.id });
  });
});

server.listen(PORT, () => console.log(`Backend listening on ${PORT}`));