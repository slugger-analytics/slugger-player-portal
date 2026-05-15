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
import { computeRankScores, type RankingPreferences } from "@available-player-portal/shared"
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
    if (filters.sortBy === "rankScore") {
      return this.listPlayerSummariesByRanking(filters)
    }
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
    if (list.length === 0) return { players: [], total }
    const ids = list.map((p) => p.id)
    const recentTxById = await this.transactions.getMostRecentProfileTransactionsByPlayerIds(ids, filters.transactionTypes)
    const players: PlayerSummary[] = []
    for (const p of list) {
      const base = await this.buildPlayerSummaryStatsOnly(p)
      const tx = recentTxById.get(p.id)
      players.push({
        ...base,
        mostRecentTransactionDate: tx?.date ?? null,
        mostRecentTransactionType: tx?.type ?? null,
      })
    }
    return { players, total }
  }

  private defaultRankingPreferences(): RankingPreferences {
    return {
      weights: {
        performance: 0.3,
        experience: 0.2,
        positionMatch: 0.15,
        availability: 0.15,
        recentTransactions: 0.2,
      },
      targetPosition: undefined,
    }
  }

  private isPitcherPosition(position: string): boolean {
    const pos = position.trim().toLowerCase()
    return pos === "p" || pos.startsWith("p-") || pos.includes("pitch")
  }

  private currentTeamFromStats(
    fallbackTeam: string,
    battingStats: BattingStats[],
    pitchingStats: PitchingStats[],
    position: string,
  ): string {
    const preferred = pickStatArrayForLine(battingStats, pitchingStats, position)
    const team = [...preferred, ...battingStats, ...pitchingStats].find((row) => (row.teamName ?? "").trim().length > 0)?.teamName
    return team?.trim() || fallbackTeam
  }

  /**
   * Full-filter ranking order (1 = highest score) for a player list, for attaching score + ordinal
   * when the client sends {@link PlayerFilters.rankingPreferences}.
   */
  private async getRankingMetaByPlayerId(
    list: Player[],
    filters: PlayerFilters,
  ): Promise<
    Map<
      string,
      {
        rankScore: number | null
        rankBreakdown: NonNullable<PlayerSummary["rankBreakdown"]> | null
        rankOrdinal: number
      }
    >
  > {
    const out = new Map<
      string,
      {
        rankScore: number | null
        rankBreakdown: NonNullable<PlayerSummary["rankBreakdown"]> | null
        rankOrdinal: number
      }
    >()
    if (list.length === 0) return out
    const ids = list.map((p) => p.id)
    const [battingById, pitchingById, txById] = await Promise.all([
      this.batting.getStatsByPlayerIds(ids),
      this.pitching.getStatsByPlayerIds(ids),
      this.transactions.getMostRecentProfileTransactionsByPlayerIds(ids, filters.transactionTypes),
    ])
    const rankingInput = list.map((p) => {
      const batting = battingById.get(p.id) ?? []
      const pitching = pitchingById.get(p.id) ?? []
      const recentTx = txById.get(p.id)
      const isPitcher = this.isPitcherPosition(p.position ?? "")
      const mostRecentBatting = batting[0]
      const mostRecentPitching = pitching[0]
      return {
        id: p.id,
        position: p.position,
        status: p.status,
        experienceLevel: p.experienceLevel,
        isPitcher,
        ops: mostRecentBatting?.ops,
        obp: mostRecentBatting?.obp,
        slg: mostRecentBatting?.slg,
        era: mostRecentPitching?.era,
        whip: mostRecentPitching?.whip,
        k: mostRecentPitching?.k,
        ip: mostRecentPitching?.ip,
        transactionDate: recentTx?.date ?? null,
        transactionType: recentTx?.type ?? null,
      }
    })
    const rankingPreferences: RankingPreferences = {
      ...(filters.rankingPreferences ?? this.defaultRankingPreferences()),
    }
    if (!rankingPreferences.targetPosition?.trim() && filters.position?.trim()) {
      rankingPreferences.targetPosition = filters.position
    }
    const scores = computeRankScores({
      players: rankingInput,
      weights: rankingPreferences.weights,
      targetPosition: rankingPreferences.targetPosition,
    })
    const rows = list.map((p) => {
      const score = scores.get(p.id)
      return {
        id: p.id,
        name: p.name,
        rankScore: score?.score ?? null,
        rankBreakdown: score ? { ...score.components } : null,
      }
    })
    rows.sort((a, b) => {
      const as = a.rankScore ?? -1
      const bs = b.rankScore ?? -1
      if (as !== bs) return bs - as
      const aLast = a.name.trim().split(/\s+/).at(-1)?.toLowerCase() ?? ""
      const bLast = b.name.trim().split(/\s+/).at(-1)?.toLowerCase() ?? ""
      if (aLast !== bLast) return aLast.localeCompare(bLast)
      return a.name.localeCompare(b.name)
    })
    rows.forEach((r, i) => {
      out.set(r.id, {
        rankScore: r.rankScore,
        rankBreakdown: r.rankBreakdown,
        rankOrdinal: i + 1,
      })
    })
    return out
  }

  private async listPlayerSummariesByRanking(filters: PlayerFilters): Promise<PlayerSummariesResponse> {
    const candidates = await this.players.listPlayerIdAndNameMatching(filters)
    if (candidates.length === 0) return { players: [], total: 0 }
    const ids = candidates.map((c) => c.id)
    const list = await this.players.getPlayersByIdsInOrder(ids)
    if (list.length === 0) return { players: [], total: 0 }

    const [battingById, pitchingById, txById] = await Promise.all([
      this.batting.getStatsByPlayerIds(ids),
      this.pitching.getStatsByPlayerIds(ids),
      this.transactions.getMostRecentProfileTransactionsByPlayerIds(ids, filters.transactionTypes),
    ])
    const players: PlayerSummary[] = []
    const rankingInput = list.map((p) => {
      const batting = battingById.get(p.id) ?? []
      const pitching = pitchingById.get(p.id) ?? []
      const recentTx = txById.get(p.id)
      const arr = pickStatArrayForLine(batting, pitching, p.position)
      const currentTeam = this.currentTeamFromStats(p.team, batting, pitching, p.position)
      players.push({
        id: p.id,
        name: p.name,
        position: p.position,
        team: currentTeam,
        status: p.status,
        experienceLevel: p.experienceLevel ?? null,
        minimalStatLine: this.statLine.generateMinimalStatLine(arr),
        mostRecentTeam: currentTeam,
        imageUrl: null,
        mostRecentTransactionDate: recentTx?.date ?? null,
        mostRecentTransactionType: recentTx?.type ?? null,
      })
      const isPitcher = this.isPitcherPosition(p.position ?? "")
      const mostRecentBatting = batting[0]
      const mostRecentPitching = pitching[0]
      return {
        id: p.id,
        position: p.position,
        status: p.status,
        experienceLevel: p.experienceLevel,
        isPitcher,
        ops: mostRecentBatting?.ops,
        obp: mostRecentBatting?.obp,
        slg: mostRecentBatting?.slg,
        era: mostRecentPitching?.era,
        whip: mostRecentPitching?.whip,
        k: mostRecentPitching?.k,
        ip: mostRecentPitching?.ip,
        transactionDate: recentTx?.date ?? null,
        transactionType: recentTx?.type ?? null,
      }
    })
    const rankingPreferences = filters.rankingPreferences ?? this.defaultRankingPreferences()
    if (!rankingPreferences.targetPosition?.trim() && filters.position?.trim()) {
      rankingPreferences.targetPosition = filters.position
    }
    const scores = computeRankScores({
      players: rankingInput,
      weights: rankingPreferences.weights,
      targetPosition: rankingPreferences.targetPosition,
    })
    for (const s of players) {
      const score = scores.get(s.id)
      s.rankScore = score?.score ?? null
      s.rankBreakdown = score ? { ...score.components } : null
    }
    const sorted = [...players].sort((a, b) => {
      const as = a.rankScore ?? -1
      const bs = b.rankScore ?? -1
      if (as !== bs) return bs - as
      const aLast = a.name.trim().split(/\s+/).at(-1)?.toLowerCase() ?? ""
      const bLast = b.name.trim().split(/\s+/).at(-1)?.toLowerCase() ?? ""
      if (aLast !== bLast) return aLast.localeCompare(bLast)
      return a.name.localeCompare(b.name)
    })
    sorted.forEach((s, i) => {
      s.rankOrdinal = i + 1
    })
    const total = sorted.length
    const offset = filters.offset ?? 0
    const limit = filters.limit != null ? filters.limit : sorted.length
    return { players: sorted.slice(offset, offset + limit), total }
  }

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
    if (list.length === 0) return { players: [], total }
    const rankingMeta =
      filters.rankingPreferences != null
        ? await this.getRankingMetaByPlayerId(
            await this.players.getPlayersByIdsInOrder(filtered.map((c) => c.id)),
            filters,
          )
        : undefined
    const recentTxById = await this.transactions.getMostRecentProfileTransactionsByPlayerIds(
      list.map((p) => p.id),
      filters.transactionTypes,
    )
    const players: PlayerSummary[] = []
    for (const p of list) {
      const base = await this.buildPlayerSummaryStatsOnly(p)
      const tx = recentTxById.get(p.id)
      const row: PlayerSummary = {
        ...base,
        mostRecentTransactionDate: tx?.date ?? null,
        mostRecentTransactionType: tx?.type ?? null,
      }
      const meta = rankingMeta?.get(p.id)
      if (meta) {
        row.rankScore = meta.rankScore
        row.rankBreakdown = meta.rankBreakdown
        row.rankOrdinal = meta.rankOrdinal
      }
      players.push(row)
    }
    return { players, total }
  }

  /** Single-player variant of {@link listPlayerSummaries} (404 path handled by route). */
  async buildPlayerSummary(playerId: string): Promise<PlayerSummary | null> {
    const p = await this.players.getPlayerById(playerId)
    if (!p) return null
    return this.buildPlayerSummaryInternal(p)
  }

  /** Stat line only; list callers merge {@link PlayerSummary.mostRecentTransactionDate} from a batch query. */
  private async buildPlayerSummaryStatsOnly(
    p: Player,
  ): Promise<Omit<PlayerSummary, "mostRecentTransactionDate">> {
    const battingStats = await this.batting.getStatsByPlayer(p.id)
    const pitchingStats = await this.pitching.getStatsByPlayer(p.id)
    const arr = pickStatArrayForLine(battingStats, pitchingStats, p.position)
    const minimalStatLine = this.statLine.generateMinimalStatLine(arr)
    const currentTeam = this.currentTeamFromStats(p.team, battingStats, pitchingStats, p.position)
    return {
      id: p.id,
      name: p.name,
      position: p.position,
      team: currentTeam,
      status: p.status,
      experienceLevel: p.experienceLevel ?? null,
      minimalStatLine,
      mostRecentTeam: currentTeam,
      imageUrl: null,
    }
  }

  /** Shared implementation for list and single summary (avoids double-fetching by id). */
  private async buildPlayerSummaryInternal(p: Player): Promise<PlayerSummary> {
    const [base, recentTxById] = await Promise.all([
      this.buildPlayerSummaryStatsOnly(p),
      this.transactions.getMostRecentProfileTransactionsByPlayerIds([p.id]),
    ])
    const tx = recentTxById.get(p.id)
    return {
      ...base,
      mostRecentTransactionDate: tx?.date ?? null,
      mostRecentTransactionType: tx?.type ?? null,
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
