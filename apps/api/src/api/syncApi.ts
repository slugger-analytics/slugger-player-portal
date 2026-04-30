/**
 * @file syncApi.ts
 * @description HTTP trigger for the TBC → DB sync pipeline (`runSyncPipeline`).
 *
 * **POST /sync** — Fetches feeds, parses, upserts. Optional `SYNC_INTERNAL_KEY`: when set,
 * require `Authorization: Bearer <key>`. The Next.js app proxies with the same server-only env.
 */

import { Router } from "express"
import { runSyncPipeline, runSyncPipelineFromRaw } from "../jobs/syncPipeline"
import { NotificationMatchingService } from "../services/NotificationMatchingService"

export function createSyncRouter(): Router {
  const r = Router()
  const notifications = new NotificationMatchingService()

  function ensureAuthorized(req: { headers: { authorization?: string } }, res: { status: (code: number) => { json: (body: unknown) => void } }): boolean {
    const required = process.env.SYNC_INTERNAL_KEY?.trim()
    if (!required) return true
    const auth = req.headers.authorization
    if (auth === `Bearer ${required}`) return true
    res.status(401).json({ error: "Invalid or missing sync authorization" })
    return false
  }

  r.post("/", async (req, res, next) => {
    try {
      if (!ensureAuthorized(req, res)) return

      const counts = await runSyncPipeline()
      await notifications.evaluateAfterSync({
        syncRunKey: counts.syncRunKey,
        changedPlayerIds: counts.changedPlayerIds,
      })
      res.json({
        ok: true,
        syncRunKey: counts.syncRunKey,
        players: counts.players,
        transactions: counts.transactions,
        batting: counts.batting,
        pitching: counts.pitching,
        changedPlayers: counts.changedPlayerIds.length,
      })
    } catch (e) {
      next(e)
    }
  })

  /**
   * Temporary fallback endpoint: process externally-fetched raw feed payloads.
   * This keeps DB writes + notifications in production while feed download can
   * happen from a non-blocked network.
   */
  r.post("/ingest-raw", async (req, res, next) => {
    try {
      if (!ensureAuthorized(req, res)) return
      const transactionsRaw =
        typeof req.body?.transactionsRaw === "string" ? req.body.transactionsRaw : ""
      const battingRaw = typeof req.body?.battingRaw === "string" ? req.body.battingRaw : ""
      const pitchingRaw = typeof req.body?.pitchingRaw === "string" ? req.body.pitchingRaw : ""
      if (!transactionsRaw || !battingRaw || !pitchingRaw) {
        res.status(400).json({
          error:
            "Missing raw feed payloads. Expected JSON body with transactionsRaw, battingRaw, pitchingRaw.",
        })
        return
      }

      const counts = await runSyncPipelineFromRaw({
        transactionsRaw,
        battingRaw,
        pitchingRaw,
      })
      await notifications.evaluateAfterSync({
        syncRunKey: counts.syncRunKey,
        changedPlayerIds: counts.changedPlayerIds,
      })
      res.json({
        ok: true,
        source: "raw-ingest",
        syncRunKey: counts.syncRunKey,
        players: counts.players,
        transactions: counts.transactions,
        batting: counts.batting,
        pitching: counts.pitching,
        changedPlayers: counts.changedPlayerIds.length,
      })
    } catch (e) {
      next(e)
    }
  })

  return r
}
