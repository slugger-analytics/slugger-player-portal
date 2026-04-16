/**
 * @file syncApi.ts
 * @description HTTP trigger for the TBC → DB sync pipeline (`runSyncPipeline`).
 *
 * **POST /sync** — Fetches feeds, parses, upserts. Optional `SYNC_INTERNAL_KEY`: when set,
 * require `Authorization: Bearer <key>`. The Next.js app proxies with the same server-only env.
 */

import { Router } from "express"
import { runSyncPipeline } from "../jobs/syncPipeline"

export function createSyncRouter(): Router {
  const r = Router()

  r.post("/", async (req, res, next) => {
    try {
      const required = process.env.SYNC_INTERNAL_KEY?.trim()
      if (required) {
        const auth = req.headers.authorization
        if (auth !== `Bearer ${required}`) {
          res.status(401).json({ error: "Invalid or missing sync authorization" })
          return
        }
      }

      const counts = await runSyncPipeline()
      res.json({ ok: true, ...counts })
    } catch (e) {
      next(e)
    }
  })

  return r
}
