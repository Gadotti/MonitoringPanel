/* ================================================
   HEALTH CHECK — Status do servidor, WebSocket e watchers
   ================================================ */

(function () {
  const modal      = document.getElementById('health-modal');
  const openBtn    = document.getElementById('btn-health-check');
  const closeBtn   = document.getElementById('close-health-modal');
  const refreshBtn = document.getElementById('btn-health-refresh');
  const grid       = document.getElementById('hc-grid');

  if (!modal || !openBtn) return;

  /* ── Abre o modal ── */
  openBtn.addEventListener('click', () => {
    modal.classList.add('show');
    loadHealth();
  });

  /* ── Fecha o modal ── */
  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('show')) closeModal();
  });

  refreshBtn.addEventListener('click', loadHealth);

  function closeModal() {
    modal.classList.remove('show');
  }

  /* ── Carrega dados de health ── */
  async function loadHealth() {
    grid.innerHTML = '<p class="hc-placeholder">Carregando…</p>';

    try {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      renderHealth(data);
    } catch (err) {
      grid.innerHTML = '<p class="hc-placeholder hc-placeholder--error">Erro ao obter status do servidor.</p>';
      console.error(err);
    }
  }

  /* ── Renderiza os dados ── */
  function renderHealth(data) {
    const uptime = formatUptime(data.uptime);
    const ts = data.timestamp ? new Date(data.timestamp).toLocaleString('pt-BR') : '—';

    const ws = data.websocket || {};
    const watchers = data.watchers || {};
    const watched = watchers.watched || {};
    const watchedEntries = Object.entries(watched);

    let watchedHtml = '';
    if (watchedEntries.length === 0) {
      watchedHtml = '<p class="hc-empty">Nenhum arquivo monitorado.</p>';
    } else {
      watchedHtml = watchedEntries.map(([filePath, cardIds]) => `
        <div class="hc-watcher-row">
          <span class="hc-watcher-file" title="${escapeHtml(filePath)}">${escapeHtml(filePath)}</span>
          <span class="hc-watcher-cards">${cardIds.map(id => `<span class="hc-card-tag">${escapeHtml(id)}</span>`).join('')}</span>
        </div>
      `).join('');
    }

    grid.innerHTML = `
      <div class="hc-section">
        <div class="hc-section-title">Servidor</div>
        <div class="hc-info-grid">
          <div class="hc-info-item">
            <span class="hc-info-label">Status</span>
            <span class="hc-status-badge hc-status--${data.status === 'ok' ? 'ok' : 'error'}">${data.status === 'ok' ? 'Online' : 'Erro'}</span>
          </div>
          <div class="hc-info-item">
            <span class="hc-info-label">Uptime</span>
            <span class="hc-info-value">${uptime}</span>
          </div>
          <div class="hc-info-item">
            <span class="hc-info-label">Timestamp</span>
            <span class="hc-info-value">${ts}</span>
          </div>
        </div>
      </div>

      <div class="hc-section">
        <div class="hc-section-title">WebSocket</div>
        <div class="hc-info-grid">
          <div class="hc-info-item">
            <span class="hc-info-label">Status</span>
            <span class="hc-status-badge hc-status--${ws.status === 'ok' ? 'ok' : 'error'}">${ws.status === 'ok' ? 'Online' : 'Erro'}</span>
          </div>
          <div class="hc-info-item">
            <span class="hc-info-label">Porta</span>
            <span class="hc-info-value">${ws.port || '—'}</span>
          </div>
          <div class="hc-info-item">
            <span class="hc-info-label">Clientes conectados</span>
            <span class="hc-info-value">${ws.connectedClients ?? '—'}</span>
          </div>
        </div>
      </div>

      <div class="hc-section">
        <div class="hc-section-title">Watchers (${watchers.totalFiles || 0} arquivos)</div>
        <div class="hc-watcher-list">
          ${watchedHtml}
        </div>
      </div>
    `;
  }

  /* ── Utilitários ── */
  function formatUptime(seconds) {
    if (!seconds && seconds !== 0) return '—';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
})();
