# Painel SI

Self-hosted, real-time security and infrastructure monitoring dashboard. Displays configurable cards organized in independent views. Data is produced externally (Python scripts or any tool) and written to JSON/CSV files; the server detects changes and pushes updates to cards via WebSocket automatically.

---

## Requirements

- Node.js 18+
- Python 3.9+ *(only required for uptime monitoring and chart data scripts)*

---

## Features

- **Multiple views** — independent layouts, switchable from the sidebar
- **Real-time updates** — WebSocket pushes file changes to the browser without page reload
- **Drag, resize, and configure** — cards can be reordered, resized, titled, and removed directly in the UI
- **Six card types** — chart, list, dynamic-list, uptime, CVE assets, iframe
- **Uptime monitoring** — async URL checker with online/offline history and webhook notifications
- **CVE assessment** — collapsible asset board with per-CVE assessment panel
- **Backup** — one-click download of all configs and local data as a zip
- **Health check** — server status, WebSocket info, and active file watchers

---

## Card Types

| Type | Description |
|---|---|
| `chart` | Chart.js graph (line, bar, doughnut) — inline data or computed via Python script |
| `list` | Event list from a semicolon-delimited CSV |
| `dynamic-list` | Configurable list: custom separator, up to 3 typed fields (Text, Date, or URL) |
| `uptime` | Availability monitor for services and URLs |
| `cve-assets` | Asset board with associated CVEs and inline assessment panel |
| `frame` | Iframe with zoom controls for local or external pages |

---

## Quickstart

```bash
npm install
npm start
# → http://localhost:3123
```

Port and bind address are configured in `server-config.json` and `websocket-config.json`.

---

## Examples

`cards/cards-examples.json` contains ready-to-use card definitions for all types. Copy and adapt them into `cards/cards-list.json`.

`cards/card.schema.json` documents the full structure of each card type.

---

## Project Structure

```
├── server.js              # Bootstrap — starts HTTP + WebSocket servers
├── src/app.js             # Express app factory, all API routes
├── server-config.json     # HTTP port and address
├── public/
│   ├── index.html         # SPA shell
│   ├── css/               # Design system and per-component styles
│   └── js/                # Vanilla JS — layout, cards, modals, WebSocket
├── cards/
│   ├── cards-list.json    # Active card registry (gitignored, per-instance)
│   ├── cards-examples.json
│   └── card.schema.json
├── configs/               # Views and layouts (gitignored, per-instance)
├── scripts/
│   ├── check_status.py    # Async uptime checker (asyncio + aiohttp)
│   └── count_events_by_weekday.py
└── tests/                 # Jest + Supertest — backend and frontend unit tests
```

---

## Python Scripts

| Script | Purpose |
|---|---|
| `scripts/check_status.py` | Checks URL availability, writes results to `public/local-data-uptimes/` |
| `scripts/count_events_by_weekday.py` | Aggregates a CSV into per-weekday counts for chart cards |

---

## Release & Deploy

```bash
# Build a release zip
python release.py
# → _deploys/{version}.zip

# On the target server
unzip {version}.zip -d painel/
cd painel/
npm install
npm start
```

The zip respects `.gitignore` and renames `server-config.json` and `websocket-config.json` to `*-SAMPLE` to avoid overwriting existing production configs.

---

## Testing

```bash
npm test                # run all tests
npm run test:watch      # watch mode
npm run test:coverage   # with coverage report
```

---

## License

This project is unlicensed. Use at your own discretion.
