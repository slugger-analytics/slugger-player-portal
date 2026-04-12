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
 * **Note:** `listPlayerSummaries` loads stats per player (N+1 pattern); acceptable for
 * moderate lists; optimize with batched queries if profiles grow large.
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
    const list = await this.players.getPlayers(filters)
    const out: PlayerSummary[] = []
    for (const p of list) {
      out.push(await this.buildPlayerSummaryInternal(p))
    }
    return out
  }

  /** List + total row count for `GET /players` pagination (`limit` / `offset`). */
  async listPlayerSummariesWithTotal(filters: PlayerFilters): Promise<PlayerSummariesResponse> {
    const [total, list] = await Promise.all([
      this.players.countPlayers(filters),
      this.players.getPlayers(filters),
    ])
    const players: PlayerSummary[] = []
    for (const p of list) {
      players.push(await this.buildPlayerSummaryInternal(p))
    }
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
    const battingStats = await this.batting.getStatsByPlayer(p.id)
    const pitchingStats = await this.pitching.getStatsByPlayer(p.id)
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
    }
  }

  /**
   * Full detail: core `Player`, batting/pitching “most recent” + “previous” seasons,
   * and transaction history (same rows as `GET /players/:id/transactions`, embedded).
   */
  async buildPlayerProfile(playerId: string): Promise<PlayerProfile | null> {
    const player = await this.players.getPlayerById(playerId)
    if (!player) return null
    const battingStats = await this.batting.getStatsByPlayer(playerId)
    const pitchingStats = await this.pitching.getStatsByPlayer(playerId)
    const txs = await this.transactions.getTransactionsByPlayer(playerId)
    return {
      player,
      mostRecentBatting: this.statLine.selectMostRecentSeason(battingStats) as BattingStats | null,
      previousBatting: this.statLine.selectPreviousSeason(battingStats) as BattingStats | null,
      mostRecentPitching: this.statLine.selectMostRecentSeason(pitchingStats) as PitchingStats | null,
      previousPitching: this.statLine.selectPreviousSeason(pitchingStats) as PitchingStats | null,
      transactions: txs,
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
