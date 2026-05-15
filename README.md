# SLUGGER: Available Player Portal

## Description

The SLUGGER Available Player Portal is a web application designed to help professional baseball teams identify and evaluate available players more efficiently. The platform centralizes player information, transaction data, rankings, and notifications into one system to simplify the recruiting workflow.

This project was developed as part of the Johns Hopkins Sports Analytics Research Group (SARG) in collaboration with the Atlantic League and the SLUGGER platform.

---

## Features

- Centralized player discovery dashboard
- Real-time player availability tracking
- Weighted player ranking system
- Custom filtering and search functionality
- Saved search profiles
- Personal email notifications
- AWS deployment integration
- Responsive frontend interface

---

## Overview

- **`apps/web`** — Next.js 15 (App Router), Tailwind CSS, Player Discovery UI at `/dashboard`, player detail at `/players/[id]`. The browser talks to the API only through HTTP (`NEXT_PUBLIC_API_URL`); it never calls TBC or sees feed credentials.
- **`apps/api`** — Express server with Prisma ORM, REST routes under `/players`, and a **sync job** that fetches TBC transaction, batting, and pitching feeds, stores raw snapshots, parses CSV-style rows, and upserts `players`, `transactions`, `batting_stats`, and `pitching_stats`.
- **`packages/shared`** — Shared domain types (`Player`, `PlayerSummary`, `PlayerProfile`, stats, filters) consumed by both apps.

For a deeper file-by-file map and implementation notes, see [`progress.md`](progress.md).

**Formal docs:** [`docs/API_SPEC.md`](docs/API_SPEC.md), [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md), [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md), [`docs/SLUGGER_WIDGET_REGISTRATION.md`](docs/SLUGGER_WIDGET_REGISTRATION.md), [`docs/SRS.md`](docs/SRS.md).

---

## Architecture

```
┌─────────────┐     HTTP (JSON)      ┌─────────────┐
│  apps/web   │ ◄──────────────────► │  apps/api   │
│  (Next.js)  │  NEXT_PUBLIC_API_URL │  (Express)  │
└─────────────┘                      └──────┬──────┘
       │                                    │
       │                            Prisma  │
       │                                    ▼
       │                             PostgreSQL
       │
       └── uses @available-player-portal/shared (types)

Sync (CLI / cron, server only):

  ApiSyncTBC → RawDataStorage → DataParser → repositories (upsert)
```

- **Read path:** Web → `GET /players`, `GET /players/:id`, `GET /players/:id/transactions` → `PlayerDataService` + repositories → database.
- **Write path (sync):** `npm run sync` (or `sync:ts-node`) in `apps/api` runs `src/jobs/syncPipeline.ts`. TBC password is read from **`TBC_FEED_PASSWORD`** on the server only (never prefix with `NEXT_PUBLIC_`).

### UI style (Player Discovery mockup)

New widget screens should match the home experience:

- **Tokens:** Tailwind `portal-*` colors and radii in `apps/web/tailwind.config.ts` (page background, steel blue accent, sidebar, lavender filter area, gray results panel).
- **Components:** `@layer components` helpers in `apps/web/app/globals.css` — `portal-btn-primary`, `portal-btn-ghost`, `portal-surface`, `portal-filter-shell`, `portal-panel-well`.
- **Shell:** `BrowserChrome` + sidebar live in `apps/web/app/(widget)/layout.tsx`; stub routes use `components/portal/PortalPlaceholder.tsx`.

---

## SLUGGER Widget Integration

When the app is embedded in **SLUGGER**, configure the widget-related variables so origins and widget ID match your SLUGGER deployment:

| Variable | Role |
|----------|------|
| `SLUGGER_API_BASE_URL` | Backend base URL for SLUGGER APIs (e.g. `/api/users/me`). |
| `SLUGGER_WIDGET_ID` | Must match the widget ID registered in SLUGGER. |
| `NEXT_PUBLIC_SLUGGER_ORIGINS` | Comma-separated allowed parent origins for CSP / embedding. |

Standalone auth (NextAuth) uses `NEXTAUTH_URL` and `NEXTAUTH_SECRET` when the app is used outside the widget flow. Adjust `next.config.ts` CSP `frame-ancestors` for production hosts as needed.

