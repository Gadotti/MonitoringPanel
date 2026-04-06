'use strict';

const request  = require('supertest');
const path     = require('path');
const { EventEmitter } = require('events');

// ── fs mock ──
const fs = require('fs');
jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    existsSync:        jest.fn(),
    readFile:          jest.fn(),
    readdir:           jest.fn(),
    writeFile:         jest.fn(),
    unlink:            jest.fn(),
    createReadStream:  jest.fn(),
    createWriteStream: jest.fn(),
  };
});

// ── archiver mock ──
let mockArchive;

jest.mock('archiver', () => {
  return jest.fn(() => mockArchive);
});

const ROOT = '/fake/root';

function setupArchiveMock() {
  mockArchive = {
    pipe:      jest.fn(),
    file:      jest.fn(),
    directory: jest.fn(),
    finalize:  jest.fn(),
    on:        jest.fn(),
  };

  // createWriteStream returns a fake writable that emits 'close' when archiver.finalize() is called
  const fakeStream = new EventEmitter();
  fs.createWriteStream.mockReturnValue(fakeStream);

  // When finalize is called, emit 'close' on the output stream on next tick
  mockArchive.finalize.mockImplementation(() => {
    process.nextTick(() => fakeStream.emit('close'));
  });
}

// Import app AFTER mocks are set up
const { createApp } = require('../src/app');
const app = createApp({ rootDir: ROOT, PYTHON_CMD: 'python' });

// ============================================================ GET /api/backup
describe('GET /api/backup', () => {
  beforeEach(() => setupArchiveMock());
  afterEach(() => jest.clearAllMocks());

  test('configures archiver with cards-list.json and all directories', async () => {
    fs.existsSync.mockReturnValue(true);

    const res = await request(app).get('/api/backup');

    // Backup file is created inside _backup/
    expect(fs.createWriteStream).toHaveBeenCalledWith(
      path.join(ROOT, '_backup', 'backup.zip')
    );

    expect(mockArchive.pipe).toHaveBeenCalled();
    expect(mockArchive.file).toHaveBeenCalledWith(
      path.join(ROOT, 'cards', 'cards-list.json'),
      { name: 'cards/cards-list.json' }
    );

    const dirCalls = mockArchive.directory.mock.calls;
    const zipPrefixes = dirCalls.map(c => c[1]);
    expect(zipPrefixes).toContain('configs');
    expect(zipPrefixes).toContain('public/local-data-uptimes');
    expect(zipPrefixes).toContain('public/local-data-charts');
    expect(zipPrefixes).toContain('public/local-events');
    expect(zipPrefixes).toContain('public/local-pages');

    expect(mockArchive.finalize).toHaveBeenCalled();
  });

  test('skips non-existent directories', async () => {
    fs.existsSync.mockImplementation((p) => {
      return p === path.join(ROOT, 'cards', 'cards-list.json');
    });

    await request(app).get('/api/backup');

    expect(mockArchive.file).toHaveBeenCalledTimes(1);
    expect(mockArchive.directory).not.toHaveBeenCalled();
  });

  test('skips cards-list.json when it does not exist', async () => {
    fs.existsSync.mockReturnValue(false);

    await request(app).get('/api/backup');

    expect(mockArchive.file).not.toHaveBeenCalled();
    expect(mockArchive.directory).not.toHaveBeenCalled();
  });
});
