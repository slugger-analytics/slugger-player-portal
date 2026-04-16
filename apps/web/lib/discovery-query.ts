import { filtersToQuery, type UiFilter } from "@/components/discovery/DiscoveryFilterTypes"
import type { PlayerSearchProfile } from "@/lib/player-profiles"

/** Builds `GET /players` query params from filters + optional stats-available flag. */
export function buildPlayerListParams(
  filters: UiFilter[],
  onlyWithStats: boolean,
): Record<string, string | number | boolean | undefined> {
  const q: Record<string, string | number | boolean | undefined> = {
    ...filtersToQuery(filters),
  }
  if (onlyWithStats) q.hasStats = true
  return q
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
): Record<string, string | number | boolean | undefined> {
  if (searchMode === "profile") {
    const p = profiles.find((x) => x.id === selectedProfileId)
    if (!p) return buildPlayerListParams([], false)
    return buildPlayerListParams(p.filters, p.onlyWithStats)
  }
  return buildPlayerListParams(customFilters, customOnlyWithStats)
}

export function profileSummaryLine(filters: UiFilter[], onlyWithStats: boolean): string {
  const parts: string[] = []
  if (filters.length) parts.push(`${filters.length} filter${filters.length === 1 ? "" : "s"}`)
  if (onlyWithStats) parts.push("stats required")
  return parts.length ? parts.join(" · ") : "No filters (all players)"
}
