/* ================================================
   UPTIME EDITOR — Edição de configuração de monitoramento
   ================================================ */

(function () {
  const modal = document.getElementById('uptime-editor-modal');
  if (!modal) return;

  let currentFilePath = null;
  let services = [];

  const NOTIFY_OPTIONS = [
    { value: 'when-offline', label: 'Quando offline' },
    { value: 'when-online',  label: 'Quando online'  },
    { value: 'off',          label: 'Desativado'      },
  ];

  function el(id) { return document.getElementById(id); }

  // ── Custom dropdown: position fixed para escapar de containers overflow:auto ──
  function openDropdown(trigger, dropdown) {
    var rect = trigger.getBoundingClientRect();
    dropdown.style.top   = (rect.bottom + 4) + 'px';
    dropdown.style.left  = rect.left + 'px';
    dropdown.style.width = rect.width + 'px';
    dropdown.classList.add('open');
    trigger.classList.add('open');
  }

  function closeDropdown(trigger, dropdown) {
    if (dropdown) dropdown.classList.remove('open');
    if (trigger)  trigger.classList.remove('open');
  }

  function closeAllDropdowns() {
    var newModeDropdown = el('ue-new-mode-dropdown');
    var newModeTrigger  = el('ue-new-mode-trigger');
    if (newModeDropdown) closeDropdown(newModeTrigger, newModeDropdown);

    document.querySelectorAll('.ue-mode-dropdown.open').forEach(function (d) { d.classList.remove('open'); });
    document.querySelectorAll('.ue-mode-trigger.open').forEach(function (t)  { t.classList.remove('open'); });
  }

  // ── Dropdown do formulário de adição ──
  let newModeSelected = 'when-offline';

  function notifyLabel(val) {
    var opt = NOTIFY_OPTIONS.find(function (o) { return o.value === val; });
    return opt ? opt.label : 'Quando offline';
  }

  function buildNewModeDropdown() {
    var dropdown = el('ue-new-mode-dropdown');
    if (!dropdown) return;
    dropdown.innerHTML = NOTIFY_OPTIONS.map(function (opt) {
      return '<button class="ue-dd-option' + (opt.value === newModeSelected ? ' selected' : '') + '" type="button" data-value="' + opt.value + '">' +
        '<span class="ue-dd-option-icon">' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<polyline points="20 6 9 17 4 12"/>' +
          '</svg>' +
        '</span>' +
        opt.label +
      '</button>';
    }).join('');

    dropdown.querySelectorAll('.ue-dd-option').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        newModeSelected = btn.dataset.value;
        var label = el('ue-new-mode-label');
        if (label) label.textContent = notifyLabel(newModeSelected);
        closeDropdown(el('ue-new-mode-trigger'), dropdown);
      });
    });
  }

  // ── Helpers do formulário de adição ──
  function clearAddForm() {
    el('ue-new-name').value = '';
    el('ue-new-url').value  = '';
    el('ue-new-http').value = '';
    newModeSelected = 'when-offline';
    var label = el('ue-new-mode-label');
    if (label) label.textContent = 'Quando offline';
    closeDropdown(el('ue-new-mode-trigger'), el('ue-new-mode-dropdown'));
  }

  function openAddForm() {
    const form   = el('ue-add-form');
    const toggle = el('ue-add-toggle');
    if (!form || !toggle) return;
    form.style.display = 'block';
    toggle.classList.add('ue-add-toggle--open');
    const nameInput = el('ue-new-name');
    if (nameInput) nameInput.focus();
  }

  function closeAddForm() {
    const form   = el('ue-add-form');
    const toggle = el('ue-add-toggle');
    if (form)   form.style.display = 'none';
    if (toggle) toggle.classList.remove('ue-add-toggle--open');
    clearAddForm();
  }

  // ── Wiring de eventos ──
  document.addEventListener('DOMContentLoaded', function () {
    var addToggle = el('ue-add-toggle');
    if (addToggle) {
      addToggle.addEventListener('click', function () {
        var form = el('ue-add-form');
        var isOpen = form && form.style.display !== 'none';
        if (isOpen) closeAddForm(); else openAddForm();
      });
    }

    var cancelAddBtn = el('ue-cancel-add-btn');
    if (cancelAddBtn) cancelAddBtn.addEventListener('click', closeAddForm);

    var addBtn = el('ue-add-btn');
    if (addBtn) addBtn.addEventListener('click', confirmAdd);

    var closeBtn = el('close-uptime-editor-modal');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('show')) closeModal();
    });

    var saveBtn = el('ue-save-btn');
    if (saveBtn) saveBtn.addEventListener('click', saveConfig);

    var newModeTrigger = el('ue-new-mode-trigger');
    if (newModeTrigger) {
      newModeTrigger.addEventListener('click', function (e) {
        e.stopPropagation();
        var dropdown = el('ue-new-mode-dropdown');
        if (dropdown.classList.contains('open')) {
          closeDropdown(newModeTrigger, dropdown);
        } else {
          closeAllDropdowns();
          buildNewModeDropdown();
          openDropdown(newModeTrigger, dropdown);
        }
      });
    }

    document.addEventListener('click', function () {
      closeAllDropdowns();
    });
  });

  // ── API pública: chamada pelo eventListeners.js ao clicar no lápis ──
  window.openUptimeEditor = function (card) {
    const sourceItems = card.dataset.externalSourceMonitor;
    if (!sourceItems || sourceItems === 'undefined') {
      alert('Este card não possui um arquivo de configuração associado.');
      return;
    }

    currentFilePath = sourceItems;

    clearFeedback();
    closeAddForm();

    const hookInput    = el('ue-notification-hook');
    const servicesList = el('ue-services-list');
    if (hookInput)    hookInput.value = '';
    if (servicesList) servicesList.innerHTML = '<p class="mv-loading">Carregando…</p>';

    modal.classList.add('show');
    loadConfig();
  };

  function closeModal() {
    modal.classList.remove('show');
    closeAllDropdowns();
    currentFilePath = null;
    services = [];
    closeAddForm();
    clearFeedback();
  }

  async function loadConfig() {
    const servicesList = el('ue-services-list');
    try {
      const res = await fetch('/api/uptime-config?file=' + encodeURIComponent(currentFilePath));
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();

      const hookInput = el('ue-notification-hook');
      if (hookInput) hookInput.value = data.notificationHook || '';

      services = (data.servicesStatus || []).map(function (s) { return Object.assign({}, s); });
      renderServices();

    } catch (err) {
      if (servicesList) servicesList.innerHTML = '<p class="mv-empty">Erro ao carregar configuração.</p>';
      console.error('[UptimeEditor] loadConfig:', err);
    }
  }

  function renderServices() {
    const servicesList = el('ue-services-list');
    if (!servicesList) return;

    if (!services.length) {
      servicesList.innerHTML = '<p class="mv-empty">Nenhum serviço configurado.</p>';
      return;
    }

    const chevronSvg =
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
        '<polyline points="6 9 12 15 18 9"/>' +
      '</svg>';

    servicesList.innerHTML = services.map(function (s, i) {
      const modeVal = s.notificationHookMode || 'when-offline';
      return '<div class="ue-service-row" data-index="' + i + '">' +
        '<div class="ue-service-fields">' +
          '<div class="ue-field-group">' +
            '<label class="ue-field-label">Nome</label>' +
            '<input class="ue-input" data-field="name" value="' + escHtml(s.name || '') + '" placeholder="Nome">' +
          '</div>' +
          '<div class="ue-field-group ue-field-url">' +
            '<label class="ue-field-label">URL</label>' +
            '<input class="ue-input" data-field="url" value="' + escHtml(s.url || '') + '" placeholder="https://…">' +
          '</div>' +
          '<div class="ue-field-group ue-field-http">' +
            '<label class="ue-field-label">HTTP esperado</label>' +
            '<input class="ue-input" data-field="expectedHttpRespose" value="' + escHtml(s.expectedHttpRespose || '200') + '" placeholder="200">' +
          '</div>' +
          '<div class="ue-field-group ue-field-mode">' +
            '<label class="ue-field-label">Notificação</label>' +
            '<div class="ue-dd-wrapper">' +
              '<button class="ue-dd-trigger ue-mode-trigger" type="button" data-index="' + i + '">' +
                '<span class="ue-dd-label">' + escHtml(notifyLabel(modeVal)) + '</span>' +
                '<span class="ue-dd-chevron">' + chevronSvg + '</span>' +
              '</button>' +
              '<div class="ue-dd-dropdown ue-mode-dropdown"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<button class="mv-delete-btn ue-delete-btn" data-index="' + i + '" title="Remover serviço">' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<polyline points="3 6 5 6 21 6"/>' +
            '<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>' +
            '<path d="M10 11v6M14 11v6"/>' +
            '<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>' +
          '</svg>' +
        '</button>' +
      '</div>';
    }).join('');

    servicesList.querySelectorAll('.ue-input').forEach(function (input) {
      input.addEventListener('input', function () {
        var row = input.closest('.ue-service-row');
        var idx = parseInt(row.dataset.index, 10);
        if (services[idx] !== undefined) {
          services[idx][input.dataset.field] = input.value;
        }
      });
    });

    servicesList.querySelectorAll('.ue-mode-trigger').forEach(function (trigger) {
      var dropdown = trigger.nextElementSibling;
      var idx = parseInt(trigger.dataset.index, 10);

      trigger.addEventListener('click', function (e) {
        e.stopPropagation();
        var isOpen = dropdown.classList.contains('open');
        closeAllDropdowns();
        if (!isOpen) {
          buildServiceModeDropdown(dropdown, trigger, idx);
          openDropdown(trigger, dropdown);
        }
      });
    });

    servicesList.querySelectorAll('.ue-delete-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.dataset.index, 10);
        services.splice(idx, 1);
        clearFeedback();
        renderServices();
      });
    });
  }

  function buildServiceModeDropdown(dropdown, trigger, idx) {
    var currentVal = (services[idx] && services[idx].notificationHookMode) || 'when-offline';
    dropdown.innerHTML = NOTIFY_OPTIONS.map(function (opt) {
      return '<button class="ue-dd-option' + (opt.value === currentVal ? ' selected' : '') + '" type="button" data-value="' + opt.value + '">' +
        '<span class="ue-dd-option-icon">' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<polyline points="20 6 9 17 4 12"/>' +
          '</svg>' +
        '</span>' +
        opt.label +
      '</button>';
    }).join('');

    dropdown.querySelectorAll('.ue-dd-option').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (services[idx] !== undefined) {
          services[idx].notificationHookMode = btn.dataset.value;
        }
        var label = trigger.querySelector('.ue-dd-label');
        if (label) label.textContent = notifyLabel(btn.dataset.value);
        closeDropdown(trigger, dropdown);
      });
    });
  }

  function confirmAdd() {
    var name = (el('ue-new-name').value || '').trim();
    var url  = (el('ue-new-url').value  || '').trim();
    var http = (el('ue-new-http').value || '').trim() || '200';
    var mode = newModeSelected;

    if (!url) {
      showFeedback('A URL do serviço é obrigatória.', 'error');
      el('ue-new-url').focus();
      return;
    }

    services.push({
      name:                 name || url,
      url:                  url,
      expectedHttpRespose:  http,
      notificationHookMode: mode,
      status:               'offline',
      lastStatusOnline:     '',
      lastStatusOffline:    '',
    });

    closeAddForm();
    clearFeedback();
    renderServices();
  }

  async function saveConfig() {
    if (!currentFilePath) return;

    const servicesList = el('ue-services-list');
    const saveBtn      = el('ue-save-btn');
    const hookInput    = el('ue-notification-hook');

    if (servicesList) {
      servicesList.querySelectorAll('.ue-service-row').forEach(function (row) {
        var idx = parseInt(row.dataset.index, 10);
        row.querySelectorAll('.ue-input').forEach(function (input) {
          if (services[idx] !== undefined) {
            services[idx][input.dataset.field] = input.value;
          }
        });
      });
    }

    var invalid = services.find(function (s) { return !s.url || !s.url.trim(); });
    if (invalid !== undefined) {
      showFeedback('Todos os serviços precisam ter uma URL.', 'error');
      return;
    }

    if (saveBtn) saveBtn.disabled = true;
    clearFeedback();

    try {
      var res = await fetch('/api/uptime-config?file=' + encodeURIComponent(currentFilePath), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationHook: hookInput ? hookInput.value.trim() : '',
          servicesStatus:   services,
        }),
      });

      if (!res.ok) {
        var data = await res.json().catch(function () { return {}; });
        showFeedback(data.error || 'Erro ao salvar.', 'error');
        return;
      }

      showFeedback('Configuração salva com sucesso!', 'success');

      var cardEl = null;
      document.querySelectorAll('[data-external-source-monitor]').forEach(function (c) {
        if (c.dataset.externalSourceMonitor === currentFilePath) cardEl = c;
      });
      if (cardEl && typeof loadCardsContent === 'function') {
        loadCardsContent(cardEl.id);
      }

    } catch (err) {
      showFeedback('Erro de comunicação com o servidor.', 'error');
      console.error('[UptimeEditor] saveConfig:', err);
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  function showFeedback(msg, type) {
    var f = el('ue-feedback');
    if (!f) return;
    f.textContent = msg;
    f.className = 'mv-feedback mv-feedback--' + type;
  }

  function clearFeedback() {
    var f = el('ue-feedback');
    if (!f) return;
    f.textContent = '';
    f.className = 'mv-feedback';
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
})();
