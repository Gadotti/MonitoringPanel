function openSettings(card) {
  currentCard = card;

  const style = currentCard.style;
  const colMatch = style.gridColumn.match(/span (\d+)/);
  const rowMatch = style.gridRow.match(/span (\d+)/);

  inputColumns.value = colMatch ? colMatch[1] : 1;
  inputRows.value = rowMatch ? rowMatch[1] : 1;

  const title = card.querySelector('.card-header .title').innerText;
  inputTitle.value = title;

  modal.classList.add('show');
  inputTitle.focus();
}

function closeSettings() {
  modal.classList.remove('show');
  currentCard = null;
}

[inputTitle, inputColumns, inputRows].forEach(input => {
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      btnApply.click();
    }
  });
});

document.getElementById('btn-close').addEventListener('click', closeSettings);

btnApply.addEventListener('click', () => {
  const cols = parseInt(inputColumns.value);
  const rows = parseInt(inputRows.value);
  const newTitle = inputTitle.value.trim();

  if (currentCard) {
    currentCard.style.gridColumn = `span ${cols}`;
    currentCard.style.gridRow = `span ${rows}`;
    currentCard.dataset.colSpan = cols;
    currentCard.dataset.rowSpan = rows;

    const titleElement = currentCard.querySelector('.card-header .title');
    if (titleElement) {
      titleElement.innerText = newTitle;
    }
  }

  saveLayoutConfig();
  closeSettings();
});

btnRemove.addEventListener('click', () => {
  if (!currentCard) return;

  const confirmed = confirm('Tem certeza que deseja remover este card?');

  if (confirmed) {
    currentCard.remove();
    saveLayoutConfig();
    closeSettings();    
  }
});