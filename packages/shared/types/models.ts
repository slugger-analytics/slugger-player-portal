import type { BatHand, ThrowHand } from "./handedness"

/**
 * @file packages/shared/types/models.ts
 * @description **Canonical domain types** shared by the Express API and Next.js web app.
 *
 * **Purpose:** Single source of truth for `Player`, stat lines, and API response shapes
 * (`PlayerSummary`, `PlayerProfile`). Both workspaces import `@available-player-portal/shared`.
 *
 * **Usage:** API re-exports from `apps/api/src/types/models.ts`; UI imports from
 * `@available-player-portal/shared` or `@/lib/api` (typed fetch helpers).
 */

export type PlayerStatus = "available" | "signed" | "injured"

export interface Player {
  id: string
  name: string
  position: string
  team: string
  status: PlayerStatus | string
  age?: number | null
  /** Highest level reached; Prisma enum string e.g. `AAA`, `MLB`. */
  experienceLevel?: string | null
  /** From TBC feed: L / R / B (both). */
  bats?: BatHand | null
  /** From TBC feed: L / R. */
  throws?: ThrowHand | null
}

export interface Transaction {
  playerId: string
  date: string
  type: string
  description: string
}

export interface BattingStats {
  playerId: string
  season: number
  teamName?: string | null
  avg: number
  obp: number
  slg: number
  ops: number
  bb: number
  /** Home runs (TBC batting feed `hr` / `HR`). */
  hr: number
}

export interface PitchingStats {
  playerId: string
  season: number
  teamName?: string | null
  g: number
  era: number
  whip: number
  ip: number
  k: number
  bb: number
}

export type TransactionTypeFilter = "retired" | "released" | "freeAgent"

export interface RankingWeights {
  performance: number
  experience: number
  positionMatch: number
  availability: number
  recentTransactions: number
}

export interface RankingPreferences {
  weights: RankingWeights
  targetPosition?: string
}

export interface RankBreakdown {
  performance: number
  experience: number
  positionMatch: number
  availability: number
  recentTransactions: number
  lambda: number
}

export interface PlayerFilters {
  position?: string
  status?: string
  team?: string
  ageMin?: number
  ageMax?: number
  /**
   * Highest experience level **at or below** this value (inclusive).
   * Back-compat query keys: `experienceLevel`, `experience_level`, `highlevel`, `highLevel`.
   */
  experienceLevel?: string
  /**
   * Highest experience level **at or above** this value (inclusive).
   * Query: `experienceLevelMin`, `experience_level_min`, `minExperienceLevel`, `min_level`, `minlevel`.
   */
  experienceLevelMin?: string
  /** When true, only players with at least one batting **or** pitching stat row. */
  hasStats?: boolean
  /** Max rows to return (1–100). When set, enables pagination with {@link offset}. */
  limit?: number
  /** Skip this many rows before returning `limit` results (default 0). Ignored if `limit` is unset. */
  offset?: number
  /**
   * Discovery list ordering. Default `name`.
   * `recentProfileTransaction` = newest profile-visible transaction date first (then name); requires
   * API support that joins transaction data. Omit `lastTransactionDays` when using this sort.
   */
  sortBy?: "name" | "lastName" | "experienceLevel" | "recentProfileTransaction" | "rankScore"
  /**
   * `asc` | `desc`. When omitted: `asc` for name, `desc` for experience level (MLB first).
   */
  sortDir?: "asc" | "desc"
  /**
   * Rolling window from now: only players with at least one transaction whose `date` falls in
   * `[now − N days, now]`. List order is by most recent transaction first (then name).
   * Allowed values: {@link LAST_TRANSACTION_DAYS_OPTIONS}.
   */
  lastTransactionDays?: number
  /** Optional profile-visible transaction type filter used by discovery sorting/filtering. */
  transactionTypes?: TransactionTypeFilter[]
  /** Exact match on {@link Player.bats} (L, R, B). Query: `bats`. */
  bats?: BatHand
  /** Exact match on {@link Player.throws} (L, R). Query: `throws`. */
  throws?: ThrowHand
  rankingPreferences?: RankingPreferences
}

/** Allowed “Last X days” preference values (transaction recency window). */
export const LAST_TRANSACTION_DAYS_OPTIONS = [7, 14, 21, 30, 45, 60] as const

export type LastTransactionDaysOption = (typeof LAST_TRANSACTION_DAYS_OPTIONS)[number]

export function isLastTransactionDaysOption(n: number): n is LastTransactionDaysOption {
  return (LAST_TRANSACTION_DAYS_OPTIONS as readonly number[]).includes(n)
}

/** API response for GET /players */
export interface PlayerSummary {
  id: string
  name: string
  position: string
  team: string
  status: string
  /** Highest level reached (`ExperienceLevel` enum code); optional when unknown. */
  experienceLevel?: string | null
  minimalStatLine: string
  mostRecentTeam: string
  imageUrl?: string | null
  /** Latest calendar date among profile-visible transactions (retired / released / FA); null if none. */
  mostRecentTransactionDate?: string | null
  rankScore?: number | null
  /** 1-based position when ordering by rank score (best = 1) among the current filter set. */
  rankOrdinal?: number | null
  rankBreakdown?: RankBreakdown | null
}

/** API response for `GET /players` (paginated list + total matching filters). */
export interface PlayerSummariesResponse {
  players: PlayerSummary[]
  /** Row count matching the same filters as `players`, ignoring `limit` / `offset`. */
  total: number
}

/** API response for GET /players/:id */
export interface PlayerProfile {
  player: Player
  /** All rows from the most recent batting season (can include multiple teams). */
  mostRecentBattingRows?: BattingStats[]
  mostRecentBatting: BattingStats | null
  previousBatting: BattingStats | null
  /** All rows from the most recent pitching season (can include multiple teams). */
  mostRecentPitchingRows?: PitchingStats[]
  mostRecentPitching: PitchingStats | null
  previousPitching: PitchingStats | null
  transactions: Transaction[]
  /** Same semantics as {@link PlayerSummary.mostRecentTransactionDate} (profile-visible types only). */
  mostRecentTransactionDate?: string | null
}
