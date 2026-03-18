# CLAUDE.md — Painel 42

## Project Overview

**Painel 42** is a self-hosted, real-time security and infrastructure monitoring dashboard. It renders configurable card-based layouts with charts, event lists, uptime monitors, CVE asset reports, and embedded iframes. The dashboard supports multiple named "views", each with its own independently saved layout, and updates cards in real time via WebSocket when their source data files change on disk.

The project is designed to be lightweight and local-first: data is produced externally by Python scripts (e.g., uptime checkers, CVE scanners, breach feed consumers) and written to JSON/CSV files that the server watches and broadcasts changes from.

---

## Repository Layout

```
painel/
├── server.js                          # Bootstrap only: app.listen + WebSocket server
├── src/
│   └── app.js                         # Express app factory — testável, sem side effects
├── server-config.json                 # Server port, address, python command
├── version.json                       # Current release version
├── package.json
├── jest.setup.js                      # Jest global setup (silencia logs durante testes)
├── release.py                         # Builds a versioned .zip release artifact
│
├── tests/
│   ├── app.smoke.test.js              # Smoke tests: criação do app e SPA fallback
│   ├── api.layout.test.js             # GET /api/layout/:viewName
│   ├── api.layout.save.test.js        # POST /api/layout/:viewName
│   ├── api.meta.test.js               # GET /api/views, /api/cards, /version
│   ├── api.csv.test.js                # GET /api/partial-csv
│   └── api.chartdata.test.js          # POST /api/chart-data
│
├── public/                            # Static assets served to the browser
│   ├── index.html                     # Single-page app shell
│   ├── favicon.svg                    # SVG favicon — ícone dos quadradinhos (accent #cc785c)
│   ├── websocket-config.json          # WebSocket host/port for the frontend
│   ├── css/
│   │   ├── style.css                  # Global layout, grid, cards, modals + design tokens (:root)
│   │   ├── drawer.css                 # Menu gaveta lateral flutuante + design tokens do drawer
│   │   ├── event-list.css             # List card styles
│   │   ├── frame-card.css             # iframe card + zoom controls
│   │   ├── highlight.css              # Card update pulse animation
│   │   ├── uptime-card.css            # Uptime card styles
│   │   └── cve-assets.css             # CVE assets board styles
│   └── js/
│       ├── consts.js                  # DOM references and shared state
│       ├── drawer.js                  # Drawer toggle, estado persistido em localStorage, carga de versão
│       ├── script.js                  # Core: layout load/save, card rendering, content loaders
│       ├── eventListeners.js          # DOM event wiring, card interaction init
│       ├── carddrag.js                # Drag-and-drop card reordering
│       ├── resizecards.js             # Mouse-resize card spans
│       ├── cardsettings.js            # Settings modal (title, cols, rows, remove)
│       ├── addcards.js                # Add-card modal (abertura imediata + fetches paralelos)
│       ├── socketListeners.js         # WebSocket connection and update handling
│       ├── helpers.js                 # CSV parsing utilities
│       └── view-selector.js           # Dropdown customizado de seleção de visão (sincronizado ao <select> oculto)
│
├── cards/
│   ├── cards-list.json                # Master registry of all available cards
│   ├── cards-examples.json            # Example/reference card definitions
│   └── card.schema.json               # JSON schema documenting card structure
│
├── configs/
│   ├── views.json                     # List of named views (value + display title)
│   ├── layout.config-default.json     # Saved layout for the "default" view
│   ├── layout.config-infra.json       # Saved layout for the "infra" view
│   └── layout.config-{view}.json      # Pattern: one file per view
│
├── scripts/
│   ├── check_status.py                # Async HTTP uptime checker; writes uptime JSON
│   ├── check-cve-assets.py            # NVD CVE lookup + risk scoring; writes CVE report JSON
│   └── count_events_by_weekday.py     # Aggregates CSV events into weekday counts for charts
│
└── public/local-*/                    # Runtime data directories (gitignored)
    ├── local-events/                  # CSV event feeds and CVE report JSON
    ├── local-data-uptimes/            # Uptime results JSON
    ├── local-data-charts/             # Pre-computed chart data
    └── local-pages/                   # Embedded local HTML pages (e.g. SSLabs reports)
```

> **Note:** `public/local-*/`, `configs/`, and `cards/cards-list.json` are gitignored because they contain instance-specific runtime data. The repository ships with `cards/cards-examples.json` as a reference and `configs/` must be created per deployment.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| HTTP server | Express 4.x |
| Real-time | WebSocket (`ws` 8.x) |
| File watching | Chokidar 4.x |
| Frontend | Vanilla JS (ES6+), no framework |
| Charts | Chart.js (CDN) |
| Data scripts | Python 3 (`asyncio`, `aiohttp`, `requests`, `beautifulsoup4`) |
| Data formats | JSON (configs, uptime, CVE reports), CSV (event lists) |
| Test runner | Jest 29.x |
| HTTP test client | Supertest 7.x |

