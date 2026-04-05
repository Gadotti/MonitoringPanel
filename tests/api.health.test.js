'use strict';

const request = require('supertest');
const { createApp } = require('../src/app');

// ============================================================ GET /api/health
describe('GET /api/health', () => {

  test('returns base health info without getHealthInfo callback', async () => {
    const app = createApp({ rootDir: '/fake/root' });

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
    expect(res.body.uptime).toBeGreaterThanOrEqual(0);
    expect(res.body.timestamp).toBeDefined();
    // Should NOT have websocket/watchers when no callback
    expect(res.body.websocket).toBeUndefined();
    expect(res.body.watchers).toBeUndefined();
  });

  test('merges data from getHealthInfo callback', async () => {
    const app = createApp({
      rootDir: '/fake/root',
      getHealthInfo: () => ({
        websocket: {
          status: 'ok',
          port: 8123,
          connectedClients: 3,
        },
        watchers: {
          totalFiles: 2,
          watched: {
            'public\\local-data\\uptime.json': ['uptime-card'],
            'public\\local-events\\events.csv': ['events-card', 'chart-card'],
          },
        },
      }),
    });

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.uptime).toBeGreaterThanOrEqual(0);
    expect(res.body.timestamp).toBeDefined();

    // WebSocket info
    expect(res.body.websocket).toEqual({
      status: 'ok',
      port: 8123,
      connectedClients: 3,
    });

    // Watchers info
    expect(res.body.watchers.totalFiles).toBe(2);
    expect(Object.keys(res.body.watchers.watched)).toHaveLength(2);
    expect(res.body.watchers.watched['public\\local-data\\uptime.json']).toEqual(['uptime-card']);
    expect(res.body.watchers.watched['public\\local-events\\events.csv']).toEqual(['events-card', 'chart-card']);
  });

  test('returns ok even if getHealthInfo returns empty object', async () => {
    const app = createApp({
      rootDir: '/fake/root',
      getHealthInfo: () => ({}),
    });

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('includes uptime as integer seconds', async () => {
    const app = createApp({ rootDir: '/fake/root' });

    const res = await request(app).get('/api/health');

    expect(Number.isInteger(res.body.uptime)).toBe(true);
  });

  test('timestamp is valid ISO string', async () => {
    const app = createApp({ rootDir: '/fake/root' });

    const res = await request(app).get('/api/health');

    const parsed = new Date(res.body.timestamp);
    expect(isNaN(parsed.getTime())).toBe(false);
  });
});
