# Deployment — Available Player Portal

This repo is a **npm workspaces** monorepo (`apps/web`, `apps/api`, `packages/shared`) orchestrated with **Turborepo**. Production means running **PostgreSQL**, the **Express API**, and the **Next.js** app with consistent environment variables.

---

## Architecture (runtime)

| Component | Package | Role |
|-----------|---------|------|
| Web | `@available-player-portal/web` | Next.js 15 App Router, UI, `POST /api/sync` proxy |
| API | `@available-player-portal/api` | Express, Prisma, `GET /players*`, `POST /sync` |
| Database | PostgreSQL | Source of truth after sync |
| Types | `@available-player-portal/shared` | Shared TypeScript types (bundled at build time) |

The browser **never** receives TBC feed credentials. Ingest runs only on the API (CLI, cron, or `POST /sync`).

---

## Prerequisites

- **Node.js** 18+ (global `fetch` on the API)
- **PostgreSQL** 14+ (or compatible)
- **Network** egress from the API host to `https://thebaseballcube.com` for sync

---

## Environment variables

Copy **`.env.example`** at the repo root and set values per environment. Minimum for Player Discovery:

| Variable | Service | Required | Purpose |
|----------|---------|----------|---------|
| `DATABASE_URL` | API | Yes | Prisma connection string |
| `TBC_FEED_PASSWORD` | API | Yes for sync | TBC feed query parameter (server-only) |
| `TBC_HTTPS_PROXY` | API / Sync relay | No | Optional static/allowlisted egress for Baseball Cube fetches |
| `NEXT_PUBLIC_API_URL` | Web | Yes (prod) | Public base URL of the API as seen by the browser |
| `PORT` | API | No | Default `4000` |

**Recommended for production:**

| Variable | Service | Purpose |
|----------|---------|---------|
| `SYNC_INTERNAL_KEY` | API + Web (server) | Same secret on both; protects `POST /sync` and allows `POST /api/sync` to authorize |
| `INTERNAL_API_URL` | Web (server) | If the API URL differs from `NEXT_PUBLIC_API_URL` inside your VPC (e.g. private hostname) |
| `REMOTE_SYNC_INGEST_URL` | Sync relay | Override target for `npm run sync:relay`; defaults to production raw-ingest route |

**Optional / future features** (see `.env.example`): `NEXTAUTH_*`, `SLUGGER_*`, `SMTP_*`, `VAPID_*`, `MLB_*`, `BASEBALL_CUBE_*`.

---

## Build

From the repository root:

```bash
npm install
npm run db:generate -w @available-player-portal/api
npm run build -w @available-player-portal/api
npm run build -w @available-player-portal/web
```

**API output:** `apps/api/dist/` — start with `node dist/index.js` (see `apps/api/package.json` `start` script).

**Web output:** Next standalone output per `next build` defaults.

---

## Database migrations

- **Development:** `npm run db:push -w @available-player-portal/api` applies `schema.prisma` to the database quickly.
- **Production:** Prefer versioned migrations:

  ```bash
  cd apps/api && npx prisma migrate deploy
  ```

  Create migrations during development with `npx prisma migrate dev`.

---

## Initial data load

After the database schema exists, run **one full sync** (either):

```bash
npm run sync -w @available-player-portal/api
```

or, with API running and secrets configured:

- `POST /sync` with `Authorization: Bearer …` if `SYNC_INTERNAL_KEY` is set, or  
- **Refresh database** on the home page (calls Next `POST /api/sync`).

If TBC blocks AWS/Lambda egress, run the relay instead:

```bash
npm run sync:relay -w @available-player-portal/api
```

The relay fetches TBC from the runner or `TBC_HTTPS_PROXY`, then posts raw feeds to `POST /sync/ingest-raw`; the API still performs production DB writes and notification emails. The scheduled GitHub workflow uses this relay path so the sync Lambda does not need direct access to TBC.

---

## Process layout (typical)

1. **PostgreSQL** — managed service or container; allow connections from the API only.
2. **API** — one or more Node processes behind a reverse proxy; set `DATABASE_URL`, `TBC_FEED_PASSWORD`, `PORT`, optional `SYNC_INTERNAL_KEY`.
3. **Web** — Next.js on Vercel, Node host, or container; set `NEXT_PUBLIC_API_URL` to the **public** API URL; set server env `SYNC_INTERNAL_KEY` / `INTERNAL_API_URL` if you use the sync proxy.

---

## Security checklist

- [ ] Never prefix **`TBC_FEED_PASSWORD`** or **`SYNC_INTERNAL_KEY`** with `NEXT_PUBLIC_`.
- [ ] Restrict **CORS** on the API to known web origins.
- [ ] Set **`SYNC_INTERNAL_KEY`** in production so arbitrary clients cannot trigger ingest.
- [ ] Use **HTTPS** in front of both web and API in production.
- [ ] If embedding in **SLUGGER**, configure **CSP `frame-ancestors`** in `next.config.ts` (see `docs/SLUGGER_WIDGET_REGISTRATION.md`).

---

## Health checks

- **API:** `GET /health` → `{ "ok": true }`
- **Web:** framework default or custom route as needed

---

## npm audit (`effect` / Prisma CLI)

Prisma 6’s CLI pulls `@prisma/config`, which previously depended on `effect` &lt; 3.20 (advisory [GHSA-38f7-945m-qr2g](https://github.com/advisories/GHSA-38f7-945m-qr2g)). The repo root **`package.json`** uses an **`overrides`** entry to pin `effect@3.21.0` under `@prisma/config` so `npm audit` is clean without upgrading to Prisma 7 (which needs `prisma.config.ts`, driver adapters, and broader app changes). Re-run `npm install` after pulling.

---

## Troubleshooting

| Symptom | Checks |
|---------|--------|
| Empty player list | Run sync; verify `DATABASE_URL`; confirm filters are not overly strict. |
| Web “cannot reach API” | `NEXT_PUBLIC_API_URL`, firewall, API process listening. |
| Sync 401 | `SYNC_INTERNAL_KEY` must match on API and on the Next server for `/api/sync`. |
| Sync 403 from TBC | Use `npm run sync:relay -w @available-player-portal/api`; set `TBC_HTTPS_PROXY` if the runner itself needs a whitelisted static IP. |
| Prisma errors | `npx prisma generate` after schema changes; migration status. |

---

## Related documentation

- [API_SPEC.md](./API_SPEC.md) — HTTP contract
- [DATA_SOURCES.md](./DATA_SOURCES.md) — TBC feeds and pipeline
- [SLUGGER_WIDGET_REGISTRATION.md](./SLUGGER_WIDGET_REGISTRATION.md) — iframe embedding