---

## Architecture Principles

### Server

- **`server.js` é apenas bootstrap** — lê configs, chama `createApp()` e sobe `app.listen` + WebSocket. Não contém lógica de rotas.
- **`src/app.js` é o app factory** — exporta `createApp({ rootDir, PYTHON_CMD, spawn })`. Não chama `app.listen`. Toda a lógica de rotas vive aqui.
- Essa separação permite que os testes importem o Express app sem subir servidor real ou porta de rede.
- O WebSocket server roda em **porta separada** (padrão `8123`) do HTTP server (padrão `3123`). Clientes subscrevem file paths; o servidor faz broadcast de `{ type: "update", cardId }` quando um arquivo monitorado muda.
- Python scripts são spawned on-demand via `child_process.spawn` para agregação de dados de chart. `spawn` é injetado como dependência em `createApp` para facilitar testes (ver Convenções).
- Layout configs são stored como flat JSON arrays (`layout.config-{view}.json`), um por view. O frontend é autoritativo para mutações de layout; salvar sempre faz POST do layout completo atual.

### WebSocket — detalhes de implementação

- `watchedFiles`: `Map<sanitizedPath, Set<cardId>>` — usa `Set` para evitar cardIds duplicados.
- `sanitizePath()` deve ser aplicado tanto ao receber a mensagem `watch` do cliente quanto ao processar o evento `change` do Chokidar — garante que a chave de inserção e a de lookup no Map sejam sempre idênticas.
- Chokidar iniciado com `{ ignoreInitial: true }` — não dispara eventos para o estado atual dos arquivos ao iniciar, apenas para mudanças reais posteriores.

### Frontend

- The app is a single HTML page. JavaScript files are loaded in a strict dependency order via `<script>` tags in `index.html`. There is no bundler.
- **Ordem de carregamento dos scripts** (deve ser respeitada):
  `consts.js` → `drawer.js` → `cardsettings.js` → `carddrag.js` → `resizecards.js` → `addcards.js` → `helpers.js` → `script.js` → `eventListeners.js` → `socketListeners.js` → `view-selector.js`
- **State is minimal and explicit**: `consts.js` holds all shared DOM references and mutable globals (`currentCard`, `draggedItem`, `resizing`, `selectedView`, `chartInstances`).
- Cards are rendered from two merged sources: the layout config (order, spans, title, zoom) merged over the card definition (type, data, source paths).
- Card content loading is **type-dispatched** in `loadCardsContent()` → one function per `cardType` (`chart`, `list`, `uptime`, `cve-assets`, `frame`).
- Real-time updates use a single WebSocket connection per page load. On reconnection (view change), `signSocketListeners()` re-registers all current cards.

### Navegação — Menu Gaveta Lateral

- O `.top-bar` (header fixo) foi removido. A navegação é feita pelo `<aside class="side-drawer">`, um menu gaveta flutuante à esquerda.
- O drawer possui dois estados: **recolhido** (`56px` — apenas ícones) e **expandido** (`240px` — ícones + labels). O estado é persistido em `localStorage` com a chave `drawer_expanded`.
- `drawer.js` gerencia o toggle, o overlay mobile e carrega a versão via `GET /version` para exibir no rodapé do drawer.
- A seleção de visão usa um dropdown completamente customizado (`.view-selector-custom`). O `<select id="view-selector">` permanece no DOM como fonte de verdade — todo o código existente que referencia `viewSelector` continua funcionando sem alteração. `view-selector.js` sincroniza o dropdown customizado ao select oculto via `MutationObserver` e despacha eventos `change` nativos.
- O ícone principal do drawer (quatro quadradinhos) usa a cor accent `#cc785c` e é também o `favicon.svg` do projeto.

### Add Card — comportamento

- `addcards.js`: ao clicar em "Adicionar Card", o modal abre **imediatamente** com mensagem de carregamento.
- Os dois fetches necessários (`fetchAvailableCards` e `fetchLayout`) são disparados em paralelo com `Promise.all`.
- Se `availableCards` já estiver populado de um carregamento anterior, o fetch de cards é pulado (cache em memória).

### Data Flow

```
External script (Python)
  └─▶ writes file  (CSV / JSON)
        └─▶ Chokidar detects change
              └─▶ WebSocket broadcast  { type: "update", cardId }
                    └─▶ Browser reloads that card's content
```

