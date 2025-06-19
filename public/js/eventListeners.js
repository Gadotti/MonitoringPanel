window.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    if (modal.classList.contains('show')) {
      closeSettings();
    }
    
    if (addCardModal.classList.contains('show')) {
      closeAddCard();
    }
  }
});

window.addEventListener('resize', adjustCardColSpans);

viewSelector.addEventListener('change', (e) => {
  const view = e.target.value; 
  selectedView = view
  loadLayoutConfig();
  adjustCardColSpans();
});

document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname.replace(/^\/+|\/+$/g, ''); // remove barras

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

  card.setAttribute('draggable', true);

  card.addEventListener('dragstart', (e) => {
    draggedItem = card;
    setTimeout(() => {
      card.classList.add('dragging');
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
}