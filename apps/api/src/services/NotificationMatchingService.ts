import { Prisma } from "@prisma/client"
import { PlayerDataService } from "./PlayerDataService"
import { NotificationEmailService } from "./NotificationEmailService"
import { prisma } from "../lib/prisma"

type MatchInput = {
  syncRunKey: string
  changedPlayerIds: string[]
}

type ProfileFilters = Record<string, string | number | boolean | undefined>

export function filtersJsonToQuery(
  filters: unknown,
  onlyWithStats: boolean,
  rankingPreferences: unknown,
): ProfileFilters {
  const out: ProfileFilters = {}
  if (Array.isArray(filters)) {
    for (const item of filters) {
      if (item && typeof item === "object") {
        const field = String((item as { field?: unknown }).field ?? "")
        const value = (item as { value?: unknown }).value
        if (!field || value == null || value === "") continue
        out[field] = typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : String(value)
      }
    }
  }
  if (onlyWithStats) out.hasStats = true
  if (rankingPreferences && typeof rankingPreferences === "object") {
    const rank = rankingPreferences as { weights?: Record<string, number>; targetPosition?: string }
    if (rank.weights) {
      out.rankWPerf = rank.weights.performance
      out.rankWExp = rank.weights.experience
      out.rankWPos = rank.weights.positionMatch
      out.rankWAvail = rank.weights.availability
      out.rankWTx = rank.weights.recentTransactions
    }
    if (rank.targetPosition?.trim()) out.rankTargetPosition = rank.targetPosition.trim()
  }
  out.sortBy = "recentProfileTransaction"
  out.sortDir = "desc"
  return out
}

export class NotificationMatchingService {
  constructor(
    private readonly players = new PlayerDataService(),
    private readonly emailService = new NotificationEmailService(),
  ) {}

  async evaluateAfterSync(input: MatchInput): Promise<void> {
    if (input.changedPlayerIds.length === 0) return
    const changedSet = new Set(input.changedPlayerIds)
    const users = await prisma.notificationUser.findMany({
      include: {
        savedProfiles: true,
        watchedPlayers: true,
      },
    })
    for (const user of users) {
      const createdEventIds: string[] = []

      for (const profile of user.savedProfiles) {
        const filters = filtersJsonToQuery(profile.filters, profile.onlyWithStats, profile.rankingPreferences)
        const result = await this.players.listPlayerSummariesWithTotal(filters)
        for (const p of result.players) {
          if (!changedSet.has(p.id)) continue
          const dedupeKey = `${input.syncRunKey}:${user.id}:${p.id}:PROFILE:${profile.id}`
          const created = await prisma.notificationEvent.upsert({
            where: { dedupeKey },
            create: {
              notificationUserId: user.id,
              playerId: p.id,
              type: "PROFILE",
              dedupeKey,
              savedSearchProfileId: profile.id,
              payload: {
                profileName: profile.name,
                mostRecentTransactionDate: p.mostRecentTransactionDate,
                mostRecentTransactionType: p.mostRecentTransactionType,
              },
            },
            update: {},
            select: { id: true },
          })
          createdEventIds.push(created.id)
        }
      }

      const watchedMatches = user.watchedPlayers.filter((row) => changedSet.has(row.playerId))
      for (const watched of watchedMatches) {
        const dedupeKey = `${input.syncRunKey}:${user.id}:${watched.playerId}:WATCHED`
        const created = await prisma.notificationEvent.upsert({
          where: { dedupeKey },
          create: {
            notificationUserId: user.id,
            playerId: watched.playerId,
            type: "WATCHED",
            dedupeKey,
            payload: { reason: "watched-player-update" },
          },
          update: {},
          select: { id: true },
        })
        createdEventIds.push(created.id)
      }

      if (createdEventIds.length === 0) continue

      const dispatch = await prisma.notificationDispatch.upsert({
        where: { notificationUserId_syncRunKey: { notificationUserId: user.id, syncRunKey: input.syncRunKey } },
        create: {
          notificationUserId: user.id,
          syncRunKey: input.syncRunKey,
          status: "pending",
        },
        update: {},
      })
      await prisma.notificationDispatchItem.createMany({
        data: createdEventIds.map((eventId) => ({ dispatchId: dispatch.id, eventId })),
        skipDuplicates: true,
      })

      try {
        const lines = await this.buildEmailLines(createdEventIds)
        await this.emailService.sendMatchSummary({
          to: user.email,
          syncRunKey: input.syncRunKey,
          lines,
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
  }

  private async buildEmailLines(eventIds: string[]): Promise<string[]> {
    const rows = await prisma.notificationEvent.findMany({
      where: { id: { in: eventIds } },
      include: { player: true, savedProfile: true },
      orderBy: [{ createdAt: "desc" }],
    })
    return rows.map((row) => {
      if (row.type === "PROFILE") {
        return `${row.player.name} matched profile "${row.savedProfile?.name ?? "Saved profile"}"`
      }
      return `${row.player.name} had an update from your watched list`
    })
  }
}