---

## Card Types

| `cardType` | Renderer | Data source |
|---|---|---|
| `chart` | Chart.js canvas | Inline JSON data, or Python script via `/api/chart-data` |
| `list` | `<ul>` event list | CSV file via `/api/partial-csv` |
| `uptime` | Uptime status list | JSON file (direct fetch from `public/`) |
| `cve-assets` | Collapsible asset table | JSON file (direct fetch from `public/`) |
| `frame` | `<iframe>` with zoom | Any URL or local HTML page |

A card definition lives in `cards/cards-list.json`. Its structure is documented in `cards/card.schema.json`.

---

## Coding Conventions

### JavaScript

- **No framework, no build step.** Plain ES6+ with `async/await`. Files are loaded via `<script src="...">` tags.
- **DOM queries at top of file** — all `getElementById`/`querySelector` calls are centralized in `consts.js`, not scattered across modules.
- **Functions are globally scoped** — since there is no module system, all public functions must be on `window` (implicit). Avoid naming collisions.
- **Card creation is pure** — `createCardElement(config)` returns a DOM node without side effects. Content loading is a separate step via `loadCardsContent()`.
- **Layout save is fire-and-forget** — `saveLayoutConfig()` always POSTs the full current DOM state. Never patch individual fields.
- **CSS class toggles for expand/collapse** — use `.expanded` class + CSS `max-height` transitions; avoid inline style toggling for animations.
- **Injeção de dependência para módulos de sistema** — dependências como `child_process.spawn` devem ser passadas como parâmetro para funções/factories (`createApp({ spawn })`), não importadas com desestruturação no topo do módulo. Desestruturação captura a referência no momento do `require`, tornando-a invisível para mocks de teste.

### Python

- Scripts are designed to be run stand-alone from the command line or spawned by the server.
- Scripts that produce chart data must print a **single JSON object** to stdout: `{ "labels": [...], "data": [...] }`.
- Use file-level caching (`cache/` directory) for expensive external API calls (NVD, Vulners).
- Use `argparse` for CLI scripts. Defaults should be sensible for local development.
- `check_status.py` uses `asyncio`/`aiohttp` for concurrent HTTP checks — do not convert to synchronous.

### CSS

- **BEM-style class naming** for card component internals: `.asset-card`, `.asset-card-content`, `.asset-row`, `.asset-collapsible`.
- Each card type has its own CSS file under `public/css/`. Do not add cross-card styles to a card-specific file.
- **Design tokens** — as cores e valores de espaçamento base estão definidos como custom properties em `:root` em `style.css`. Usar sempre as variáveis, nunca valores hexadecimais fixos em arquivos de componentes:

  | Token | Valor | Uso |
  |---|---|---|
  | `--app-bg` | `#1c1c28` | Fundo da página |
  | `--surface-bg` | `#252535` | Superfície de modais e dropdowns |
  | `--card-bg` | `#2b2b3d` | Fundo dos cards |
  | `--border-subtle` | `rgba(255,255,255,0.07)` | Bordas de cards e separadores |
  | `--border-mid` | `rgba(255,255,255,0.11)` | Bordas de inputs e modais |
  | `--text` | `#c8c8d4` | Texto padrão |
  | `--text-muted` | `#6b6b80` | Labels, metadados |
  | `--text-bright` | `#f0f0f5` | Títulos e texto em destaque |
  | `--accent` | `#cc785c` | Cor de destaque (botão apply, check, ícone logo) |
  | `--ease-std` | `cubic-bezier(0.4,0,0.2,1)` | Curva de easing padrão para transições |
  | `--radius-sm/md/lg` | `6px / 8px / 12px` | Border-radius padronizados |

- **Fonte base:** `'Segoe UI', system-ui, -apple-system, sans-serif` (não usar `Arial`).
- **Scrollbars:** largura `3px`, thumb `rgba(255,255,255,0.12)`, border-radius `2px` — padrão em todos os componentes.
- **Colapsáveis:** o padding de espaçamento **nunca** deve estar no elemento com `max-height: 0` — colocar nos filhos internos para evitar que o padding vaze visualmente quando recolhido.
- Use CSS `max-height` + `overflow: hidden` transitions for smooth expand/collapse, not `display: none` toggling.

---

## Testing

### Executar testes

```bash
npm test                # roda todos os testes
npm run test:watch      # modo watch (reexecuta ao salvar)
npm run test:coverage   # com relatório de cobertura HTML + lcov
```

### Cobertura mínima exigida (threshold)

