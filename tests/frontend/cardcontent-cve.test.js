/**
 * @jest-environment jsdom
 */

const { loadScript } = require('./load-script');

beforeAll(() => {
  global.suppressedCardUpdates = new Set();
  global.fetch = jest.fn();

  loadScript('cardcontent-cve.js');
});

afterEach(() => {
  // Clean up any floating panel
  const panel = document.getElementById('cve-assess-panel');
  if (panel) panel.remove();
  jest.clearAllMocks();
});

// ─── toggleCveAssetsDetails ───

describe('toggleCveAssetsDetails', () => {
  test('toggles expanded class on row and sibling', () => {
    const row = document.createElement('div');
    const details = document.createElement('div');
    details.classList.add('asset-collapsible');
    document.body.appendChild(row);
    document.body.appendChild(details);

    // First call — expand
    toggleCveAssetsDetails(row);
    expect(row.classList.contains('expanded')).toBe(true);
    expect(details.classList.contains('expanded')).toBe(true);

    // Second call — collapse
    toggleCveAssetsDetails(row);
    expect(row.classList.contains('expanded')).toBe(false);
    expect(details.classList.contains('expanded')).toBe(false);

    row.remove();
    details.remove();
  });

  test('does not throw if sibling is not collapsible', () => {
    const row = document.createElement('div');
    const other = document.createElement('div');
    document.body.appendChild(row);
    document.body.appendChild(other);

    toggleCveAssetsDetails(row);
    expect(row.classList.contains('expanded')).toBe(true);
    expect(other.classList.contains('expanded')).toBe(false);

    row.remove();
    other.remove();
  });
});

// ─── getCveAssessPanel ───

describe('getCveAssessPanel', () => {
  test('creates panel on first call', () => {
    const panel = getCveAssessPanel();
    expect(panel).not.toBeNull();
    expect(panel.id).toBe('cve-assess-panel');
    expect(document.getElementById('cve-assess-panel')).toBe(panel);
  });

  test('returns the same panel on subsequent calls', () => {
    const panel1 = getCveAssessPanel();
    const panel2 = getCveAssessPanel();
    expect(panel1).toBe(panel2);
  });
});

// ─── closeCveAssessPanel ───

describe('closeCveAssessPanel', () => {
  test('removes open class from panel', () => {
    const panel = getCveAssessPanel();
    panel.classList.add('open');

    closeCveAssessPanel();

    expect(panel.classList.contains('open')).toBe(false);
  });

  test('clears active trigger reference', () => {
    const panel = getCveAssessPanel();
    panel._activeTrigger = document.createElement('button');

    closeCveAssessPanel();
    expect(panel._activeTrigger).toBeNull();
  });

  test('removes open class from all triggers', () => {
    // Ensure panel exists so closeCveAssessPanel doesn't return early
    getCveAssessPanel();

    const trigger = document.createElement('button');
    trigger.classList.add('cve-assess-trigger', 'open');
    document.body.appendChild(trigger);

    closeCveAssessPanel();
    expect(trigger.classList.contains('open')).toBe(false);

    trigger.remove();
  });

  test('does not throw when panel does not exist', () => {
    const panel = document.getElementById('cve-assess-panel');
    if (panel) panel.remove();

    expect(() => closeCveAssessPanel()).not.toThrow();
  });
});

// ─── initCveAssessmentDropdowns ───

describe('initCveAssessmentDropdowns', () => {
  test('opens panel on trigger click', () => {
    const cardEl = document.createElement('div');
    const trigger = document.createElement('button');
    trigger.classList.add('cve-assess-trigger');
    trigger.dataset.cveId = 'CVE-2024-0001';
    trigger.dataset.reportItemId = 'item-1';
    trigger.dataset.currentAssessment = '';
    trigger.innerHTML = '<span class="cve-assess-label">Avaliar…</span>';
    cardEl.appendChild(trigger);
    document.body.appendChild(cardEl);

    initCveAssessmentDropdowns(cardEl, 'card-1', 'public/local-events/cve.json');

    trigger.click();

    const panel = document.getElementById('cve-assess-panel');
    expect(panel.classList.contains('open')).toBe(true);
    expect(trigger.classList.contains('open')).toBe(true);

    // Panel should contain the 3 assessment options
    const options = panel.querySelectorAll('.cve-assess-option');
    expect(options).toHaveLength(3);

    cardEl.remove();
  });

  test('closes panel on second click of same trigger', () => {
    const cardEl = document.createElement('div');
    const trigger = document.createElement('button');
    trigger.classList.add('cve-assess-trigger');
    trigger.dataset.cveId = 'CVE-2024-0002';
    trigger.dataset.reportItemId = 'item-2';
    trigger.dataset.currentAssessment = '';
    trigger.innerHTML = '<span class="cve-assess-label">Avaliar…</span>';
    cardEl.appendChild(trigger);
    document.body.appendChild(cardEl);

    initCveAssessmentDropdowns(cardEl, 'card-2', 'file.json');

    trigger.click(); // open
    trigger.click(); // close

    const panel = document.getElementById('cve-assess-panel');
    expect(panel.classList.contains('open')).toBe(false);

    cardEl.remove();
  });

  test('marks current assessment as selected', () => {
    const cardEl = document.createElement('div');
    const trigger = document.createElement('button');
    trigger.classList.add('cve-assess-trigger');
    trigger.dataset.cveId = 'CVE-2024-0003';
    trigger.dataset.reportItemId = 'item-3';
    trigger.dataset.currentAssessment = 'False Positive';
    trigger.innerHTML = '<span class="cve-assess-label cve-assess-label--set">False Positive</span>';
    cardEl.appendChild(trigger);
    document.body.appendChild(cardEl);

    initCveAssessmentDropdowns(cardEl, 'card-3', 'file.json');

    trigger.click();

    const panel = document.getElementById('cve-assess-panel');
    const selected = panel.querySelector('.cve-assess-option.selected');
    expect(selected).not.toBeNull();
    expect(selected.dataset.value).toBe('False Positive');

    cardEl.remove();
  });

  test('clicking an option sends fetch and updates trigger label', async () => {
    global.fetch.mockResolvedValue({ ok: true });

    const cardEl = document.createElement('div');
    const trigger = document.createElement('button');
    trigger.classList.add('cve-assess-trigger');
    trigger.dataset.cveId = 'CVE-2024-0004';
    trigger.dataset.reportItemId = 'item-4';
    trigger.dataset.currentAssessment = '';
    trigger.innerHTML = '<span class="cve-assess-label">Avaliar…</span>';
    cardEl.appendChild(trigger);
    document.body.appendChild(cardEl);

    initCveAssessmentDropdowns(cardEl, 'card-4', 'public/local-events/cve.json');

    trigger.click();

    const panel = document.getElementById('cve-assess-panel');
    const option = panel.querySelector('.cve-assess-option[data-value="Accepted Risk"]');
    option.click();

    // Wait for async fetch
    await new Promise(r => setTimeout(r, 0));

    expect(trigger.querySelector('.cve-assess-label').textContent).toBe('Accepted Risk');
    expect(trigger.dataset.currentAssessment).toBe('Accepted Risk');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/cve-assessment'),
      expect.objectContaining({ method: 'POST' })
    );

    cardEl.remove();
  });
});
