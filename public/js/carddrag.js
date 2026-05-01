let _dragOverRafPending = false;
let _lastDragX = 0;
let _lastDragY = 0;

grid.addEventListener('dragover', (e) => {
  e.preventDefault();

  // Captura a posição no momento do evento (síncrono) mas adia a mutação
  // do DOM para o próximo frame. Sem isso, o handler dispara centenas de vezes
  // por segundo, cada chamada forçando um layout reflow síncrono via
  // getBoundingClientRect — o que congela cards com DOM complexo (ex.: cve-assets).
  _lastDragX = e.clientX;
  _lastDragY = e.clientY;

  if (_dragOverRafPending) return;
  _dragOverRafPending = true;

  requestAnimationFrame(() => {
    _dragOverRafPending = false;
    const dragging = document.querySelector('.dragging');
    if (!dragging) return;
    placeDraggingCard(grid, dragging, _lastDragX, _lastDragY);
  });
});

function placeDraggingCard(container, dragging, x, y) {
  const cards = container.querySelectorAll('.card:not(.dragging)');
  if (!cards.length) return;

  // Card mais próximo do cursor por distância 2D. O algoritmo anterior
  // usava só Y — em grids multi-coluna isso jogava o item arrastado sempre
  // antes do card mais à esquerda da linha seguinte, ignorando a coluna
  // onde o cursor estava de fato.
  let target = null;
  let targetBox = null;
  let bestDist = Number.POSITIVE_INFINITY;

  for (const card of cards) {
    const box = card.getBoundingClientRect();
    const dx = x - (box.left + box.width / 2);
    const dy = y - (box.top + box.height / 2);
    const dist = Math.hypot(dx, dy);
    if (dist < bestDist) {
      bestDist = dist;
      target = card;
      targetBox = box;
    }
  }

  if (!target) return;

  // Decide o lado da inserção por eixo: dentro da faixa vertical do alvo,
  // compara X (reordena dentro da linha); fora dela, compara Y (reordena
  // entre linhas). Sem essa separação, movimentos laterais dentro de uma
  // linha são interpretados como saltos verticais.
  const onSameRow = y >= targetBox.top && y <= targetBox.bottom;
  const targetCenterX = targetBox.left + targetBox.width / 2;
  const targetCenterY = targetBox.top + targetBox.height / 2;
  const insertBefore = onSameRow ? x < targetCenterX : y < targetCenterY;

  // Early-return quando o card já está na posição final — sem isso, mesmo
  // movimentos minúsculos do cursor reescrevem o DOM e causam piscadas no grid.
  if (insertBefore) {
    if (target.previousElementSibling === dragging) return;
    container.insertBefore(dragging, target);
  } else {
    if (target.nextElementSibling === dragging) return;
    container.insertBefore(dragging, target.nextElementSibling);
  }
}
