'use strict';

const request          = require('supertest');
const { EventEmitter } = require('events');
const { createApp }    = require('../src/app');

// Necessário para que express.static não trave ao acessar /fake/root/public
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync:       jest.fn(),
  readFile:         jest.fn(),
  writeFile:        jest.fn(),
  createReadStream: jest.fn(),
}));

const ROOT      = '/fake/root';
const spawnMock = jest.fn();
const app       = createApp({ rootDir: ROOT, PYTHON_CMD: 'python', spawn: spawnMock });

/**
 * Retorna uma FACTORY (não o proc diretamente).
 * Deve ser usada com mockImplementation(() => makeFakePython(...)),
 * nunca com mockReturnValue(makeFakePython(...)).
 *
 * Motivo: mockReturnValue chama makeFakePython imediatamente, agendando
 * o setImmediate antes de a requisição HTTP existir. Quando o setImmediate
 * dispara, nenhum listener foi anexado ao proc — os eventos são emitidos
 * no vazio e o route handler nunca recebe a resposta (timeout).
 *
 * Com mockImplementation, makeFakePython só é chamado quando spawnFn()
 * é invocado dentro do route handler, momento em que os listeners já
 * foram (ou estão prestes a ser) anexados de forma síncrona.
 */
function makeFakePython({ stdout = '', stderr = '', exitCode = 0 } = {}) {
  const proc  = new EventEmitter();
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();

  setImmediate(() => {
    if (stdout) proc.stdout.emit('data', Buffer.from(stdout));
    if (stderr) proc.stderr.emit('data', Buffer.from(stderr));
    proc.emit('close', exitCode);
  });

  return proc;
}

describe('POST /api/chart-data', () => {
  afterEach(() => jest.clearAllMocks());

  test('retorna 400 quando scriptPath está ausente', async () => {
    const res = await request(app)
      .post('/api/chart-data')
      .send({ sourceFile: 'data.csv' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/scriptPath/);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  test('retorna 200 com stdout quando o script executa com sucesso', async () => {
    const fakeOutput = JSON.stringify({ labels: ['Seg', 'Ter'], data: [10, 20] });
    // ✅ mockImplementation: makeFakePython é chamado quando spawnFn() é invocado
    spawnMock.mockImplementation(() => makeFakePython({ stdout: fakeOutput, exitCode: 0 }));

    const res = await request(app)
      .post('/api/chart-data')
      .send({ scriptPath: 'scripts/count_events_by_weekday.py', sourceFile: 'data/events.csv' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.output).toBe(fakeOutput);
  });

  test('retorna 500 quando o script falha (exit code != 0)', async () => {
    spawnMock.mockImplementation(() =>
      makeFakePython({ stderr: 'ModuleNotFoundError', exitCode: 1 })
    );

    const res = await request(app)
      .post('/api/chart-data')
      .send({ scriptPath: 'scripts/count_events_by_weekday.py', sourceFile: 'data/events.csv' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/code 1/);
    expect(res.body.stderr).toBe('ModuleNotFoundError');
  });

  test('chama spawn com o executável python configurado', async () => {
    const customSpawn = jest.fn().mockImplementation(() =>
      makeFakePython({ stdout: '{}', exitCode: 0 })
    );
    const appPython3 = createApp({ rootDir: ROOT, PYTHON_CMD: 'python3', spawn: customSpawn });

    await request(appPython3)
      .post('/api/chart-data')
      .send({ scriptPath: 'scripts/test.py', sourceFile: 'data.csv' })
      .set('Content-Type', 'application/json');

    expect(customSpawn).toHaveBeenCalledWith(
      'python3',
      expect.arrayContaining([expect.stringContaining('test.py')])
    );
  });

  test('retorna output trimado (sem espaços/newlines extras)', async () => {
    spawnMock.mockImplementation(() =>
      makeFakePython({ stdout: '  {"labels":[],"data":[]}  \n', exitCode: 0 })
    );

    const res = await request(app)
      .post('/api/chart-data')
      .send({ scriptPath: 'scripts/s.py', sourceFile: 'data.csv' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.output).toBe('{"labels":[],"data":[]}');
  });
});