---

## Getting Started

### Prerequisites

- **Node.js** 18+ (global `fetch` used by the API)
- **PostgreSQL** installed locally (or remote) — **Docker is not required** for development
- **npm** (workspaces enabled at the repo root)

### Install

```bash
npm install
```

### Database

The API uses **PostgreSQL** only (`apps/api/prisma/schema.prisma`). For day-to-day development, run Postgres **natively** on your Mac and set **`DATABASE_URL`** in **`.env`** (repo root or `apps/api/.env`).

**1. Install and start PostgreSQL** (pick one):

- **[Postgres.app](https://postgresapp.com/)** — open the app, initialize a server, note the port (often `5432`).
- **Homebrew:** `brew install postgresql@16`, then `brew services start postgresql@16` (see `brew info postgresql@16` for the default socket/port).

**2. Create a database user and database** (adjust names/passwords to taste; these match **`.env.example`**):

```bash
psql -d postgres -c "CREATE USER \"user\" WITH PASSWORD 'password';"
psql -d postgres -c "CREATE DATABASE available_player_portal OWNER \"user\";"
```

If `psql` fails with “role does not exist”, open **Postgres.app** (or use `psql` as the superuser your install created). If your Mac user is already a Postgres superuser, you can skip creating `user`/`password` and use  
`DATABASE_URL=postgresql://YOUR_MAC_USERNAME@localhost:5432/available_player_portal` when local auth allows it.

**3. Copy env and apply the schema**

Copy **`.env.example`** to **`.env`** and set **`DATABASE_URL`** to match the user, password, host, port, and database you created.

From the repo root (or run the same scripts inside `apps/api`):

```bash
npm run db:generate -w @available-player-portal/api
npm run db:push -w @available-player-portal/api
```

Use `prisma migrate dev` inside `apps/api` when you want versioned migrations instead of `db push`.

**Optional — Postgres in Docker** (only if you prefer containers): `docker compose -f docker-compose.dev.yml up -d` and keep the sample `DATABASE_URL` from **`.env.example`** (credentials match the compose file). Requires Docker Desktop (or another running Docker daemon).

### Load TBC data (optional but required for real player lists)

```bash
npm run sync -w @available-player-portal/api
```

Requires network access to thebaseballcube.com and a valid `TBC_FEED_PASSWORD` in `.env`.

### Run apps in development

In two terminals:

```bash
npm run dev -w @available-player-portal/api
npm run dev -w @available-player-portal/web
```

Or from root (if Turbo is wired to both workspaces):

```bash
npm run dev
```

- **Web:** [http://localhost:3000](http://localhost:3000) — `/` redirects to `/dashboard` (Player Discovery Home).
- **API:** [http://localhost:4000](http://localhost:4000) — `GET /health`, `GET /players`, etc.

Copy `.env.example` to `.env` and adjust values before running.

### Troubleshooting: `404` on `main-app.js`, `layout.js`, `_next/static/…`

Those files are **Next.js JavaScript and CSS chunks**. A **404** means the browser asked your server for a path under **`/_next/static/...`** and got nothing back, so the UI loads half-broken or “unstable.”

| Cause | What to do |
|--------|------------|
| **Stale dev cache** after upgrades or branch switches | Stop `next dev`, delete **`apps/web/.next`**, start again, then **hard refresh** the browser (bypass cache). |
| **Reverse proxy / nginx** only forwards `/` HTML, not static assets | Forward **`/_next/`** to the same Next process (same as HTML). |
| **App hosted under a subpath** (e.g. `https://example.com/portal/dashboard`) without config | Set **`NEXT_PUBLIC_BASE_PATH`** to that prefix (e.g. `/portal`) in `.env`, rebuild or restart dev so it matches **`basePath`** in `apps/web/next.config.ts`. |
| **Wrong host/port** (HTML from one origin, tabs pointing at another) | Open the app at the same URL the dev server prints (e.g. `http://localhost:3000`). |

Monorepo hosts (Vercel, etc.): set the project **Root Directory** to **`apps/web`** so the Next build and `/_next` routes stay aligned.

---

## Environment Variables

Copy **`.env.example`** to **`.env`** at the repo root (or set env per app in your host). Highlights:

| Variable | Where | Purpose |
|----------|--------|---------|
| `DATABASE_URL` | API | PostgreSQL connection string for Prisma. |
| `PORT` | API | HTTP port (default `4000`). |
| `TBC_FEED_PASSWORD` | API | TBC feed password; **server-only**, never exposed to the browser. |
| `TBC_HTTPS_PROXY` | API / Sync relay | Optional static/allowlisted egress for Baseball Cube fetches. |
| `NEXT_PUBLIC_API_URL` | Web | Base URL of the Express API (e.g. `http://localhost:4000`). |
| `NEXT_PUBLIC_BASE_PATH` | Web | Optional URL prefix when the app is not at domain root (must match `basePath` in `next.config.ts`). |
| `NEXTAUTH_*` | Web | Standalone NextAuth when not using SLUGGER-only flow. |
| `SLUGGER_*`, `NEXT_PUBLIC_SLUGGER_ORIGINS` | API / Web | Widget embedding and SLUGGER API calls. |
| `MLB_*`, `BASEBALL_CUBE_*` | API | Reserved / optional for other data sources (see `.env.example`). |
| `SMTP_*`, `VAPID_*` | API | Email and web push when those features are enabled. |
| `CRON_*` | Ops | Suggested schedules for transaction sync and alert dispatch. |

---

## Data sync (Baseball Cube pipeline)

The **Player Discovery** dataset is populated by the API job, not by the Next.js app:

- **Command:** `npm run sync -w @available-player-portal/api` (uses `tsx`) or `npm run sync:ts-node -w @available-player-portal/api`.
- **Entry:** `apps/api/src/jobs/syncPipeline.ts` — fetches three TBC feeds, appends rows to `raw_feed_snapshots`, parses and upserts players and stats. Re-running is **idempotent** for players and stats (unique keys); transactions use a content hash to avoid duplicates.
- **AWS-safe relay:** `npm run sync:relay -w @available-player-portal/api` fetches TBC from the runner or `TBC_HTTPS_PROXY`, then posts raw feeds to `POST /sync/ingest-raw`. Production DB writes and notification emails still happen inside the API, but AWS Lambda no longer needs direct TBC egress.

Schedule `sync:relay` when TBC blocks AWS egress. Configure `TBC_FEED_PASSWORD`, `SYNC_INTERNAL_KEY`, and optionally `REMOTE_SYNC_INGEST_URL` / `TBC_HTTPS_PROXY`.

---

## Deployment

- **API:** Build with `npm run build -w @available-player-portal/api`, run `node dist/index.js` (or your process manager). Run `prisma migrate deploy` (or your chosen migration strategy) against production `DATABASE_URL`. Run the sync job on a schedule.
- **Web:** Build with `npm run build -w @available-player-portal/web`, run `npm run start -w @available-player-portal/web`. Set `NEXT_PUBLIC_API_URL` to the public API URL.
- **CORS:** The API currently uses permissive CORS for development; tighten `origin` in `apps/api/src/index.ts` for production.
- **Security:** Never put `TBC_FEED_PASSWORD` in any `NEXT_PUBLIC_*` variable or client bundle.

---

## API reference (Player Discovery)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness check. |
| `GET` | `/players` | Query: filters + optional `limit`/`offset` — returns `{ players, total }`. See `docs/API_SPEC.md`. |
| `GET` | `/players/:id` | Full `PlayerProfile` (player, recent/previous batting & pitching, transactions). |
| `GET` | `/players/:id/transactions` | `Transaction[]` only (chronological). |
| `POST` | `/sync` | Runs the full TBC → PostgreSQL pipeline. Optional: set `SYNC_INTERNAL_KEY` and send `Authorization: Bearer <key>`. |
| `POST` | `/sync/ingest-raw` | Processes externally fetched TBC raw feeds, then evaluates notification matches and sends emails. Requires the same sync authorization. |

The **Player Discovery Home** page includes **Refresh database**, which calls the Next.js route **`POST /api/sync`** (server-side only). That proxies to **`POST /sync`** on the API with the shared secret when configured.

---

## License / project name

Package name in `package.json` is `available-player-portal`; workspace packages are `@available-player-portal/web`, `@available-player-portal/api`, and `@available-player-portal/shared`.
