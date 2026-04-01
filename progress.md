# Project progress — Player Discovery Portal

This document summarizes the **Player Discovery Portal** work completed in this repository: a full-stack feature (Next.js UI, Express REST API, PostgreSQL via Prisma, and a server-side Baseball Cube data pipeline). It also notes where **inline documentation** was added so future readers can navigate the codebase quickly.

---

## 1. Architecture overview

| Layer | Location | Role |
|--------|-----------|------|
| **Shared types** | `packages/shared/types/` | Single source of truth for `Player`, stats, `PlayerSummary`, `PlayerProfile`, filters |
| **API** | `apps/api/src/` | Express app, Prisma, TBC sync job, repositories, `PlayerDataService` orchestration |
| **Web** | `apps/web/` | Next.js App Router, Player Discovery UI, typed `fetch` helpers |
| **Tooling** | Root `package.json`, `turbo.json` | Monorepo workspaces (`apps/*`, `packages/*`) |

**Data flow (read path):** Browser → `NEXT_PUBLIC_API_URL` → Express `/players/*` → repositories / `PlayerDataService` → PostgreSQL.

**Data flow (sync path):** Cron or CLI → `syncPipeline.ts` → `ApiSyncTBC` (HTTPS, server-only password) → `RawDataStorage` + `DataParser` → upsert into `players`, `transactions`, `batting_stats`, `pitching_stats`.

---

## 2. Database (Prisma)

**File:** `apps/api/prisma/schema.prisma`

| Model | Purpose |
|--------|---------|
| `Player` | TBC `playerid` as string PK; optional `age` for discovery filters |
| `Transaction` | Feed transaction lines; `unique_hash` (SHA-256 of natural key) for idempotent upserts |
| `BattingStat` | One row per (player, season); unique `(player_id, season)` |
| `PitchingStat` | Same pattern for ERA/WHIP/IP/K |
| `RawFeedSnapshot` | Append-only raw feed text per sync for audit/debug |

Comments were added at the top of the schema file and above each model describing intent and uniqueness constraints.

---

## 3. Backend (`apps/api`)

### 3.1 Entry and configuration

| File | Purpose |
|------|---------|
| `src/index.ts` | Express bootstrap: CORS, JSON, `/health`, `/players`, Prisma connect, error handler |
| `src/config/index.ts` | `PORT`, `DATABASE_URL`, `TBC_FEED_PASSWORD` (documented as server-only) |
| `src/lib/prisma.ts` | Singleton `PrismaClient` with dev hot-reload reuse on `globalThis` |

### 3.2 Data ingestion and parsing

| File | Purpose |
|------|---------|
| `src/services/ApiSyncTBC.ts` | GET TBC feeds (`tranx.asp`, `batting.asp`, `pitching.asp`) over HTTPS; password in URL from config |
| `src/services/RawDataStorage.ts` | Append raw strings to `raw_feed_snapshots` |
| `src/services/DataParser.ts` | Parse CSV-with-`<br>` rows; camelCase headers; `Transaction`, stats, `Player`; `normalizePlayer` |

### 3.3 Domain services

| File | Purpose |
|------|---------|
| `src/services/StatLineService.ts` | Minimal stat line strings; most recent / previous season selection; `pickStatArrayForLine` |
| `src/services/PlayerDataService.ts` | **Only** cross-repository joins for `PlayerSummary`, `PlayerProfile`, `attach*` helpers |

### 3.4 Repositories (single-table access)

| File | Purpose |
|------|---------|
| `src/repositories/PlayerRepository.ts` | Filtered `findMany`, `getPlayerById`, upsert players (pitcher filter OR logic) |
| `src/repositories/TransactionRepository.ts` | List by player (date asc); upsert by `uniqueHash` |
| `src/repositories/BattingStatsRepository.ts` | By player, season upsert |
| `src/repositories/PitchingStatsRepository.ts` | Same for pitching |

### 3.5 HTTP API

| File | Purpose |
|------|---------|
| `src/api/PlayerAPI.ts` | `GET /`, `GET /:id/transactions`, `GET /:id`; query parsing with `firstString` |

