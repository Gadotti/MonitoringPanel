const express = require('express');
const fs = require('fs');
const path = require('path');
const readline = require('readline')
const { spawn } = require('child_process');;
const app = express();

// Middleware para servir arquivos estáticos
app.use(express.static('public'));
app.use(express.json());
app.use('/local-pages', express.static(__dirname + '/local-pages'));

const CONFIGS_PATH = "configs";
const CONFIG_PATH = path.join(__dirname, CONFIGS_PATH, 'layout.config-{view-name}.json');
const VIEWS_PATH = path.join(__dirname, CONFIGS_PATH, 'views.json');
const CARDS_PATH = path.join(__dirname, "cards", 'cards-list.json');



// Caminhos dos arquivos de configuração
const SERVERCONFIG_PATH = path.join(__dirname, 'server-config.json');
const WSCONFIG_PATH = path.join(__dirname, 'public', 'websocket-config.json');

// Leitura e parse do server-config.json
let serverConfig = {};
try {
  serverConfig = JSON.parse(fs.readFileSync(SERVERCONFIG_PATH, 'utf-8'));
} catch (err) {
  console.error(`Erro ao ler server-config.json: ${err.message}`);
  process.exit(1);
}

// Leitura e parse do websocket-config.json
let wsConfig = {};
try {
  wsConfig = JSON.parse(fs.readFileSync(WSCONFIG_PATH, 'utf-8'));
} catch (err) {
  console.error(`Erro ao ler websocket-config.json: ${err.message}`);
  process.exit(1);
}

// Variáveis globais de configuração
const PORT = serverConfig.port || 3123;
const ADDRESS = serverConfig.address || 'localhost';
const PYTHON_CMD = serverConfig.python_cmd || 'python';
const WSPORT = wsConfig.port || 8123;

console.log('Configurações carregadas:');

// Endpoint para obter o layout atual
app.get('/api/layout/:viewName', (req, res) => {
    const viewName = req.params.viewName;
    const viewPath = CONFIG_PATH.replace('{view-name}', viewName);

    // Verifica se o arquivo existe
    if (!fs.existsSync(viewPath)) {
        return res.json([]); // Retorna um array vazio se o arquivo não existir
    }

    fs.readFile(viewPath, 'utf8', (err, data) => {
        if (err) {
            console.error(`Erro ao ler o layout da visão "${viewName}":`, err);
            return res.status(500).json({ error: `Erro ao ler configuração para visão "${viewName}"` });
        }

        try {
            res.json(JSON.parse(data));
        } catch (parseError) {
            console.error(`Erro ao parsear o layout da visão "${viewName}":`, parseError);
            return res.status(500).json({ error: `Erro ao interpretar configuração para visão "${viewName}"` });
        }
    });
});

// Endpoint para salvar o layout atualizado
app.post('/api/layout/:viewName', (req, res) => {
    const layoutData = req.body;
    const viewName = req.params.viewName;
    const viewPath = CONFIG_PATH.replace('{view-name}', viewName);

    fs.writeFile(viewPath, JSON.stringify(layoutData, null, 2), 'utf8', (err) => {
        if (err) {
            console.error('Erro ao salvar configuração:', err);
            return res.status(500).send('Erro ao salvar configuração');
        }
        res.sendStatus(200);
    });
});

// Rota da API para retornar as visões
app.get('/api/views', (req, res) => {  
  fs.readFile(VIEWS_PATH, 'utf8', (err, data) => {
    if (err) {
        console.error('Erro ao ler o arquivo views.json:', err);
        return res.status(500).json({ error: 'Erro ao ler visões' });
    }
    res.json(JSON.parse(data));
  });
});

// Rota da API para retornar os cards
app.get('/api/cards', (req, res) => {  
  fs.readFile(CARDS_PATH, 'utf8', (err, data) => {
    if (err) {
        console.error('Erro ao ler o arquivo json de cards:', err);
        return res.status(500).json({ error: 'Erro ao ler os cards' });
    }
    res.json(JSON.parse(data));
  });
});

app.get('/version', (req, res) => {  
  fs.readFile("version.json", 'utf8', (err, data) => {
    if (err) {
        console.error('Erro ao ler o arquivo json de versões:', err);
        return res.status(500).json({ error: 'Erro ao ler a versão' });
    }
    res.json(JSON.parse(data));
  });
});

