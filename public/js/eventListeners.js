window.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    if (modal.classList.contains('show')) {
      closeSettings();
    }
    
    if (addCardModal.classList.contains('show')) {
      closeAddCard();
    }

    // Fecha o painel flutuante de assessment de CVE se estiver aberto
    const panel = document.getElementById('cve-assess-panel');
    if (panel && panel.classList.contains('open')) {
      closeCveAssessPanel();
    }
  }
});

window.addEventListener('resize', adjustCardColSpans);

viewSelector.addEventListener('change', (e) => {
  const view = e.target.value; 
  selectedView = view;
  loadLayoutConfig();
  adjustCardColSpans();
});

document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname.replace(/^\/+|\/+$/g, '');

  if (path) {
    selectedView = path;
  } else {
    selectedView = localStorage.getItem('lastView') || 'default';
  } 
  
  loadViewOptions().then(() => {
    loadLayoutConfig();        
  });
});

function initializeCardEvents(card) {  
  const contentArea = card.querySelector('.card-content');

  if (contentArea) {
    contentArea.addEventListener('mouseover', e => {
      if (e.target.closest('.event-list')) {
        card.setAttribute('draggable', false);
      }
    });

    contentArea.addEventListener('mouseout', e => {
      if (e.target.closest('.event-list')) {
        card.setAttribute('draggable', true);
      }
    });
  }

  const frameWrapper = card.querySelector('.frame-wrapper');
  if (frameWrapper) {
    frameWrapper.addEventListener('mouseover', e => {
      if (e.target.closest('.card-content')) {
        card.setAttribute('draggable', false);
      }
    });

    frameWrapper.addEventListener('mouseout', e => {
      if (e.target.closest('.card-content')) {
        card.setAttribute('draggable', true);
      }
    });

    const zoomOutButton = card.querySelector('.zoom-out-button');
    const zoomInButton = card.querySelector('.zoom-in-button');

    if (zoomOutButton && zoomInButton) {
      zoomOutButton.addEventListener('click', () => adjustFrameZoom(card, -0.01));
      zoomInButton.addEventListener('click', () => adjustFrameZoom(card, +0.01));
    }
  }

  const uptimeWrapper = card.querySelector('.uptime-card');
  if (uptimeWrapper) {
    uptimeWrapper.addEventListener('mouseover', e => {
      if (e.target.closest('.card-content')) {
        card.setAttribute('draggable', false);
      }
    });

    uptimeWrapper.addEventListener('mouseout', e => {
      if (e.target.closest('.card-content')) {
        card.setAttribute('draggable', true);
      }
    });
  }

  const cveassetsWrapper = card.querySelector('.asset-card');
  if (cveassetsWrapper) {
    cveassetsWrapper.addEventListener('mouseover', e => {
      if (e.target.closest('.card-content')) {
        card.setAttribute('draggable', false);
      }
    });

    cveassetsWrapper.addEventListener('mouseout', e => {
      if (e.target.closest('.card-content')) {
        card.setAttribute('draggable', true);
      }
    });
  }

  card.setAttribute('draggable', true);

  card.addEventListener('dragstart', (e) => {
    draggedItem = card;

    // Usa um ghost leve no lugar do snapshot do card completo.
    // Sem isso, o browser tira uma captura visual de todo o DOM do card no
    // momento do dragstart — em cards com conteúdo pesado (ex.: cve-assets
    // com centenas de itens) isso causa um freeze perceptível de vários segundos.
    const title = card.querySelector('.card-header .title')?.innerText || '';
    const ghost = document.createElement('div');
    ghost.textContent = title;
    ghost.style.cssText = [
      'position:fixed',
      'top:-200px',          // fora da área visível; necessário para setDragImage funcionar
      'left:0',
      'width:200px',
      'padding:8px 14px',
      'background:var(--card-bg,#2b2b3d)',
      'border:1px solid var(--border-mid,rgba(255,255,255,0.11))',
      'border-radius:8px',
      'color:var(--text-bright,#f0f0f5)',
      'font-size:0.83rem',
      'font-family:Segoe UI,system-ui,sans-serif',
      'font-weight:600',
      'white-space:nowrap',
      'overflow:hidden',
      'text-overflow:ellipsis',
      'pointer-events:none',
      'z-index:-1',
    ].join(';');
    document.body.appendChild(ghost);

    e.dataTransfer.setDragImage(ghost, 100, 22);

    setTimeout(() => {
      card.classList.add('dragging');
      if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
    }, 0);
  });

  card.addEventListener('dragend', () => {
    draggedItem = null;
    document.querySelectorAll('.card').forEach(c => c.classList.remove('dragging'));
    saveLayoutConfig();
  });

  const rightHandle = card.querySelector('.resize-handle.right');
  const bottomHandle = card.querySelector('.resize-handle.bottom');
  const cornerHandle = card.querySelector('.resize-handle.corner');

  if (rightHandle) rightHandle.addEventListener('mousedown', e => startResize(e, card, 'right'));
  if (bottomHandle) bottomHandle.addEventListener('mousedown', e => startResize(e, card, 'bottom'));
  if (cornerHandle) cornerHandle.addEventListener('mousedown', e => startResize(e, card, 'corner'));

  const settingsButton = card.querySelector('.settings-button');
  if (settingsButton) {
    settingsButton.addEventListener('click', (e) => {
      openSettings(card);
    });
  }

  const expandButton = card.querySelector('.expand-button');
  if (expandButton) {
    expandButton.addEventListener('click', (e) => {
      e.stopPropagation();

      const frameWrapper = card.querySelector('.frame-wrapper');
      if (frameWrapper && frameWrapper.dataset.url) {
        window.open(frameWrapper.dataset.url, '_blank');
      } else {
        if (card.dataset.view && card.dataset.view !== '') {
          window.open(card.dataset.view, '_blank');
        }        
      }
    });
  }

  // ── Botão de edição de monitoramento (cards do tipo uptime) ──
  const uptimeEditButton = card.querySelector('.uptime-edit-button');
  if (uptimeEditButton) {
    uptimeEditButton.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof openUptimeEditor === 'function') {
        openUptimeEditor(card);
      }
    });
  }

  // ── Botão de edição de métrica (cards do tipo metric) ──
  const metricEditButton = card.querySelector('.metric-edit-button');
  if (metricEditButton) {
    metricEditButton.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof openMetricEditor === 'function') {
        openMetricEditor(card);
      }
    });
  }
}

// ── Fecha o painel flutuante de assessment ao clicar fora dele ou do trigger ──
document.addEventListener('click', (e) => {
  const panel = document.getElementById('cve-assess-panel');
  if (!panel || !panel.classList.contains('open')) return;

  const activeTrigger = document.querySelector('.cve-assess-trigger.open');
  const clickedInsidePanel   = panel.contains(e.target);
  const clickedInsideTrigger = activeTrigger && activeTrigger.contains(e.target);

  if (!clickedInsidePanel && !clickedInsideTrigger) {
    closeCveAssessPanel();
  }
});