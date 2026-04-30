/**
 * Temporary direct-sync runner:
 * Executes the normal sync pipeline locally (fetch + parse + upsert) against
 * the configured DATABASE_URL, then evaluates notifications for all users.
 *
 * Use this when production egress cannot fetch BaseballCube directly.
 */

import { runSyncPipeline } from "./syncPipeline"
import { NotificationMatchingService } from "../services/NotificationMatchingService"
import { NotificationEmailService } from "../services/NotificationEmailService"
import { prisma } from "../lib/prisma"

function parseCsvIds(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
}

async function runLocalDirectSync(): Promise<void> {
  const counts = await runSyncPipeline()
  const notifications = new NotificationMatchingService()
  await notifications.evaluateAfterSync({
    syncRunKey: counts.syncRunKey,
    changedPlayerIds: counts.changedPlayerIds,
  })

  // Hard deterministic fallback for demos: if matching produced no dispatch rows,
  // force a watched-style event+dispatch for an explicit user/player pair.
  const forceSub = process.env.SYNC_FORCE_NOTIFY_USER_SUB?.trim() || ""
  const forcePlayerIds = parseCsvIds(process.env.SYNC_FORCE_NOTIFY_PLAYER_IDS)
  if (forceSub && forcePlayerIds.length > 0) {
    const targetUsers = await prisma.notificationUser.findMany({
      where: {
        ...(forceSub ? { cognitoSub: forceSub } : {}),
      },
      select: {
        id: true,
        email: true,
      },
    })
    for (const user of targetUsers) {
      const existing = await prisma.notificationDispatch.findUnique({
        where: {
          notificationUserId_syncRunKey: {
            notificationUserId: user.id,
            syncRunKey: counts.syncRunKey,
          },
        },
        select: { id: true },
      })
      if (existing) continue
      const matchedForcedIds = [...forcePlayerIds]
      if (matchedForcedIds.length === 0) continue
      const createdEventIds: string[] = []
      for (const playerId of matchedForcedIds) {
        const event = await prisma.notificationEvent.upsert({
          where: { dedupeKey: `${counts.syncRunKey}:${user.id}:${playerId}:WATCHED:LOCAL_DIRECT_FORCE` },
          create: {
            notificationUserId: user.id,
            playerId,
            type: "WATCHED",
            dedupeKey: `${counts.syncRunKey}:${user.id}:${playerId}:WATCHED:LOCAL_DIRECT_FORCE`,
            payload: { reason: "local-direct-sync-force-demo" },
          },
          update: {},
          select: { id: true },
        })
        createdEventIds.push(event.id)
      }
      if (createdEventIds.length === 0) continue
      const dispatch = await prisma.notificationDispatch.create({
        data: {
          notificationUserId: user.id,
          syncRunKey: counts.syncRunKey,
          status: "pending",
        },
      })
      await prisma.notificationDispatchItem.createMany({
        data: createdEventIds.map((eventId) => ({ dispatchId: dispatch.id, eventId })),
        skipDuplicates: true,
      })
      try {
        const rows = await prisma.notificationEvent.findMany({
          where: { id: { in: createdEventIds } },
          include: { player: true },
          orderBy: [{ createdAt: "desc" }],
        })
        const email = new NotificationEmailService()
        await email.sendMatchSummary({
          to: user.email,
          syncRunKey: counts.syncRunKey,
          lines: rows.map((r) => `${r.player.name} had an update from your watched list`),
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
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: true,
        source: "local-direct-sync",
        syncRunKey: counts.syncRunKey,
        players: counts.players,
        transactions: counts.transactions,
        batting: counts.batting,
        pitching: counts.pitching,
        changedPlayers: counts.changedPlayerIds.length,
      },
      null,
      2,
    ),
  )
}

runLocalDirectSync().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error)
  process.exit(1)
})

