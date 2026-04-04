async function loadViewOptions() {
  const res = await fetch('api/views');
  const views = await res.json();
  
  viewSelector.innerHTML = '';

  views.forEach(view => {
    const option = document.createElement('option');
    option.value = view.value;
    option.textContent = view.title;
    viewSelector.appendChild(option);
  });

  if (!views.some(v => v.value === selectedView)) {
    selectedView = 'default';
  }

  updateViewSelector();
}

function getCurrentView() {  
  return viewSelector?.value || 'default';
}

function updateViewSelector() {  
  if (viewSelector && selectedView) {
    viewSelector.value = selectedView;
  }

  updateUrlForView();
}

function updateUrlForView() {
  const newUrl = `/${selectedView}`;
  window.history.replaceState({}, '', newUrl);
}

function getLayoutConfig() {
  const cards = Array.from(grid.querySelectorAll('.card'));
  return cards.map((card, index) => {
    const title = card.querySelector('.card-header .title').innerText;
    const gridColumn = card.style.gridColumn.match(/span (\d+)/);
    const gridRow = card.style.gridRow.match(/span (\d+)/);

    const zoomWrapper = card.querySelector('.frame-wrapper');
    const zoomFrame = zoomWrapper?.querySelector('iframe');
    const zoomScale = zoomFrame?.dataset.scale || 1;

    return {
      id: card.dataset.id || `card${index + 1}`,
      order: index,
      title: title,
      columns: gridColumn ? parseInt(gridColumn[1]) : 1,
      rows: gridRow ? parseInt(gridRow[1]) : 1,
      zoom: parseFloat(zoomScale)
    };
  });
}

