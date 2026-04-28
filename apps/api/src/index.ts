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
 * **Usage:**
 * - Local: leave `BASE_PATH` unset so routes are `/health`, `/players`, `/sync`.
 * - Production (ALB): set `BASE_PATH` (e.g. `/widgets/player-portal`); routes are under `${BASE_PATH}/api/...`.
 * - If `BASE_PATH` is set (e.g. copied from prod), routes are **also** mounted at `/` so
 *   `NEXT_PUBLIC_API_URL=http://localhost:4000` still hits `/health`, `/players`, `/sync`.
 *
 * Run: `npm run dev` (tsx watch) or `npm run build && npm start` after `tsc`.
 */

import cors from "cors"
import express from "express"
import { createPlayerRouter } from "./api/PlayerAPI"
import { createNotificationRouter } from "./api/notificationApi"
import { createSyncRouter } from "./api/syncApi"
import { config } from "./config"
import { prisma } from "./lib/prisma"

const app = express()
// In production, CORS_ALLOWED_ORIGIN is set to the ALB domain (e.g. https://alpb-analytics.com).
// In local dev the variable is unset, so 'true' is used (allow all origins — same as before).
const corsOrigin: string | boolean = process.env.CORS_ALLOWED_ORIGIN || true
app.use(cors({ origin: corsOrigin }))
app.use(express.json())

/** e.g. `/widgets/player-portal/api` when `BASE_PATH=/widgets/player-portal` */
function apiPathPrefixFromEnv(): string {
  const raw = process.env.BASE_PATH?.trim()
  if (!raw) return ""
  const base = raw.replace(/\/$/, "")
  return `${base}/api`
}

const productionApiPrefix = apiPathPrefixFromEnv()
/** When BASE_PATH is set, still mount the same routes at `/` for local clients that use a bare origin. */
const alsoMountAtRoot = Boolean(productionApiPrefix)
function mountApiRoutes(pathPrefix: string): void {
  const p = pathPrefix.replace(/\/$/, "")
  app.get(`${p}/health`, (_req, res) => {
    res.json({ ok: true })
  })
  app.use(`${p}/players`, createPlayerRouter())
  app.use(`${p}/notifications`, createNotificationRouter())
  app.use(`${p}/sync`, createSyncRouter())
}

if (productionApiPrefix) {
  mountApiRoutes(productionApiPrefix)
  if (alsoMountAtRoot) {
    mountApiRoutes("")
  }
} else {
  mountApiRoutes("")
}

if (process.env.NODE_ENV !== "production") {
  app.get("/", (_req, res) => {
    const hints = [
      "Player Portal API",
      "",
      productionApiPrefix
        ? `Prefixed routes (BASE_PATH): ${productionApiPrefix}/health, …/players, …/sync`
        : "Try GET /health, GET /players",
      alsoMountAtRoot ? "Also mounted at /health, /players, /sync (duplicate of BASE_PATH routes)." : "",
      "",
      "If the server exits immediately, check DATABASE_URL and run Postgres + prisma migrate.",
    ]
      .filter(Boolean)
      .join("\n")
    res.type("text/plain").send(hints)
  })
}

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
    if (productionApiPrefix) {
      // eslint-disable-next-line no-console
      console.log(`  API route prefix: ${productionApiPrefix}`)
      if (alsoMountAtRoot) {
        // eslint-disable-next-line no-console
        console.log(`  same routes also at http://localhost:${config.port}/health …`)
      }
    }
  })
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e)
  process.exit(1)
})
