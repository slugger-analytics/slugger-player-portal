/**
 * @file PlayerDataService.ts
 * @description **Orchestration layer** for player-facing API payloads.
 *
 * **Purpose:** This is the **only** place that joins multiple repositories to build
 * composite responses (`PlayerSummary`, `PlayerProfile`). Individual repositories stay
 * single-table; routes should not stitch data themselves.
 *
 * **Usage:**
 * - `listPlayerSummaries` / `buildPlayerSummary` → `GET /players` list + card data
 * - `buildPlayerProfile` → `GET /players/:id` (stats + embedded transaction list)
 * - `attachTransactions` / `attachStats` → optional helpers if you extend internal APIs
 *
 * **Note:** List endpoints batch-load batting/pitching by player id (two queries per list).
 */

import type {
  BattingStats,
  Player,
  PlayerFilters,
  PlayerProfile,
  PlayerSummariesResponse,
  PlayerSummary,
  PitchingStats,
  Transaction,
} from "../types/models"
import { BattingStatsRepository } from "../repositories/BattingStatsRepository"
import { PitchingStatsRepository } from "../repositories/PitchingStatsRepository"
import { PlayerRepository } from "../repositories/PlayerRepository"
import { TransactionRepository } from "../repositories/TransactionRepository"
import { pickStatArrayForLine, StatLineService } from "./StatLineService"

/**
 * Facade over `PlayerRepository`, `TransactionRepository`, and stats repositories.
 * Default constructor wires concrete repos; inject mocks in unit tests if needed.
 */
export class PlayerDataService {
  constructor(
    private readonly players = new PlayerRepository(),
    private readonly transactions = new TransactionRepository(),
    private readonly batting = new BattingStatsRepository(),
    private readonly pitching = new PitchingStatsRepository(),
    private readonly statLine = new StatLineService(),
  ) {}

  /** Applies DB filters, then enriches each row with a minimal stat line for the UI. */
  async listPlayerSummaries(filters: PlayerFilters): Promise<PlayerSummary[]> {
    const { players } = await this.listPlayerSummariesWithTotal(filters)
    return players
  }

  /** List + total row count for `GET /players` pagination (`limit` / `offset`). */
  async listPlayerSummariesWithTotal(filters: PlayerFilters): Promise<PlayerSummariesResponse> {
    if (
      (filters.sortBy === "recentProfileTransaction" && filters.lastTransactionDays == null) ||
      filters.sortBy === "lastName"
    ) {
      return this.listPlayerSummariesWithCustomOrdering(filters)
    }
    const [total, list] = await Promise.all([
      this.players.countPlayers(filters),
      this.players.getPlayers(filters),
    ])
    const players = await this.buildPlayerSummariesBatch(list)
    return { players, total }
  }

  /**
   * All matching players sorted by newest profile-visible transaction date (desc), then name;
   * players with no such transactions last. Then applies `offset` / `limit`.
   */
  private async listPlayerSummariesWithCustomOrdering(filters: PlayerFilters): Promise<PlayerSummariesResponse> {
    const candidates = await this.players.listPlayerIdAndNameMatching(filters)
    if (candidates.length === 0) return { players: [], total: 0 }
    const ids = candidates.map((c) => c.id)
    const txMap = await this.transactions.getMaxTransactionDatesByPlayerIds(ids, filters.transactionTypes)
    const sorted =
      filters.sortBy === "lastName"
        ? [...candidates].sort((a, b) => {
            const aLast = a.name.trim().split(/\s+/).at(-1)?.toLowerCase() ?? ""
            const bLast = b.name.trim().split(/\s+/).at(-1)?.toLowerCase() ?? ""
            if (aLast !== bLast) return aLast.localeCompare(bLast)
            return a.name.localeCompare(b.name)
          })
        : [...candidates].sort((a, b) => {
            const da = txMap.get(a.id)
            const db = txMap.get(b.id)
            const aHas = da != null
            const bHas = db != null
            if (aHas && bHas && da !== db) return db!.localeCompare(da!)
            if (aHas && !bHas) return -1
            if (!aHas && bHas) return 1
            const aLast = a.name.trim().split(/\s+/).at(-1)?.toLowerCase() ?? ""
            const bLast = b.name.trim().split(/\s+/).at(-1)?.toLowerCase() ?? ""
            if (aLast !== bLast) return aLast.localeCompare(bLast)
            return a.name.localeCompare(b.name)
          })
    const filtered =
      filters.sortBy === "recentProfileTransaction" && (filters.transactionTypes?.length ?? 0) > 0
        ? sorted.filter((c) => txMap.has(c.id))
        : sorted
    const total = filtered.length
    const offset = filters.offset ?? 0
    const limit = filters.limit != null ? filters.limit : filtered.length
    const slice = filtered.slice(offset, offset + limit)
    const list = await this.players.getPlayersByIdsInOrder(slice.map((s) => s.id))
    const players = await this.buildPlayerSummariesBatch(list)
    return { players, total }
  }

