import { filtersToQuery, type UiFilter } from "@/components/discovery/DiscoveryFilterTypes"

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

export function profileSummaryLine(filters: UiFilter[], onlyWithStats: boolean): string {
  const parts: string[] = []
  if (filters.length) parts.push(`${filters.length} filter${filters.length === 1 ? "" : "s"}`)
  if (onlyWithStats) parts.push("stats required")
  return parts.length ? parts.join(" · ") : "No filters (all players)"
}
