function startResize(e, card, direction) {
  e.preventDefault();
  resizing = { card, direction, startX: e.clientX, startY: e.clientY };

  const gridStyle = getComputedStyle(grid);
  resizing.columnWidth = parseFloat(gridStyle.gridAutoColumns) || 280;
  resizing.rowHeight = parseFloat(gridStyle.gridAutoRows) || 200;

  const colMatch = card.style.gridColumn.match(/span (\d+)/);
  const rowMatch = card.style.gridRow.match(/span (\d+)/);

  resizing.startCols = colMatch ? parseInt(colMatch[1]) : 1;
  resizing.startRows = rowMatch ? parseInt(rowMatch[1]) : 1;

  window.addEventListener('mousemove', doResize);
  window.addEventListener('mouseup', stopResize);
}

function doResize(e) {
  if (!resizing) return;
  const dx = e.clientX - resizing.startX;
  const dy = e.clientY - resizing.startY;

  let newCols = resizing.startCols;
  let newRows = resizing.startRows;

  if (resizing.direction === 'right' || resizing.direction === 'corner') {
    newCols = Math.max(1, Math.round(resizing.startCols + dx / 280));
  }
  if (resizing.direction === 'bottom' || resizing.direction === 'corner') {
    newRows = Math.max(1, Math.round(resizing.startRows + dy / 200));
  }

  resizing.card.style.gridColumn = `span ${newCols}`;
  resizing.card.style.gridRow = `span ${newRows}`;
}

function stopResize() {
  window.removeEventListener('mousemove', doResize);
  window.removeEventListener('mouseup', stopResize);
  resizing = null;
  saveLayoutConfig();
}