  /** Single-player variant of {@link listPlayerSummaries} (404 path handled by route). */
  async buildPlayerSummary(playerId: string): Promise<PlayerSummary | null> {
    const p = await this.players.getPlayerById(playerId)
    if (!p) return null
    return this.buildPlayerSummaryInternal(p)
  }

  /** Shared implementation for list and single summary (avoids double-fetching by id). */
  private async buildPlayerSummaryInternal(p: Player): Promise<PlayerSummary> {
    const [battingStats, pitchingStats, txMaxById] = await Promise.all([
      this.batting.getStatsByPlayer(p.id),
      this.pitching.getStatsByPlayer(p.id),
      this.transactions.getMaxTransactionDatesByPlayerIds([p.id]),
    ])
    return this.playerSummaryFromStats(
      p,
      battingStats,
      pitchingStats,
      txMaxById.get(p.id) ?? null,
    )
  }

  private async buildPlayerSummariesBatch(list: Player[]): Promise<PlayerSummary[]> {
    if (list.length === 0) return []
    const ids = list.map((p) => p.id)
    const [battingById, pitchingById, txMaxById] = await Promise.all([
      this.batting.getStatsByPlayerIds(ids),
      this.pitching.getStatsByPlayerIds(ids),
      this.transactions.getMaxTransactionDatesByPlayerIds(ids),
    ])
    return list.map((p) =>
      this.playerSummaryFromStats(
        p,
        battingById.get(p.id) ?? [],
        pitchingById.get(p.id) ?? [],
        txMaxById.get(p.id) ?? null,
      ),
    )
  }

  private playerSummaryFromStats(
    p: Player,
    battingStats: BattingStats[],
    pitchingStats: PitchingStats[],
    mostRecentTransactionDate: string | null,
  ): PlayerSummary {
    const arr = pickStatArrayForLine(battingStats, pitchingStats, p.position)
    const minimalStatLine = this.statLine.generateMinimalStatLine(arr)
    return {
      id: p.id,
      name: p.name,
      position: p.position,
      team: p.team,
      status: p.status,
      experienceLevel: p.experienceLevel ?? null,
      minimalStatLine,
      mostRecentTeam: p.team,
      imageUrl: null,
      mostRecentTransactionDate,
    }
  }

  /**
   * Full detail: core `Player`, batting/pitching “most recent” + “previous” seasons,
   * and transaction history (same rows as `GET /players/:id/transactions`, embedded).
   */
  async buildPlayerProfile(playerId: string): Promise<PlayerProfile | null> {
    const player = await this.players.getPlayerById(playerId)
    if (!player) return null
    const [battingStats, pitchingStats, txs, txMaxById] = await Promise.all([
      this.batting.getStatsByPlayer(playerId),
      this.pitching.getStatsByPlayer(playerId),
      this.transactions.getTransactionsByPlayer(playerId),
      this.transactions.getMaxTransactionDatesByPlayerIds([playerId]),
    ])
    return {
      player,
      mostRecentBattingRows: this.statLine.selectMostRecentSeasonRows(battingStats) as BattingStats[],
      mostRecentBatting: this.statLine.selectMostRecentSeason(battingStats) as BattingStats | null,
      previousBatting: this.statLine.selectPreviousSeason(battingStats) as BattingStats | null,
      mostRecentPitchingRows: this.statLine.selectMostRecentSeasonRows(pitchingStats) as PitchingStats[],
      mostRecentPitching: this.statLine.selectMostRecentSeason(pitchingStats) as PitchingStats | null,
      previousPitching: this.statLine.selectPreviousSeason(pitchingStats) as PitchingStats | null,
      transactions: txs,
      mostRecentTransactionDate: txMaxById.get(playerId) ?? null,
    }
  }

  /** Convenience: load transactions for an in-memory `Player` (internal/extension use). */
  async attachTransactions(player: Player): Promise<Player & { transactions: Transaction[] }> {
    const transactions = await this.transactions.getTransactionsByPlayer(player.id)
    return { ...player, transactions }
  }

  /** Convenience: attach raw stat arrays for tooling (not exposed as a public route). */
  async attachStats(
    player: Player,
  ): Promise<Player & { battingStats?: BattingStats[]; pitchingStats?: PitchingStats[] }> {
    const battingStats = await this.batting.getStatsByPlayer(player.id)
    const pitchingStats = await this.pitching.getStatsByPlayer(player.id)
    return { ...player, battingStats, pitchingStats }
  }
}
