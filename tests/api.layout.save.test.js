'use strict';

const request = require('supertest');
const fs      = require('fs');
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

describe('POST /api/layout/:viewName', () => {
  afterEach(() => jest.clearAllMocks());

  test('salva layout e retorna 200', async () => {
    fs.writeFile.mockImplementation((p, data, enc, cb) => cb(null));

    const payload = [{ id: 'card-1', columns: 3, rows: 2 }];
    const res = await request(app)
      .post('/api/layout/default')
      .send(payload)
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(fs.writeFile).toHaveBeenCalledTimes(1);

    // Verifica que o caminho contém o nome da view
    const [writtenPath] = fs.writeFile.mock.calls[0];
    expect(writtenPath).toContain('layout.config-default.json');
  });

  test('retorna 500 quando a escrita falha', async () => {
    fs.writeFile.mockImplementation((p, data, enc, cb) => cb(new Error('write error')));

    const res = await request(app)
      .post('/api/layout/default')
      .send([])
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(500);
  });

  test('usa o nome correto da view no caminho do arquivo', async () => {
    fs.writeFile.mockImplementation((p, data, enc, cb) => cb(null));

    await request(app)
      .post('/api/layout/infra')
      .send([])
      .set('Content-Type', 'application/json');

    const [writtenPath] = fs.writeFile.mock.calls[0];
    expect(writtenPath).toContain('layout.config-infra.json');
  });
});
