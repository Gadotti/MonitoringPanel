let WS_HOST;
let WS_PORT;

async function loadWsConfig() {
  try {
    const response = await fetch('../websocket-config.json');
    const config = await response.json();
    WS_PORT = config.port || 8123;
    WS_HOST = window.location.hostname;
  } catch (err) {
    console.error("Erro ao carregar websocket-config.json:", err);
    WS_PORT = 8123;
    WS_HOST = window.location.hostname;
  }
}

// chamada na inicialização da página
loadWsConfig(); // garante que as variáveis fiquem preenchidas antes

function signSocketListeners() {
    const socket = new WebSocket(`ws://${WS_HOST}:${WS_PORT}`);
   
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
            }
        }
    });
}