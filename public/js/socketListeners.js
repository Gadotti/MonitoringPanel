function signSocketListeners() {
    const socket = new WebSocket('ws://localhost:8080');
   
    socket.addEventListener('open', () => {
        console.log('WebSocket conectado.');

        // Para cada card com origem de dados, envia a solicitação de "watch"
        const cards = grid.querySelectorAll('.card');
        cards.forEach(card => {   
            if (!card.dataset.externalSourceMonitor || card.dataset.externalSourceMonitor === 'undefined') return

            const filePath = card.dataset.externalSourceMonitor;
            const cardId = card.dataset.id;
            socket.send(JSON.stringify({
                type: 'watch',
                filePath,
                cardId
            }));
        });
    });

    socket.addEventListener('message', async (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === 'update') {
            const card = document.getElementById(msg.cardId);
            
            if (card) {
                loadCardsContent(card.id);                
                animateCardHighlight(card.id);
            }
        }
    });
}