'use strict';

const request = require('supertest');
const fs      = require('fs');
const { createApp } = require('../src/app');

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync:       jest.fn(),
  readFile:         jest.fn(),
  readdir:          jest.fn(),
  writeFile:        jest.fn(),
  unlink:           jest.fn(),
  createReadStream: jest.fn(),
}));

const ROOT = '/fake/root';
const app  = createApp({ rootDir: ROOT, PYTHON_CMD: 'python' });

// ============================================================ GET /api/logs
describe('GET /api/logs', () => {
  afterEach(() => jest.clearAllMocks());

  test('retorna lista de arquivos .log ordenada', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readdir.mockImplementation((p, cb) =>
      cb(null, ['script_b.log', 'script_a.log', 'noincluir.txt', 'outro.json'])
    );

    const res = await request(app).get('/api/logs');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(['script_a.log', 'script_b.log']);
  });

  test('retorna [] quando a pasta não existe', async () => {
    fs.existsSync.mockReturnValue(false);

    const res = await request(app).get('/api/logs');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('retorna [] quando a pasta está vazia', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readdir.mockImplementation((p, cb) => cb(null, []));

    const res = await request(app).get('/api/logs');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('ignora arquivos sem extensão .log', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readdir.mockImplementation((p, cb) =>
      cb(null, ['run.log', 'config.json', 'readme.txt', 'data.csv'])
    );

    const res = await request(app).get('/api/logs');

    expect(res.body).toEqual(['run.log']);
  });

  test('retorna 500 quando readdir falha', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readdir.mockImplementation((p, cb) => cb(new Error('permission denied')));

    const res = await request(app).get('/api/logs');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });
});

// ============================================================ GET /api/logs/:filename
describe('GET /api/logs/:filename', () => {
  afterEach(() => jest.clearAllMocks());

  test('retorna conteúdo do arquivo como text/plain', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFile.mockImplementation((p, enc, cb) => cb(null, '[INFO] Script concluído.\n[WARN] Aviso de teste.'));

    const res = await request(app).get('/api/logs/script.log');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toContain('[INFO] Script concluído.');
  });

  test('retorna 404 quando arquivo não existe', async () => {
    fs.existsSync.mockReturnValue(false);

    const res = await request(app).get('/api/logs/naoexiste.log');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  test('retorna 400 para nome com path traversal (..)', async () => {
    const res = await request(app).get('/api/logs/..%2F..%2Fetc%2Fpasswd');

    expect(res.status).toBe(400);
  });

  test('retorna 400 para arquivo sem extensão .log', async () => {
    const res = await request(app).get('/api/logs/config.json');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('retorna 500 quando readFile falha', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFile.mockImplementation((p, enc, cb) => cb(new Error('read error')));

    const res = await request(app).get('/api/logs/script.log');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });

  test('lê o arquivo do caminho correto (scripts/log/)', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFile.mockImplementation((p, enc, cb) => cb(null, 'ok'));

    await request(app).get('/api/logs/check.log');

    const [readPath] = fs.readFile.mock.calls[0];
    expect(readPath).toContain('scripts');
    expect(readPath).toContain('logs');
    expect(readPath).toContain('check.log');
  });
});