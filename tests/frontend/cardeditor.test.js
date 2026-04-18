/**
 * @jest-environment jsdom
 */

const { loadScript } = require('./load-script');

beforeAll(() => {
  global.fetch = jest.fn();

  // Minimal DOM required by cardeditor.js IIFE (elements used without null-checks)
  document.body.innerHTML = `
    <button id="btn-card-editor"></button>
    <div id="card-editor-modal" class="modal">
      <div id="ce-feedback"></div>
      <div id="ce-list-section"><div id="ce-cards-list"></div></div>
      <button id="ce-form-toggle"></button>
      <div id="ce-form" style="display:none;">
        <span id="ce-form-label"></span>
        <div id="ce-source-row">
          <input id="ce-card-source" type="text">
        </div>
        <div id="ce-type-wrapper">
          <button id="ce-type-trigger" type="button">
            <span id="ce-type-label">chart</span>
          </button>
          <div id="ce-type-dropdown"></div>
        </div>
        <input id="ce-card-id"          type="text">
        <input id="ce-card-title"       type="text">
        <input id="ce-card-description" type="text">
        <textarea id="ce-card-json"></textarea>
        <button id="ce-metric-btn" style="display:none;">Configurar métrica</button>
        <div id="ce-metric-panel" style="display:none;">
          <button id="ce-metric-back"></button>
          <div id="ce-metric-available"></div>
          <div id="ce-metric-sources"></div>
        </div>
        <div id="ce-format-panel" style="display:none;">
          <button id="ce-format-back"></button>
        </div>
      </div>
      <button id="ce-cancel-btn"></button>
      <button id="ce-confirm-btn"></button>
      <div>
        <button id="close-card-editor-modal"></button>
        <button id="ce-metric-save" style="display:none;"></button>
      </div>
    </div>
  `;

  loadScript('cardeditor.js');
});

afterEach(() => {
  jest.clearAllMocks();
  document.getElementById('card-editor-modal').classList.remove('show');
  document.getElementById('ce-source-row').style.display = '';
  // Close type dropdown
  document.getElementById('ce-type-dropdown').classList.remove('open');
  document.getElementById('ce-type-trigger').classList.remove('open');
  // Hide metric panel and reset save/back buttons
  document.getElementById('ce-metric-panel').style.display = 'none';
  if (document.getElementById('ce-metric-back')) document.getElementById('ce-metric-back').style.display = '';
  document.getElementById('ce-metric-save').style.display = 'none';
  document.getElementById('ce-form').style.display = 'none';
});

/** Opens the type dropdown and clicks the option with the given value. */
function selectType(value) {
  document.getElementById('ce-type-trigger').click();
  const option = document.querySelector(`#ce-type-dropdown [data-value="${value}"]`);
  if (option) option.click();
}

// ─── updateSourceRowVisibility ───

describe('updateSourceRowVisibility (via type dropdown)', () => {
  test('hides #ce-source-row when metric type is selected', () => {
    selectType('metric');
    expect(document.getElementById('ce-source-row').style.display).toBe('none');
  });

  test('restores #ce-source-row when chart type is selected after metric', () => {
    selectType('metric');
    selectType('chart');
    expect(document.getElementById('ce-source-row').style.display).toBe('');
  });

  test('restores #ce-source-row when list type is selected after metric', () => {
    selectType('metric');
    selectType('list');
    expect(document.getElementById('ce-source-row').style.display).toBe('');
  });

  test('restores #ce-source-row when uptime type is selected after metric', () => {
    selectType('metric');
    selectType('uptime');
    expect(document.getElementById('ce-source-row').style.display).toBe('');
  });
});

// ─── openMetricEditor ───

describe('openMetricEditor', () => {
  test('opens the card-editor-modal', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
    const fakeCard = Object.assign(document.createElement('div'), { id: 'x' });
    fakeCard.dataset.id = 'x';

    await window.openMetricEditor(fakeCard);

    expect(document.getElementById('card-editor-modal').classList.contains('show')).toBe(true);
  });

  test('fetches /api/cards to resolve the card list', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
    const fakeCard = Object.assign(document.createElement('div'), { id: 'y' });
    fakeCard.dataset.id = 'y';

    await window.openMetricEditor(fakeCard);

    expect(global.fetch).toHaveBeenCalledWith('/api/cards');
  });

  test('shows the metric panel after opening', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
    const fakeCard = Object.assign(document.createElement('div'), { id: 'z' });
    fakeCard.dataset.id = 'z';

    await window.openMetricEditor(fakeCard);

    expect(document.getElementById('ce-metric-panel').style.display).toBe('block');
  });

  test('hides the "Voltar ao formulário" button in direct mode', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
    const fakeCard = Object.assign(document.createElement('div'), { id: 'dm1' });
    fakeCard.dataset.id = 'dm1';

    await window.openMetricEditor(fakeCard);

    expect(document.getElementById('ce-metric-back').style.display).toBe('none');
  });

  test('shows the "Salvar" button in direct mode', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
    const fakeCard = Object.assign(document.createElement('div'), { id: 'dm2' });
    fakeCard.dataset.id = 'dm2';

    await window.openMetricEditor(fakeCard);

    expect(document.getElementById('ce-metric-save').style.display).toBe('');
  });

  test('still opens modal if /api/cards request fails', async () => {
    global.fetch.mockRejectedValueOnce(new Error('network error'));
    const fakeCard = Object.assign(document.createElement('div'), { id: 'err' });
    fakeCard.dataset.id = 'err';

    await window.openMetricEditor(fakeCard);

    expect(document.getElementById('card-editor-modal').classList.contains('show')).toBe(true);
  });
});

// ─── openMetricPanel via metricBtn (modo formulário) ───

describe('openMetricPanel via metricBtn (modo formulário)', () => {
  test('shows "Voltar ao formulário" and hides "Salvar" when opened from form', () => {
    // Simulate opening via the form's "Configurar métrica" button
    document.getElementById('ce-metric-btn').click();

    expect(document.getElementById('ce-metric-back').style.display).toBe('');
    expect(document.getElementById('ce-metric-save').style.display).toBe('none');
  });
});
