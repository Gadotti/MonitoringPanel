/**
 * @jest-environment jsdom
 */

const { loadScript } = require('./load-script');

beforeAll(() => {
  // Globals expected by main.js (normally from consts.js)
  global.viewSelector = document.createElement('select');
  global.grid = document.createElement('div');
  global.grid.className = 'grid';
  document.body.appendChild(global.grid);
  global.chartInstances = {};
  global.availableCards = [];
  global.selectedView = 'default';
  global.suppressedCardUpdates = new Set();
  global.initializeCardEvents = jest.fn();
  global.signSocketListeners = jest.fn();
  global.csvToJson = jest.fn();

  // Stub fetch globally
  global.fetch = jest.fn();

  loadScript('main.js');
});

afterEach(() => {
  grid.innerHTML = '';
  jest.clearAllMocks();
});

// ─── createCardElement ───

describe('createCardElement', () => {
  test('creates a chart card with canvas', () => {
    const card = createCardElement({
      id: 'test-chart',
      cardType: 'chart',
      title: 'My Chart',
      order: 0,
      columns: 2,
      rows: 1,
      sourceItems: 'data.csv'
    });

    expect(card.tagName).toBe('DIV');
    expect(card.classList.contains('card')).toBe(true);
    expect(card.id).toBe('test-chart');
    expect(card.dataset.id).toBe('test-chart');
    expect(card.dataset.colSpan).toBe('2');
    expect(card.dataset.rowSpan).toBe('1');
    expect(card.style.gridColumn).toBe('span 2');
    expect(card.style.gridRow).toBe('span 1');
    expect(card.getAttribute('draggable')).toBe('true');
    expect(card.querySelector('canvas#chart-test-chart')).not.toBeNull();
    expect(card.querySelector('.card-header .title').textContent).toBe('My Chart');
    expect(card.querySelector('.settings-button')).not.toBeNull();
    expect(card.dataset.externalSourceMonitor).toBe('data.csv');
  });

  test('creates a list card with event-list ul', () => {
    const card = createCardElement({
      id: 'test-list',
      cardType: 'list',
      title: 'Events',
      order: 1,
      list: { sourceItems: 'events.csv' }
    });

    expect(card.querySelector('ul.event-list')).not.toBeNull();
    expect(card.dataset.externalSourceMonitor).toBe('events.csv');
  });

  test('creates an uptime card with edit button', () => {
    const card = createCardElement({
      id: 'test-uptime',
      cardType: 'uptime',
      title: 'Uptime',
      order: 2,
      sourceItems: 'uptime.json'
    });

    expect(card.querySelector('.uptime-card')).not.toBeNull();
    expect(card.querySelector('.uptime-edit-button')).not.toBeNull();
  });

  test('creates a cve-assets card', () => {
    const card = createCardElement({
      id: 'test-cve',
      cardType: 'cve-assets',
      title: 'CVE Report',
      order: 3,
      sourceItems: 'cve.json'
    });

    expect(card.querySelector('.asset-card')).not.toBeNull();
  });

  test('creates a frame card with iframe and zoom controls', () => {
    const card = createCardElement({
      id: 'test-frame',
      cardType: 'frame',
      title: 'Embedded Page',
      order: 4,
      columns: 3,
      rows: 2,
      zoom: 0.8,
      sourceItems: 'page.html',
      frame: { url: 'http://example.com' }
    });

    const iframe = card.querySelector('iframe');
    expect(iframe).not.toBeNull();
    expect(iframe.getAttribute('src')).toBe('http://example.com');
    expect(iframe.dataset.scale).toBe('0.8');
    expect(card.querySelector('.zoom-in-button')).not.toBeNull();
    expect(card.querySelector('.zoom-out-button')).not.toBeNull();
    expect(card.querySelector('.zoom-percentage')).not.toBeNull();
  });

  test('uses default column and row of 1 when not specified', () => {
    const card = createCardElement({
      id: 'defaults',
      cardType: 'chart',
      title: 'Defaults',
      order: 0
    });

    expect(card.style.gridColumn).toBe('span 1');
    expect(card.style.gridRow).toBe('span 1');
  });

  test('does not include uptime edit button for non-uptime cards', () => {
    const card = createCardElement({
      id: 'no-edit',
      cardType: 'chart',
      title: 'Chart',
      order: 0
    });

    expect(card.querySelector('.uptime-edit-button')).toBeNull();
  });

  test('includes resize handles', () => {
    const card = createCardElement({
      id: 'resize',
      cardType: 'chart',
      title: 'R',
      order: 0
    });

    expect(card.querySelector('.resize-handle.right')).not.toBeNull();
    expect(card.querySelector('.resize-handle.bottom')).not.toBeNull();
    expect(card.querySelector('.resize-handle.corner')).not.toBeNull();
  });

  test('creates a metric card with .metric-card div', () => {
    const card = createCardElement({
      id: 'test-metric',
      cardType: 'metric',
      title: 'KPIs',
      order: 0
    });

    expect(card.querySelector('.metric-card')).not.toBeNull();
  });

  test('metric card has a metric-edit-button but no uptime-edit-button', () => {
    const card = createCardElement({
      id: 'test-metric-btn',
      cardType: 'metric',
      title: 'KPIs',
      order: 0
    });

    expect(card.querySelector('.metric-edit-button')).not.toBeNull();
    expect(card.querySelector('.uptime-edit-button')).toBeNull();
  });

  test('non-metric card has no metric-edit-button', () => {
    const card = createCardElement({
      id: 'no-metric-btn',
      cardType: 'chart',
      title: 'Chart',
      order: 0
    });

    expect(card.querySelector('.metric-edit-button')).toBeNull();
  });
});