function saveLayoutConfig() {
  const currentView = getCurrentView();
  const config = getLayoutConfig();

  fetch(`/api/layout/${currentView}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(config)
  })
  .then(response => {
    if (!response.ok) throw new Error('Erro ao salvar layout');
  })
  .catch(err => console.error(err));
}

async function fetchLayout(view = 'default') {
  try {
    const response = await fetch(`/api/layout/${view}`);
    if (!response.ok) throw new Error('Erro ao obter layout');
    const data = await response.json();
    return data || [];
  } catch (err) {
    console.error('Erro ao obter layout:', err);
    return [];
  }
}

function loadLayoutConfig() {
  localStorage.setItem('lastView', selectedView);
  updateUrlForView();

  let cardElementsList = [];

  Promise.all([fetchLayout(selectedView), fetchAvailableCards()])
    .then(([layout, allCards]) => {
      const grid = document.querySelector('.grid');
      grid.innerHTML = '';

      const cardPromises = layout.map(async layoutItem => {
        const fullCardConfig = allCards.find(card => card.id === layoutItem.id);
        if (!fullCardConfig) return;

        const mergedConfig = {
          ...fullCardConfig,
          ...layoutItem
        };

        const cardElement = createCardElement(mergedConfig);
        adjustFrameZoom(cardElement, 0, false);
        initializeCardEvents(cardElement);

        cardElementsList.push(cardElement);
      });

      return Promise.all(cardPromises);
    })
  .then(() => {
    renderCardsInOrder(grid, cardElementsList);
    loadCardsContent();
    adjustCardColSpans();
    signSocketListeners();
  })
  .catch(err => {
    console.error('Erro ao carregar configuração do layout:', err);
  });
}

function renderCardsInOrder(container, cardElementsList) {
  const sortedCards = cardElementsList.sort((a, b) => {
    return Number(a.dataset.order) - Number(b.dataset.order);
  });

  sortedCards.forEach(card => {
    container.appendChild(card);
  });
}

function createCardElement(config) {
  const card = document.createElement('div');
  const columns = config.columns ?? 1;
  const rows = config.rows ?? 1;
  const view = config.view ?? '';
  let externalSourceMonitor;
  
  card.className = 'card';
  card.id = config.id;
  card.dataset.id = config.id;
  card.dataset.colSpan = columns;
  card.dataset.rowSpan = rows;
  card.dataset.view = view;
  card.dataset.order = config.order;  
  card.style.gridColumn = `span ${columns}`;
  card.style.gridRow = `span ${rows}`;
  card.setAttribute('draggable', true);
  
  let contentHtml = '';
  let contentZoomControls = '';

  switch (config.cardType) {
    case 'chart':
      externalSourceMonitor = config.sourceItems;
      contentHtml = `<canvas id="chart-${config.id}"></canvas>`;
      break;
    case 'list':
      externalSourceMonitor = config.list?.sourceItems;
      contentHtml = '<ul class="event-list"></ul>';
      break;
    case 'uptime':
      externalSourceMonitor = config.sourceItems;
      contentHtml = "<div class='uptime-card'></div>";
      break;
    case 'cve-assets':
      externalSourceMonitor = config.sourceItems;
      contentHtml = "<div class='asset-card'></div>";
      break;
    case 'frame':
      externalSourceMonitor = config.sourceItems;
      contentZoomControls = `
        <div class="card-zoom-controls">
          <button class="zoom-in-button" title="Aumentar zoom">➕</button>
          <button class="zoom-out-button" title="Reduzir zoom">➖</button>
          <span class="zoom-percentage">(100%)</span>
        </div>
      `;
      contentHtml = `
        <div class="frame-wrapper" data-url="${config.frame.url}" title="Clique para abrir em nova aba">
          <iframe src="${config.frame.url}" frameborder="0"></iframe>
        </div>`;
      break;
    default:
      break;
  }

  card.dataset.externalSourceMonitor = externalSourceMonitor;

  const uptimeEditBtn = config.cardType === 'uptime'
    ? `<button class="uptime-edit-button" title="Editar monitoramento">
         <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
           <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
           <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
         </svg>
       </button>`
    : '';

  card.innerHTML = `          
    <div class="card-header">
      ${contentZoomControls}
      <span class="title">${config.title}</span>
      <div class="card-controls">
        <button class="expand-button" title="Expandir">⛶</button>
        ${uptimeEditBtn}
        <button class="settings-button" title="Opções">⚙️</button>
      </div>
    </div>
    <div class="card-content">
      ${contentHtml}
    </div>
    <div class="resize-handle right"></div>
    <div class="resize-handle bottom"></div>
    <div class="resize-handle corner"></div>          
  `;

  const iframe = getFrameFromCardElement(card);
  if (iframe) {
    const zoomScale = config.zoom ?? 1;
    iframe.dataset.scale = zoomScale;
  }

  return card;
}

function getFrameFromCardElement(cardElement) {
  const wrapper = cardElement.querySelector('.frame-wrapper');
  const iframe = wrapper?.querySelector('iframe');
  return iframe;
}

function adjustFrameZoom(cardElement, delta = 0, saveLayout = true) {  
  const iframe = getFrameFromCardElement(cardElement);
  if (!iframe) return;

  const zoomDisplay = cardElement.querySelector('.zoom-percentage');

  let currentScale = parseFloat(iframe.dataset.scale) || 1.0;
  currentScale = Math.max(0.1, Math.min(2, currentScale + delta));

  iframe.style.transform = `scale(${currentScale})`;
  iframe.style.width = `${100 / currentScale}%`;
  iframe.style.height = `${95 / currentScale}%`;
  iframe.dataset.scale = currentScale.toFixed(2);

  if (zoomDisplay) {
    zoomDisplay.textContent = `(${Math.round(currentScale * 100)}%)`;
  }

  if (saveLayout) {
    saveLayoutConfig();
  }
}

function createChart(ctx, config) {
  return new Chart(ctx, config);
}

async function fetchAvailableCards() {
  try {
    const response = await fetch('/api/cards');
    if (!response.ok) throw new Error('Erro ao carregar os cards');
    const cards = await response.json();
    return cards;
  } catch (err) {
    console.error('Erro ao carregar os cards:', err);
    return [];
  }
}

function loadCardsContent(cardId = '') {  
  fetchAvailableCards().then(cards => {
    cards.forEach((card) => {
      if (cardId !== '' && card.id !== cardId) return;

      switch (card.cardType) {
        case 'chart':
          loadCardContentChart(card);
          break;
        case 'list':      
          loadCardContentList(card);
        case 'frame':
          if (cardId !== '') {
            reloadCardFrame(card);
          }
          break;
        case 'uptime':
          loadCardContentUptime(card);
          break;
        case 'cve-assets':
          loadCardContentCveAssets(card);
          break;
        default:
          break;
      }

      if (card.cardType === 'frame' || card.view) {
        const cardElement = document.getElementById(card.id);
        const expandButton = cardElement?.querySelector('.expand-button');
        if (expandButton) {
          expandButton.style.display = 'block';
        }
      }

      let animateHighlight = true;
      if (card.animateHighlight !== undefined) {
        animateHighlight = card.animateHighlight;
      }

      if (animateHighlight) {
        animateCardHighlight(card.id);
      }
    });
  });  
}

function reloadCardFrame(card) {
  const iframeElement = document.getElementById(card.id)?.querySelector('iframe');
  if (!iframeElement) return;
  iframeElement.src = card.frame.url;
}

async function loadCardContentChart(card) {
  const chartElementId = `chart-${card.id}`;
  const chartElement = document.getElementById(chartElementId);

  if (chartElement && card.cardType === 'chart' && card.chart) {

    if (card.chart.data.datasets[0]?.script) {     
      try {
        const response = await fetch('/api/chart-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scriptPath: card.chart.data.datasets[0].script,
            sourceFile: card.sourceItems
          })
        });

        if (!response.ok) throw new Error(`Erro ao processar dados para gráfico: ${response.status}`);

        const responseData = await response.json();
        const outputJson = JSON.parse(responseData.output);
        card.chart.data.datasets[0].data = outputJson.data;

        if (outputJson.labels) {
          card.chart.data.labels = outputJson.labels;
        }

      } catch (error) {
        console.error('Erro ao carregar eventos:', error);
      }
    }

    if (chartInstances[card.id]) {
      chartInstances[card.id].destroy();
      delete chartInstances[card.id];
    }

    const newChart = new Chart(chartElement, {
      type: card.chart.type,
      data: card.chart.data,
      options: card.chart.options || { responsive: true, maintainAspectRatio: false }
    });

    chartInstances[card.id] = newChart;
  }
}

async function loadCardContentList(card) {
  const cardElement = document.getElementById(card.id);
  if (!cardElement) return;

  let sourceItems = card.list?.sourceItems;
  if (!sourceItems) return;

  const sourceItemsData = await fetchSourceItems(sourceItems, card.list.limit);    

  const sortedItems = [...sourceItemsData].sort((a, b) => {
    const valA = new Date(a[card.list.orderBy]);
    const valB = new Date(b[card.list.orderBy]);
    return card.list.order === 'asc' ? valA - valB : valB - valA;
  });

  const limitedItems = sortedItems.slice(0, card.list.limit);

  const contentHtml = `
    <ul class="event-list">      
      ${limitedItems.map(item => {
        const pad = n => n.toString().padStart(2, '0');
        const date = new Date(item.timestamp);
        const formattedDate = `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
        
        return `
          <li class="event-item">
            <span class="event-date">${formattedDate}</span>
            <span class="event-name">${item.event}</span>
            <a href="${item.detailsUrl}" target="_blank" class="event-link">Ver detalhes</a>
          </li>
        `;
      }).join('')}
    </ul>
  `;
  
  const eventList = cardElement?.querySelector('ul.event-list');
  if (eventList) {
    eventList.innerHTML = '';
    eventList.insertAdjacentHTML('beforeend', contentHtml);
  } 
}

// ------------------------------------------------------------------ CVE Assets
async function loadCardContentCveAssets(card) {
  const cardElement = document.getElementById(card.id);
  if (!cardElement || !card.sourceItems) return;
  
  const wrapper = cardElement.querySelector('.asset-card');

  try {
    const filePath = card.sourceItems.replace(/^public\//, '').trim();
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Erro ao carregar CVE report: ${response.status}`);
    }

    const data = await response.json();

    const lastScan    = data?.last_scan;
    const reportItems = data?.report_items || [];

    let cveReportBlocksHtml = '';

    reportItems.forEach(report => {
      const url            = report.url;
      const name           = report.name;
      const currentVersion = report.current_version;
      const risk           = report.risk  || '';
      const alert          = report.alert || '—';
      const pubEndDate     = report.pubEndDate_checked || '—';

      const cvesList = report.cves || [];

      let riskCss = '';
      switch ((risk || '').toLowerCase()) {
        case 'high':   riskCss = 'risco-alto';  break;
        case 'medium': riskCss = 'risco-medio'; break;
        case 'low':    riskCss = 'risco-baixo'; break;
        default:       riskCss = 'risco-nao';   break;
      }

      const counts = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 };
      cvesList.forEach(cve => {
        const s = (cve.severity || '').toLowerCase();
        if (counts[s] !== undefined) counts[s]++;
        else counts.unknown++;
      });

      const totalCves = cvesList.length;

      // ── Linhas de CVE com trigger de avaliação manual ──
      const cveItemsHtml = cvesList.map(cve => {
        const sev              = (cve.severity || 'UNKNOWN').toLowerCase();
        const aiNote           = cve.claude_ai_assessment || '';
        const pubDate          = cve.published_date || '';
        const currentAssessment = cve.assessment || '';

        const triggerLabel      = currentAssessment || 'Avaliar…';
        const triggerLabelClass = currentAssessment
          ? 'cve-assess-label cve-assess-label--set'
          : 'cve-assess-label';

        return `
          <div class="cve-item">
            <div class="cve-id">${cve.cve_id}</div>
            <div class="cve-body">
              <div class="cve-desc">${cve.description || ''}</div>
              ${pubDate ? `<div class="cve-meta"><span class="cve-meta-label">Publicado:</span> ${pubDate}</div>` : ''}
              ${aiNote  ? `<div class="cve-meta cve-ai-note"><span class="cve-meta-label">IA:</span> ${aiNote}</div>` : ''}
              <div class="cve-assess-wrapper">
                <button class="cve-assess-trigger" type="button"
                        data-cve-id="${cve.cve_id}"
                        data-report-item-id="${report.id}"
                        data-current-assessment="${currentAssessment}">
                  <span class="${triggerLabelClass}">${triggerLabel}</span>
                  <svg class="cve-assess-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
              </div>
            </div>
            <div class="cve-severity ${sev}">${cve.severity || 'UNKNOWN'}</div>
          </div>
        `;
      }).join('');

      cveReportBlocksHtml += `
        <div class="asset-row" onclick="toggleCveAssetsDetails(this)">
          <div class="col url">
            <span class="asset-toggle-icon">▶</span>
            <a href="${url}" target="_blank" class="asset-url-link" onclick="event.stopPropagation()">${url}</a>
          </div>
          <div class="col ativo">${name}</div>
          <div class="col versao">${currentVersion}</div>
          <div class="col cves-count">${totalCves}</div>
          <div class="col risco"><span class="${riskCss}">${risk}</span></div>
        </div>
        <div class="asset-details asset-collapsible">
          <div class="details-content">
            <div class="details-meta-grid">
              <div><span class="details-label">Alerta:</span> ${alert}</div>
              <div><span class="details-label">Verificado em:</span> ${pubEndDate}</div>
              ${counts.critical ? `<div><span class="cve-severity critical">CRITICAL</span> ${counts.critical}</div>` : ''}
              ${counts.high     ? `<div><span class="cve-severity high">HIGH</span> ${counts.high}</div>` : ''}
              ${counts.medium   ? `<div><span class="cve-severity medium">MEDIUM</span> ${counts.medium}</div>` : ''}
              ${counts.low      ? `<div><span class="cve-severity low">LOW</span> ${counts.low}</div>` : ''}
            </div>
            ${totalCves ? `
              <div class="cve-list-header">CVEs Identificados (${totalCves})</div>
              <div class="cve-list">${cveItemsHtml}</div>
            ` : '<p style="color:var(--text-muted);font-size:0.82rem;">Nenhum CVE registrado.</p>'}
          </div>
        </div>
      `;
    });

    wrapper.innerHTML = `
      <div class="asset-card-content">
        <div class="asset-header">
          <div class="col url">URL / Ativo</div>
          <div class="col ativo">Nome</div>
          <div class="col versao">Versão</div>
          <div class="col cves-count">CVEs</div>
          <div class="col risco">Risco</div>
        </div>
        <div class="asset-list">
          ${cveReportBlocksHtml || '<p style="padding:12px;color:var(--text-muted);">Nenhum item no relatório.</p>'}
        </div>
        <div class="asset-footer">
          Última varredura: ${lastScan || '—'}
        </div>
      </div>
    `;

    const contentArea = cardElement.querySelector('.card-content');
    contentArea.innerHTML = '';
    contentArea.appendChild(wrapper);

    // Inicializa dropdowns após inserção no DOM
    initCveAssessmentDropdowns(cardElement, card.id, card.sourceItems);

  } catch (err) {
    console.error(`Erro ao carregar dados de cve assets para ${card.id}:`, err);
  }
}

function toggleCveAssetsDetails(row) {
  const isExpanded = row.classList.toggle('expanded');
  const metaEl = row.nextElementSibling;

  if (metaEl && metaEl.classList.contains('asset-collapsible')) {
    metaEl.classList.toggle('expanded', isExpanded);
  }
}

// ------------------------------------------------------------------ CVE Assessment — painel flutuante

/**
 * Retorna (criando se necessário) o único painel flutuante #cve-assess-panel.
 * Appendado ao <body> para escapar de qualquer overflow:hidden/auto dos
 * containers pai (.cve-list, .asset-collapsible, etc.).
 */
function getCveAssessPanel() {
  let panel = document.getElementById('cve-assess-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'cve-assess-panel';
    document.body.appendChild(panel);
  }
  return panel;
}

/** Fecha o painel e remove a marcação .open do trigger ativo. */
function closeCveAssessPanel() {
  const panel = document.getElementById('cve-assess-panel');
  if (!panel) return;
  panel.classList.remove('open');
  panel._activeTrigger = null;

  document.querySelectorAll('.cve-assess-trigger.open').forEach(t => {
    t.classList.remove('open');
  });
}

/**
 * Inicializa os triggers de avaliação manual de CVE para um card específico.
 * Cada trigger abre o painel flutuante compartilhado posicionado via
 * position:fixed, evitando corte por overflow dos containers pai.
 *
 * @param {HTMLElement} cardElement  - Elemento DOM do card
 * @param {string}      cardId       - ID do card (para suprimir WS update)
 * @param {string}      sourceFile   - Caminho do arquivo JSON de CVEs
 */
function initCveAssessmentDropdowns(cardElement, cardId, sourceFile) {
  const ASSESSMENT_OPTIONS = ['Acknowledge/Mitigating', 'False Positive', 'Accepted Risk'];

  cardElement.querySelectorAll('.cve-assess-trigger').forEach(trigger => {
    trigger.addEventListener('click', function (e) {
      e.stopPropagation();

      const panel = getCveAssessPanel();

      // Se este trigger já está aberto, apenas fecha
      if (panel._activeTrigger === trigger && panel.classList.contains('open')) {
        closeCveAssessPanel();
        return;
      }

      // Fecha qualquer painel aberto anteriormente
      closeCveAssessPanel();

      const currentAssessment = trigger.dataset.currentAssessment || '';
      const cveId             = trigger.dataset.cveId;
      const reportItemId      = trigger.dataset.reportItemId;

      // ── Popula o painel com as opções deste CVE ──
      panel.innerHTML = ASSESSMENT_OPTIONS.map(opt => `
        <button class="cve-assess-option${currentAssessment === opt ? ' selected' : ''}" type="button" data-value="${opt}">
          <span class="cve-assess-option-icon">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </span>
          <span class="cve-assess-option-label">${opt}</span>
        </button>
      `).join('');

      // ── Posiciona o painel abaixo do trigger via getBoundingClientRect ──
      const rect     = trigger.getBoundingClientRect();
      const panelW   = 170; // estimativa; será ajustado pelo min-width do CSS
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp     = spaceBelow < 130 && rect.top > 130;

      panel.style.left = `${Math.min(rect.left, window.innerWidth - panelW - 8)}px`;
      if (openUp) {
        panel.style.bottom = `${window.innerHeight - rect.top + 4}px`;
        panel.style.top    = 'auto';
      } else {
        panel.style.top    = `${rect.bottom + 4}px`;
        panel.style.bottom = 'auto';
      }

      panel._activeTrigger = trigger;
      panel.classList.add('open');
      trigger.classList.add('open');

      // ── Wira as opções ──
      panel.querySelectorAll('.cve-assess-option').forEach(option => {
        option.addEventListener('click', async function (ev) {
          ev.stopPropagation();

          const value = option.dataset.value;

          // Atualiza trigger de forma otimista
          const label = trigger.querySelector('.cve-assess-label');
          label.textContent = value;
          label.classList.add('cve-assess-label--set');
          trigger.dataset.currentAssessment = value;

          closeCveAssessPanel();

          // Suprime reload via WebSocket durante a janela de escrita
          suppressedCardUpdates.add(cardId);

          try {
            const response = await fetch(
              `/api/cve-assessment?file=${encodeURIComponent(sourceFile)}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reportItemId, cveId, assessment: value })
              }
            );
            if (!response.ok) {
              console.error('Erro ao salvar assessment de CVE:', response.status);
            }
          } catch (err) {
            console.error('Erro ao salvar assessment de CVE:', err);
          } finally {
            // Remove supressão após 5 s — suficiente para absorver o eco do WebSocket
            setTimeout(() => suppressedCardUpdates.delete(cardId), 5000);
          }
        });
      });
    });
  });
}

