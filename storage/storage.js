// backend/storage.js
const { v4: uuidv4 } = require('uuid');

const users = {}; // id -> {id, username, isAdmin}
const rooms = { general: { id: 'general', name: 'General', messages: [] } };

function createUser(username, isAdmin=false) {
  // re-use if exists by username (demo behavior)
  const existing = Object.values(users).find(u => u.username === username);
  if (existing) return existing;
  const id = uuidv4();
  const u = { id, username, isAdmin };
  users[id] = u;
  return u;
}

function getUser(id) { return users[id]; }

function addMessage(roomId, { senderId, content, type='text', meta={} }) {
  const msg = {
    id: uuidv4(),
    roomId,
    senderId,
    content,
    type,
    meta,
    createdAt: Date.now(),
    edited: false,
    deleted: false,
    reactions: {}, // emoji -> [userId]
    seenBy: []
  };
  if (!rooms[roomId]) rooms[roomId] = { id: roomId, name: roomId, messages: [] };
  rooms[roomId].messages.push(msg);
  return msg;
}

function getMessages(roomId, { limit=50, before } = {}) {
  const list = (rooms[roomId] && rooms[roomId].messages) || [];
  // return ascending limited list (simple pagination)
  let filtered = list.slice();
  if (before) filtered = filtered.filter(m => m.createdAt < before);
  return filtered.slice(-limit);
}

function reactMessage(roomId, messageId, userId, emoji) {
  const room = rooms[roomId]; if (!room) return null;
  const msg = room.messages.find(m => m.id === messageId); if (!msg) return null;
  msg.reactions[emoji] = msg.reactions[emoji] || [];
  if (!msg.reactions[emoji].includes(userId)) msg.reactions[emoji].push(userId);
  return msg;
}

function markSeen(roomId, messageId, userId) {
  const room = rooms[roomId]; if (!room) return null;
  const msg = room.messages.find(m => m.id === messageId); if (!msg) return null;
  if (!msg.seenBy.includes(userId)) msg.seenBy.push(userId);
  return msg;
}

function editMessage(roomId, messageId, userId, newContent) {
  const room = rooms[roomId]; if (!room) return null;
  const msg = room.messages.find(m => m.id === messageId); if (!msg) return null;
  if (msg.senderId !== userId) return null;
  msg.content = newContent; msg.edited = true;
  return msg;
}

function deleteMessage(roomId, messageId, userId, force=false) {
  const room = rooms[roomId]; if (!room) return null;
  const msg = room.messages.find(m => m.id === messageId); if (!msg) return null;
  if (!force && msg.senderId !== userId) return null;
  msg.deleted = true;
  msg.content = '[message deleted]';
  return msg;
}

module.exports = {
  users, rooms,
  createUser, getUser, addMessage, getMessages,
  reactMessage, markSeen, editMessage, deleteMessage
};