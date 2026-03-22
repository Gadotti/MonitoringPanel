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

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Payload mínimo válido para POST */
const minimalPayload = () => ({
  notificationHook: '',
  servicesStatus: [
    {
      url:                 'https://exemplo.com',
      name:                'Exemplo',
      expectedHttpRespose: '200',
      notificationHookMode: 'when-offline',
    },
  ],
});

/** JSON de arquivo existente com campos de monitoramento preenchidos */
const existingFileData = () => JSON.stringify({
  notificationHook: 'https://hook.antigo.com',
  lastChecked: '2024-01-01T00:00:00Z',
  servicesStatus: [
    {
      url:                 'https://exemplo.com',
      name:                'Antigo',
      expectedHttpRespose: '200',
      notificationHookMode: 'off',
      status:              'online',
      lastStatusOnline:    '2024-06-01T10:00:00Z',
      lastStatusOffline:   '2024-05-30T08:00:00Z',
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/uptime-config
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/uptime-config', () => {
  afterEach(() => jest.clearAllMocks());

  test('retorna 400 quando o parâmetro "file" está ausente', async () => {
    const res = await request(app).get('/api/uptime-config');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/file/);
  });

  test('retorna 400 quando o caminho tenta path traversal fora do rootDir', async () => {
    const res = await request(app)
      .get('/api/uptime-config?file=' + encodeURIComponent('../../../etc/passwd'));

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/inválido/i);
  });

  test('retorna 404 quando o arquivo não existe', async () => {
    fs.existsSync.mockReturnValue(false);

    const res = await request(app)
      .get('/api/uptime-config?file=' + encodeURIComponent('public/local-data-uptimes/uptime.json'));

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/não encontrado/i);
  });

  test('retorna 200 com o JSON do arquivo quando existe e é válido', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFile.mockImplementation((p, enc, cb) => cb(null, existingFileData()));

    const res = await request(app)
      .get('/api/uptime-config?file=' + encodeURIComponent('public/local-data-uptimes/uptime.json'));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('servicesStatus');
    expect(res.body.servicesStatus).toHaveLength(1);
    expect(res.body.servicesStatus[0].url).toBe('https://exemplo.com');
  });

  test('retorna 500 quando a leitura do arquivo falha', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFile.mockImplementation((p, enc, cb) => cb(new Error('disk error')));

    const res = await request(app)
      .get('/api/uptime-config?file=' + encodeURIComponent('public/local-data-uptimes/uptime.json'));

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });

  test('retorna 500 quando o conteúdo do arquivo não é JSON válido', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFile.mockImplementation((p, enc, cb) => cb(null, 'NOT_JSON'));

    const res = await request(app)
      .get('/api/uptime-config?file=' + encodeURIComponent('public/local-data-uptimes/uptime.json'));

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/inválido/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/uptime-config
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/uptime-config', () => {
  afterEach(() => jest.clearAllMocks());

  test('retorna 400 quando o parâmetro "file" está ausente', async () => {
    const res = await request(app)
      .post('/api/uptime-config')
      .send(minimalPayload())
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/file/);
  });

  test('retorna 400 quando o caminho tenta path traversal fora do rootDir', async () => {
    const res = await request(app)
      .post('/api/uptime-config?file=' + encodeURIComponent('../../../etc/passwd'))
      .send(minimalPayload())
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/inválido/i);
  });

  test('retorna 400 quando "servicesStatus" não é um array', async () => {
    fs.readFile.mockImplementation((p, enc, cb) => cb(null, '{}'));
    fs.writeFile.mockImplementation((p, d, enc, cb) => cb(null));

    const res = await request(app)
      .post('/api/uptime-config?file=' + encodeURIComponent('public/uptime.json'))
      .send({ notificationHook: '', servicesStatus: 'invalido' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/array/i);
  });

  test('retorna 200 e salva quando os dados são válidos', async () => {
    fs.readFile.mockImplementation((p, enc, cb) => cb(null, '{}'));
    fs.writeFile.mockImplementation((p, d, enc, cb) => cb(null));

    const res = await request(app)
      .post('/api/uptime-config?file=' + encodeURIComponent('public/uptime.json'))
      .send(minimalPayload())
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
  });

  test('preserva status e timestamps de serviços existentes quando a URL bate', async () => {
    fs.readFile.mockImplementation((p, enc, cb) => cb(null, existingFileData()));

    let writtenContent = null;
    fs.writeFile.mockImplementation((p, data, enc, cb) => {
      writtenContent = JSON.parse(data);
      cb(null);
    });

    const payload = {
      notificationHook: 'https://novo-hook.com',
      servicesStatus: [
        {
          url:                 'https://exemplo.com',
          name:                'Novo Nome',
          expectedHttpRespose: '200-299',
          notificationHookMode: 'when-online',
        },
      ],
    };

    const res = await request(app)
      .post('/api/uptime-config?file=' + encodeURIComponent('public/uptime.json'))
      .send(payload)
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);

    const saved = writtenContent.servicesStatus[0];
    // Campos editáveis devem ser os novos
    expect(saved.name).toBe('Novo Nome');
    expect(saved.expectedHttpRespose).toBe('200-299');
    expect(saved.notificationHookMode).toBe('when-online');
    // Campos de monitoramento devem ser preservados do arquivo original
    expect(saved.status).toBe('online');
    expect(saved.lastStatusOnline).toBe('2024-06-01T10:00:00Z');
    expect(saved.lastStatusOffline).toBe('2024-05-30T08:00:00Z');
  });

  test('novos serviços (URL não existente) recebem valores padrão de monitoramento', async () => {
    fs.readFile.mockImplementation((p, enc, cb) => cb(null, existingFileData()));

    let writtenContent = null;
    fs.writeFile.mockImplementation((p, data, enc, cb) => {
      writtenContent = JSON.parse(data);
      cb(null);
    });

    const payload = {
      notificationHook: '',
      servicesStatus: [
        {
          url:                 'https://novo-servico.com',
          name:                'Novo',
          expectedHttpRespose: '200',
          notificationHookMode: 'when-offline',
        },
      ],
    };

    const res = await request(app)
      .post('/api/uptime-config?file=' + encodeURIComponent('public/uptime.json'))
      .send(payload)
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);

    const saved = writtenContent.servicesStatus[0];
    expect(saved.url).toBe('https://novo-servico.com');
    expect(saved.status).toBe('offline');
    expect(saved.lastStatusOnline).toBe('');
    expect(saved.lastStatusOffline).toBe('');
  });

  test('preserva lastChecked e outros campos do arquivo original não relacionados a serviços', async () => {
    fs.readFile.mockImplementation((p, enc, cb) => cb(null, existingFileData()));

    let writtenContent = null;
    fs.writeFile.mockImplementation((p, data, enc, cb) => {
      writtenContent = JSON.parse(data);
      cb(null);
    });

    await request(app)
      .post('/api/uptime-config?file=' + encodeURIComponent('public/uptime.json'))
      .send(minimalPayload())
      .set('Content-Type', 'application/json');

    expect(writtenContent.lastChecked).toBe('2024-01-01T00:00:00Z');
  });

  test('funciona mesmo quando o arquivo ainda não existe (arquivo corrompido ou novo)', async () => {
    // readFile falha — simula arquivo inexistente ou ilegível
    fs.readFile.mockImplementation((p, enc, cb) => cb(new Error('file not found')));
    fs.writeFile.mockImplementation((p, d, enc, cb) => cb(null));

    const res = await request(app)
      .post('/api/uptime-config?file=' + encodeURIComponent('public/uptime.json'))
      .send(minimalPayload())
      .set('Content-Type', 'application/json');

    // Deve salvar com defaults, sem quebrar
    expect(res.status).toBe(200);
  });

  test('retorna 500 quando a escrita do arquivo falha', async () => {
    fs.readFile.mockImplementation((p, enc, cb) => cb(null, '{}'));
    fs.writeFile.mockImplementation((p, d, enc, cb) => cb(new Error('write error')));

    const res = await request(app)
      .post('/api/uptime-config?file=' + encodeURIComponent('public/uptime.json'))
      .send(minimalPayload())
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });

  test('atualiza o notificationHook global quando fornecido', async () => {
    fs.readFile.mockImplementation((p, enc, cb) => cb(null, existingFileData()));

    let writtenContent = null;
    fs.writeFile.mockImplementation((p, data, enc, cb) => {
      writtenContent = JSON.parse(data);
      cb(null);
    });

    const payload = { notificationHook: 'https://novo-webhook.com', servicesStatus: [] };

    await request(app)
      .post('/api/uptime-config?file=' + encodeURIComponent('public/uptime.json'))
      .send(payload)
      .set('Content-Type', 'application/json');

    expect(writtenContent.notificationHook).toBe('https://novo-webhook.com');
  });
});