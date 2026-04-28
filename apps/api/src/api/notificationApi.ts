import { Router } from "express"
import { NotificationRepository } from "../repositories/NotificationRepository"
import { requireNotificationIdentity } from "../middleware/notificationAuth"

const repo = new NotificationRepository()

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null
}

export function createNotificationRouter(): Router {
  const r = Router()
  r.use(requireNotificationIdentity)

  r.get("/profiles", async (req, res, next) => {
    try {
      const userId = req.notificationIdentity!.userId
      const profiles = await repo.listProfiles(userId)
      res.json({ profiles })
    } catch (error) {
      next(error)
    }
  })

  r.post("/profiles", async (req, res, next) => {
    try {
      const userId = req.notificationIdentity!.userId
      const name = asString(req.body?.name) ?? "Untitled profile"
      const onlyWithStats = Boolean(req.body?.onlyWithStats)
      const filters = req.body?.filters
      const rankingPreferences = req.body?.rankingPreferences
      const id = asString(req.body?.id) ?? undefined
      const profile = await repo.upsertProfile(userId, { id, name, onlyWithStats, filters, rankingPreferences })
      res.json({ profile })
    } catch (error) {
      next(error)
    }
  })

  r.delete("/profiles/:id", async (req, res, next) => {
    try {
      const userId = req.notificationIdentity!.userId
      await repo.deleteProfile(userId, req.params.id)
      res.json({ ok: true })
    } catch (error) {
      next(error)
    }
  })

  r.get("/watch", async (req, res, next) => {
    try {
      const userId = req.notificationIdentity!.userId
      const playerIds = await repo.listWatchedPlayerIds(userId)
      res.json({ playerIds })
    } catch (error) {
      next(error)
    }
  })

  r.post("/watch/:playerId", async (req, res, next) => {
    try {
      const userId = req.notificationIdentity!.userId
      await repo.addWatchedPlayer(userId, req.params.playerId)
      res.json({ ok: true })
    } catch (error) {
      next(error)
    }
  })

  r.delete("/watch/:playerId", async (req, res, next) => {
    try {
      const userId = req.notificationIdentity!.userId
      await repo.removeWatchedPlayer(userId, req.params.playerId)
      res.json({ ok: true })
    } catch (error) {
      next(error)
    }
  })

  r.get("/events", async (req, res, next) => {
    try {
      const userId = req.notificationIdentity!.userId
      const events = await repo.listRecentEvents(userId)
      res.json({ events })
    } catch (error) {
      next(error)
    }
  })

  r.post("/events/read", async (req, res, next) => {
    try {
      const userId = req.notificationIdentity!.userId
      const eventIds = Array.isArray(req.body?.eventIds)
        ? req.body.eventIds.filter((id: unknown): id is string => typeof id === "string")
        : []
      await repo.markEventsRead(userId, eventIds)
      res.json({ ok: true })
    } catch (error) {
      next(error)
    }
  })

  return r
}
