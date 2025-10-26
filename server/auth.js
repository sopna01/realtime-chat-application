// backend/auth.js
const jwt = require('jsonwebtoken');
const secret = process.env.JWT_SECRET || 'dev-secret';

function signToken(payload) {
  return jwt.sign(payload, secret, { expiresIn: '8h' });
}

function verifyToken(token) {
  return jwt.verify(token, secret);
}

function requireAuthMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Missing Authorization header' });
  const parts = auth.split(' ');
  const token = parts.length === 2 ? parts[1] : parts[0];
  try {
    req.user = verifyToken(token);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { signToken, verifyToken, requireAuthMiddleware };