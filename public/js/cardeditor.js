/* ================================================
   CARD EDITOR — Editar, excluir e adicionar cards
   ================================================ */

(function () {
  const modal       = document.getElementById('card-editor-modal');
  const openBtn     = document.getElementById('btn-card-editor');
  const closeBtn    = document.getElementById('close-card-editor-modal');
  const feedback    = document.getElementById('ce-feedback');
  const listSection = document.getElementById('ce-list-section');
  const cardsList   = document.getElementById('ce-cards-list');
  const formToggle  = document.getElementById('ce-form-toggle');
  const form        = document.getElementById('ce-form');
  const formLabel   = document.getElementById('ce-form-label');
  const cancelBtn   = document.getElementById('ce-cancel-btn');
  const confirmBtn  = document.getElementById('ce-confirm-btn');

  if (!modal || !openBtn) return;

  /* ── Custom type dropdown ── */
  const CARD_TYPES    = ['metric', 'chart', 'list', 'dynamic-list', 'uptime', 'cve-assets', 'frame'];
  const typeWrapper   = document.getElementById('ce-type-wrapper');
  const typeTrigger   = document.getElementById('ce-type-trigger');
  const typeLabel     = document.getElementById('ce-type-label');
  const typeDropdown  = document.getElementById('ce-type-dropdown');
  let selectedType    = 'chart';

  function buildTypeDropdown() {
    typeDropdown.innerHTML = CARD_TYPES.map(t => `
      <button class="ce-type-option${t === selectedType ? ' selected' : ''}" type="button" data-value="${t}">
        <span class="ce-type-option-icon">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </span>
        <span class="ce-type-option-label">${t}</span>
      </button>
    `).join('');

    typeDropdown.querySelectorAll('.ce-type-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedType = opt.dataset.value;
        typeLabel.textContent = selectedType;
        closeTypeDropdown();
        buildTypeDropdown();
        clearJsonOverride();
      });
    });
  }

  function openTypeDropdown() {
    buildTypeDropdown();
    typeDropdown.classList.add('open');
    typeTrigger.classList.add('open');
  }

  function closeTypeDropdown() {
    typeDropdown.classList.remove('open');
    typeTrigger.classList.remove('open');
  }

  typeTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    typeDropdown.classList.contains('open') ? closeTypeDropdown() : openTypeDropdown();
  });

  document.addEventListener('click', (e) => {
    if (!typeWrapper.contains(e.target)) closeTypeDropdown();
  });

  /* ── Dynamic-list format config panel ── */
  const formatBtn       = document.getElementById('ce-format-btn');
  const formatPanel     = document.getElementById('ce-format-panel');
  const formatBack      = document.getElementById('ce-format-back');
  const formatSepInput  = document.getElementById('ce-format-separator');
  const formatOrderBy   = document.getElementById('ce-format-orderby');
  const formatLimit     = document.getElementById('ce-format-limit');
  const FIELD_TYPES     = ['text', 'date', 'url'];
  const MAX_FIELDS      = 3;

  /* ── Custom order dropdown (same pattern as type dropdown) ── */
  const ORDER_OPTIONS   = [
    { value: 'desc', label: 'Decrescente' },
    { value: 'asc',  label: 'Crescente' },
  ];
  const orderWrapper    = document.getElementById('ce-order-wrapper');
  const orderTrigger    = document.getElementById('ce-order-trigger');
  const orderLabel      = document.getElementById('ce-order-label');
  const orderDropdown   = document.getElementById('ce-order-dropdown');
  let selectedOrder     = 'desc';

  function buildOrderDropdown() {
    if (!orderDropdown) return;
    orderDropdown.innerHTML = ORDER_OPTIONS.map(o => `
      <button class="ce-type-option${o.value === selectedOrder ? ' selected' : ''}" type="button" data-value="${o.value}">
        <span class="ce-type-option-icon">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </span>
        <span class="ce-type-option-label">${o.label}</span>
      </button>
    `).join('');

    orderDropdown.querySelectorAll('.ce-type-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedOrder = opt.dataset.value;
        orderLabel.textContent = ORDER_OPTIONS.find(o => o.value === selectedOrder).label;
        closeOrderDropdown();
        buildOrderDropdown();
      });
    });
  }

  function openOrderDropdown() {
    buildOrderDropdown();
    orderDropdown.classList.add('open');
    orderTrigger.classList.add('open');
  }

  function closeOrderDropdown() {
    if (!orderDropdown) return;
    orderDropdown.classList.remove('open');
    if (orderTrigger) orderTrigger.classList.remove('open');
  }

  if (orderTrigger) {
    orderTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      orderDropdown.classList.contains('open') ? closeOrderDropdown() : openOrderDropdown();
    });
  }

  document.addEventListener('click', (e) => {
    if (orderWrapper && !orderWrapper.contains(e.target)) closeOrderDropdown();
  });

  let dynamicListFields = [];

  function updateFormatBtnVisibility() {
    if (formatBtn) {
      formatBtn.style.display = selectedType === 'dynamic-list' ? '' : 'none';
    }
  }

  function updateSourceRowVisibility() {
    const row = document.getElementById('ce-source-row');
    if (row) row.style.display = selectedType === 'metric' ? 'none' : '';
  }

  // Extend type selection to toggle panel buttons (format + metric) and source row
  const origBuildTypeDropdown = buildTypeDropdown;
  buildTypeDropdown = function () {
    origBuildTypeDropdown();
    typeDropdown.querySelectorAll('.ce-type-option').forEach(opt => {
      opt.addEventListener('click', () => {
        updateFormatBtnVisibility();
        updateMetricBtnVisibility();
        updateSourceRowVisibility();
      });
    });
  };

  function openFormatPanel() {
    form.style.display = 'none';
    formatPanel.style.display = 'block';
    renderFormatFields();
  }

  function closeFormatPanel() {
    formatPanel.style.display = 'none';
    form.style.display = 'block';
    clearJsonOverride();
  }

  if (formatBtn) formatBtn.addEventListener('click', openFormatPanel);
  if (formatBack) formatBack.addEventListener('click', closeFormatPanel);

  function renderFormatFields() {
    const container = document.getElementById('ce-format-fields');
    if (!container) return;

    container.innerHTML = dynamicListFields.map((f, idx) => `
      <div class="ce-fmt-field-row" data-idx="${idx}">
        <div class="ce-fmt-field-inputs">
          <input type="text" class="ce-fmt-header" placeholder="Nome do campo (header CSV)" value="${f.header || ''}" autocomplete="off">
          <input type="text" class="ce-fmt-label" placeholder="Rótulo de exibição" value="${f.label || ''}" autocomplete="off">
          <div class="ce-type-wrapper ce-fmt-type-wrapper">
            <button class="ce-type-trigger ce-fmt-type-trigger" type="button">
              <span class="ce-type-label">${f.type || 'text'}</span>
              <svg class="ce-type-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            <div class="ce-type-dropdown ce-fmt-type-dropdown"></div>
          </div>
        </div>
        <button class="mv-delete-btn ce-fmt-remove-btn" type="button" title="Remover campo">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `).join('');

    // Bind field inputs
    container.querySelectorAll('.ce-fmt-field-row').forEach(row => {
      const idx = parseInt(row.dataset.idx, 10);

      row.querySelector('.ce-fmt-header').addEventListener('input', (e) => {
        dynamicListFields[idx].header = e.target.value.trim();
      });
      row.querySelector('.ce-fmt-label').addEventListener('input', (e) => {
        dynamicListFields[idx].label = e.target.value.trim();
      });
      row.querySelector('.ce-fmt-remove-btn').addEventListener('click', () => {
        dynamicListFields.splice(idx, 1);
        renderFormatFields();
      });

      // Field type dropdown
      const wrapper = row.querySelector('.ce-fmt-type-wrapper');
      const trigger = row.querySelector('.ce-fmt-type-trigger');
      const dropdown = row.querySelector('.ce-fmt-type-dropdown');
      const label = trigger.querySelector('.ce-type-label');

      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const wasOpen = dropdown.classList.contains('open');
        // Close all other field type dropdowns
        container.querySelectorAll('.ce-fmt-type-dropdown.open').forEach(d => {
          d.classList.remove('open');
          d.previousElementSibling?.classList.remove('open');
        });
        if (!wasOpen) {
          buildFieldTypeDropdown(dropdown, idx, label);
          dropdown.classList.add('open');
          trigger.classList.add('open');
        }
      });
    });

    // Close field type dropdowns on outside click
    document.addEventListener('click', closeAllFieldTypeDropdowns);

    updateAddFieldBtnState();
  }

  function closeAllFieldTypeDropdowns() {
    const container = document.getElementById('ce-format-fields');
    if (!container) return;
    container.querySelectorAll('.ce-fmt-type-dropdown.open').forEach(d => {
      d.classList.remove('open');
    });
    container.querySelectorAll('.ce-fmt-type-trigger.open').forEach(t => {
      t.classList.remove('open');
    });
  }

  function buildFieldTypeDropdown(dropdown, fieldIdx, labelEl) {
    const current = dynamicListFields[fieldIdx].type || 'text';
    dropdown.innerHTML = FIELD_TYPES.map(t => `
      <button class="ce-type-option${t === current ? ' selected' : ''}" type="button" data-value="${t}">
        <span class="ce-type-option-icon">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </span>
        <span class="ce-type-option-label">${t === 'text' ? 'Texto' : t === 'date' ? 'Data' : 'URL'}</span>
      </button>
    `).join('');

    dropdown.querySelectorAll('.ce-type-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        dynamicListFields[fieldIdx].type = opt.dataset.value;
        labelEl.textContent = opt.dataset.value;
        dropdown.classList.remove('open');
        dropdown.previousElementSibling?.classList.remove('open');
      });
    });
  }

  function updateAddFieldBtnState() {
    const addBtn = document.getElementById('ce-format-add-field');
    if (addBtn) {
      addBtn.style.display = dynamicListFields.length >= MAX_FIELDS ? 'none' : '';
    }
  }

  const addFieldBtn = document.getElementById('ce-format-add-field');
  if (addFieldBtn) {
    addFieldBtn.addEventListener('click', () => {
      if (dynamicListFields.length >= MAX_FIELDS) return;
      dynamicListFields.push({ header: '', label: '', type: 'text' });
      renderFormatFields();
    });
  }

  /* ── Metric panel ── */
  const metricBtn     = document.getElementById('ce-metric-btn');
  const metricPanel   = document.getElementById('ce-metric-panel');
  const metricBack    = document.getElementById('ce-metric-back');
  const metricSaveBtn = document.getElementById('ce-metric-save');
  const METRIC_COMPATIBLE_TYPES = ['list', 'dynamic-list', 'uptime', 'cve-assets'];
  let metricSources = [];

  function updateMetricBtnVisibility() {
    if (metricBtn) metricBtn.style.display = selectedType === 'metric' ? '' : 'none';
  }

  function closeAllMetricFilterDropdowns() {
    const c = document.getElementById('ce-metric-sources');
    if (!c) return;
    c.querySelectorAll('.ce-metric-filter-dropdown.open').forEach(d => d.classList.remove('open'));
    c.querySelectorAll('.ce-metric-filter-trigger.open').forEach(t => t.classList.remove('open'));
  }

  async function openMetricPanel(directMode = false) {
    form.style.display = 'none';
    metricPanel.style.display = 'block';
    if (metricBack)    metricBack.style.display    = directMode ? 'none' : '';
    if (metricSaveBtn) metricSaveBtn.style.display = directMode ? ''     : 'none';
    document.addEventListener('click', closeAllMetricFilterDropdowns);
    await renderMetricPanel();
  }

  function closeMetricPanel() {
    metricPanel.style.display = 'none';
    form.style.display = 'block';
    if (metricBack)    metricBack.style.display    = '';
    if (metricSaveBtn) metricSaveBtn.style.display = 'none';
    document.removeEventListener('click', closeAllMetricFilterDropdowns);
    clearJsonOverride();
  }

  async function saveMetricDirect() {
    if (!editingCardId) return;

    if (!metricSources.length) {
      showFeedback('Adicione ao menos uma fonte à métrica.', 'error');
      return;
    }

    if (metricSaveBtn) metricSaveBtn.disabled = true;
    clearFeedback();

    try {
      const res = await fetch('/api/cards');
      if (!res.ok) throw new Error('Erro ao carregar cards');
      let cards = await res.json();

      const idx = cards.findIndex(c => c.id === editingCardId);
      if (idx === -1) {
        showFeedback(`Card "${editingCardId}" não encontrado.`, 'error');
        return;
      }

      cards[idx] = { ...cards[idx], metric: { sources: metricSources } };

      const saveRes = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cards),
      });

      if (!saveRes.ok) {
        const data = await saveRes.json().catch(() => ({}));
        showFeedback(data.error || 'Erro ao salvar.', 'error');
        return;
      }

      invalidateCardsCache();
      closeModal();

      if (typeof loadCardsContent === 'function') {
        loadCardsContent(editingCardId);
      }

    } catch (err) {
      showFeedback('Erro de comunicação com o servidor.', 'error');
      console.error(err);
    } finally {
      if (metricSaveBtn) metricSaveBtn.disabled = false;
    }
  }

  if (metricBtn)     metricBtn.addEventListener('click', () => openMetricPanel(false));
  if (metricBack)    metricBack.addEventListener('click', closeMetricPanel);
  if (metricSaveBtn) metricSaveBtn.addEventListener('click', saveMetricDirect);

  async function renderMetricPanel() {
    const availableContainer = document.getElementById('ce-metric-available');
    const sourcesContainer   = document.getElementById('ce-metric-sources');
    if (!availableContainer || !sourcesContainer) return;

    let allCards = [];
    try {
      const res = await fetch('/api/cards');
      if (res.ok) allCards = await res.json();
    } catch {}

    const selectedIds = metricSources.map(s => s.cardId);
    const available   = allCards.filter(c =>
      METRIC_COMPATIBLE_TYPES.includes(c.cardType) && !selectedIds.includes(c.id)
    );

    availableContainer.innerHTML = available.length
      ? available.map(c => `
          <div class="ce-metric-row">
            <span class="ce-metric-card-title">${c.title || c.id}</span>
            <span class="ce-row-type">${c.cardType}</span>
            <button class="btn-apply ce-metric-add-btn" type="button" data-id="${c.id}" data-type="${c.cardType}">+</button>
          </div>
        `).join('')
      : '<p class="mv-empty" style="font-size:0.82rem;">Nenhum card compatível disponível.</p>';

    availableContainer.querySelectorAll('.ce-metric-add-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const source = { cardId: btn.dataset.id };
        if (btn.dataset.type === 'uptime') source.uptimeFilter = 'offline';
        metricSources.push(source);
        renderMetricPanel();
      });
    });

    sourcesContainer.innerHTML = metricSources.length
      ? metricSources.map((s, idx) => {
          const sourceCard = allCards.find(c => c.id === s.cardId);
          const label = sourceCard ? (sourceCard.title || sourceCard.id) : s.cardId;
          const type  = sourceCard?.cardType || '';
          const uptimeCtrl = type === 'uptime' ? `
            <div class="ce-type-wrapper ce-metric-filter-wrapper">
              <button class="ce-type-trigger ce-metric-filter-trigger" type="button">
                <span class="ce-type-label">${s.uptimeFilter === 'online' ? 'Online' : 'Offline'}</span>
                <svg class="ce-type-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              <div class="ce-type-dropdown ce-metric-filter-dropdown"></div>
            </div>
          ` : '';

          return `
            <div class="ce-metric-row" data-idx="${idx}">
              <span class="ce-metric-card-title">${label}</span>
              <span class="ce-row-type">${type}</span>
              ${uptimeCtrl}
              <button class="mv-delete-btn ce-metric-remove-btn" type="button" title="Remover fonte">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          `;
        }).join('')
      : '<p class="mv-empty" style="font-size:0.82rem;">Nenhuma fonte selecionada.</p>';

    sourcesContainer.querySelectorAll('.ce-metric-remove-btn').forEach(btn => {
      const row = btn.closest('.ce-metric-row');
      btn.addEventListener('click', () => {
        metricSources.splice(parseInt(row.dataset.idx, 10), 1);
        renderMetricPanel();
      });
    });

    sourcesContainer.querySelectorAll('.ce-metric-row').forEach(row => {
      const trigger  = row.querySelector('.ce-metric-filter-trigger');
      const dropdown = row.querySelector('.ce-metric-filter-dropdown');
      if (!trigger || !dropdown) return;

      const idx   = parseInt(row.dataset.idx, 10);
      const label = trigger.querySelector('.ce-type-label');

      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const wasOpen = dropdown.classList.contains('open');
        closeAllMetricFilterDropdowns();
        if (!wasOpen) {
          buildUptimeFilterDropdown(dropdown, idx, label);
          dropdown.classList.add('open');
          trigger.classList.add('open');
        }
      });
    });
  }

  function buildUptimeFilterDropdown(dropdown, sourceIdx, labelEl) {
    const current = metricSources[sourceIdx]?.uptimeFilter || 'offline';
    const options = [{ value: 'offline', label: 'Offline' }, { value: 'online', label: 'Online' }];
    dropdown.innerHTML = options.map(o => `
      <button class="ce-type-option${o.value === current ? ' selected' : ''}" type="button" data-value="${o.value}">
        <span class="ce-type-option-icon">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </span>
        <span class="ce-type-option-label">${o.label}</span>
      </button>
    `).join('');

    dropdown.querySelectorAll('.ce-type-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        metricSources[sourceIdx].uptimeFilter = opt.dataset.value;
        labelEl.textContent = opt.dataset.value === 'online' ? 'Online' : 'Offline';
        dropdown.classList.remove('open');
        dropdown.previousElementSibling?.classList.remove('open');
      });
    });
  }

  let editingCardId = null;

  /* ── Open / Close modal ── */
  openBtn.addEventListener('click', () => {
    clearFeedback();
    showList();
    renderCardsList();
    modal.classList.add('show');
  });

  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('show')) {
      if (typeDropdown.classList.contains('open')) {
        closeTypeDropdown();
        return;
      }
      if (orderDropdown && orderDropdown.classList.contains('open')) {
        closeOrderDropdown();
        return;
      }
      if (metricPanel && metricPanel.style.display !== 'none') {
        closeMetricPanel();
        return;
      }
      if (formatPanel && formatPanel.style.display !== 'none') {
        closeFormatPanel();
        return;
      }
      if (form.style.display !== 'none') {
        showList();
        return;
      }
      closeModal();
    }
  });

  function closeModal() {
    modal.classList.remove('show');
    closeTypeDropdown();
  }

  /* ── Toggle between list and form views ── */
  function showList() {
    form.style.display = 'none';
    listSection.style.display = '';
    editingCardId = null;
    resetFormFields();
    closeTypeDropdown();
  }

  function showForm(label) {
    listSection.style.display = 'none';
    formLabel.textContent = label;
    form.style.display = 'block';
  }

  function resetFormFields() {
    getInput('id').value = '';
    getInput('id').disabled = false;
    getInput('title').value = '';
    getInput('description').value = '';
    getInput('source').value = '';
    getInput('json').value = '';
    selectedType = 'chart';
    typeLabel.textContent = 'chart';
    // Reset dynamic-list format config
    dynamicListFields = [];
    if (formatSepInput) formatSepInput.value = ';';
    if (formatOrderBy) formatOrderBy.value = '';
    selectedOrder = 'desc';
    if (orderLabel) orderLabel.textContent = 'Decrescente';
    if (formatLimit) formatLimit.value = '20';
    if (formatPanel) formatPanel.style.display = 'none';
    metricSources = [];
    if (metricPanel) metricPanel.style.display = 'none';
    updateFormatBtnVisibility();
    updateMetricBtnVisibility();
    updateSourceRowVisibility();
  }

  formToggle.addEventListener('click', () => {
    editingCardId = null;
    resetFormFields();
    showForm('Adicionar card');
  });

  cancelBtn.addEventListener('click', () => {
    showList();
    renderCardsList();
  });

  function getInput(name) {
    return document.getElementById('ce-card-' + name);
  }

  /* ── Clear JSON override when individual fields are edited ── */
  function clearJsonOverride() {
    const jsonField = getInput('json');
    if (jsonField && jsonField.value) jsonField.value = '';
  }

  ['title', 'description', 'source'].forEach(name => {
    const el = getInput(name);
    if (el) el.addEventListener('input', clearJsonOverride);
  });

  /* ── Render cards list ── */
  async function renderCardsList() {
    cardsList.innerHTML = '<p class="mv-loading">Carregando cards...</p>';

    try {
      const res = await fetch('/api/cards');
      if (!res.ok) throw new Error('Erro ao carregar cards');
      const cards = await res.json();

      if (!cards.length) {
        cardsList.innerHTML = '<p class="mv-empty">Nenhum card cadastrado.</p>';
        return;
      }

      cardsList.innerHTML = cards.map(c => `
        <div class="ce-row" data-id="${c.id}">
          <span class="ce-row-title">${c.title || c.id}</span>
          <span class="ce-row-type">${c.cardType}</span>
          <button class="ce-edit-btn" data-id="${c.id}" title="Editar card">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          </button>
          <button class="mv-delete-btn" data-id="${c.id}" data-title="${c.title || c.id}" title="Excluir card">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        </div>
      `).join('');

      cardsList.querySelectorAll('.mv-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteCard(btn.dataset.id, btn.dataset.title));
      });

      cardsList.querySelectorAll('.ce-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => startEdit(btn.dataset.id, cards));
      });

    } catch (err) {
      cardsList.innerHTML = '<p class="mv-empty">Erro ao carregar cards.</p>';
      console.error(err);
    }
  }

  /* ── Start editing an existing card ── */
  function startEdit(cardId, cards) {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    editingCardId = cardId;

    getInput('id').value = card.id;
    getInput('id').disabled = true;
    getInput('title').value = card.title || '';
    getInput('description').value = card.description || '';

    const sourceValue = card.cardType === 'dynamic-list'
      ? (card.dynamicList?.sourceItems || '')
      : (card.sourceItems || '');
    getInput('source').value = sourceValue;

    // Show full JSON for reference; cleared automatically when
    // the user edits any individual field so it won't override.
    getInput('json').value = JSON.stringify(card, null, 2);

    selectedType = card.cardType || 'chart';
    typeLabel.textContent = selectedType;

    // Populate dynamic-list format config
    if (card.cardType === 'dynamic-list' && card.dynamicList) {
      dynamicListFields = (card.dynamicList.fields || []).map(f => ({ ...f }));
      if (formatSepInput) formatSepInput.value = card.dynamicList.separator || ';';
      if (formatOrderBy) formatOrderBy.value = card.dynamicList.orderBy || '';
      selectedOrder = card.dynamicList.order || 'desc';
      if (orderLabel) orderLabel.textContent = ORDER_OPTIONS.find(o => o.value === selectedOrder)?.label || 'Decrescente';
      if (formatLimit) formatLimit.value = card.dynamicList.limit || 20;
    } else {
      dynamicListFields = [];
      if (formatSepInput) formatSepInput.value = ';';
      if (formatOrderBy) formatOrderBy.value = '';
      selectedOrder = 'desc';
      if (orderLabel) orderLabel.textContent = 'Decrescente';
      if (formatLimit) formatLimit.value = '20';
    }
    updateFormatBtnVisibility();

    if (card.cardType === 'metric' && card.metric) {
      metricSources = (card.metric.sources || []).map(s => ({ ...s }));
    } else {
      metricSources = [];
    }
    updateMetricBtnVisibility();
    updateSourceRowVisibility();

    clearFeedback();
    showForm('Editando: ' + (card.title || card.id));
  }

  /* ── Confirm add/edit ── */
  confirmBtn.addEventListener('click', async () => {
    clearFeedback();

    let cardObj;
    const jsonRaw = getInput('json').value.trim();

    if (jsonRaw) {
      try {
        cardObj = JSON.parse(jsonRaw);
      } catch {
        showFeedback('JSON inválido.', 'error');
        return;
      }
    } else {
      const id = getInput('id').value.trim();
      const title = getInput('title').value.trim();

      if (!id) { showFeedback('O campo ID é obrigatório.', 'error'); return; }
      if (!title) { showFeedback('O campo Título é obrigatório.', 'error'); return; }

      cardObj = { id, title, cardType: selectedType };

      const description = getInput('description').value.trim();
      if (description) cardObj.description = description;

      const source = getInput('source').value.trim();

      if (selectedType === 'metric') {
        if (!metricSources.length) {
          showFeedback('Adicione ao menos uma fonte à métrica.', 'error');
          return;
        }
        cardObj.metric = { sources: metricSources };
      } else if (selectedType === 'dynamic-list') {
        const validFields = dynamicListFields.filter(f => f.header);
        if (!validFields.length) {
          showFeedback('Configure ao menos um campo no formato.', 'error');
          return;
        }
        cardObj.dynamicList = {
          sourceItems: source,
          separator: (formatSepInput && formatSepInput.value) || ';',
          orderBy: (formatOrderBy && formatOrderBy.value.trim()) || '',
          order: selectedOrder || 'desc',
          limit: parseInt((formatLimit && formatLimit.value) || '20', 10) || 20,
          fields: validFields,
        };
        if (!cardObj.dynamicList.orderBy) delete cardObj.dynamicList.orderBy;
      } else if (source) {
        cardObj.sourceItems = source;
      }
    }

    if (!cardObj.id || !cardObj.cardType) {
      showFeedback('O card deve ter "id" e "cardType".', 'error');
      return;
    }

    confirmBtn.disabled = true;

    try {
      const res = await fetch('/api/cards');
      if (!res.ok) throw new Error('Erro ao carregar cards');
      let cards = await res.json();

      if (editingCardId) {
        const idx = cards.findIndex(c => c.id === editingCardId);
        if (idx === -1) {
          showFeedback(`Card "${editingCardId}" não encontrado.`, 'error');
          return;
        }
        cards[idx] = cardObj;
      } else {
        if (cards.some(c => c.id === cardObj.id)) {
          showFeedback(`Já existe um card com ID "${cardObj.id}".`, 'error');
          return;
        }
        cards.push(cardObj);
      }

      const saveRes = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cards),
      });

      if (!saveRes.ok) {
        const data = await saveRes.json().catch(() => ({}));
        showFeedback(data.error || 'Erro ao salvar.', 'error');
        return;
      }

      const verb = editingCardId ? 'atualizado' : 'adicionado';
      showFeedback(`Card "${cardObj.title || cardObj.id}" ${verb}.`, 'success');
      invalidateCardsCache();
      showList();
      renderCardsList();

    } catch (err) {
      showFeedback('Erro de comunicação com o servidor.', 'error');
      console.error(err);
    } finally {
      confirmBtn.disabled = false;
    }
  });

  /* ── Delete card ── */
  async function deleteCard(cardId, title) {
    const confirmed = confirm(`Excluir o card "${title}"?\n\nEsta ação não pode ser desfeita.`);
    if (!confirmed) return;

    clearFeedback();

    try {
      const res = await fetch(`/api/cards/${encodeURIComponent(cardId)}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showFeedback(data.error || 'Erro ao excluir card.', 'error');
        return;
      }

      showFeedback(`Card "${title}" excluído.`, 'success');
      invalidateCardsCache();
      renderCardsList();

    } catch (err) {
      showFeedback('Erro de comunicação com o servidor.', 'error');
      console.error(err);
    }
  }

  /* ── Invalidate the in-memory cards cache so addcards.js re-fetches ── */
  function invalidateCardsCache() {
    if (typeof availableCards !== 'undefined') {
      availableCards = [];
    }
  }

  /* ── Feedback helpers ── */
  function showFeedback(msg, type) {
    feedback.textContent = msg;
    feedback.className = `mv-feedback mv-feedback--${type}`;
  }

  function clearFeedback() {
    feedback.textContent = '';
    feedback.className = 'mv-feedback';
  }

  // ── API pública: abrir editor direto na aba de métrica ──
  window.openMetricEditor = async function (cardElement) {
    clearFeedback();
    modal.classList.add('show');

    let allCards = [];
    try {
      const res = await fetch('/api/cards');
      if (res.ok) allCards = await res.json();
    } catch {}

    const cardId = cardElement.dataset?.id || cardElement.id;
    startEdit(cardId, allCards);
    await openMetricPanel(true);
  };
})();
