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
import { mergeExperienceLevels } from "@available-player-portal/shared"

import type { Player } from "../types/models"

function mergePlayers(lists: Player[][]): Player[] {
  const map = new Map<string, Player>()
  for (const list of lists) {
    for (const p of list) {
      const prev = map.get(p.id)
      if (!prev) {
        map.set(p.id, { ...p })
        continue
      }
      const merged: Player = {
        ...prev,
        ...p,
        name: p.name && p.name !== "Unknown" ? p.name : prev.name,
        team: p.team && p.team !== "—" ? p.team : prev.team,
        position: p.position && p.position !== "—" ? p.position : prev.position,
        status: p.status !== "available" ? p.status : prev.status,
        age: p.age ?? prev.age,
        experienceLevel: mergeExperienceLevels(prev.experienceLevel, p.experienceLevel),
      }
      map.set(p.id, merged)
    }
  }
  return [...map.values()]
}

/** Counts returned after a successful run (HTTP + CLI logging). */
export type SyncPipelineResult = {
  syncRunKey: string
  players: number
  transactions: number
  batting: number
  pitching: number
  changedPlayerIds: string[]
}

export type SyncPipelineRawFeeds = {
  transactionsRaw: string
  battingRaw: string
  pitchingRaw: string
}

async function processRawFeeds(rawFeeds: SyncPipelineRawFeeds): Promise<SyncPipelineResult> {
  const syncStartedAt = new Date()
  const syncRunKey = syncStartedAt.toISOString()
  const raw = new RawDataStorage()
  const parser = new DataParser()
  const players = new PlayerRepository()
  const txs = new TransactionRepository()
  const batting = new BattingStatsRepository()
  const pitching = new PitchingStatsRepository()

  const tranxRaw = rawFeeds.transactionsRaw
  const batRaw = rawFeeds.battingRaw
  const pitRaw = rawFeeds.pitchingRaw

  await raw.storeTransactions(tranxRaw)
  await raw.storeBatting(batRaw)
  await raw.storePitching(pitRaw)

  const parsedTx = parser.parseTransactions(tranxRaw)
  const parsedBat = parser.parseBatting(batRaw)
  const parsedPit = parser.parsePitching(pitRaw)

  const playerList = mergePlayers([
    parser.parsePlayersFromTransactionFeed(tranxRaw),
    parser.parsePlayersFromBattingFeed(batRaw),
    parser.parsePlayersFromPitchingFeed(pitRaw),
  ])

  const eligibleIds = new Set(playerList.map((p) => p.id))
  const filteredTx = parsedTx.filter((t) => eligibleIds.has(t.playerId))
  const filteredBat = parsedBat.filter((b) => eligibleIds.has(b.playerId))
  const filteredPit = parsedPit.filter((p) => eligibleIds.has(p.playerId))

  await players.upsertPlayers(playerList)
  await txs.upsertTransactions(filteredTx)
  await batting.upsertStats(filteredBat)
  await pitching.upsertStats(filteredPit)
  await txs.enforcePortalTransactionRetentionPolicy()
  const changedPlayerIds = await txs.getPlayerIdsWithNewTransactionsSince(syncStartedAt)

  const result: SyncPipelineResult = {
    syncRunKey,
    players: playerList.length,
    transactions: filteredTx.length,
    batting: filteredBat.length,
    pitching: filteredPit.length,
    changedPlayerIds,
  }

  // eslint-disable-next-line no-console
  console.log(
    `[syncPipeline] done: players=${result.players} transactions=${result.transactions} batting=${result.batting} pitching=${result.pitching}`,
  )

  return result
}

/** Exported for tests, CLI, and `POST /sync`. */
export async function runSyncPipeline(): Promise<SyncPipelineResult> {
  const sync = new ApiSyncTBC(config.tbcFeedPassword, {
    proxyUrl: config.tbcHttpsProxyUrl || undefined,
  })
  const [transactionsRaw, battingRaw, pitchingRaw] = await Promise.all([
    sync.fetchTransactions(),
    sync.fetchBattingStats(),
    sync.fetchPitchingStats(),
  ])
  return processRawFeeds({ transactionsRaw, battingRaw, pitchingRaw })
}

/**
 * Temporary fallback path: run the same production sync processing on raw feed
 * payloads fetched externally (e.g., from a non-blocked local machine).
 */
export async function runSyncPipelineFromRaw(rawFeeds: SyncPipelineRawFeeds): Promise<SyncPipelineResult> {
  return processRawFeeds(rawFeeds)
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
