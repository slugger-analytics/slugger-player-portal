# Data sources — Available Player Portal

This document describes **implemented** data ingestion for the Player Discovery feature: **The Baseball Cube (TBC)** JHU-style CSV feeds. Other variables in `.env.example` (`MLB_TRANSACTION_FEED_URL`, `BASEBALL_CUBE_BASE_URL`, etc.) are reserved for future work and are **not** wired in the current sync pipeline.

---

## Primary source: The Baseball Cube feeds

All live ingest for players, transactions, batting, and pitching stats uses **server-side HTTP GET** to TBC. Requests use HTTPS (HTTP URLs redirect).

**Base path:** `https://thebaseballcube.com/data/feed/jhu/`

| Feed | Path | Stored as `raw_feed_snapshots.feed_type` |
|------|------|---------------------------------------------|
| Transactions | `tranx.asp?pw=<password>` | `transactions` |
| Batting | `batting.asp?pw=<password>` | `batting` |
| Pitching | `pitching.asp?pw=<password>` | `pitching` |

The password is read from the environment variable **`TBC_FEED_PASSWORD`** on the **API server only**. Do **not** expose it via `NEXT_PUBLIC_*` or client-side code.

**Implementation:** `apps/api/src/services/ApiSyncTBC.ts`

---

## Wire format (as consumed by the parser)

Responses are **plain text** with:

- Logical rows separated by HTML **`<br>`** (case-insensitive).
- Each row: **comma-separated** values, with optional quoted fields.
- First row: **header**; column names are normalized to **camelCase** for mapping.

**Implementation:** `apps/api/src/services/DataParser.ts`

Examples of concepts mapped from headers:

- **Transactions:** `playerid`, `tranx date`, `tranx_type`, `description` → `Transaction` + player context.
- **Batting:** `playerid`, `year`, rate stats → `BattingStats` per player-season.
- **Pitching:** `playerid`, `year`, `ERA`, `WHIP`, `IP`, `SO` (strikeouts) → `PitchingStats`.

---

## Pipeline (sync)

Order of operations (`apps/api/src/jobs/syncPipeline.ts`):

1. **Fetch** all three feeds in parallel (`ApiSyncTBC`).
2. **Persist raw bodies** — append-only rows in `raw_feed_snapshots` (`RawDataStorage`) for audit and debugging.
3. **Parse** each feed into typed arrays (`DataParser`).
4. **Merge** player projections from all three feeds by `playerid` (`mergePlayers`).
5. **Upsert** into PostgreSQL:
   - `players` — by `id`
   - `transactions` — by `unique_hash` (SHA-256 of natural key fields)
   - `batting_stats` — by `(player_id, season)`
   - `pitching_stats` — by `(player_id, season)`

Re-running the pipeline is **idempotent** for those unique constraints: no duplicate stat rows or duplicate transactions for the same logical line.

**Triggers:**

- CLI: `npm run sync` or `npm run sync:ts-node` in `apps/api`
- HTTP: `POST /sync` on the API (see `docs/API_SPEC.md`)
- UI: **Refresh database** on the home page → Next.js `POST /api/sync` → API `POST /sync`

---

## Database tables (Prisma)

| Table | Purpose |
|-------|---------|
| `players` | Core roster row; `id` = TBC player id string |
| `transactions` | Feed transaction lines linked to `players` |
| `batting_stats` | Season batting lines |
| `pitching_stats` | Season pitching lines |
| `raw_feed_snapshots` | Append-only copy of each fetch |

Schema: `apps/api/prisma/schema.prisma`

---

## Read path vs write path

| Direction | Path |
|-----------|------|
| **Write** | TBC → API sync job → Prisma → PostgreSQL |
| **Read** | Next.js / browser → Express `GET /players*` → Prisma → JSON |

The Next.js app does **not** connect to PostgreSQL directly for Player Discovery; it uses the REST API.

---

## Future / placeholder env vars

These appear in `.env.example` but are **not** used by the current TBC sync code:

- `MLB_TRANSACTION_FEED_URL`
- `MILB_TRANSACTION_FEED_URL`
- `BASEBALL_CUBE_BASE_URL`
- `BASEBALL_CUBE_API_KEY`

Integrating them would require new scrapers or clients and explicit routing into the same or parallel pipelines.

---

## Related documentation

- [API_SPEC.md](./API_SPEC.md) — `GET /players`, `POST /sync`
- [DEPLOYMENT.md](./DEPLOYMENT.md) — credentials and scheduling
