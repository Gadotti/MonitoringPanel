'use strict';

const {
  hashPassword,
  verifyPassword,
  generateToken,
  createSession,
  validateSession,
  destroySession,
  loadSessions,
  exportSessions,
} = require('../src/auth');

// ─── hashPassword / verifyPassword ───

describe('hashPassword', () => {
  test('returns salt and hash as hex strings', () => {
    const { salt, hash } = hashPassword('correct-horse-battery-staple');
    expect(typeof salt).toBe('string');
    expect(typeof hash).toBe('string');
    expect(salt).toHaveLength(64);  // 32 bytes hex
    expect(hash).toHaveLength(128); // 64 bytes hex
  });

  test('same password produces different salts each call', () => {
    const a = hashPassword('aaaabbbbcccc');
    const b = hashPassword('aaaabbbbcccc');
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe('verifyPassword', () => {
  test('returns true for correct password', () => {
    const { salt, hash } = hashPassword('correct-horse-battery-staple');
    expect(verifyPassword('correct-horse-battery-staple', salt, hash)).toBe(true);
  });

  test('returns false for wrong password', () => {
    const { salt, hash } = hashPassword('correct-horse-battery-staple');
    expect(verifyPassword('wrong-password-here', salt, hash)).toBe(false);
  });

  test('returns false for malformed hash', () => {
    expect(verifyPassword('any-password', 'badsalt', 'badhash')).toBe(false);
  });
});

// ─── generateToken ───

describe('generateToken', () => {
  test('returns a 64-char hex string', () => {
    const token = generateToken();
    expect(typeof token).toBe('string');
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(token)).toBe(true);
  });

  test('each call returns a unique token', () => {
    expect(generateToken()).not.toBe(generateToken());
  });
});

// ─── createSession / validateSession / destroySession ───

describe('session lifecycle', () => {
  test('createSession returns a token that validates correctly', () => {
    const token   = createSession('alice', 'editor');
    const session = validateSession(token);
    expect(session).not.toBeNull();
    expect(session.username).toBe('alice');
    expect(session.role).toBe('editor');
  });

  test('validateSession returns null for unknown token', () => {
    expect(validateSession('not-a-real-token')).toBeNull();
  });

  test('validateSession returns null for null/undefined', () => {
    expect(validateSession(null)).toBeNull();
    expect(validateSession(undefined)).toBeNull();
    expect(validateSession('')).toBeNull();
  });

  test('destroySession invalidates the token', () => {
    const token = createSession('bob', 'viewer');
    expect(validateSession(token)).not.toBeNull();
    destroySession(token);
    expect(validateSession(token)).toBeNull();
  });

  test('destroySession on unknown token does not throw', () => {
    expect(() => destroySession('non-existent')).not.toThrow();
  });

  test('createSession replaces existing session for same user', () => {
    const token1 = createSession('carol', 'viewer');
    const token2 = createSession('carol', 'viewer');
    expect(token1).not.toBe(token2);
    expect(validateSession(token1)).toBeNull();
    expect(validateSession(token2)).not.toBeNull();
  });
});

// ─── loadSessions / exportSessions ───

describe('loadSessions / exportSessions', () => {
  beforeEach(() => {
    // Start clean
    loadSessions({});
  });

  test('exportSessions returns empty object when no sessions', () => {
    expect(exportSessions()).toEqual({});
  });

  test('loadSessions populates sessions from plain object', () => {
    loadSessions({ 'tok-abc': { username: 'dave', role: 'editor' } });
    const s = validateSession('tok-abc');
    expect(s).not.toBeNull();
    expect(s.username).toBe('dave');
    expect(s.role).toBe('editor');
  });

  test('loadSessions clears existing sessions before loading', () => {
    const token = createSession('eve', 'viewer');
    loadSessions({ 'tok-xyz': { username: 'frank', role: 'viewer' } });
    expect(validateSession(token)).toBeNull();
    expect(validateSession('tok-xyz')).not.toBeNull();
  });

  test('loadSessions ignores entries with missing fields', () => {
    loadSessions({ 'bad1': { username: 'ghost' }, 'bad2': { role: 'viewer' }, 'bad3': null });
    expect(validateSession('bad1')).toBeNull();
    expect(validateSession('bad2')).toBeNull();
    expect(validateSession('bad3')).toBeNull();
  });

  test('exportSessions round-trips through loadSessions', () => {
    createSession('heidi', 'editor');
    const snapshot = exportSessions();
    const entries  = Object.values(snapshot);
    expect(entries).toHaveLength(1);
    expect(entries[0].username).toBe('heidi');

    loadSessions(snapshot);
    const token = Object.keys(snapshot)[0];
    expect(validateSession(token)).toMatchObject({ username: 'heidi', role: 'editor' });
  });
});

