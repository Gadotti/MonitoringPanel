'use strict';

const request = require('supertest');
const fs      = require('fs');
const path    = require('path');
const { createApp } = require('../src/app');

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync:       jest.fn(),
  readFile:         jest.fn(),
  writeFile:        jest.fn(),
  createReadStream: jest.fn(),
}));

const ROOT = '/fake/root';
const app  = createApp({ rootDir: ROOT, PYTHON_CMD: 'python' });

describe('GET /api/layout/:viewName', () => {
  afterEach(() => jest.clearAllMocks());

  test('retorna [] quando o arquivo de layout não existe', async () => {
    fs.existsSync.mockReturnValue(false);

    const res = await request(app).get('/api/layout/default');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('retorna o layout quando o arquivo existe e é JSON válido', async () => {
    const layout = [{ id: 'card-1', columns: 2, rows: 1 }];
    fs.existsSync.mockReturnValue(true);
    fs.readFile.mockImplementation((p, enc, cb) => cb(null, JSON.stringify(layout)));

    const res = await request(app).get('/api/layout/default');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(layout);
  });

  test('retorna 500 quando ocorre erro de leitura', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFile.mockImplementation((p, enc, cb) => cb(new Error('disk error')));

    const res = await request(app).get('/api/layout/default');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });

  test('retorna 500 quando o JSON do layout é inválido', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFile.mockImplementation((p, enc, cb) => cb(null, 'NOT_JSON'));

    const res = await request(app).get('/api/layout/default');

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/interpretar/);
  });
});