| Métrica | Mínimo |
|---|---|
| Linhas | 80% |
| Funções | 80% |
| Branches | 70% |
| Statements | 80% |

A build falha automaticamente se a cobertura cair abaixo desses limites.

### Casos cobertos

| Suíte | Endpoint | Casos |
|---|---|---|
| `api.layout.test.js` | `GET /api/layout/:viewName` | view inexistente → `[]`; JSON válido → layout; erro de leitura → 500; JSON inválido → 500 |
| `api.layout.save.test.js` | `POST /api/layout/:viewName` | salva com sucesso → 200; erro de escrita → 500; path correto por view |
| `api.meta.test.js` | `GET /api/views`, `/api/cards`, `/version` | leitura OK → 200; erro → 500; JSON inválido → 500 |
| `api.csv.test.js` | `GET /api/partial-csv` | sem `file` → 400; arquivo inexistente → 404; header sempre incluso; respeita `limit`; erro de stream → 500 |
| `api.chartdata.test.js` | `POST /api/chart-data` | sem `scriptPath` → 400; exit 0 → 200 com stdout; exit != 0 → 500 com stderr; executável configurável; output trimado |
| `app.smoke.test.js` | — | `createApp` retorna app Express válido; SPA fallback captura rotas desconhecidas |

### Regras de mock

- **`fs`** — nunca mockar o módulo inteiro (`jest.mock('fs')`).
  Usar sempre a factory com `jest.requireActual` para preservar o `fs` real que `express.static` usa internamente:
  ```js
  jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    existsSync: jest.fn(),
    readFile:   jest.fn(),
    writeFile:  jest.fn(),
    createReadStream: jest.fn(),
  }));
  ```
- **`child_process.spawn`** — não mockar o módulo. Injetar o mock diretamente via `createApp({ spawn: jest.fn() })`.
- **Processos Python falsos** — usar `EventEmitter` puro para `stdout`/`stderr`, nunca `Readable` streams. Usar sempre `mockImplementation(() => makeFakePython(...))`, nunca `mockReturnValue(makeFakePython(...))` — `mockReturnValue` executa a factory antes da requisição existir, agendando o `setImmediate` antes de os listeners serem anexados.

---

## Important Paths

| Path | Purpose |
|---|---|
| `server-config.json` | Change HTTP port, bind address, or Python executable name |
| `public/websocket-config.json` | Change WebSocket port seen by the browser |
| `public/favicon.svg` | SVG favicon — ícone dos quadradinhos accent |
| `configs/views.json` | Add or rename dashboard views |
| `configs/layout.config-{view}.json` | Per-view layout (auto-created on first save) |
| `cards/cards-list.json` | Master card registry — add new cards here |
| `public/local-events/cve-report.json` | Output path expected by the `cve-check` card |
| `public/local-data-uptimes/uptime-results.json` | Output path expected by the `uptime-results` card |
| `public/local-events/ransomlook/breachs_posts.csv` | Breach event feed for list and chart cards |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/views` | Returns `configs/views.json` |
| `GET` | `/api/cards` | Returns `cards/cards-list.json` |
| `GET` | `/api/layout/:viewName` | Returns layout config for a view (empty array if not found) |
| `POST` | `/api/layout/:viewName` | Saves full layout config for a view |
| `GET` | `/api/partial-csv?file=...&limit=N` | Streams last N lines of a CSV file |
| `POST` | `/api/chart-data` | Spawns a Python script and returns its JSON stdout |
| `GET` | `/version` | Returns `version.json` |
| `GET` | `/:view?` | Serves `public/index.html` for all other routes (SPA fallback) |

---

## Release Workflow

Releases are produced by `release.py`, which zips all tracked files (respecting `.gitignore`) into `_deploys/{version}.zip`.

```bash
# 1. Bump the version
#    Edit version.json → { "version": "1.5" }

# 2. Build the release zip
python release.py

# Output: _deploys/1.5.zip
```

The zip excludes: `.git`, `.gitignore`, `.gitattributes`, `release.py` itself, `node_modules/`, and all `public/local-*/`, `configs/`, and runtime-generated files listed in `.gitignore`.

The zip **includes** everything a new deployment needs to get started: `server.js`, `src/`, `public/`, `cards/cards-examples.json`, `scripts/`, `package.json`, `server-config.json`, `public/websocket-config.json`, and `version.json`.

### Deploying a Release

```bash
# On the target machine:
unzip 1.5.zip -d painel/
cd painel/
npm install
npm start
# → http://localhost:3123
```

After first start, create `configs/views.json` and populate `cards/cards-list.json` and `public/local-*/` with instance-specific data.