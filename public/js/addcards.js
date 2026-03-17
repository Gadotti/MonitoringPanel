function showAddCardModal() {
  // Abre o modal imediatamente com estado de carregamento
  cardSelectionList.innerHTML = `<p style="color:#aaa;">Carregando cards disponíveis...</p>`;
  addCardModal.classList.add('show');

  // Paraleliza os dois fetches em vez de encadeá-los
  Promise.all([
    availableCards.length > 0 ? Promise.resolve(availableCards) : fetchAvailableCards(),
    fetchLayout(selectedView)
  ]).then(([cards, layout]) => {
    availableCards = cards;

    const existingCardIds = new Set(layout.map(card => card.id));
    const cardsToShow = cards.filter(card => !existingCardIds.has(card.id));

    if (cardsToShow.length === 0) {
      cardSelectionList.innerHTML = `<p>Nenhum card disponível para adicionar.</p>`;
    } else {
      cardSelectionList.innerHTML = cardsToShow.map(card => `
        <div>
          <label>
            <input type="checkbox" value="${card.id}" /> ${card.title}
          </label>
        </div>
      `).join('');
    }
  }).catch(err => {
    console.error('Erro ao carregar cards disponíveis:', err);
    cardSelectionList.innerHTML = `<p style="color:#e74c3c;">Erro ao carregar cards.</p>`;
  });
}

function closeAddCard() {
  addCardModal.classList.remove('show');
}

function confirmAddCards() {
  const selectedCheckboxes = [...cardSelectionList.querySelectorAll('input[type="checkbox"]:checked')];
  const selectedCardIds = selectedCheckboxes.map(cb => cb.value);
  const cardsToAdd = availableCards.filter(card => selectedCardIds.includes(card.id));

  if (!cardsToAdd || cardsToAdd.length === 0) {
    closeAddCard();
    return;
  }

  const grid = document.querySelector('.grid');

  cardsToAdd.forEach(cardConfig => {
    const cardElement = createCardElement(cardConfig);
    grid.appendChild(cardElement);
    initializeCardEvents(cardElement);
  });

  saveLayoutConfig();
  loadCardsContent();
  closeAddCard();
}

addCardBtn.addEventListener('click', showAddCardModal);
closeAddCardModal.addEventListener('click', closeAddCard);
confirmAddCardsBtn.addEventListener('click', confirmAddCards);