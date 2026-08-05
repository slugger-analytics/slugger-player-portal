import { Prisma } from "@prisma/client"
import { PlayerDataService } from "./PlayerDataService"
import { NotificationEmailService } from "./NotificationEmailService"
import { prisma } from "../lib/prisma"
import { filtersToQuery, parseStoredFilters } from "@available-player-portal/shared"

type MatchInput = {
  syncRunKey: string
  changedPlayerIds: string[]
}

type ProfileFilters = Record<string, string | number | boolean | undefined>

function parseCsvIds(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
}

/**
 * Turn a saved profile's stored filter rows into the query its alerts evaluate.
 *
 * This used to read a `{field, value}` shape. The web has never produced one — it POSTs
 * `UiFilter` rows (`{id, kind, label, rawValue, …}`) and the API stores `req.body.filters`
 * verbatim — so every filter was skipped and the query collapsed to
 * `{sortBy, sortDir}`, i.e. every discovery-eligible player. Measured against live data:
 * 3657 matches instead of the 8 the saved filters select, so each sync mailed a user a line
 * for every changed player in the league regardless of what they had asked to watch. The
 * three unit tests passed because they hand-built the shape the product never sends.
 */
export function filtersJsonToQuery(
  filters: unknown,
  onlyWithStats: boolean,
  rankingPreferences: unknown,
): ProfileFilters {
  const out: ProfileFilters = { ...filtersToQuery(parseStoredFilters(filters)) }
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
  // Alerts are standing queries, so the window has to travel with time: keep
  // lastTransactionDays and drop the anchor the user pinned when they saved the
  // profile, which would otherwise freeze the alert on that date forever.
  delete out.asOfDate
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
    const forceNotifySub = process.env.SYNC_FORCE_NOTIFY_USER_SUB?.trim() || ""
    const forceNotifyPlayerIds = parseCsvIds(process.env.SYNC_FORCE_NOTIFY_PLAYER_IDS)
    for (const user of users) {
      const createdEventIds: string[] = []

      // Deterministic demo override: directly force watched-style events for a given user/player set.
      // This is opt-in only via env vars and still tied to the sync run key for traceability.
      if (forceNotifySub && forceNotifySub === user.cognitoSub) {
        for (const forcedPlayerId of forceNotifyPlayerIds) {
          if (!changedSet.has(forcedPlayerId)) continue
          const dedupeKey = `${input.syncRunKey}:${user.id}:${forcedPlayerId}:WATCHED:FORCED`
          const created = await prisma.notificationEvent.upsert({
            where: { dedupeKey },
            create: {
              notificationUserId: user.id,
              playerId: forcedPlayerId,
              type: "WATCHED",
              dedupeKey,
              payload: { reason: "forced-sync-demo-watch-update" },
            },
            update: {},
            select: { id: true },
          })
          createdEventIds.push(created.id)
        }
      }

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
      const forcedWatchedMatches =
        forceNotifySub && forceNotifySub === user.cognitoSub
          ? forceNotifyPlayerIds
              .filter((playerId) => changedSet.has(playerId))
              .map((playerId) => ({ playerId }))
          : []
      for (const watched of [...watchedMatches, ...forcedWatchedMatches]) {
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