// ─── getFrameFromCardElement ───

describe('getFrameFromCardElement', () => {
  test('returns iframe from a frame card', () => {
    const card = createCardElement({
      id: 'frame-1',
      cardType: 'frame',
      title: 'F',
      order: 0,
      frame: { url: 'http://test.com' }
    });

    const iframe = getFrameFromCardElement(card);
    expect(iframe).not.toBeNull();
    expect(iframe.tagName).toBe('IFRAME');
  });

  test('returns undefined for non-frame card', () => {
    const card = createCardElement({
      id: 'chart-1',
      cardType: 'chart',
      title: 'C',
      order: 0
    });

    const iframe = getFrameFromCardElement(card);
    expect(iframe).toBeUndefined();
  });
});

// ─── adjustFrameZoom ───

describe('adjustFrameZoom', () => {
  test('applies zoom scale to iframe', () => {
    const card = createCardElement({
      id: 'zoom-test',
      cardType: 'frame',
      title: 'Zoom',
      order: 0,
      zoom: 1,
      frame: { url: 'http://zoom.com' }
    });

    adjustFrameZoom(card, 0.1, false);

    const iframe = card.querySelector('iframe');
    expect(parseFloat(iframe.dataset.scale)).toBeCloseTo(1.1, 1);
    expect(card.querySelector('.zoom-percentage').textContent).toBe('(110%)');
  });

  test('clamps zoom to max 2', () => {
    const card = createCardElement({
      id: 'max-zoom',
      cardType: 'frame',
      title: 'Max',
      order: 0,
      zoom: 1.95,
      frame: { url: 'http://max.com' }
    });

    adjustFrameZoom(card, 0.5, false);

    const iframe = card.querySelector('iframe');
    expect(parseFloat(iframe.dataset.scale)).toBe(2);
  });

  test('clamps zoom to min 0.1', () => {
    const card = createCardElement({
      id: 'min-zoom',
      cardType: 'frame',
      title: 'Min',
      order: 0,
      zoom: 0.15,
      frame: { url: 'http://min.com' }
    });

    adjustFrameZoom(card, -0.5, false);

    const iframe = card.querySelector('iframe');
    expect(parseFloat(iframe.dataset.scale)).toBeCloseTo(0.1, 1);
  });

  test('does nothing for non-frame card', () => {
    const card = createCardElement({
      id: 'no-frame',
      cardType: 'chart',
      title: 'NF',
      order: 0
    });

    // Should not throw
    adjustFrameZoom(card, 0.1, false);
  });
});

// ─── renderCardsInOrder ───

describe('renderCardsInOrder', () => {
  test('appends cards sorted by data-order', () => {
    const container = document.createElement('div');

    const card2 = document.createElement('div');
    card2.dataset.order = '2';
    card2.textContent = 'second';

    const card0 = document.createElement('div');
    card0.dataset.order = '0';
    card0.textContent = 'first';

    const card1 = document.createElement('div');
    card1.dataset.order = '1';
    card1.textContent = 'middle';

    renderCardsInOrder(container, [card2, card0, card1]);

    const children = Array.from(container.children);
    expect(children[0].textContent).toBe('first');
    expect(children[1].textContent).toBe('middle');
    expect(children[2].textContent).toBe('second');
  });
});

