/**
 * @file index.ts
 * @description Express **HTTP entry point** for `@available-player-portal/api`.
 *
 * **Responsibilities:**
 * - Load env (via `dotenv/config`)
 * - Enable CORS for local Next.js (`localhost:3000`) and configured origins
 * - Mount `GET /health` for orchestration probes
 * - Mount Player Discovery API at `/players`
 * - Mount `POST /sync` to run the TBC ingest pipeline (optional `SYNC_INTERNAL_KEY`)
 * - Connect Prisma before listening on `PORT` (default 4000)
 *
 * **Usage:** `npm run dev` (tsx watch) or `npm run build && npm start` after `tsc`.
 */

import "dotenv/config"
import cors from "cors"
import express from "express"
import { config } from "./config"
import { createPlayerRouter } from "./api/PlayerAPI"
import { createSyncRouter } from "./api/syncApi"
import { prisma } from "./lib/prisma"

const app = express()
app.use(cors({ origin: true }))
app.use(express.json())

/** Liveness/readiness probe for Docker or process managers. */
app.get("/health", (_req, res) => {
  res.json({ ok: true })
})

app.use("/players", createPlayerRouter())
app.use("/sync", createSyncRouter())

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
