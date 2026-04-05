/**
 * @jest-environment jsdom
 */

const { loadScript } = require('./load-script');

beforeAll(() => {
  global.fetch = jest.fn();

  // Create required DOM elements before loading the IIFE
  document.body.innerHTML = `
    <div id="health-modal" class="modal">
      <div id="hc-grid"></div>
      <button id="btn-health-refresh"></button>
      <button id="close-health-modal"></button>
    </div>
    <button id="btn-health-check"></button>
  `;

  loadScript('healthcheck.js');
});

afterEach(() => {
  document.getElementById('health-modal').classList.remove('show');
  jest.clearAllMocks();
});

describe('Health Check modal', () => {
  test('opens modal and fetches /api/health on button click', () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'ok',
        uptime: 3661,
        timestamp: '2026-04-05T10:00:00.000Z',
      }),
    });

    document.getElementById('btn-health-check').click();

    expect(document.getElementById('health-modal').classList.contains('show')).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith('/api/health');
  });

  test('closes modal on close button click', () => {
    const modal = document.getElementById('health-modal');
    modal.classList.add('show');

    document.getElementById('close-health-modal').click();

    expect(modal.classList.contains('show')).toBe(false);
  });

  test('closes modal on Escape key', () => {
    const modal = document.getElementById('health-modal');
    modal.classList.add('show');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(modal.classList.contains('show')).toBe(false);
  });

  test('closes modal on backdrop click', () => {
    const modal = document.getElementById('health-modal');
    modal.classList.add('show');

    modal.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(modal.classList.contains('show')).toBe(false);
  });

  test('renders health data after successful fetch', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'ok',
        uptime: 90061,
        timestamp: '2026-04-05T10:00:00.000Z',
        websocket: { status: 'ok', port: 8123, connectedClients: 2 },
        watchers: {
          totalFiles: 1,
          watched: { 'data\\uptime.json': ['uptime-card'] },
        },
      }),
    });

    document.getElementById('btn-health-check').click();

    // Wait for async render
    await new Promise(r => setTimeout(r, 10));

    const grid = document.getElementById('hc-grid');
    const html = grid.innerHTML;

    // Server section
    expect(html).toContain('Online');
    expect(html).toContain('1d');
    expect(html).toContain('1h');

    // WebSocket section
    expect(html).toContain('8123');
    expect(html).toContain('2');

    // Watchers section
    expect(html).toContain('uptime.json');
    expect(html).toContain('uptime-card');
  });

  test('renders error message on fetch failure', async () => {
    global.fetch.mockRejectedValue(new Error('network error'));

    document.getElementById('btn-health-check').click();

    await new Promise(r => setTimeout(r, 10));

    const grid = document.getElementById('hc-grid');
    expect(grid.innerHTML).toContain('Erro ao obter status');
  });

  test('refresh button triggers new fetch', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', uptime: 10, timestamp: new Date().toISOString() }),
    });

    document.getElementById('btn-health-refresh').click();

    expect(global.fetch).toHaveBeenCalledWith('/api/health');
  });

  test('renders "Nenhum arquivo monitorado" when watchers are empty', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'ok',
        uptime: 5,
        timestamp: new Date().toISOString(),
        websocket: { status: 'ok', port: 8123, connectedClients: 0 },
        watchers: { totalFiles: 0, watched: {} },
      }),
    });

    document.getElementById('btn-health-check').click();
    await new Promise(r => setTimeout(r, 10));

    expect(document.getElementById('hc-grid').innerHTML).toContain('Nenhum arquivo monitorado');
  });
});
