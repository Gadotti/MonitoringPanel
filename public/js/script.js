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
      grid.innerHTML = ''; // Limpa a grid antes de carregar

      const cardPromises = layout.map(async layoutItem => {
        const fullCardConfig = allCards.find(card => card.id === layoutItem.id);
        if (!fullCardConfig) return;

        const mergedConfig = {
          ...fullCardConfig,
          ...layoutItem // sobrescreve colunas, linhas e título
        };

        const cardElement = createCardElement(mergedConfig);
        adjustFrameZoom(cardElement, 0, false);
        initializeCardEvents(cardElement);

        cardElementsList.push(cardElement);
      });

      return Promise.all(cardPromises);
    })
  .then(() => {
    // Só executa isso depois que todos os cards foram adicionados corretamente
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
  // Ordena os elementos com base no dataset.order (convertido para número)
  const sortedCards = cardElementsList.sort((a, b) => {
    return Number(a.dataset.order) - Number(b.dataset.order);
  });

  // Faz o appendChild de cada card ordenadamente no grid
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
      `
      contentHtml = `
        <div class="frame-wrapper" data-url="${config.frame.url}" title="Clique para abrir em nova aba">
          <iframe src="${config.frame.url}" frameborder="0"></iframe>
        </div>`;
      break;
    default:
      break;
  }

  card.dataset.externalSourceMonitor = externalSourceMonitor

  card.innerHTML = `          
    <div class="card-header">
      ${contentZoomControls}
      <span class="title">${config.title}</span>
      <div class="card-controls">
        <button class="expand-button" title="Expandir">⛶</button>
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

  if (chartElement && 
    card.cardType === 'chart' && 
    card.chart) {

      // Se houver script para gerar os dados
      if (card.chart.data.datasets[0]?.script) {     
        
        try {
          const response = await fetch('/api/chart-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              scriptPath: card.chart.data.datasets[0].script,
              sourceFile: card.sourceItems
              // args: ['', '', '']
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

      // Destrói gráfico anterior se existir
      if (chartInstances[card.id]) {
        chartInstances[card.id].destroy();
        delete chartInstances[card.id];
      }

      // Cria novo gráfico
      const newChart = new Chart(chartElement, {
        type: card.chart.type,
        data: card.chart.data,
        options: card.chart.options || { responsive: true, maintainAspectRatio: false }
      });

      // Salva a instância
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

async function loadCardContentCveAssets(card) {
  const cardElement = document.getElementById(card.id);
  if (!cardElement || !card.sourceItems) return;
  
  const wrapper = cardElement.querySelector('.asset-card');

  try {
    const filePath = card.sourceItems.replace(/^public\//, '').trim();
    const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`Erro ao carregar status de uptime: ${response.status}`);
      }

    const data = await response.json();
    const lastChecked = data?.last_checked;
    const reportItens = data?.report_itens || [];

    let cveReportBlocksHtml = '';

    reportItens.forEach(report => {
      const url = report.url;
      const name = report.nome;
      const currentVersion = report.versao_atual;
      const recommendedVersion = report.versao_recomendada;
      const risk = report.risco;
      const upToDate = !report.desatualizada;
      const currentExploits = report.exploits_ativos;
      const alert = report.alerta;
      const upToDateDesc = upToDate ? "Atualizado" : "Desatualizado";
      const upToDateCss = upToDate ? "status-ok" : "status-outdated";

      const cvesList = report.cves || []
      let cveItensListBlockHtml = ''

      let riskCss = '';
      switch (risk.toLowerCase()) {
        case 'alto':
          riskCss = 'risco-alto';          
          break;
        case 'médio':
          riskCss = 'risco-medio';
          break;
        case 'baixo':
          riskCss = 'risco-baixo';
          break;      
        default:
          riskCss = 'risco-nao';
          break;
      }

      cvesList.forEach(cve => {
        cveItensListBlockHtml += `
          <div class="cve-item">
            <div class="cve-id">${cve.cve_id}</div>
            <div class="cve-desc">${cve.descricao}</div>
            <div class="cve-severity ${cve.severity.toLowerCase()}">${cve.severity}</div>
          </div>
        `;
      });

      cveReportBlocksHtml += `
        <div class="asset-row" onclick="toggleCveAssetsDetails(this)">
          <div class="col url" target="_blank" href="${url}">
            <span class="asset-toggle-icon">▶</span>
            ${url}
          </div>
          <div class="col ativo">${name}</div>
          <div class="col versao">${currentVersion}</div>
          <div class="col status"><span class="${upToDateCss}">${upToDateDesc}</span></div>
          <div class="col risco"><span class="${riskCss}">${risk}</span></div>
        </div>
        <div class="asset-details asset-collapsible">
          <div class="details-content">
            <p><strong>Versão recomendada:</strong> ${recommendedVersion}</p>
            <p><strong>Exploits ativos:</strong> ${currentExploits}</p>
            <p><strong>Alerta:</strong> ${alert}</p>
            
            <h4>CVEs Identificados:</h4>
            <div class="cve-list">
              ${cveItensListBlockHtml}
            </div>
          </div>
        </div>
      `;
    });

    wrapper.innerHTML = `
      <div class="asset-card-content">
    
        <div class="asset-header">
          <div class="col url">Url</div>
          <div class="col ativo">Ativo</div>
          <div class="col versao">Versão</div>
          <div class="col status">Status</div>
          <div class="col risco">Risco</div>
        </div>

        <div class="asset-list">
          ${cveReportBlocksHtml}
        </div>

        <div class="asset-footer">
          Última verificação: ${lastChecked}
        </div>
      </div>
    `;

    const contentArea = cardElement.querySelector('.card-content');
    contentArea.innerHTML = '';
    contentArea.appendChild(wrapper);    
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
      const status = service.status.toLowerCase(); // "online" ou "offline"
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
            <a class="uptime-url" target="_blank" href="${url}">${url}</a>
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
    return csvToJson(csvText); // Usa PapaParse ou método próprio
  } catch (error) {
    console.error('Erro ao carregar eventos:', error);
    return [];
  }
}

function adjustCardColSpans() {
  const cards = grid.querySelectorAll('.card');

  const gridWidth = grid.clientWidth;
  const colMinWidth = 280; // mesmo valor do minmax(280px, 1fr)
  const maxCols = Math.floor(gridWidth / colMinWidth);

  cards.forEach(card => {
    const requestedCols = parseInt(card.dataset.colSpan || '1', 10);

    // Use o menor entre o solicitado e o possível
    const spanCols = Math.min(requestedCols, maxCols);

    card.style.gridColumn = `span ${spanCols}`;
  });
}

function animateCardHighlight(cardId) {
  const card = document.getElementById(cardId);
  if (!card) return;

  card.classList.add('highlight');

  // Remove após a animação completar para poder reaplicar futuramente
  setTimeout(() => {
    card.classList.remove('highlight');
  }, 1100); // ligeiramente maior que o tempo da animação
}
