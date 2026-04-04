let _dragOverRafPending = false;
let _lastDragY = 0;

grid.addEventListener('dragover', (e) => {
  e.preventDefault();

  // Captura a posição no momento do evento (síncrono) mas adia a mutação
  // do DOM para o próximo frame. Sem isso, o handler dispara centenas de vezes
  // por segundo, cada chamada forçando um layout reflow síncrono via
  // getBoundingClientRect — o que congela cards com DOM complexo (ex.: cve-assets).
  _lastDragY = e.clientY;

  if (_dragOverRafPending) return;
  _dragOverRafPending = true;

  requestAnimationFrame(() => {
    _dragOverRafPending = false;

    const afterElement = getDragAfterElement(grid, _lastDragY);
    const dragging = document.querySelector('.dragging');
    if (!dragging) return;

    if (!afterElement) {
      grid.appendChild(dragging);
    } else {
      grid.insertBefore(dragging, afterElement);
    }
  });
});

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.card:not(.dragging)')];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;

    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child }
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}