'use strict';

const fs   = require('fs');
const path = require('path');
const WebSocket = require('ws');
const chokidar  = require('chokidar');

const { createApp }     = require('./src/app');
const { validateSession } = require('./src/auth');

const VERBOSE = process.argv.includes('--verbose');

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

wss.on('connection', (ws, req) => {
  const urlObj = new URL(req.url, 'http://localhost');
  const token  = urlObj.searchParams.get('token') || '';

  // Reject if auth is configured and token is invalid
  const usersPath = path.join(__dirname, 'configs', 'users.json');
  let authEnabled = false;
  try {
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    authEnabled = Array.isArray(users) && users.length > 0;
  } catch { /* no users file — auth not configured */ }

  if (authEnabled && !validateSession(token)) {
    ws.close(4401, 'Unauthorized');
    return;
  }

  if (VERBOSE) console.log('Cliente WebSocket conectado.');
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
        if (VERBOSE) console.log(`Monitorando: ${sanitizedPath} -> ${cardId}`);
      }
    } catch (err) {
      if (VERBOSE) console.error('Erro ao processar mensagem WebSocket:', err.message);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    if (VERBOSE) console.log('Cliente desconectado.');
  });
});

const watcher = chokidar.watch([], { ignoreInitial: true, usePolling: true, interval: 3000 });

watcher.on('change', (changedPath) => {
  const sanitizedPath = sanitizePath(changedPath);
  if (VERBOSE) console.log(`Alteração detectada em: ${sanitizedPath}`);

  const cardIds = watchedFiles.get(sanitizedPath);
  if (cardIds) {
    cardIds.forEach((cardId) => broadcast({ type: 'update', cardId }));
  }
});

// ------------------------------------------------------------------ HTTP
const app = createApp({
  rootDir: __dirname,
  PYTHON_CMD,
  getHealthInfo() {
    const watched = {};
    watchedFiles.forEach((cardIds, filePath) => {
      watched[filePath] = Array.from(cardIds);
    });

    return {
      websocket: {
        status: wss.address() ? 'ok' : 'error',
        port: WSPORT,
        connectedClients: clients.size,
      },
      watchers: {
        totalFiles: watchedFiles.size,
        watched,
      },
    };
  },
});

app.listen(PORT, ADDRESS, () => {
  console.log(`Servidor rodando em http://${ADDRESS}:${PORT}`);
});