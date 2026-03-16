'use strict';

const express  = require('express');
const fs       = require('fs');
const path     = require('path');
const readline = require('readline');

/**
 * Cria e retorna a aplicação Express configurada.
 * Não chama app.listen — isso é responsabilidade de server.js.
 *
 * @param {object} config
 * @param {string}   config.rootDir    - __dirname do projeto raiz
 * @param {string}   config.PYTHON_CMD - executável python (ex: "python3")
 * @param {Function} config.spawn      - child_process.spawn (injetável para testes)
 */
function createApp(config = {}) {
  const rootDir    = config.rootDir    || path.resolve(__dirname, '..');
  const PYTHON_CMD = config.PYTHON_CMD || 'python';
  // Injeção de dependência: permite substituir em testes sem jest.mock()
  const spawnFn    = config.spawn      || require('child_process').spawn;

  const CONFIGS_PATH = path.join(rootDir, 'configs');
  const VIEWS_PATH   = path.join(CONFIGS_PATH, 'views.json');
  const CARDS_PATH   = path.join(rootDir, 'cards', 'cards-list.json');

  const app = express();

  app.use(express.static(path.join(rootDir, 'public')));
  app.use(express.json());
  app.use('/local-pages', express.static(path.join(rootDir, 'local-pages')));

  // ------------------------------------------------------------------ helpers
  function layoutPath(viewName) {
    return path.join(CONFIGS_PATH, `layout.config-${viewName}.json`);
  }

  // ------------------------------------------------------------------ GET /api/layout/:viewName
  app.get('/api/layout/:viewName', (req, res) => {
    const viewPath = layoutPath(req.params.viewName);

    if (!fs.existsSync(viewPath)) {
      return res.json([]);
    }

    fs.readFile(viewPath, 'utf8', (err, data) => {
      if (err) {
        return res.status(500).json({ error: `Erro ao ler configuração para visão "${req.params.viewName}"` });
      }
      try {
        res.json(JSON.parse(data));
      } catch {
        res.status(500).json({ error: `Erro ao interpretar configuração para visão "${req.params.viewName}"` });
      }
    });
  });

  // ------------------------------------------------------------------ POST /api/layout/:viewName
  app.post('/api/layout/:viewName', (req, res) => {
    const viewPath = layoutPath(req.params.viewName);

    fs.writeFile(viewPath, JSON.stringify(req.body, null, 2), 'utf8', (err) => {
      if (err) {
        return res.status(500).send('Erro ao salvar configuração');
      }
      res.sendStatus(200);
    });
  });

  // ------------------------------------------------------------------ GET /api/views
  app.get('/api/views', (req, res) => {
    fs.readFile(VIEWS_PATH, 'utf8', (err, data) => {
      if (err) {
        return res.status(500).json({ error: 'Erro ao ler visões' });
      }
      try {
        res.json(JSON.parse(data));
      } catch {
        res.status(500).json({ error: 'Erro ao interpretar visões' });
      }
    });
  });

  // ------------------------------------------------------------------ GET /api/cards
  app.get('/api/cards', (req, res) => {
    fs.readFile(CARDS_PATH, 'utf8', (err, data) => {
      if (err) {
        return res.status(500).json({ error: 'Erro ao ler os cards' });
      }
      try {
        res.json(JSON.parse(data));
      } catch {
        res.status(500).json({ error: 'Erro ao interpretar os cards' });
      }
    });
  });

  // ------------------------------------------------------------------ GET /version
  app.get('/version', (req, res) => {
    const versionPath = path.join(rootDir, 'version.json');
    fs.readFile(versionPath, 'utf8', (err, data) => {
      if (err) {
        return res.status(500).json({ error: 'Erro ao ler a versão' });
      }
      try {
        res.json(JSON.parse(data));
      } catch {
        res.status(500).json({ error: 'Erro ao interpretar a versão' });
      }
    });
  });

  // ------------------------------------------------------------------ GET /api/partial-csv
  app.get('/api/partial-csv', async (req, res) => {
    const filePath = req.query.file;
    const limit    = parseInt(req.query.limit) || 10;

    if (!filePath) {
      return res.status(400).json({ error: 'Parâmetro "file" é obrigatório.' });
    }

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
        if (lines.length > limit) lines.shift();
      }

      const finalCsv = [headerLine, ...lines].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.send(finalCsv);
    } catch (err) {
      res.status(500).json({ error: 'Erro ao processar CSV' });
    }
  });

  // ------------------------------------------------------------------ POST /api/chart-data
  app.post('/api/chart-data', (req, res) => {
    const { scriptPath, sourceFile } = req.body;

    if (!scriptPath) {
      return res.status(400).json({ error: 'Parâmetro "scriptPath" é obrigatório.' });
    }

    const resolvedScript = path.resolve(rootDir, scriptPath);
    const resolvedSource = path.resolve(rootDir, sourceFile || '');

    const python = spawnFn(PYTHON_CMD, [resolvedScript, resolvedSource]);

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', d => { stdout += d.toString(); });
    python.stderr.on('data', d => { stderr += d.toString(); });

    python.on('close', (code) => {
      if (code === 0) {
        res.json({ output: stdout.trim() });
      } else {
        res.status(500).json({
          error: `Erro ao executar o script (code ${code})`,
          stderr: stderr.trim(),
        });
      }
    });
  });

  // ------------------------------------------------------------------ SPA fallback
  app.get('/:view?', (req, res) => {
    res.sendFile(path.join(rootDir, 'public', 'index.html'));
  });

  return app;
}

module.exports = { createApp };