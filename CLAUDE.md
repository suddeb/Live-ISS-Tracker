# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Start production server
npm start          # node server.js

# Start development server (auto-restart on changes)
npm run dev        # npx nodemon server.js

# Run all tests
npm test           # jest

# Run a single test file
npx jest public/js/tests/centering.test.js
npx jest public/js/tests/crew.test.js
```

The app runs at `http://localhost:3000` by default. Copy `.env.example` to `.env` to configure `PORT` and `NODE_ENV`.

## Architecture

This is a real-time ISS tracker with a **Node.js/Express backend** that pushes data to a **vanilla JS frontend** via Socket.IO.

### Data flow

1. **Background jobs on the server** fetch from external APIs on a schedule and broadcast to all connected clients via Socket.IO:
   - Every 2 s: ISS position from `wheretheiss.at` → `iss:position`
   - Every 10 min: Crew list from `corquaid.github.io` → `iss:astronauts`  
   - Every 30 min: TLE data from `wheretheiss.at` → `iss:tle` + `iss:orbital-path`

2. **Orbital path computation** (`server.js:computeOrbitalPath`) uses `satellite.js` to propagate TLE data ±45 minutes. Paths are split at the antimeridian to avoid rendering artifacts.

3. **REST API** (`/api/iss/*`) serves the same data on-demand with rate limiting (30 req/min per IP). The frontend does not call these directly — it uses Socket.IO — but they're available for external consumers.

4. **Frontend** (`public/js/app.js`) maintains a `state` object and updates a Leaflet map. On first `iss:position` event it auto-centers/zooms to the ISS footprint; subsequent updates only pan if `state.following` is true.

### Key files

- `server.js` — Express + Socket.IO server, all background jobs, REST routes, orbital path math
- `lib/crewFetcher.js` — Isolated module for crew data fetch from the Corquaid API
- `public/js/app.js` — All frontend logic: Leaflet map, Socket.IO handlers, UI state, telemetry display
- `public/index.html` — Single page; loads Leaflet, Socket.IO client, and `app.js` from CDN/static

### Testing approach

Tests live in `public/js/tests/` and use **Jest + jsdom**. Because `app.js` is a browser script (not a CommonJS module), tests mock the globals `L` (Leaflet), `io` (Socket.IO client), and `fetch`, then `require('../app.js')` inside `jest.isolateModules()` to get a fresh instance per test. Tests access the exported `map` and `state` objects directly to assert behavior.

### External APIs

| API | Purpose |
|-----|---------|
| `api.wheretheiss.at/v1/satellites/25544` | ISS position + TLE |
| `corquaid.github.io/.../people-in-space.json` | Crew data with agency/flag details |
| `nominatim.openstreetmap.org/reverse` | Reverse geocoding for ISS location display |

All external fetches go through `fetchWithRetry` (3 attempts, exponential backoff, 8 s timeout).