// ─── getLayoutConfig ───

describe('getLayoutConfig', () => {
  test('extracts layout from card elements in the grid', () => {
    const card = createCardElement({
      id: 'layout-card',
      cardType: 'chart',
      title: 'Layout Test',
      order: 0,
      columns: 2,
      rows: 3
    });
    grid.appendChild(card);

    const config = getLayoutConfig();

    expect(config).toHaveLength(1);
    expect(config[0].id).toBe('layout-card');
    expect(config[0].order).toBe(0);
    expect(config[0].columns).toBe(2);
    expect(config[0].rows).toBe(3);
    expect(config[0].zoom).toBe(1);
  });

  test('extracts zoom from frame cards', () => {
    const card = createCardElement({
      id: 'layout-frame',
      cardType: 'frame',
      title: 'Frame Layout',
      order: 0,
      zoom: 0.75,
      frame: { url: 'http://test.com' }
    });
    grid.appendChild(card);

    const config = getLayoutConfig();
    expect(config[0].zoom).toBe(0.75);
  });

  test('returns empty array when grid has no cards', () => {
    expect(getLayoutConfig()).toEqual([]);
  });
});

// ─── getCurrentView ───

describe('getCurrentView', () => {
  test('returns the value of viewSelector', () => {
    const option = document.createElement('option');
    option.value = 'security';
    viewSelector.appendChild(option);
    viewSelector.value = 'security';

    expect(getCurrentView()).toBe('security');
  });

  test('returns default when viewSelector has no value', () => {
    viewSelector.innerHTML = '';
    viewSelector.value = '';
    expect(getCurrentView()).toBe('default');
  });
});

// ─── animateCardHighlight ───

describe('animateCardHighlight', () => {
  test('adds and removes highlight class', () => {
    jest.useFakeTimers();

    const card = createCardElement({
      id: 'highlight-test',
      cardType: 'chart',
      title: 'HL',
      order: 0
    });
    document.body.appendChild(card);

    animateCardHighlight('highlight-test');
    expect(card.classList.contains('highlight')).toBe(true);

    jest.advanceTimersByTime(1100);
    expect(card.classList.contains('highlight')).toBe(false);

    card.remove();
    jest.useRealTimers();
  });

  test('does nothing for non-existent card', () => {
    // Should not throw
    animateCardHighlight('non-existent');
  });
});

// ─── updateUrlForView ───

describe('updateUrlForView', () => {
  test('updates the URL with the selected view', () => {
    const replaceStateSpy = jest.spyOn(window.history, 'replaceState');
    global.selectedView = 'monitoring';

    updateUrlForView();

    expect(replaceStateSpy).toHaveBeenCalledWith({}, '', '/monitoring');
    replaceStateSpy.mockRestore();
  });
});

// ─── loadCardsContent — metric dispatch ───

describe('loadCardsContent — metric type dispatch', () => {
  beforeAll(() => {
    // Stub all content loaders that loadCardsContent may call
    global.loadCardContentChart    = jest.fn();
    global.loadCardContentList     = jest.fn();
    global.loadCardContentDynamicList = jest.fn();
    global.loadCardContentMetric   = jest.fn();
    global.loadCardContentUptime   = jest.fn();
    global.loadCardContentCveAssets = jest.fn();
    global.animateCardHighlight    = jest.fn();
  });

  test('calls loadCardContentMetric for metric cards', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { id: 'kpi', cardType: 'metric', title: 'KPIs', metric: { sources: [] } }
      ])
    });

    loadCardsContent();
    await new Promise(r => setTimeout(r, 10));

    expect(global.loadCardContentMetric).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'kpi', cardType: 'metric' })
    );
  });

  test('does not call loadCardContentMetric for non-metric cards', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { id: 'ch', cardType: 'chart', title: 'Chart' }
      ])
    });

    loadCardsContent();
    await new Promise(r => setTimeout(r, 10));

    expect(global.loadCardContentMetric).not.toHaveBeenCalled();
  });
});
