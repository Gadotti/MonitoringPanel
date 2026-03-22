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

  /**
   * Converte um título livre num slug seguro para nome de arquivo.
   * Ex: "Minha Visão"  →  "minha-visao"
   */
  function slugify(str) {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')   // remove diacríticos
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')      // remove caracteres especiais
      .replace(/\s+/g, '-')              // espaços → hífens
      .replace(/-+/g, '-')              // hífens múltiplos → um
      .replace(/^-+|-+$/g, '');          // remove hífens nas bordas
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

  // ------------------------------------------------------------------ POST /api/views
  app.post('/api/views', (req, res) => {
    const { title } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'O campo "title" é obrigatório.' });
    }

    const value = slugify(title.trim());

    if (!value) {
      return res.status(400).json({ error: 'Título inválido: não gerou um identificador válido.' });
    }

    fs.readFile(VIEWS_PATH, 'utf8', (err, data) => {
      if (err) {
        return res.status(500).json({ error: 'Erro ao ler visões' });
      }

      let views;
      try {
        views = JSON.parse(data);
      } catch {
        return res.status(500).json({ error: 'Erro ao interpretar visões' });
      }

      if (views.some(v => v.value === value)) {
        return res.status(409).json({ error: `Já existe uma visão com o identificador "${value}".` });
      }

      const newView = { value, title: title.trim() };
      views.push(newView);

      fs.writeFile(VIEWS_PATH, JSON.stringify(views, null, 2), 'utf8', (writeErr) => {
        if (writeErr) {
          return res.status(500).json({ error: 'Erro ao salvar visões' });
        }

        // Cria o arquivo de layout vazio para a nova visão
        const lPath = layoutPath(value);
        fs.writeFile(lPath, '[]', 'utf8', (layoutErr) => {
          if (layoutErr) {
            return res.status(500).json({ error: 'Visão criada, mas erro ao inicializar o layout.' });
          }
          res.status(201).json(newView);
        });
      });
    });
  });

  // ------------------------------------------------------------------ DELETE /api/views/:viewName
  app.delete('/api/views/:viewName', (req, res) => {
    const { viewName } = req.params;

    fs.readFile(VIEWS_PATH, 'utf8', (err, data) => {
      if (err) {
        return res.status(500).json({ error: 'Erro ao ler visões' });
      }

      let views;
      try {
        views = JSON.parse(data);
      } catch {
        return res.status(500).json({ error: 'Erro ao interpretar visões' });
      }

      if (!views.some(v => v.value === viewName)) {
        return res.status(404).json({ error: `Visão "${viewName}" não encontrada.` });
      }

      const updated = views.filter(v => v.value !== viewName);

      fs.writeFile(VIEWS_PATH, JSON.stringify(updated, null, 2), 'utf8', (writeErr) => {
        if (writeErr) {
          return res.status(500).json({ error: 'Erro ao salvar visões' });
        }

        // Remove o arquivo de layout se existir (falha silenciosa — não impede o sucesso)
        const lPath = layoutPath(viewName);
        if (fs.existsSync(lPath)) {
          fs.unlink(lPath, () => {});
        }

        res.sendStatus(200);
      });
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

  // ------------------------------------------------------------------ GET /api/logs
  app.get('/api/logs', (req, res) => {
    const logsDir = path.join(rootDir, 'scripts', 'logs');

    if (!fs.existsSync(logsDir)) {
      return res.json([]);
    }

    fs.readdir(logsDir, (err, files) => {
      if (err) {
        return res.status(500).json({ error: 'Erro ao listar logs' });
      }
      const logs = files
        .filter(f => f.endsWith('.log'))
        .sort();
      res.json(logs);
    });
  });

  // ------------------------------------------------------------------ GET /api/logs/:filename
  app.get('/api/logs/:filename', (req, res) => {
    const { filename } = req.params;

    // Bloqueia traversal e garante somente .log
    if (filename.includes('..') || filename.includes('/') || !filename.endsWith('.log')) {
      return res.status(400).json({ error: 'Nome de arquivo inválido.' });
    }

    const filePath = path.join(rootDir, 'scripts', 'logs', filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Arquivo não encontrado.' });
    }

    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        return res.status(500).json({ error: 'Erro ao ler arquivo de log.' });
      }
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.send(data);
    });
  });

  // ------------------------------------------------------------------ GET /api/uptime-config
  app.get('/api/uptime-config', (req, res) => {
    const filePath = req.query.file;
    if (!filePath) {
      return res.status(400).json({ error: 'Parâmetro "file" é obrigatório.' });
    }

    const resolved = path.resolve(rootDir, filePath);
    if (!resolved.startsWith(rootDir)) {
      return res.status(400).json({ error: 'Caminho inválido.' });
    }

    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ error: 'Arquivo não encontrado.' });
    }

    fs.readFile(resolved, 'utf8', (err, data) => {
      if (err) return res.status(500).json({ error: 'Erro ao ler arquivo.' });
      try {
        res.json(JSON.parse(data));
      } catch {
        res.status(500).json({ error: 'Arquivo JSON inválido.' });
      }
    });
  });

  // ------------------------------------------------------------------ POST /api/uptime-config
  app.post('/api/uptime-config', (req, res) => {
    const filePath = req.query.file;
    if (!filePath) {
      return res.status(400).json({ error: 'Parâmetro "file" é obrigatório.' });
    }

    const resolved = path.resolve(rootDir, filePath);
    if (!resolved.startsWith(rootDir)) {
      return res.status(400).json({ error: 'Caminho inválido.' });
    }

    const { servicesStatus, notificationHook } = req.body;
    if (!Array.isArray(servicesStatus)) {
      return res.status(400).json({ error: 'Campo "servicesStatus" deve ser um array.' });
    }

    // Preserva campos de sistema do arquivo atual (status, lastStatusOn/Offline, lastChecked)
    fs.readFile(resolved, 'utf8', (err, data) => {
      let current = {};
      if (!err) {
        try { current = JSON.parse(data); } catch { /* arquivo corrompido — sobrescreve */ }
      }

      const currentServices = current.servicesStatus || [];

      // Mescla: mantém campos de monitoramento existentes; substitui campos editáveis
      const merged = servicesStatus.map(incoming => {
        const existing = currentServices.find(s => s.url === incoming.url) || {};
        return {
          url:                 incoming.url,
          name:                incoming.name,
          expectedHttpRespose: incoming.expectedHttpRespose,
          notificationHookMode: incoming.notificationHookMode || 'when-offline',
          // campos gerenciados pelo script — preservados se existirem
          status:              existing.status              || 'offline',
          lastStatusOnline:    existing.lastStatusOnline   || '',
          lastStatusOffline:   existing.lastStatusOffline  || '',
        };
      });

      const updated = {
        ...current,
        notificationHook: notificationHook ?? (current.notificationHook || ''),
        lastChecked:      current.lastChecked || '',
        servicesStatus:   merged,
      };

      fs.writeFile(resolved, JSON.stringify(updated, null, 2), 'utf8', (writeErr) => {
        if (writeErr) return res.status(500).json({ error: 'Erro ao salvar arquivo.' });
        res.sendStatus(200);
      });
    });
  });

  // ------------------------------------------------------------------ SPA fallback
  app.get('/:view?', (req, res) => {
    res.sendFile(path.join(rootDir, 'public', 'index.html'));
  });

  return app;
}

module.exports = { createApp };