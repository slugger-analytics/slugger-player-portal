# API specification — Available Player Portal

This document describes the **Express API** in `apps/api` as implemented today. The Next.js app (`apps/web`) calls these endpoints via `NEXT_PUBLIC_API_URL` (and the server-side `/api/sync` proxy for sync).

**Default base URL (local):** `http://localhost:4000`  
**Content type:** JSON for request/response bodies where applicable.

---

## Health

### `GET /health`

**Response:** `200 OK`

```json
{ "ok": true }
```

Use for load balancers and process managers.

---

## Player Discovery

All routes below are mounted under **`/players`** (see `apps/api/src/api/PlayerAPI.ts`).

### `GET /players`

Returns a list of player summaries for the discovery UI, with optional filters. Data is read from PostgreSQL after the TBC sync pipeline has populated tables.

**Query parameters** (all optional):

| Parameter   | Type   | Description |
|------------|--------|-------------|
| `position` | string | Substring match (case-insensitive). Values containing `pitch` also match short pitcher codes (`P`, `p-`, etc.). |
| `status`   | string | Exact match on `Player.status` (e.g. `available`, `signed`, `injured`). |
| `team`     | string | Substring match on `team` (case-insensitive). |
| `ageMin`   | number | Inclusive minimum `age`. |
| `ageMax`   | number | Inclusive maximum `age`. |
| `hasStats` | string | When `true`, `1`, or `yes`, only players with **≥1** `batting_stats` **or** `pitching_stats` row. `false` / `0` / `no` clears the filter. |
| `limit`    | number | Max rows to return (integer **1–100**). Applies `take` in Prisma after sort by name. |
| `offset`   | number | Skip this many rows before applying `limit` (integer **≥ 0**). Ignored unless `limit` is set. |

Invalid `ageMin` / `ageMax` / `limit` / `offset` / `hasStats` (unrecognized value) → **`400`** with `{ "error": "Invalid …" }`.  
`offset` **> 0** without `limit` → **`400`** with `{ "error": "Invalid offset: use limit when offset is set" }`.

**Response:** `200 OK` — JSON object **`PlayerSummariesResponse`**:

| Field | Type | Description |
|-------|------|-------------|
| `players` | **`PlayerSummary[]`** | Page of rows for this request (after `limit` / `offset`). |
| `total` | number | Count of all rows matching the same filters, **ignoring** `limit` / `offset` (for “N of total” UI). |

Each **`PlayerSummary`** in `players`:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | TBC player id (primary key in DB). |
| `name` | string | Display name. |
| `position` | string | Position label. |
| `team` | string | Team label. |
| `status` | string | Availability-style status. |
| `minimalStatLine` | string | Batter: `AVG / OBP / SLG`; pitcher: `ERA / WHIP / K` from latest season row. |
| `mostRecentTeam` | string | Currently mirrors `team`. |
| `imageUrl` | string \| null | Optional; often `null` (UI uses placeholder). |

---

### `GET /players/:id/transactions`

**Note:** This route is registered **before** `GET /players/:id` so `transactions` is not interpreted as an `:id`.

Returns transaction rows for one player, **oldest → newest** by date.

**Response:** `200 OK` — array of **`Transaction`**:

| Field | Type | Description |
|-------|------|-------------|
| `playerId` | string | Player id. |
| `date` | string | ISO date `YYYY-MM-DD`. |
| `type` | string | Feed transaction type (e.g. trade, contract). |
| `description` | string | Free-text description from feed. |

---

### `GET /players/:id`

Returns full profile for detail views.

**Response:** `200 OK` — **`PlayerProfile`**:

| Field | Type | Description |
|-------|------|-------------|
| `player` | `Player` | Core row: `id`, `name`, `position`, `team`, `status`, optional `age`. |
| `mostRecentBatting` | `BattingStats` \| null | Highest `season` batting row. |
| `previousBatting` | `BattingStats` \| null | Second-highest season. |
| `mostRecentPitching` | `PitchingStats` \| null | Highest `season` pitching row. |
| `previousPitching` | `PitchingStats` \| null | Second-highest season. |
| `transactions` | `Transaction[]` | Same logical data as `GET /players/:id/transactions` (embedded for convenience). |

**Errors:** `404` — `{ "error": "Player not found" }` if id does not exist.

---

## Data sync (ingest pipeline)

### `POST /sync`

Runs the full **The Baseball Cube → PostgreSQL** pipeline (fetch feeds, append raw snapshots, parse, upsert). Equivalent to `npm run sync` in `apps/api`.

**Authentication (optional):**

- If `SYNC_INTERNAL_KEY` is set in the API environment, the request must include:
  - Header: `Authorization: Bearer <SYNC_INTERNAL_KEY>`
- If unset, the endpoint accepts unauthenticated requests (acceptable for trusted local networks only).

**Response:** `200 OK`

```json
{
  "ok": true,
  "players": 1234,
  "transactions": 5678,
  "batting": 9012,
  "pitching": 3456
}
```

Counts reflect **parsed row volumes** for that run (upserts may update existing rows).

**Errors:** `401` if the key is required but missing/invalid; `500` on pipeline failure (message in JSON `error` when handled by the global error middleware).

**Browser access:** The web app should not call this URL directly with secrets. Use **`POST /api/sync`** on the Next.js app, which proxies server-side (see `apps/web/app/api/sync/route.ts`).

### `POST /sync/ingest-raw`

Processes raw TBC feed payloads fetched by a trusted relay. This runs the same parse, upsert, notification matching, and email dispatch logic as `/sync`, but avoids direct TBC egress from AWS Lambda.

**Authentication:** same `Authorization: Bearer <SYNC_INTERNAL_KEY>` behavior as `/sync`.

**Request bodies (one of):**

```json
{
  "s3Bucket": "alpb-player-portal-sync",
  "transactionsKey": "feeds/<run>/transactions.csv.gz",
  "battingKey": "feeds/<run>/batting.csv.gz",
  "pitchingKey": "feeds/<run>/pitching.csv.gz"
}
```

```json
{
  "transactionsRaw": "...",
  "battingRaw": "...",
  "pitchingRaw": "..."
}
```

Keys ending in `.gz` are gunzipped transparently. `s3Bucket` defaults to `FEED_S3_BUCKET` when omitted.

**Response:** same counts as `/sync`, plus `"source": "s3-ingest"` or `"raw-ingest"`.

---

## Global errors

Unhandled errors may return **`500`** with:

```json
{ "error": "<message>" }
```

---

## CORS

The API uses permissive CORS (`origin: true`) for development. **Tighten** `apps/api/src/index.ts` for production deployments.

---

## Related code

| Area | Path |
|------|------|
| Routes | `apps/api/src/api/PlayerAPI.ts`, `apps/api/src/api/syncApi.ts` |
| Orchestration | `apps/api/src/services/PlayerDataService.ts` |
| Shared types | `packages/shared/types/models.ts` |
| Web client | `apps/web/lib/api.ts` |
