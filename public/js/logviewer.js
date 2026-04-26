/* ================================================
   LOG VIEWER — Visualização dos logs dos scripts
   ================================================ */

(function () {
  const modal       = document.getElementById('logs-modal');
  const openBtn     = document.getElementById('btn-view-logs');
  const closeBtn    = document.getElementById('close-logs-modal');
  const wrapper     = document.getElementById('logs-selector-wrapper');
  const trigger     = document.getElementById('logs-selector-trigger');
  const labelEl     = document.getElementById('logs-selector-label');
  const dropdown    = document.getElementById('logs-selector-dropdown');
  const contentArea = document.getElementById('logs-content-area');

  if (!modal || !openBtn) return;

  let currentFile = null;

  /* ── Abre o modal ── */
  openBtn.addEventListener('click', () => {
    currentFile = null;
    resetContent();
    modal.classList.add('show');
    loadLogFiles();
  });

  /* ── Fecha o modal ── */
  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('show')) {
      if (dropdown.classList.contains('open')) {
        closeDropdown();
      } else {
        closeModal();
      }
    }
  });

  function closeModal() {
    closeDropdown();
    modal.classList.remove('show');
  }

  /* ── Carrega lista de arquivos .log ── */
  async function loadLogFiles() {
    labelEl.textContent = 'Carregando…';
    dropdown.innerHTML  = '';

    try {
      const res = await fetch('/api/logs');
      if (!res.ok) throw new Error('Erro ao listar logs');
      const files = await res.json();

      if (!files.length) {
        labelEl.textContent = 'Nenhum log disponível';
        dropdown.innerHTML = '<p class="logs-dd-empty">Nenhum arquivo .log encontrado em public/logs/</p>';
        return;
      }

      labelEl.textContent = 'Selecione um arquivo de log…';

      dropdown.innerHTML = files.map(f => `
        <button class="logs-option" type="button" data-file="${f}">
          <span class="logs-option-icon">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.5"
                 stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </span>
          <span class="logs-option-label">${f}</span>
        </button>
      `).join('');

      dropdown.querySelectorAll('.logs-option').forEach(btn => {
        btn.addEventListener('click', () => {
          selectFile(btn.dataset.file);
          closeDropdown();
        });
      });

    } catch (err) {
      labelEl.textContent = 'Erro ao carregar';
      console.error(err);
    }
  }

  /* ── Seleciona e carrega um arquivo ── */
  async function selectFile(filename) {
    if (filename === currentFile) return;
    currentFile = filename;

    // Atualiza label e marca seleção no dropdown
    labelEl.textContent = filename;
    dropdown.querySelectorAll('.logs-option').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.file === filename);
    });

    // Mostra loading na área de conteúdo
    contentArea.innerHTML = '<p class="logs-placeholder">Carregando…</p>';

    try {
      const res = await fetch(`/api/logs/${encodeURIComponent(filename)}`);
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const text = await res.text();

      if (!text.trim()) {
        contentArea.innerHTML = '<p class="logs-placeholder">Arquivo vazio.</p>';
        return;
      }

      contentArea.innerHTML = `<pre class="logs-pre">${escapeHtml(text)}</pre>`;
      // Rola para o final (logs mais recentes)
      contentArea.scrollTop = contentArea.scrollHeight;

    } catch (err) {
      contentArea.innerHTML = `<p class="logs-placeholder logs-placeholder--error">Erro ao carregar o arquivo.</p>`;
      console.error(err);
    }
  }

  /* ── Toggle do dropdown ── */
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.contains('open') ? closeDropdown() : openDropdown();
  });

  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) closeDropdown();
  });

  function openDropdown() {
    dropdown.classList.add('open');
    trigger.classList.add('open');
  }

  function closeDropdown() {
    dropdown.classList.remove('open');
    trigger.classList.remove('open');
  }

  /* ── Utilitários ── */
  function resetContent() {
    labelEl.textContent = 'Selecione um arquivo de log…';
    contentArea.innerHTML = '<p class="logs-placeholder">Nenhum arquivo selecionado.</p>';
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
})();
