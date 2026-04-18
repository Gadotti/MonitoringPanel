/**
 * @jest-environment jsdom
 */

const { loadScript } = require('./load-script');

beforeAll(() => {
  global.fetch = jest.fn();

  // Minimal DOM — must be set up BEFORE loadScript so the IIFE finds the modal
  document.body.innerHTML = `
    <div id="uptime-editor-modal" class="modal">
      <input type="text" id="ue-notification-hook">
      <div id="ue-services-list"></div>
      <div class="ue-add-section">
        <button id="ue-add-toggle" type="button">+ Adicionar serviço</button>
        <div id="ue-add-form" style="display:none;">
          <input type="text" id="ue-new-name">
          <input type="text" id="ue-new-url">
          <input type="text" id="ue-new-http">
          <div class="ue-dd-wrapper">
            <button id="ue-new-mode-trigger" type="button">
              <span id="ue-new-mode-label">Quando offline</span>
              <span class="ue-dd-chevron"></span>
            </button>
            <div id="ue-new-mode-dropdown"></div>
          </div>
          <button id="ue-cancel-add-btn" type="button">Cancelar</button>
          <button id="ue-add-btn"        type="button">Confirmar</button>
        </div>
      </div>
      <div id="ue-feedback"></div>
      <button id="close-uptime-editor-modal">Fechar</button>
      <button id="ue-save-btn">Salvar</button>
    </div>
  `;

  loadScript('uptimeeditor.js');

  // DOMContentLoaded has already fired in jsdom — dispatch it again so the
  // IIFE's event listeners (trigger clicks, document click, etc.) are wired.
  document.dispatchEvent(new Event('DOMContentLoaded'));
});

afterEach(() => {
  jest.clearAllMocks();
  // Reset dropdown state
  document.getElementById('ue-new-mode-dropdown').classList.remove('open');
  document.getElementById('ue-new-mode-trigger').classList.remove('open');
  document.getElementById('ue-new-mode-label').textContent = 'Quando offline';
  // Reset add form
  document.getElementById('ue-add-form').style.display = 'none';
  document.getElementById('ue-add-toggle').classList.remove('ue-add-toggle--open');
});

// ─── notification mode dropdown (add-form) ───

describe('uptime editor — notification mode dropdown', () => {
  test('clicking the trigger adds the open class to trigger and dropdown', () => {
    const trigger  = document.getElementById('ue-new-mode-trigger');
    const dropdown = document.getElementById('ue-new-mode-dropdown');

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: false }));

    expect(dropdown.classList.contains('open')).toBe(true);
    expect(trigger.classList.contains('open')).toBe(true);
  });

  test('renders three notification options', () => {
    const trigger  = document.getElementById('ue-new-mode-trigger');
    const dropdown = document.getElementById('ue-new-mode-dropdown');

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: false }));

    const options = dropdown.querySelectorAll('.ue-dd-option');
    expect(options).toHaveLength(3);

    const values = Array.from(options).map(o => o.dataset.value);
    expect(values).toEqual(expect.arrayContaining(['when-offline', 'when-online', 'off']));
  });

  test('marks the current selection with class "selected"', () => {
    const trigger  = document.getElementById('ue-new-mode-trigger');
    const dropdown = document.getElementById('ue-new-mode-dropdown');

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: false }));

    const selected = dropdown.querySelector('.ue-dd-option.selected');
    expect(selected).not.toBeNull();
    expect(selected.dataset.value).toBe('when-offline'); // default
  });

  test('clicking an option updates the label text', () => {
    const trigger = document.getElementById('ue-new-mode-trigger');
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: false }));

    const option = document.querySelector('#ue-new-mode-dropdown [data-value="when-online"]');
    option.dispatchEvent(new MouseEvent('click', { bubbles: false }));

    expect(document.getElementById('ue-new-mode-label').textContent).toBe('Quando online');
  });

  test('clicking an option closes the dropdown', () => {
    const trigger  = document.getElementById('ue-new-mode-trigger');
    const dropdown = document.getElementById('ue-new-mode-dropdown');

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: false }));
    expect(dropdown.classList.contains('open')).toBe(true);

    const option = document.querySelector('#ue-new-mode-dropdown [data-value="off"]');
    option.dispatchEvent(new MouseEvent('click', { bubbles: false }));

    expect(dropdown.classList.contains('open')).toBe(false);
    expect(trigger.classList.contains('open')).toBe(false);
  });

  test('clicking the trigger a second time closes the dropdown', () => {
    const trigger  = document.getElementById('ue-new-mode-trigger');
    const dropdown = document.getElementById('ue-new-mode-dropdown');

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: false }));
    expect(dropdown.classList.contains('open')).toBe(true);

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: false }));
    expect(dropdown.classList.contains('open')).toBe(false);
  });

  test('newly selected option becomes selected after re-opening', () => {
    const trigger  = document.getElementById('ue-new-mode-trigger');
    const dropdown = document.getElementById('ue-new-mode-dropdown');

    // Select 'when-online'
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: false }));
    document.querySelector('#ue-new-mode-dropdown [data-value="when-online"]')
      .dispatchEvent(new MouseEvent('click', { bubbles: false }));

    // Re-open
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: false }));
    const selected = dropdown.querySelector('.ue-dd-option.selected');
    expect(selected.dataset.value).toBe('when-online');

    // Reset for next tests
    document.querySelector('#ue-new-mode-dropdown [data-value="when-offline"]')
      .dispatchEvent(new MouseEvent('click', { bubbles: false }));
  });
});

// ─── modal open / close ───

describe('uptime editor — modal', () => {
  test('openUptimeEditor shows the modal', () => {
    // Card with a file monitor set
    const card = document.createElement('div');
    card.dataset.externalSourceMonitor = 'public/local-data-uptimes/status.json';

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ notificationHook: '', servicesStatus: [] }),
    });

    window.openUptimeEditor(card);

    expect(document.getElementById('uptime-editor-modal').classList.contains('show')).toBe(true);
  });

  test('close button hides the modal', () => {
    document.getElementById('uptime-editor-modal').classList.add('show');
    document.getElementById('close-uptime-editor-modal').click();
    expect(document.getElementById('uptime-editor-modal').classList.contains('show')).toBe(false);
  });

  test('Escape key closes the modal', () => {
    document.getElementById('uptime-editor-modal').classList.add('show');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.getElementById('uptime-editor-modal').classList.contains('show')).toBe(false);
  });

  test('backdrop click closes the modal', () => {
    const modal = document.getElementById('uptime-editor-modal');
    modal.classList.add('show');
    modal.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(modal.classList.contains('show')).toBe(false);
  });

  test('shows alert when card has no externalSourceMonitor', () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    const card = document.createElement('div');
    card.dataset.externalSourceMonitor = 'undefined';

    window.openUptimeEditor(card);

    expect(alertSpy).toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
