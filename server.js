'use strict';

const fs   = require('fs');
const path = require('path');
const WebSocket = require('ws');
const chokidar  = require('chokidar');

const { createApp } = require('./src/app');

// ------------------------------------------------------------------ configs
const SERVERCONFIG_PATH = path.join(__dirname, 'server-config.json');
const WSCONFIG_PATH     = path.join(__dirname, 'public', 'websocket-config.json');

let serverConfig = {};
try {
  serverConfig = JSON.parse(fs.readFileSync(SERVERCONFIG_PATH, 'utf-8'));
} catch (err) {
  console.error(`Erro ao ler server-config.json: ${err.message}`);
  process.exit(1);
}

let wsConfig = {};
try {
  wsConfig = JSON.parse(fs.readFileSync(WSCONFIG_PATH, 'utf-8'));
} catch (err) {
  console.error(`Erro ao ler websocket-config.json: ${err.message}`);
  process.exit(1);
}

const PORT       = serverConfig.port       || 3123;
const ADDRESS    = serverConfig.address    || 'localhost';
const PYTHON_CMD = serverConfig.python_cmd || 'python';
const WSPORT     = wsConfig.port           || 8123;

console.log('Configurações carregadas:', { PORT, ADDRESS, PYTHON_CMD, WSPORT });

// ------------------------------------------------------------------ HTTP
const app = createApp({ rootDir: __dirname, PYTHON_CMD });

app.listen(PORT, ADDRESS, () => {
  console.log(`Servidor rodando em http://${ADDRESS}:${PORT}`);
});

// ------------------------------------------------------------------ WebSocket
const wss = new WebSocket.Server({ port: WSPORT });
console.log(`WebSocket server escutando na porta ${WSPORT}`);

const watchedFiles = new Map(); // sanitizedPath -> Set<cardId>
const clients      = new Set();

function sanitizePath(partialPath) {
  let p = partialPath.replace(/\/\//g, '/');
  p = p.replace(/\//g, '\\');
  return p;
}

function broadcast(messageObj) {
  const message = JSON.stringify(messageObj);
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

wss.on('connection', (ws) => {
  console.log('Cliente WebSocket conectado.');
  clients.add(ws);

  ws.on('message', (raw) => {
    try {
      const { type, filePath, cardId } = JSON.parse(raw);

      if (type === 'watch') {
        const sanitizedPath = sanitizePath(filePath);

        if (!watchedFiles.has(sanitizedPath)) {
          watchedFiles.set(sanitizedPath, new Set());
          watcher.add(sanitizedPath);
        }
        watchedFiles.get(sanitizedPath).add(cardId);
        console.log(`Monitorando: ${sanitizedPath} -> ${cardId}`);
      }
    } catch (err) {
      console.error('Erro ao processar mensagem WebSocket:', err.message);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log('Cliente desconectado.');
  });
});

const watcher = chokidar.watch([], { ignoreInitial: true });

watcher.on('change', (changedPath) => {
  const sanitizedPath = sanitizePath(changedPath);
  console.log(`Alteração detectada em: ${sanitizedPath}`);

  const cardIds = watchedFiles.get(sanitizedPath);
  if (cardIds) {
    cardIds.forEach((cardId) => broadcast({ type: 'update', cardId }));
  }
});