import { filtersToQuery, type UiFilter } from "@/components/discovery/DiscoveryFilterTypes"
import type { PlayerSearchProfile } from "@/lib/player-profiles"
import type { RankingPreferences } from "@available-player-portal/shared"

/** Builds `GET /players` query params from filters + optional stats-available flag. */
export type DiscoverySortOption = "newestTransaction" | "lastName" | "transactionType" | "ranking"
export type DiscoveryTransactionType = "retired" | "released" | "freeAgent"

function applyRankingPreferences(
  q: Record<string, string | number | boolean | undefined>,
  ranking?: RankingPreferences,
): void {
  if (!ranking) return
  q.rankWPerf = ranking.weights.performance
  q.rankWExp = ranking.weights.experience
  q.rankWPos = ranking.weights.positionMatch
  q.rankWAvail = ranking.weights.availability
  q.rankWTx = ranking.weights.recentTransactions
  if (ranking.targetPosition?.trim()) q.rankTargetPosition = ranking.targetPosition.trim()
}

function applyDiscoverySort(
  q: Record<string, string | number | boolean | undefined>,
  sort: DiscoverySortOption,
  transactionTypes: DiscoveryTransactionType[],
  ranking?: RankingPreferences,
): Record<string, string | number | boolean | undefined> {
  // When the profile (or custom search) has ranking weights, send them on every sort so the API can attach rank score + ordinal beside other orderings.
  applyRankingPreferences(q, ranking)
  if (sort === "newestTransaction") {
    q.sortBy = "recentProfileTransaction"
    q.sortDir = "desc"
  } else if (sort === "lastName") {
    q.sortBy = "lastName"
    q.sortDir = "asc"
  } else if (sort === "transactionType") {
    q.sortBy = "recentProfileTransaction"
    q.sortDir = "desc"
    q.transactionTypes = transactionTypes.join(",")
  } else if (sort === "ranking") {
    q.sortBy = "rankScore"
    q.sortDir = "desc"
  }
  return q
}

export function buildPlayerListParams(
  filters: UiFilter[],
  onlyWithStats: boolean,
  sort: DiscoverySortOption = "newestTransaction",
  transactionTypes: DiscoveryTransactionType[] = [],
  ranking?: RankingPreferences,
  nameSearch = "",
): Record<string, string | number | boolean | undefined> {
  const q: Record<string, string | number | boolean | undefined> = {
    ...filtersToQuery(filters),
  }
  if (onlyWithStats) q.hasStats = true
  const nameTrim = nameSearch.trim()
  if (nameTrim) q.nameSearch = nameTrim.slice(0, 200)
  return applyDiscoverySort(q, sort, transactionTypes, ranking)
}

export type DiscoverySearchMode = "custom" | "profile"

/**
 * Params for the discovery grid: custom filters on the home page, or a saved profile’s filters.
 */
export function buildDiscoveryListParams(
  searchMode: DiscoverySearchMode,
  profiles: PlayerSearchProfile[],
  selectedProfileId: string,
  customFilters: UiFilter[],
  customOnlyWithStats: boolean,
  sort: DiscoverySortOption = "newestTransaction",
  transactionTypes: DiscoveryTransactionType[] = [],
  customRankingPreferences?: RankingPreferences,
  nameSearch = "",
): Record<string, string | number | boolean | undefined> {
  if (searchMode === "profile") {
    const p = profiles.find((x) => x.id === selectedProfileId)
    if (!p) return buildPlayerListParams([], false, sort, transactionTypes, undefined, nameSearch)
    return buildPlayerListParams(p.filters, p.onlyWithStats, sort, transactionTypes, p.rankingPreferences, nameSearch)
  }
  return buildPlayerListParams(
    customFilters,
    customOnlyWithStats,
    sort,
    transactionTypes,
    customRankingPreferences,
    nameSearch,
  )
}

export function profileSummaryLine(filters: UiFilter[], onlyWithStats: boolean): string {
  const parts: string[] = []
  if (filters.length) parts.push(`${filters.length} filter${filters.length === 1 ? "" : "s"}`)
  if (onlyWithStats) parts.push("stats required")
  return parts.length ? parts.join(" · ") : "No filters (all players)"
}
