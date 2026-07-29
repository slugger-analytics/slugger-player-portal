/**
 * @file syncPipeline.ts
 * @description **End-to-end sync job:** fetch TBC feeds → persist raw snapshots → parse → upsert DB.
 *
 * **Execution order (idempotent writes):**
 * 1. Fetch all three feeds in parallel (`ApiSyncTBC`)
 * 2. Append raw snapshots (`RawDataStorage`) — audit trail, not upserted
 * 3. Parse strings into typed rows (`DataParser`)
 * 4. Merge `Player` rows from all feeds (`mergePlayers`)
 * 5. Upsert `players`, then `transactions`, `batting_stats`, `pitching_stats`
 * 6. Enforce portal retention: delete transactions before 2025-01-01, recompute profile-visible flags, remove players with none (cascades stats)
 *
 * **Usage:**
 * - CLI: `npm run sync` (tsx) or `npm run sync:ts-node` from `apps/api`
 * - Cron: same command with `DATABASE_URL` and `TBC_FEED_PASSWORD` in the environment
 *
 * **Module entry:** When this file is the process entry (CLI), runs the pipeline and exits.
 * Uses `argv`/`__filename` match because `require.main === module` is unreliable under `tsx`.
 */

import path from "node:path"

import { config } from "../config"
import { ApiSyncTBC } from "../services/ApiSyncTBC"
import { RawDataStorage } from "../services/RawDataStorage"
import { DataParser } from "../services/DataParser"
import { PlayerRepository } from "../repositories/PlayerRepository"
import { TransactionRepository } from "../repositories/TransactionRepository"
import { BattingStatsRepository } from "../repositories/BattingStatsRepository"
import { PitchingStatsRepository } from "../repositories/PitchingStatsRepository"
import { mergePlayers } from "./mergePlayers"

/** Counts returned after a successful run (HTTP + CLI logging). */
export type SyncPipelineResult = {
  players: number
  transactions: number
  batting: number
  pitching: number
}

/** Exported for tests, CLI, and `POST /sync`. */
export async function runSyncPipeline(): Promise<SyncPipelineResult> {
  const sync = new ApiSyncTBC(config.tbcFeedPassword)
  const raw = new RawDataStorage()
  const parser = new DataParser()
  const players = new PlayerRepository()
  const txs = new TransactionRepository()
  const batting = new BattingStatsRepository()
  const pitching = new PitchingStatsRepository()

  const [tranxRaw, batRaw, pitRaw] = await Promise.all([
    sync.fetchTransactions(),
    sync.fetchBattingStats(),
    sync.fetchPitchingStats(),
  ])

  await raw.storeTransactions(tranxRaw)
  await raw.storeBatting(batRaw)
  await raw.storePitching(pitRaw)

  const parsedTx = parser.parseTransactions(tranxRaw)
  const parsedBat = parser.parseBatting(batRaw)
  const parsedPit = parser.parsePitching(pitRaw)

  const playerList = mergePlayers([
    { players: parser.parsePlayersFromTransactionFeed(tranxRaw), positionAuthoritative: true },
    { players: parser.parsePlayersFromBattingFeed(batRaw), positionAuthoritative: false },
    { players: parser.parsePlayersFromPitchingFeed(pitRaw), positionAuthoritative: false },
  ])

  await players.upsertPlayers(playerList)
  await txs.upsertTransactions(parsedTx)
  // Recompute profile-visible flags for the players we just touched so newly-born rows
  // (default has_profile_visible_transaction=false) become discoverable within this run,
  // not only via the end-of-run retention pass. Repository chunks ids at 4000.
  await txs.refreshHasProfileVisibleTransactionForPlayerIds([
    ...new Set(parsedTx.map((t) => t.playerId)),
  ])
  await batting.upsertStats(parsedBat)
  await pitching.upsertStats(parsedPit)
  await txs.enforcePortalTransactionRetentionPolicy()

  const result: SyncPipelineResult = {
    players: playerList.length,
    transactions: parsedTx.length,
    batting: parsedBat.length,
    pitching: parsedPit.length,
  }

  // eslint-disable-next-line no-console
  console.log(
    `[syncPipeline] done: players=${result.players} transactions=${result.transactions} batting=${result.batting} pitching=${result.pitching}`,
  )

  return result
}

/** True when this file is the CLI entry (`tsx …/syncPipeline.ts` or `node …/syncPipeline.js`). */
function isSyncCliMain(): boolean {
  const thisFile = path.resolve(__filename)
  for (const arg of process.argv.slice(1)) {
    if (!arg || arg.startsWith("-")) continue
    try {
      if (path.resolve(arg) === thisFile) return true
    } catch {
      // ignore invalid paths
    }
  }
  return false
}

if (isSyncCliMain()) {
  runSyncPipeline()
    .then(() => process.exit(0))
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(err)
      process.exit(1)
    })
}
