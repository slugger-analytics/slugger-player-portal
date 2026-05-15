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
import { FeedObjectStore } from "../services/FeedObjectStore"

export function createSyncRouter(): Router {
  const r = Router()
  const notifications = new NotificationMatchingService()
  const feedStore = new FeedObjectStore()

  function ensureAuthorized(
    req: { headers: { authorization?: string } },
    res: { status: (code: number) => { json: (body: unknown) => void } },
  ): boolean {
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
   * Relay endpoint for externally fetched raw feed payloads. This keeps DB writes
   * and notifications in production while avoiding TBC blocks on AWS egress.
   *
   * Two body shapes are supported:
   * 1. Inline strings `{ transactionsRaw, battingRaw, pitchingRaw }` — fine for
   *    local development where the payload comfortably fits the request.
   * 2. S3 references `{ s3Bucket?, transactionsKey, battingKey, pitchingKey }` —
   *    used by CI so the gzipped feed payload never has to fit in the ALB → Lambda
   *    1 MB sync request limit. Keys ending in `.gz` are gunzipped transparently.
   */
  r.post("/ingest-raw", async (req, res, next) => {
    try {
      if (!ensureAuthorized(req, res)) return
      const body = req.body ?? {}

      const hasS3Refs = [body.transactionsKey, body.battingKey, body.pitchingKey].every(
        (v) => typeof v === "string" && v.length > 0,
      )

      let rawFeeds: { transactionsRaw: string; battingRaw: string; pitchingRaw: string } | null = null
      if (hasS3Refs) {
        rawFeeds = await feedStore.readFeeds({
          bucket: typeof body.s3Bucket === "string" ? body.s3Bucket : undefined,
          transactionsKey: body.transactionsKey,
          battingKey: body.battingKey,
          pitchingKey: body.pitchingKey,
        })
      } else {
        const transactionsRaw = typeof body.transactionsRaw === "string" ? body.transactionsRaw : ""
        const battingRaw = typeof body.battingRaw === "string" ? body.battingRaw : ""
        const pitchingRaw = typeof body.pitchingRaw === "string" ? body.pitchingRaw : ""
        if (!transactionsRaw || !battingRaw || !pitchingRaw) {
          res.status(400).json({
            error:
              "Missing raw feed payloads. Expected JSON body with transactionsRaw/battingRaw/pitchingRaw or transactionsKey/battingKey/pitchingKey (+ optional s3Bucket).",
          })
          return
        }
        rawFeeds = { transactionsRaw, battingRaw, pitchingRaw }
      }

      const counts = await runSyncPipelineFromRaw(rawFeeds)
      await notifications.evaluateAfterSync({
        syncRunKey: counts.syncRunKey,
        changedPlayerIds: counts.changedPlayerIds,
      })
      res.json({
        ok: true,
        source: hasS3Refs ? "s3-ingest" : "raw-ingest",
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
