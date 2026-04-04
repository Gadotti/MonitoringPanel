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
  const CARD_TYPES    = ['chart', 'list', 'uptime', 'cve-assets', 'frame'];
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
    getInput('source').value = card.sourceItems || '';
    getInput('json').value = JSON.stringify(card, null, 2);

    selectedType = card.cardType || 'chart';
    typeLabel.textContent = selectedType;

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
      if (source) cardObj.sourceItems = source;
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
})();
