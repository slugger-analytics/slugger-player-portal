# Software Requirements Specification (SRS) — Available Player Portal

**Scope:** This SRS reflects the **implemented** Player Discovery stack in this repository (Next.js web, Express API, PostgreSQL, TBC sync). Items marked *future* are not guaranteed to exist in code.

---

## 1. Purpose

Provide a **player discovery** experience: filter a roster dataset, view summary cards, open a detail view with season stats and transaction history. Data is maintained by a **server-side ingest pipeline** from The Baseball Cube feeds into a relational database; the browser accesses data only through a **REST API**.

---

## 2. User-facing features

### 2.1 Player Discovery Home

- Display a **filter panel** (position, age, team, status) mapped to API query parameters.
- Display **player cards** with photo placeholder, name, position, team, and minimal stat line.
- Support **add / edit / remove** filters with UI state stored in the client (React).
- Provide **Refresh database** to trigger a full TBC sync via a server-side proxy (`POST /api/sync`).

### 2.2 Player detail

- Show identity: name, position, team, status, age when present.
- Show **most recent** and **previous** season rows for batting and pitching (when data exists).
- Show **transaction history** loaded from `GET /players/:id/transactions`.

### 2.3 Application shell (widget routes)

- **Browser chrome** mock, steel-blue accent, sidebar navigation placeholders, consistent **portal** styling tokens for stub and future pages.

### 2.4 Standalone auth placeholders

- Login and register routes exist as **stubs**; full NextAuth flows are *future* unless configured separately.

---

## 3. System interfaces

### 3.1 REST API (Express)

- `GET /health` — liveness.
- `GET /players` — filtered list (`PlayerSummary[]`).
- `GET /players/:id` — profile (`PlayerProfile`).
- `GET /players/:id/transactions` — transactions only.
- `POST /sync` — run ingest pipeline; optional Bearer secret.

See [API_SPEC.md](./API_SPEC.md).

### 3.2 Next.js

- Server and client fetch API using `NEXT_PUBLIC_API_URL`.
- Server-only `POST /api/sync` proxies to the API with optional `SYNC_INTERNAL_KEY`.

### 3.3 External data (TBC)

- HTTPS GET to three TBC feed URLs; password from server env only.

See [DATA_SOURCES.md](./DATA_SOURCES.md).

---

## 4. Data requirements

- **PostgreSQL** with tables: `players`, `transactions`, `batting_stats`, `pitching_stats`, `raw_feed_snapshots` (Prisma schema).
- **Idempotent upserts** for players, stats, and transactions (unique keys as implemented).
- **Append-only** raw snapshots per sync for audit.

---

## 5. Non-functional requirements (as implemented)

| Area | Requirement |
|------|----------------|
| Security | TBC password and optional sync secret never exposed as `NEXT_PUBLIC_*`. |
| Security | CORS on API is permissive in dev; must be restricted in production. |
| Performance | Player list loads stats per player (N+1); acceptable for moderate lists. |
| Reliability | Sync failures surface as HTTP 5xx / UI error banners. |
| Embedding | SLUGGER integration requires CSP `frame-ancestors` configuration (see [SLUGGER_WIDGET_REGISTRATION.md](./SLUGGER_WIDGET_REGISTRATION.md)). |

---

## 6. Out of scope (current codebase)

- Full NextAuth user management and role-based UI enforcement in production.
- MLB/MILB feeds referenced only in `.env.example` placeholders.
- Email / web push / cron jobs beyond documentation in `.env.example`.

---

## 7. Related documents

| Document | Content |
|----------|---------|
| [API_SPEC.md](./API_SPEC.md) | HTTP contract |
| [DATA_SOURCES.md](./DATA_SOURCES.md) | Feeds and pipeline |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Build, env, operations |
| [SLUGGER_WIDGET_REGISTRATION.md](./SLUGGER_WIDGET_REGISTRATION.md) | Iframe / SLUGGER |
| [README.md](../README.md) | Quick start and overview |
| [progress.md](../progress.md) | Implementation map |
