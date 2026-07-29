# TBC Sync Runbook

Operational guide for running the The Baseball Cube (TBC) → PostgreSQL sync for the
Available Player Portal, verifying the result, and reasoning about parity with TBC.

The sync fetches three TBC feeds (transactions, batting, pitching), parses them, upserts
`players` / `transactions` / `batting_stats` / `pitching_stats`, then enforces the portal
retention policy. See `apps/api/src/jobs/syncPipeline.ts` and `docs/DEPLOYMENT.md`.

> **Never print or commit secret values.** This runbook references environment variables by
> **name only**. `TBC_FEED_PASSWORD` and `SYNC_INTERNAL_KEY` already exist in git history and
> must be rotated (see [Warnings](#warnings)).

---

## 1. Manual sync — GitHub Actions (preferred)

The scheduled cron is currently paused (see [Re-enabling the cron](#5-re-enabling-the-cron)),
so production syncs run via manual dispatch of the relay workflow:

```bash
gh workflow run sync.yml --ref main
# watch it:
gh run watch "$(gh run list --workflow=sync.yml --limit 1 --json databaseId --jq '.[0].databaseId')"
```

What the workflow (`.github/workflows/sync.yml`) does:

1. Builds `@available-player-portal/shared`, assumes the AWS deploy role via OIDC (region
   `us-east-2`), then runs `apps/api/src/jobs/localRelaySync.ts`.
2. Fetches the three feeds from a **non-AWS** network (the GitHub runner, optionally via
   `TBC_HTTPS_PROXY`) so the Lambda never has to egress to TBC and never trips Cloudflare's
   Bot Fight Mode against AWS IPs.
3. **Stages the gzipped feeds** under `s3://alpb-player-portal-sync/feeds/<runId>/`
   (`transactions.csv.gz`, `batting.csv.gz`, `pitching.csv.gz`). Staging in S3 keeps the
   payload out of the ALB → Lambda **1 MB request limit**.
4. `POST /sync/ingest-raw` with the S3 keys and `Authorization: Bearer <SYNC_INTERNAL_KEY>`.
   The Lambda reads the feeds from S3 via its VPC gateway endpoint and runs the same parse +
   upsert + notification-matching path as a normal sync.

Endpoint (default `REMOTE_SYNC_INGEST_URL`):
`https://www.alpb-analytics.com/widgets/player-portal/api/sync/ingest-raw`

A healthy run typically completes in **~110 s** (May 2026 precedent) and returns a JSON body
with `players`, `transactions`, `batting`, `pitching`, and `changedPlayers` counts.

---

## 2. Workstation fallback — `sync:relay`

When GitHub Actions is unavailable, run the identical relay from a workstation with
non-AWS egress:

```bash
npm run sync:relay -w @available-player-portal/api
```

Required environment (set these in your shell — **names only**, never paste values here):

| Variable | Purpose |
| --- | --- |
| `TBC_FEED_PASSWORD` | TBC feed query-string credential (server-only) |
| `SYNC_INTERNAL_KEY` | Bearer token authorizing `POST /sync/ingest-raw` |
| `FEED_S3_BUCKET` | S3 bucket the relay stages gzipped feeds into (`alpb-player-portal-sync`) |

Optional: `REMOTE_SYNC_INGEST_URL` (defaults to the production ingest route), `TBC_HTTPS_PROXY`
(static/allow-listed egress for TBC), `AWS_REGION` (defaults to `us-east-2`), `SYNC_RUN_ID`.

You need AWS credentials in the environment that can `PutObject` to `FEED_S3_BUCKET`. The relay
uploads to S3, then calls `POST /sync/ingest-raw`; the production API still performs all DB
writes and notification emails.

> A local, direct-to-DB sync (`npm run sync -w @available-player-portal/api`, or the home-page
> **Refresh database** button which calls `POST /api/sync`) also exists, but requires direct TBC
> egress + `DATABASE_URL` and is not the production path.

---

## 3. Post-sync verification probes

After a run, confirm known players are present and carry **compound positions** (the sync now
derives position from the *newest* transaction row, so shortstop/second-base types survive
instead of being clobbered by a single-position stats cell):

```bash
BASE=https://www.alpb-analytics.com/widgets/player-portal/api
for name in Windish Roselli Leonard; do
  echo "== $name =="
  curl -s "$BASE/players?nameSearch=$name" | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('total'), [ (p['name'], p['position']) for p in d['players'] ])"
done
```

Expect:

- **Presence** — each name returns at least one row (`total >= 1`).
- **Compound positions** — e.g. `SS-2B` / `2B-SS`, not a single-position cell, for players
  whose transaction feed lists a compound position.

Spot-check a profile's transaction list too: `GET $BASE/players/<id>` should include the
player's `Released` / `Free Agent` / `Retired` lines (including suffix variants such as
`Free Agent (minors)`).

---

## 4. TBC-parity caveats

When comparing the portal to TBC's own site, differences are usually **expected**, not bugs:

- **Date anchor (≤ 1 day).** TBC's feed reflects "as of now". A portal that was last synced
  more than a day ago can lag TBC by a day of transactions. Anchor comparisons to the same
  calendar date and re-sync first.
- **Sync recency.** Confirm a fresh sync ran before comparing counts; the cron is paused, so
  the DB is only as current as the last manual dispatch.
- **Type families.** The portal surfaces three families — retired, released, free agent. To
  match a TBC "Free Agents + Released" view, **uncheck Retired** in the discovery filter so the
  families line up.
- **Per-transaction vs newest-transaction position.** TBC lists a position per transaction
  line. The portal stores **one** position per player, derived from the player's *newest*
  transaction row. An older TBC line may therefore show a different position than the portal.

---

## Warnings

- **Out-of-band stale-retention sync is deleting players.** Hundreds of players whose first
  profile-visible transaction is exactly `Released` have gone missing from production. The
  cause is a **separate, out-of-band sync process running stale retention logic** that deletes
  them. It **must be found and decommissioned** before any backfill will stick — otherwise a
  fresh sync repopulates them and the rogue process deletes them again.
- **Rotate secrets.** `TBC_FEED_PASSWORD` and `SYNC_INTERNAL_KEY` exist in git history and
  should be rotated. Update them in the GitHub Actions secrets and the Lambda environment.
  **Do not paste the values anywhere**, including this file.

---

## 5. Re-enabling the cron

The `schedule:` trigger in `.github/workflows/sync.yml` is commented out because TBC's
Cloudflare Bot Fight Mode blocks GitHub-hosted runner IPs. To re-enable:

1. Get a stable egress identifier allow-listed by TBC, **or** configure `TBC_HTTPS_PROXY` to a
   static/allow-listed egress IP (the **allow-list/proxy route only** — do not attempt any
   Cloudflare bypass).
2. Uncomment the `schedule:` block (e.g. `cron: "*/30 * * * *"`) in `sync.yml`.
3. Confirm the OIDC role (`AWS_DEPLOY_ROLE_ARN`) and secrets are still valid, then dispatch one
   manual run before relying on the schedule.
