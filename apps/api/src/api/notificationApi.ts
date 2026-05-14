import { Router } from "express"
import { NotificationRepository } from "../repositories/NotificationRepository"
import { requireNotificationIdentity } from "../middleware/notificationAuth"
import { NotificationEmailService } from "../services/NotificationEmailService"
import { prisma } from "../lib/prisma"

const repo = new NotificationRepository()
const emailService = new NotificationEmailService()

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
      const identity = req.notificationIdentity!
      const playerId = req.params.playerId
      await repo.addWatchedPlayer(userId, playerId)

      // Demo-safe, UI-only deterministic path: when enabled, clicking bell creates
      // an immediate watched notification + dispatch + email without waiting for sync.
      const immediateNotifyOnWatch = process.env.DEMO_IMMEDIATE_NOTIFY_ON_WATCH === "true"
      if (immediateNotifyOnWatch) {
        const immediateCooldownHours = 24
        const cooldownStart = new Date(Date.now() - immediateCooldownHours * 60 * 60 * 1000)
        const existingImmediate = await prisma.notificationEvent.findFirst({
          where: {
            notificationUserId: userId,
            playerId,
            type: "WATCHED",
            createdAt: { gte: cooldownStart },
            payload: { path: ["reason"], equals: "immediate-watch-trigger" },
          },
          select: { id: true },
        })
        if (existingImmediate) {
          res.json({ ok: true, immediateSkipped: "cooldown" })
          return
        }

        const syncRunKey = `watch-trigger-${new Date().toISOString()}`
        const dedupeKey = `${syncRunKey}:${userId}:${playerId}:WATCHED:IMMEDIATE`
        const event = await prisma.notificationEvent.upsert({
          where: { dedupeKey },
          create: {
            notificationUserId: userId,
            playerId,
            type: "WATCHED",
            dedupeKey,
            payload: { reason: "immediate-watch-trigger" },
          },
          update: {},
          include: { player: true },
        })
        const dispatch = await prisma.notificationDispatch.upsert({
          where: { notificationUserId_syncRunKey: { notificationUserId: userId, syncRunKey } },
          create: {
            notificationUserId: userId,
            syncRunKey,
            status: "pending",
          },
          update: {},
        })
        await prisma.notificationDispatchItem.createMany({
          data: [{ dispatchId: dispatch.id, eventId: event.id }],
          skipDuplicates: true,
        })
        try {
          await emailService.sendMatchSummary({
            to: identity.email,
            syncRunKey,
            lines: [`${event.player.name} had an update from your watched list`],
          })
          await prisma.notificationDispatch.update({
            where: { id: dispatch.id },
            data: { status: "sent", errorMessage: null },
          })
        } catch (error) {
          await prisma.notificationDispatch.update({
            where: { id: dispatch.id },
            data: {
              status: "failed",
              errorMessage: error instanceof Error ? error.message : "Unknown email failure",
            },
          })
        }
      }
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

  r.post("/test-email", async (req, res, next) => {
    try {
      const identity = req.notificationIdentity!
      const requestedEventIds = Array.isArray(req.body?.eventIds)
        ? req.body.eventIds.filter((id: unknown): id is string => typeof id === "string")
        : []
      const rows = await repo.listRecentEvents(identity.userId)
      const selected =
        requestedEventIds.length > 0
          ? rows.filter((row) => requestedEventIds.includes(row.id))
          : rows.slice(0, 10)
      const lines =
        selected.length > 0
          ? selected.map((row) => {
              if (row.type === "PROFILE") {
                return `${row.player.name} matched profile "${row.savedProfile?.name ?? "Saved profile"}"`
              }
              return `${row.player.name} had an update from your watched list`
            })
          : ["Test notification: no recent events were available for this user."]
      const syncRunKey = `manual-test-${new Date().toISOString()}`
      await emailService.sendMatchSummary({
        to: identity.email,
        syncRunKey,
        lines,
      })
      res.json({
        ok: true,
        to: identity.email,
        syncRunKey,
        eventCount: selected.length,
        webhookConfigured: Boolean(process.env.NOTIFICATION_EMAIL_WEBHOOK_URL?.trim()),
      })
    } catch (error) {
      next(error)
    }
  })

  return r
}
