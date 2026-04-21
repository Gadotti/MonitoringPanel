'use strict';

const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  try {
    const derived  = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, 'hex');
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

const sessions = new Map();

function createSession(username, role) {
  const token = generateToken();
  sessions.set(token, { username, role });
  return token;
}

function validateSession(token) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  return { username: session.username, role: session.role };
}

function destroySession(token) {
  sessions.delete(token);
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  createSession,
  validateSession,
  destroySession,
};