### 3.6 Sync job

| File | Purpose |
|------|---------|
| `src/jobs/syncPipeline.ts` | `runSyncPipeline()`: fetch → store raw → parse → `mergePlayers` → upsert all tables; CLI entry via `require.main` |

### 3.7 Types

| File | Purpose |
|------|---------|
| `src/types/models.ts` | Re-exports `@available-player-portal/shared` for stable API imports |

---

## 4. Frontend (`apps/web`)

### 4.1 Routing and layout

| Route / file | Purpose |
|--------------|---------|
| `app/page.tsx` | Redirect `/` → `/dashboard` |
| `app/layout.tsx` | Root layout, global CSS, metadata |
| `app/(widget)/layout.tsx` | Steel blue bar, 80px sidebar, header strip (wireframe shell) |
| `app/(widget)/dashboard/page.tsx` | Player Discovery Home: filters, API query mapping, results grid |
| `app/(widget)/players/[id]/page.tsx` | Server page: profile + stat tables + `TransactionHistoryView` |

Stub routes (`login`, `register`, `compare`, etc.) export minimal pages so `next build` succeeds.

### 4.2 Components and API client

| File | Purpose |
|------|---------|
| `lib/api.ts` | `getApiBaseUrl`, `fetchPlayerSummaries`, `fetchPlayerProfile`, `fetchPlayerTransactions` |
| `components/discovery/PlayerCard.tsx` | Card for one `PlayerSummary`; link to detail |
| `components/discovery/TransactionHistoryView.tsx` | Client list from `GET /players/:id/transactions` |

### 4.3 Static assets

| Asset | Purpose |
|-------|---------|
| `public/player-placeholder.png` | Default headshot when API `imageUrl` is null |

---

## 5. Environment and scripts

| Variable / script | Purpose |
|-------------------|---------|
| `DATABASE_URL` | PostgreSQL connection for Prisma |
| `PORT` | API listen port (default 4000) |
| `TBC_FEED_PASSWORD` | Server-only TBC feed password (documented in `.env.example`; not `NEXT_PUBLIC_*`) |
| `NEXT_PUBLIC_API_URL` | Browser + SSR base URL for API calls |
| Root `npm run dev` | Turbo dev (web + api when configured) |
| `apps/api` `npm run sync` | `tsx src/jobs/syncPipeline.ts` |
| `apps/api` `npm run sync:ts-node` | `ts-node` variant for spec compliance |

---

## 6. Documentation pass (comments)

A **documentation pass** added file-level and module-level comments (purpose, usage, integration points) to:

- All **API services**, **repositories**, **PlayerAPI**, **syncPipeline**, **config**, **prisma singleton**, **types re-export**
- **Prisma schema** (header + per-model)
- **Shared** `packages/shared/types/models.ts`
- **Web:** `lib/api.ts`, widget layout, dashboard page, discovery components, player detail page, root layout, home redirect

Client components keep `"use client"` as the **first line**; longer file comments follow immediately after.

---

## 7. Known follow-ups (optional)

- **Performance:** `listPlayerSummaries` performs per-player stat loads (N+1); batch or Prisma `include` if lists grow large.
- **Security:** Lock down CORS `origin` in production instead of `origin: true`.
- **Migrations:** `db push` is convenient for dev; use `prisma migrate` for production history.

---

## 8. How to run (quick reference)

1. Copy `.env.example` → `.env`; set `DATABASE_URL` and optionally `TBC_FEED_PASSWORD`.
2. `npm install` at repo root.
3. `npm run db:generate -w @available-player-portal/api` and `npm run db:push -w @available-player-portal/api`.
4. `npm run sync -w @available-player-portal/api` (requires network to TBC).
5. Start API: `npm run dev -w @available-player-portal/api`.
6. Start web: `npm run dev -w @available-player-portal/web`; open `/dashboard`.

---

*Last updated: documentation and `progress.md` filled to reflect the Player Discovery Portal implementation and comment pass.*
