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
}

/** API response for GET /players */
export interface PlayerSummary {
  id: string
  name: string
  position: string
  team: string
  status: string
  minimalStatLine: string
  mostRecentTeam: string
  imageUrl?: string | null
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
