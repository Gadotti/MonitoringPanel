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