async function loadCardContentUptime(card) {  
  const cardElement = document.getElementById(card.id);
  if (!cardElement || !card.sourceItems) return;
  
  const wrapper = cardElement.querySelector('.uptime-card');

  try {
    const filePath = card.sourceItems.replace(/^public\//, '').trim();
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Erro ao carregar status de uptime: ${response.status}`);
    }

    const data = await response.json();
    const item = Array.isArray(data) ? data[0] : data;

    const servicesStatus = item?.servicesStatus || [];

    let uptimeBlocksHtml = '';

    servicesStatus.forEach(service => {
      const url = service.url;
      const name = service.name ?? service.url;
      const status = service.status.toLowerCase();
      const statusText = status === 'online' ? 'Online' : 'Offline';

      let lastOnline = '-';
      if (service.lastStatusOnline && service.lastStatusOnline !== '') {
        lastOnline = new Date(service.lastStatusOnline).toLocaleString('pt-BR', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
      }

      let lastOffline = '-';
      if (service.lastStatusOffline && service.lastStatusOffline !== '') {
        lastOffline = new Date(service.lastStatusOffline).toLocaleString('pt-BR', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
      }

      uptimeBlocksHtml += `
        <div class="uptime-header" onclick="toggleUptimeMeta(this)">
          <div class="uptime-header-left">
            <span class="uptime-toggle-icon">▶</span>
            <a class="uptime-url" target="_blank" href="${url}">${name}</a>
          </div>
          <div class="uptime-status-indicator ${status}">${statusText}</div>
        </div>
        <div class="uptime-meta collapsible">
          <div class="uptime-time"><strong>Última vez online:</strong> ${lastOnline}</div>
          <div class="uptime-time"><strong>Última vez offline:</strong> ${lastOffline}</div>
        </div>
      `;
    });

    const lastChecked = new Date(item?.lastChecked || null);
    const formattedDate = !isNaN(lastChecked)
      ? lastChecked.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }).replace(',', '')
      : 'Data inválida';

    wrapper.innerHTML = `
    <div class="uptime-card-content">
      ${uptimeBlocksHtml}
      <div class="uptime-footer">
        <span class="uptime-label">Última verificação:</span>
        <span class="uptime-date">${formattedDate}</span>
      </div>
    </div>
    `;

    const contentArea = cardElement.querySelector('.card-content');
    contentArea.innerHTML = '';
    contentArea.appendChild(wrapper);    
  } catch (err) {
    console.error(`Erro ao carregar dados de uptime para ${card.id}:`, err);
  }
}

function toggleUptimeMeta(headerEl) {
  const isExpanded = headerEl.classList.toggle('expanded');
  const metaEl = headerEl.nextElementSibling;

  if (metaEl && metaEl.classList.contains('collapsible')) {
    metaEl.classList.toggle('expanded', isExpanded);
  }
}

async function fetchSourceItems(sourceItems, limit) {
  if (!sourceItems) return [];

  try {
    const url = `/api/partial-csv?file=${encodeURIComponent(sourceItems)}&limit=${limit}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Erro ao buscar o arquivo: ${response.status}`);
    }

    const csvText = await response.text();
    return csvToJson(csvText);
  } catch (error) {
    console.error('Erro ao carregar eventos:', error);
    return [];
  }
}

function adjustCardColSpans() {
  const cards = grid.querySelectorAll('.card');

  const gridWidth = grid.clientWidth;
  const colMinWidth = 280;
  const maxCols = Math.floor(gridWidth / colMinWidth);

  cards.forEach(card => {
    const requestedCols = parseInt(card.dataset.colSpan || '1', 10);
    const spanCols = Math.min(requestedCols, maxCols);
    card.style.gridColumn = `span ${spanCols}`;
  });
}

function animateCardHighlight(cardId) {
  const card = document.getElementById(cardId);
  if (!card) return;

  card.classList.add('highlight');

  setTimeout(() => {
    card.classList.remove('highlight');
  }, 1100);
}