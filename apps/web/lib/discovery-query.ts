import { filtersToQuery, type UiFilter } from "@/components/discovery/DiscoveryFilterTypes"
import type { PlayerSearchProfile } from "@/lib/player-profiles"

/** Builds `GET /players` query params from filters + optional stats-available flag. */
export type DiscoverySortOption = "newestTransaction" | "lastName" | "transactionType"
export type DiscoveryTransactionType = "retired" | "released" | "freeAgent"

function applyDiscoverySort(
  q: Record<string, string | number | boolean | undefined>,
  sort: DiscoverySortOption,
  transactionTypes: DiscoveryTransactionType[],
): Record<string, string | number | boolean | undefined> {
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
  }
  return q
}

export function buildPlayerListParams(
  filters: UiFilter[],
  onlyWithStats: boolean,
  sort: DiscoverySortOption = "newestTransaction",
  transactionTypes: DiscoveryTransactionType[] = [],
): Record<string, string | number | boolean | undefined> {
  const q: Record<string, string | number | boolean | undefined> = {
    ...filtersToQuery(filters),
  }
  if (onlyWithStats) q.hasStats = true
  return applyDiscoverySort(q, sort, transactionTypes)
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
): Record<string, string | number | boolean | undefined> {
  if (searchMode === "profile") {
    const p = profiles.find((x) => x.id === selectedProfileId)
    if (!p) return buildPlayerListParams([], false, sort, transactionTypes)
    return buildPlayerListParams(p.filters, p.onlyWithStats, sort, transactionTypes)
  }
  return buildPlayerListParams(customFilters, customOnlyWithStats, sort, transactionTypes)
}

export function profileSummaryLine(filters: UiFilter[], onlyWithStats: boolean): string {
  const parts: string[] = []
  if (filters.length) parts.push(`${filters.length} filter${filters.length === 1 ? "" : "s"}`)
  if (onlyWithStats) parts.push("stats required")
  return parts.length ? parts.join(" · ") : "No filters (all players)"
}
