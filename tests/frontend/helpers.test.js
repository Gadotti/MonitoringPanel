/**
 * @jest-environment jsdom
 */

const { loadScript } = require('./load-script');

beforeAll(() => {
  loadScript('helpers.js');
});

describe('parseCSVLine', () => {
  test('parses semicolon-delimited line', () => {
    const result = parseCSVLine('timestamp;event;detailsUrl');
    expect(result).toEqual(['timestamp', 'event', 'detailsUrl']);
  });

  test('handles quoted fields with inner semicolons', () => {
    const result = parseCSVLine('"campo;com;ponto";valor2;valor3');
    expect(result).toEqual(['campo;com;ponto', 'valor2', 'valor3']);
  });

  test('handles quoted fields with escaped double quotes', () => {
    const result = parseCSVLine('"campo ""aspas""";outro');
    expect(result).toEqual(['campo "aspas"', 'outro']);
  });

  test('handles single field', () => {
    const result = parseCSVLine('unico');
    expect(result).toEqual(['unico']);
  });
});

describe('csvToJson', () => {
  test('converts basic CSV to array of objects', () => {
    const csv = 'timestamp;event;detailsUrl\n2024-01-01;Login;http://example.com';
    const result = csvToJson(csv);
    expect(result).toEqual([
      { timestamp: '2024-01-01', event: 'Login', detailsUrl: 'http://example.com' }
    ]);
  });

  test('converts multiple rows', () => {
    const csv = [
      'col1;col2',
      'a;b',
      'c;d'
    ].join('\n');
    const result = csvToJson(csv);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ col1: 'a', col2: 'b' });
    expect(result[1]).toEqual({ col1: 'c', col2: 'd' });
  });

  test('handles missing values as empty strings', () => {
    const csv = 'h1;h2;h3\nonly';
    const result = csvToJson(csv);
    expect(result[0]).toEqual({ h1: 'only', h2: '', h3: '' });
  });

  test('handles quoted values', () => {
    const csv = 'name;desc\n"Alice";"Desc com espaco"';
    const result = csvToJson(csv);
    expect(result[0]).toEqual({ name: 'Alice', desc: 'Desc com espaco' });
  });
});
