# CLAUDE.md — Painel de Monitoramento

## Project Overview

**Painel de Monitoramento** is a self-hosted, real-time security and infrastructure monitoring dashboard. It renders configurable card-based layouts with charts, event lists, uptime monitors, CVE asset reports, and embedded iframes. The dashboard supports multiple named "views", each with its own independently saved layout, and updates cards in real time via WebSocket when their source data files change on disk.

The project is designed to be lightweight and local-first: data is produced externally by Python scripts (e.g., uptime checkers, CVE scanners, breach feed consumers) and written to JSON/CSV files that the server watches and broadcasts changes from.

---

## Repository Layout

```
painel/
├── server.js                          # Express HTTP + WebSocket server
├── server-config.json                 # Server port, address, python command
├── version.json                       # Current release version
├── package.json
├── release.py                         # Builds a versioned .zip release artifact
│
├── public/                            # Static assets served to the browser
│   ├── index.html                     # Single-page app shell
│   ├── websocket-config.json          # WebSocket host/port for the frontend
│   ├── css/
│   │   ├── style.css                  # Global layout, grid, cards, modals
│   │   ├── event-list.css             # List card styles
│   │   ├── frame-card.css             # iframe card + zoom controls
│   │   ├── highlight.css              # Card update pulse animation
│   │   ├── uptime-card.css            # Uptime card styles
│   │   └── cve-assets.css             # CVE assets board styles
│   └── js/
│       ├── consts.js                  # DOM references and shared state
│       ├── script.js                  # Core: layout load/save, card rendering, content loaders
│       ├── eventListeners.js          # DOM event wiring, card interaction init
│       ├── carddrag.js                # Drag-and-drop card reordering
│       ├── resizecards.js             # Mouse-resize card spans
│       ├── cardsettings.js            # Settings modal (title, cols, rows, remove)
│       ├── addcards.js                # Add-card modal
│       ├── socketListeners.js         # WebSocket connection and update handling
│       └── helpers.js                 # CSV parsing utilities
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

---

## Architecture Principles

### Server

- The Express server is a thin static file host plus a small REST API. It does not own data — it only reads and writes config files and proxies CSV reads.
- The WebSocket server runs on a **separate port** (default `8123`) from the HTTP server (default `3123`). Clients subscribe to file paths; the server broadcasts `{ type: "update", cardId }` when a watched file changes.
- Python scripts are spawned on-demand via `child_process.spawn` for chart data aggregation. Scripts receive the source file path as an argument and return JSON on stdout.
- Layout configs are stored as flat JSON arrays (`layout.config-{view}.json`), one per view. The frontend is authoritative for layout mutations; saving always POSTs the full current layout.

### Frontend

- The app is a single HTML page. JavaScript files are loaded in a strict dependency order via `<script>` tags in `index.html`. There is no bundler.
- **State is minimal and explicit**: `consts.js` holds all shared DOM references and mutable globals (`currentCard`, `draggedItem`, `resizing`, `selectedView`, `chartInstances`).
- Cards are rendered from two merged sources: the layout config (order, spans, title, zoom) merged over the card definition (type, data, source paths).
- Card content loading is **type-dispatched** in `loadCardsContent()` → one function per `cardType` (`chart`, `list`, `uptime`, `cve-assets`, `frame`).
- Real-time updates use a single WebSocket connection per page load. On reconnection (view change), `signSocketListeners()` re-registers all current cards.

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

### Python

- Scripts are designed to be run stand-alone from the command line or spawned by the server.
- Scripts that produce chart data must print a **single JSON object** to stdout: `{ "labels": [...], "data": [...] }`.
- Use file-level caching (`cache/` directory) for expensive external API calls (NVD, Vulners).
- Use `argparse` for CLI scripts. Defaults should be sensible for local development.
- `check_status.py` uses `asyncio`/`aiohttp` for concurrent HTTP checks — do not convert to synchronous.

### CSS

- **BEM-style class naming** for card component internals: `.asset-card`, `.asset-card-content`, `.asset-row`, `.asset-collapsible`.
- Each card type has its own CSS file under `public/css/`. Do not add cross-card styles to a card-specific file.
- Dark theme base colors: background `#1e1e2f`, card surface `#2b2b3d`, border `#444`, dimmed text `#aaa`.
- Use CSS `max-height` + `overflow: hidden` transitions for smooth expand/collapse, not `display: none` toggling.

---

## Important Paths

| Path | Purpose |
|---|---|
| `server-config.json` | Change HTTP port, bind address, or Python executable name |
| `public/websocket-config.json` | Change WebSocket port seen by the browser |
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

The zip **includes** everything a new deployment needs to get started: `server.js`, `public/`, `cards/cards-examples.json`, `scripts/`, `package.json`, `server-config.json`, `public/websocket-config.json`, and `version.json`.

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
