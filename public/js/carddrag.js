grid.addEventListener('dragover', (e) => {
  e.preventDefault();
  const afterElement = getDragAfterElement(grid, e.clientY);
  const dragging = document.querySelector('.dragging');
  if (!afterElement) {
    grid.appendChild(dragging);
  } else {
    grid.insertBefore(dragging, afterElement);
  }
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