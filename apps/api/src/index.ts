/**
 * @file index.ts
 * @description Express **HTTP entry point** for `@available-player-portal/api`.
 *
 * **Responsibilities:**
 * - Load env (via `./config` → `loadDotenv()`)
 * - Enable CORS for local Next.js (`localhost:3000`) and configured origins
 * - Mount `GET /health` for orchestration probes
 * - Mount Player Discovery API at `/players`
 * - Mount `POST /sync` to run the TBC ingest pipeline (optional `SYNC_INTERNAL_KEY`)
 * - Connect Prisma before listening on `PORT` (default 4000)
 *
 * **Usage:** `npm run dev` (tsx watch) or `npm run build && npm start` after `tsc`.
 */

import cors from "cors"
import express from "express"
import { createPlayerRouter } from "./api/PlayerAPI"
import { createSyncRouter } from "./api/syncApi"
import { config } from "./config"
import { prisma } from "./lib/prisma"

const app = express()
// In production, CORS_ALLOWED_ORIGIN is set to the ALB domain (e.g. https://alpb-analytics.com).
// In local dev the variable is unset, so 'true' is used (allow all origins — same as before).
const corsOrigin: string | boolean = process.env.CORS_ALLOWED_ORIGIN || true
app.use(cors({ origin: corsOrigin }))
app.use(express.json())

// ALB forwards the full path (e.g. /widgets/player-portal/api/health).
// In production BASE_PATH is set; locally it's empty so routes stay at /.
const base = process.env.BASE_PATH
  ? `${process.env.BASE_PATH}/api`
  : ""

/** Liveness/readiness probe for Docker or process managers. */
app.get(`${base}/health`, (_req, res) => {
  res.json({ ok: true })
})

app.use(`${base}/players`, createPlayerRouter())
app.use(`${base}/sync`, createSyncRouter())

/** Last-resort JSON error handler for route failures and unexpected errors. */
app.use(
  (
    err: Error & { status?: number },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    // eslint-disable-next-line no-console
    console.error(err)
    const status = err.status ?? 500
    res.status(status).json({ error: err.message || "Internal Server Error" })
  },
)

async function main() {
  await prisma.$connect()
  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on http://localhost:${config.port}`)
  })
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e)
  process.exit(1)
})
