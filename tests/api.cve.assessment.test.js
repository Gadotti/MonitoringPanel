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

function makeSampleReport() {
  return {
    last_scan: '2026-03-21 21:02:06',
    report_items: [
      {
        id: 'FortiOS_7.6.0',
        name: 'FortiOS',
        url: 'https://example.com',
        current_version: '7.6.0',
        cves: [
          {
            cve_id: 'CVE-2024-21762',
            description: 'Test description',
            severity: 'CRITICAL',
            assessment: '',
            claude_ai_assessment: 'Test AI note'
          }
        ]
      }
    ]
  };
}

function sampleReportJson() {
  return JSON.stringify(makeSampleReport());
}

const FILE_PARAM = encodeURIComponent('public/local-events/cve-report.json');

describe('POST /api/cve-assessment', () => {
  afterEach(() => jest.clearAllMocks());

  test('retorna 400 quando o parâmetro "file" está ausente', async () => {
    const res = await request(app)
      .post('/api/cve-assessment')
      .send({ reportItemId: 'FortiOS_7.6.0', cveId: 'CVE-2024-21762', assessment: 'Accepted Risk' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/file/);
  });

  test('retorna 400 para path traversal', async () => {
    const res = await request(app)
      .post(`/api/cve-assessment?file=${encodeURIComponent('../../../etc/passwd')}`)
      .send({ reportItemId: 'FortiOS_7.6.0', cveId: 'CVE-2024-21762', assessment: 'Accepted Risk' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/inválido/i);
  });

  test('retorna 400 quando "reportItemId" está ausente', async () => {
    fs.existsSync.mockReturnValue(true);

    const res = await request(app)
      .post(`/api/cve-assessment?file=${FILE_PARAM}`)
      .send({ cveId: 'CVE-2024-21762', assessment: 'Accepted Risk' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/reportItemId/);
  });

  test('retorna 400 quando "cveId" está ausente', async () => {
    fs.existsSync.mockReturnValue(true);

    const res = await request(app)
      .post(`/api/cve-assessment?file=${FILE_PARAM}`)
      .send({ reportItemId: 'FortiOS_7.6.0', assessment: 'Accepted Risk' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cveId/);
  });

  test('retorna 400 para valor de assessment inválido', async () => {
    fs.existsSync.mockReturnValue(true);

    const res = await request(app)
      .post(`/api/cve-assessment?file=${FILE_PARAM}`)
      .send({ reportItemId: 'FortiOS_7.6.0', cveId: 'CVE-2024-21762', assessment: 'Valor Invalido' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/assessment/i);
  });

  test('retorna 400 quando "assessment" está ausente no body', async () => {
    fs.existsSync.mockReturnValue(true);

    const res = await request(app)
      .post(`/api/cve-assessment?file=${FILE_PARAM}`)
      .send({ reportItemId: 'FortiOS_7.6.0', cveId: 'CVE-2024-21762' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/assessment/i);
  });

  test('retorna 404 quando o arquivo não existe', async () => {
    fs.existsSync.mockReturnValue(false);

    const res = await request(app)
      .post(`/api/cve-assessment?file=${FILE_PARAM}`)
      .send({ reportItemId: 'FortiOS_7.6.0', cveId: 'CVE-2024-21762', assessment: 'Accepted Risk' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/não encontrado/i);
  });

  test('retorna 404 quando o report item não existe', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFile.mockImplementation((p, enc, cb) => cb(null, sampleReportJson()));

    const res = await request(app)
      .post(`/api/cve-assessment?file=${FILE_PARAM}`)
      .send({ reportItemId: 'NaoExiste_1.0', cveId: 'CVE-2024-21762', assessment: 'Accepted Risk' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/NaoExiste_1.0/);
  });

  test('retorna 404 quando o CVE não existe no item', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFile.mockImplementation((p, enc, cb) => cb(null, sampleReportJson()));

    const res = await request(app)
      .post(`/api/cve-assessment?file=${FILE_PARAM}`)
      .send({ reportItemId: 'FortiOS_7.6.0', cveId: 'CVE-9999-99999', assessment: 'Accepted Risk' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/CVE-9999-99999/);
  });

  test('retorna 200 e salva o assessment corretamente', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFile.mockImplementation((p, enc, cb) => cb(null, sampleReportJson()));

    let savedData = null;
    fs.writeFile.mockImplementation((p, data, enc, cb) => {
      savedData = JSON.parse(data);
      cb(null);
    });

    const res = await request(app)
      .post(`/api/cve-assessment?file=${FILE_PARAM}`)
      .send({ reportItemId: 'FortiOS_7.6.0', cveId: 'CVE-2024-21762', assessment: 'Accepted Risk' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(fs.writeFile).toHaveBeenCalledTimes(1);

    const cve = savedData.report_items[0].cves[0];
    expect(cve.assessment).toBe('Accepted Risk');
  });

  test('aceita o valor vazio como assessment válido (limpar avaliação)', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFile.mockImplementation((p, enc, cb) => cb(null, sampleReportJson()));
    fs.writeFile.mockImplementation((p, data, enc, cb) => cb(null));

    const res = await request(app)
      .post(`/api/cve-assessment?file=${FILE_PARAM}`)
      .send({ reportItemId: 'FortiOS_7.6.0', cveId: 'CVE-2024-21762', assessment: '' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
  });

  test('aceita todos os valores de assessment válidos', async () => {
    const validValues = ['Acknowledge/Mitigating', 'False Positive', 'Accepted Risk', ''];

    for (const value of validValues) {
      jest.clearAllMocks();
      fs.existsSync.mockReturnValue(true);
      fs.readFile.mockImplementation((p, enc, cb) => cb(null, sampleReportJson()));
      fs.writeFile.mockImplementation((p, data, enc, cb) => cb(null));

      const res = await request(app)
        .post(`/api/cve-assessment?file=${FILE_PARAM}`)
        .send({ reportItemId: 'FortiOS_7.6.0', cveId: 'CVE-2024-21762', assessment: value })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
    }
  });

  test('retorna 500 quando a leitura do arquivo falha', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFile.mockImplementation((p, enc, cb) => cb(new Error('disk error')));

    const res = await request(app)
      .post(`/api/cve-assessment?file=${FILE_PARAM}`)
      .send({ reportItemId: 'FortiOS_7.6.0', cveId: 'CVE-2024-21762', assessment: 'Accepted Risk' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });

  test('retorna 500 quando o conteúdo do arquivo não é JSON válido', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFile.mockImplementation((p, enc, cb) => cb(null, 'NOT_JSON'));

    const res = await request(app)
      .post(`/api/cve-assessment?file=${FILE_PARAM}`)
      .send({ reportItemId: 'FortiOS_7.6.0', cveId: 'CVE-2024-21762', assessment: 'Accepted Risk' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/inválido/i);
  });

  test('retorna 500 quando a escrita do arquivo falha', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFile.mockImplementation((p, enc, cb) => cb(null, sampleReportJson()));
    fs.writeFile.mockImplementation((p, data, enc, cb) => cb(new Error('write error')));

    const res = await request(app)
      .post(`/api/cve-assessment?file=${FILE_PARAM}`)
      .send({ reportItemId: 'FortiOS_7.6.0', cveId: 'CVE-2024-21762', assessment: 'Accepted Risk' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });

  test('não modifica outros campos do CVE ao salvar o assessment', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFile.mockImplementation((p, enc, cb) => cb(null, sampleReportJson()));

    let savedData = null;
    fs.writeFile.mockImplementation((p, data, enc, cb) => {
      savedData = JSON.parse(data);
      cb(null);
    });

    await request(app)
      .post(`/api/cve-assessment?file=${FILE_PARAM}`)
      .send({ reportItemId: 'FortiOS_7.6.0', cveId: 'CVE-2024-21762', assessment: 'False Positive' })
      .set('Content-Type', 'application/json');

    const cve = savedData.report_items[0].cves[0];
    expect(cve.cve_id).toBe('CVE-2024-21762');
    expect(cve.description).toBe('Test description');
    expect(cve.severity).toBe('CRITICAL');
    expect(cve.assessment).toBe('False Positive');
    expect(cve.claude_ai_assessment).toBe('Test AI note');
  });

  test('não modifica outros campos do report item ao salvar o assessment', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFile.mockImplementation((p, enc, cb) => cb(null, sampleReportJson()));

    let savedData = null;
    fs.writeFile.mockImplementation((p, data, enc, cb) => {
      savedData = JSON.parse(data);
      cb(null);
    });

    await request(app)
      .post(`/api/cve-assessment?file=${FILE_PARAM}`)
      .send({ reportItemId: 'FortiOS_7.6.0', cveId: 'CVE-2024-21762', assessment: 'False Positive' })
      .set('Content-Type', 'application/json');

    const item = savedData.report_items[0];
    expect(item.id).toBe('FortiOS_7.6.0');
    expect(item.name).toBe('FortiOS');
    expect(item.url).toBe('https://example.com');
    expect(item.cves).toHaveLength(1);
  });

  test('preserva o last_scan e outros campos raiz do arquivo', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFile.mockImplementation((p, enc, cb) => cb(null, sampleReportJson()));

    let savedData = null;
    fs.writeFile.mockImplementation((p, data, enc, cb) => {
      savedData = JSON.parse(data);
      cb(null);
    });

    await request(app)
      .post(`/api/cve-assessment?file=${FILE_PARAM}`)
      .send({ reportItemId: 'FortiOS_7.6.0', cveId: 'CVE-2024-21762', assessment: 'Acknowledged/Mitigating' })
      .set('Content-Type', 'application/json');

    expect(savedData.last_scan).toBe('2026-03-21 21:02:06');
    expect(savedData.report_items).toHaveLength(1);
  });
});
