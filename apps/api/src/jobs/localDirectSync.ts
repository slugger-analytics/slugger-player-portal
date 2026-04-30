/**
 * Temporary direct-sync runner:
 * Executes the normal sync pipeline locally (fetch + parse + upsert) against
 * the configured DATABASE_URL, then evaluates notifications for all users.
 *
 * Use this when production egress cannot fetch BaseballCube directly.
 */

import { runSyncPipeline } from "./syncPipeline"
import { NotificationMatchingService } from "../services/NotificationMatchingService"

async function runLocalDirectSync(): Promise<void> {
  const counts = await runSyncPipeline()
  const notifications = new NotificationMatchingService()
  await notifications.evaluateAfterSync({
    syncRunKey: counts.syncRunKey,
    changedPlayerIds: counts.changedPlayerIds,
  })
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

