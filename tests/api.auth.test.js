'use strict';

const request  = require('supertest');
const path     = require('path');
const fs       = require('fs');
const os       = require('os');
const { createApp } = require('../src/app');
const { hashPassword, createSession } = require('../src/auth');

let app;
let tmpDir;
let usersPath;

beforeAll(() => {
  tmpDir    = fs.mkdtempSync(path.join(os.tmpdir(), 'painel-auth-test-'));
  usersPath = path.join(tmpDir, 'users.json');

  const configsDir = path.join(tmpDir, 'configs');
  fs.mkdirSync(configsDir, { recursive: true });

  // Create a test user
  const { salt, hash } = hashPassword('supersecret123');
  const users = [
    { name: 'Test User', username: 'testuser', role: 'editor', salt, hash, createdAt: new Date().toISOString() },
    { name: 'Viewer User', username: 'viewer', role: 'viewer', ...hashPassword('viewerpassword!'), createdAt: new Date().toISOString() },
  ];

  fs.writeFileSync(
    path.join(configsDir, 'users.json'),
    JSON.stringify(users, null, 2),
    'utf8'
  );

  // Minimal configs needed by the app
  fs.writeFileSync(path.join(configsDir, 'views.json'), '[]', 'utf8');

  const cardsDir = path.join(tmpDir, 'cards');
  fs.mkdirSync(cardsDir);
  fs.writeFileSync(path.join(cardsDir, 'cards-list.json'), '[]', 'utf8');

  app = createApp({ rootDir: tmpDir });
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─── GET /api/auth/status ───

describe('GET /api/auth/status', () => {
  test('returns authEnabled true when users exist', async () => {
    const res = await request(app).get('/api/auth/status');
    expect(res.status).toBe(200);
    expect(res.body.authEnabled).toBe(true);
  });
});

// ─── POST /api/auth/login ───

describe('POST /api/auth/login', () => {
  test('returns 200 with token and role on valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'supersecret123' });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token).toHaveLength(64);
    expect(res.body.role).toBe('editor');
    expect(res.body.name).toBe('Test User');
  });

  test('returns 401 for wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  test('returns 401 for unknown user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody', password: 'supersecret123' });

    expect(res.status).toBe(401);
  });

  test('returns 401 without body', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/auth/logout ───

describe('POST /api/auth/logout', () => {
  test('returns 200 and invalidates the token', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'supersecret123' });

    const token = loginRes.body.token;

    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    expect(logoutRes.status).toBe(200);

    // Token should now be invalid
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(401);
  });

  test('returns 200 even without a token (idempotent)', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
  });
});

// ─── GET /api/auth/me ───

describe('GET /api/auth/me', () => {
  test('returns session info for valid token', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'supersecret123' });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.username).toBe('testuser');
    expect(res.body.role).toBe('editor');
    expect(res.body.name).toBe('Test User');
  });

  test('returns 401 for invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalidtoken');

    expect(res.status).toBe(401);
  });

  test('returns 401 without Authorization header', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

// ─── Auth middleware on /api/* ───

describe('requireAuth middleware', () => {
  test('returns 401 on protected GET without token', async () => {
    const res = await request(app).get('/api/views');
    expect(res.status).toBe(401);
  });

  test('allows request with valid token', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'supersecret123' });

    const res = await request(app)
      .get('/api/views')
      .set('Authorization', `Bearer ${loginRes.body.token}`);

    expect(res.status).toBe(200);
  });
});

// ─── requireRole middleware ───

describe('requireRole middleware', () => {
  let viewerToken;
  let editorToken;

  beforeAll(async () => {
    const vRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'viewer', password: 'viewerpassword!' });
    viewerToken = vRes.body.token;

    const eRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'supersecret123' });
    editorToken = eRes.body.token;
  });

  test('viewer can GET /api/views', async () => {
    const res = await request(app)
      .get('/api/views')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(200);
  });

  test('viewer cannot POST /api/views (403)', async () => {
    const res = await request(app)
      .post('/api/views')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ title: 'Test' });
    expect(res.status).toBe(403);
  });

  test('editor can POST /api/views', async () => {
    const res = await request(app)
      .post('/api/views')
      .set('Authorization', `Bearer ${editorToken}`)
      .send({ title: 'TestView' });
    expect([200, 201, 409]).toContain(res.status);
  });

  test('viewer cannot DELETE /api/views/:viewName (403)', async () => {
    const res = await request(app)
      .delete('/api/views/testview')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(403);
  });
});

// ─── Rate limiting ───

describe('rate limiting on /api/auth/login', () => {
  // Fresh app instance so the loginAttempts Map starts at zero
  let rlApp;
  beforeAll(() => { rlApp = createApp({ rootDir: tmpDir }); });

  test('blocks after 5 failed attempts from the same IP', async () => {
    const results = [];
    for (let i = 0; i < 6; i++) {
      const res = await request(rlApp)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'wrongpassword' });
      results.push(res.status);
    }
    // First 5 are 401, 6th is 429
    expect(results.slice(0, 5).every(s => s === 401)).toBe(true);
    expect(results[5]).toBe(429);
  });
});
