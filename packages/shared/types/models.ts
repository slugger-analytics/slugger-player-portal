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
  avg: number
  obp: number
  slg: number
  ops: number
}

export interface PitchingStats {
  playerId: string
  season: number
  era: number
  whip: number
  ip: number
  k: number
}

export interface PlayerFilters {
  position?: string
  status?: string
  team?: string
  ageMin?: number
  ageMax?: number
  /**
   * **Exact** match on highest level only (`A_PLUS` → only A+, `MLB` → only MLB). No ranges.
   * Query: `experienceLevel`, `experience_level`, `highlevel`, or `highLevel`.
   */
  experienceLevel?: string
  /** When true, only players with at least one batting **or** pitching stat row. */
  hasStats?: boolean
  /** Max rows to return (1–100). When set, enables pagination with {@link offset}. */
  limit?: number
  /** Skip this many rows before returning `limit` results (default 0). Ignored if `limit` is unset. */
  offset?: number
  /** Discovery list ordering. Default `name`. */
  sortBy?: "name" | "experienceLevel"
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
  mostRecentBatting: BattingStats | null
  previousBatting: BattingStats | null
  mostRecentPitching: PitchingStats | null
  previousPitching: PitchingStats | null
  transactions: Transaction[]
}
