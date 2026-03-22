/* ================================================
   UPTIME EDITOR — Edição de configuração de monitoramento
   ================================================ */

(function () {
  // Único elemento verificado no topo — se não existir, a feature não está na página
  const modal = document.getElementById('uptime-editor-modal');
  if (!modal) return;

  // ── Estado interno ──
  let currentFilePath = null;
  let services = [];

  // ── Accessors lazy (resolvidos no momento do uso, nunca no topo) ──
  function el(id) { return document.getElementById(id); }

  // ── Helpers do formulário de adição ──
  function clearAddForm() {
    el('ue-new-name').value = '';
    el('ue-new-url').value  = '';
    el('ue-new-http').value = '';
    const mode = el('ue-new-mode');
    if (mode) mode.value = 'when-offline';
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

  // ── Wiring de eventos — executado em DOMContentLoaded para garantir que o DOM está pronto ──
  document.addEventListener('DOMContentLoaded', function () {
    // Toggle de abertura do formulário de adição
    const addToggle = el('ue-add-toggle');
    if (addToggle) {
      addToggle.addEventListener('click', function () {
        const form = el('ue-add-form');
        const isOpen = form && form.style.display !== 'none';
        if (isOpen) closeAddForm(); else openAddForm();
      });
    }

    // Cancelar adição
    const cancelAddBtn = el('ue-cancel-add-btn');
    if (cancelAddBtn) {
      cancelAddBtn.addEventListener('click', closeAddForm);
    }

    // Confirmar adição de novo serviço
    const addBtn = el('ue-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', confirmAdd);
    }

    // Fechar modal pelo botão
    const closeBtn = el('close-uptime-editor-modal');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeModal);
    }

    // Fechar modal clicando no backdrop
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });

    // Fechar modal com Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('show')) closeModal();
    });

    // Salvar configuração
    const saveBtn = el('ue-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', saveConfig);
    }
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

  // ── Fecha o modal ──
  function closeModal() {
    modal.classList.remove('show');
    currentFilePath = null;
    services = [];
    closeAddForm();
    clearFeedback();
  }

  // ── Carrega configuração atual do backend ──
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

  // ── Renderiza a lista de serviços editável ──
  function renderServices() {
    const servicesList = el('ue-services-list');
    if (!servicesList) return;

    if (!services.length) {
      servicesList.innerHTML = '<p class="mv-empty">Nenhum serviço configurado.</p>';
      return;
    }

    servicesList.innerHTML = services.map(function (s, i) {
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
            '<select class="ue-select" data-field="notificationHookMode">' +
              '<option value="when-offline"' + (s.notificationHookMode === 'when-offline' ? ' selected' : '') + '>Quando offline</option>' +
              '<option value="when-online"'  + (s.notificationHookMode === 'when-online'  ? ' selected' : '') + '>Quando online</option>' +
              '<option value="off"'          + (s.notificationHookMode === 'off'          ? ' selected' : '') + '>Desativado</option>' +
            '</select>' +
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

    // Sincroniza edições inline → array em memória
    servicesList.querySelectorAll('.ue-input, .ue-select').forEach(function (input) {
      input.addEventListener('input', function () {
        var row = input.closest('.ue-service-row');
        var idx = parseInt(row.dataset.index, 10);
        if (services[idx] !== undefined) {
          services[idx][input.dataset.field] = input.value;
        }
      });
    });

    // Botões de remoção
    servicesList.querySelectorAll('.ue-delete-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.dataset.index, 10);
        services.splice(idx, 1);
        clearFeedback();
        renderServices();
      });
    });
  }

  // ── Confirmar adição de novo serviço ──
  function confirmAdd() {
    var name = (el('ue-new-name').value || '').trim();
    var url  = (el('ue-new-url').value  || '').trim();
    var http = (el('ue-new-http').value || '').trim() || '200';
    var mode = (el('ue-new-mode') ? el('ue-new-mode').value : 'when-offline');

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

  // ── Salva a configuração no backend ──
  async function saveConfig() {
    if (!currentFilePath) return;

    const servicesList = el('ue-services-list');
    const saveBtn      = el('ue-save-btn');
    const hookInput    = el('ue-notification-hook');

    // Sincroniza campos que podem não ter disparado 'input'
    if (servicesList) {
      servicesList.querySelectorAll('.ue-service-row').forEach(function (row) {
        var idx = parseInt(row.dataset.index, 10);
        row.querySelectorAll('.ue-input, .ue-select').forEach(function (input) {
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

      // Recarrega o card correspondente
      var cardEl = document.querySelector('[data-external-source-monitor]');
      // busca o card cujo monitor bate com o arquivo
      document.querySelectorAll('[data-external-source-monitor]').forEach(function (c) {
        if (c.dataset.externalSourceMonitor === currentFilePath) {
          cardEl = c;
        }
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

  // ── Utilitários ──
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