app.get('/api/partial-csv', async (req, res) => {
  //const filePath = sanitizePath(req.query.file);
  const filePath = req.query.file;
  const limit = parseInt(req.query.limit) || 10;

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Arquivo não encontrado' });
  }

  try {
    const lines = [];
    const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: stream });

    let headerLine = null;

    for await (const line of rl) {
      if (!headerLine) {
        headerLine = line;
        continue;
      }

      lines.push(line);
      if (lines.length > limit) {
        lines.shift(); // remove o mais antigo
      }
    }
    
    const finalCsv = [headerLine, ...lines].join('\n');

    // Essa aplicação não pode ser a responsável pela manutenção do tamanho do arquivo, 
    //   isso deve ser delegado para a aplicação que gera e atualizar o arquivo
      // try {
      //   //Temporariamente ignora alterações nesse arquivo
      //   watcher.unwatch(filePath);

      //   //Regrava arquivo para manter apenas os X últimos itens
      //   await fs.promises.writeFile(filePath, finalCsv, 'utf8');

      // } catch (err) {
      //   console.error(err);
      // } finally {
      //   //Reativa o watcher após pequeno atraso para evitar reação ao próprio evento
      //   setTimeout(() => watcher.add(filePath), 100);
      // }
    
    res.setHeader('Content-Type', 'text/csv');
    res.send(finalCsv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao processar CSV' });
  }
});

app.post('/api/chart-data', (req, res) => {
  const { scriptPath, sourceFile,  args } = req.body;

  if (!scriptPath) {
    return res.status(400).json({ error: 'Parâmetro "scriptPath" é obrigatório.' });
  }

  const resolvedScriptPath = path.resolve(__dirname, scriptPath);
  const resolverSourceFile = path.resolve(__dirname, sourceFile);
  console.log(resolvedScriptPath);
  console.log(resolverSourceFile);

  // Garante que os args sejam sempre um array
  // const finalArgs = Array.isArray(args) ? args : [];

  const python = spawn(PYTHON_CMD, [resolvedScriptPath, resolverSourceFile]);

  let stdout = '';
  let stderr = '';

  python.stdout.on('data', data => {
    stdout += data.toString();
  });

  python.stderr.on('data', data => {
    stderr += data.toString();
  });

  python.on('close', code => {
    if (code === 0) {
      res.json({ output: stdout.trim() });
    } else {
      res.status(500).json({
        error: `Erro ao executar o script (code ${code})`,
        stderr: stderr.trim()
      });
    }
  });
});

//Rota dinâmica para qualquer visão
app.get('/:view?', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://${ADDRESS}:${PORT}`);
});

/**************************************************************** 
 * WEB SOCKET
*/

const WebSocket = require('ws');
const chokidar = require('chokidar');
const suppressedFiles = new Set();

const wss = new WebSocket.Server({ port: WSPORT });
console.log(`WebSocket server escutando na porta ${WSPORT}`);

const watchedFiles = new Map(); // filePath -> cardId[]
const clients = new Set(); // conexões WebSocket

function sanitizePath(partialPath) {
  let sanitizedPath = partialPath.replace(/\/\//g, '/');   // Remove barras duplas
  sanitizedPath = sanitizedPath.replace(/\//g, '\\');   // Converte para contra-barras
  sanitizedPath = path.resolve(__dirname, sanitizedPath);

  sanitizedPath = partialPath.replace(/\/\//g, '/');   // Remove barras duplas
  sanitizedPath = sanitizedPath.replace(/\//g, '\\');   // Converte para contra-barras

  return sanitizedPath;
}

wss.on('connection', (ws) => {
  console.log('Cliente WebSocket conectado.');
  clients.add(ws);

  ws.on('close', () => {
    clients.delete(ws);
    console.log('Cliente desconectado.');
  });

  ws.on('message', (msg) => {
    try {
      const { type, filePath, cardId } = JSON.parse(msg);
      if (type === 'watch') {
        const sanitizedPath = sanitizePath(filePath);

        // const resolvedScriptPath = path.resolve(__dirname, sanitizedPath);
        // console.log(resolvedScriptPath);

        if (!watchedFiles.has(sanitizedPath)) {
          watchedFiles.set(sanitizedPath, new Set());
          watcher.add(sanitizedPath);
        }
        watchedFiles.get(sanitizedPath).add(cardId);
        console.log(`Cliente solicitou monitorar: ${sanitizedPath} -> ${cardId}`);
      }
    } catch (e) {
      console.error('Erro ao interpretar mensagem do cliente:', e.message);
    }
  });
});

const watcher = chokidar.watch([], { ignoreInitial: true });

watcher.on('change', (changedPath) => {
  const sanitizedPath = sanitizePath(changedPath);
  console.log(`Alteração detectada em: ${sanitizedPath}`);

  const cardIds = watchedFiles.get(sanitizedPath);
  if (cardIds) {
    cardIds.forEach(cardId => {
      broadcast({ type: 'update', cardId });
    });
  }
});

function broadcast(messageObj) {
  const message = JSON.stringify(messageObj);
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}