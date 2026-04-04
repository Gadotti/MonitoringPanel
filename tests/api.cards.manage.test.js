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

function sampleCards() {
  return [
    { id: 'card-a', title: 'Card A', cardType: 'chart' },
    { id: 'card-b', title: 'Card B', cardType: 'list' },
  ];
}

// ============================================================ POST /api/cards
describe('POST /api/cards', () => {
  afterEach(() => jest.clearAllMocks());

  test('salva array de cards com sucesso', async () => {
    const cards = sampleCards();
    let savedData = null;

    fs.writeFile.mockImplementation((p, data, enc, cb) => {
      savedData = JSON.parse(data);
      cb(null);
    });

    const res = await request(app)
      .post('/api/cards')
      .send(cards)
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(savedData).toEqual(cards);
  });

  test('retorna 400 quando body não é array', async () => {
    const res = await request(app)
      .post('/api/cards')
      .send({ id: 'not-array' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/array/i);
  });

  test('retorna 400 quando um card não tem id', async () => {
    const res = await request(app)
      .post('/api/cards')
      .send([{ title: 'No ID', cardType: 'chart' }])
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/id/i);
  });

  test('retorna 400 quando um card não tem cardType', async () => {
    const res = await request(app)
      .post('/api/cards')
      .send([{ id: 'missing-type', title: 'No Type' }])
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cardType/i);
  });

  test('retorna 400 quando há IDs duplicados', async () => {
    const res = await request(app)
      .post('/api/cards')
      .send([
        { id: 'dup', title: 'A', cardType: 'chart' },
        { id: 'dup', title: 'B', cardType: 'list' },
      ])
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/duplicado/i);
  });

  test('retorna 500 quando a escrita falha', async () => {
    fs.writeFile.mockImplementation((p, data, enc, cb) => cb(new Error('write error')));

    const res = await request(app)
      .post('/api/cards')
      .send(sampleCards())
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });

  test('aceita array vazio', async () => {
    fs.writeFile.mockImplementation((p, data, enc, cb) => cb(null));

    const res = await request(app)
      .post('/api/cards')
      .send([])
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
  });
});

// ============================================================ DELETE /api/cards/:cardId
describe('DELETE /api/cards/:cardId', () => {
  afterEach(() => jest.clearAllMocks());

  test('remove um card existente', async () => {
    const cards = sampleCards();
    fs.readFile.mockImplementation((p, enc, cb) => cb(null, JSON.stringify(cards)));

    let savedData = null;
    fs.writeFile.mockImplementation((p, data, enc, cb) => {
      savedData = JSON.parse(data);
      cb(null);
    });

    const res = await request(app).delete('/api/cards/card-a');

    expect(res.status).toBe(200);
    expect(savedData).toHaveLength(1);
    expect(savedData[0].id).toBe('card-b');
  });

  test('retorna 404 quando o card não existe', async () => {
    fs.readFile.mockImplementation((p, enc, cb) => cb(null, JSON.stringify(sampleCards())));

    const res = await request(app).delete('/api/cards/inexistente');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/inexistente/);
  });

  test('retorna 500 quando a leitura falha', async () => {
    fs.readFile.mockImplementation((p, enc, cb) => cb(new Error('read error')));

    const res = await request(app).delete('/api/cards/card-a');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });

  test('retorna 500 quando o JSON é inválido', async () => {
    fs.readFile.mockImplementation((p, enc, cb) => cb(null, 'NOT_JSON'));

    const res = await request(app).delete('/api/cards/card-a');

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/interpretar/i);
  });

  test('retorna 500 quando a escrita falha', async () => {
    fs.readFile.mockImplementation((p, enc, cb) => cb(null, JSON.stringify(sampleCards())));
    fs.writeFile.mockImplementation((p, data, enc, cb) => cb(new Error('write error')));

    const res = await request(app).delete('/api/cards/card-a');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });
});
