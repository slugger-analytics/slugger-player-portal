/**
 * Persists discovery UI state only for the flow: Home → player profile → Back to Home.
 * Cleared when visiting Favorites, History, Updates, Preferences, etc., so those navigations
 * do not restore a previous custom/saved-profile search.
 */

import type { UiFilter } from "@/components/discovery/DiscoveryFilterTypes"
import type { DiscoverySortOption, DiscoveryTransactionType } from "@/lib/discovery-query"

const SNAPSHOT_KEY = "portal-discovery-return-snapshot"

export type DiscoverySnapshot = {
  searchMode: "custom" | "profile"
  customFilters: UiFilter[]
  customOnlyWithStats: boolean
  selectedProfileId: string
  sort: DiscoverySortOption
  transactionTypes: DiscoveryTransactionType[]
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v)
}

function isUiFilter(v: unknown): v is UiFilter {
  if (!isRecord(v)) return false
  return typeof v.id === "string" && typeof v.kind === "string" && typeof v.label === "string"
}

function parseSnapshot(raw: string): DiscoverySnapshot | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return null
    const sm = parsed.searchMode
    if (sm !== "custom" && sm !== "profile") return null
    const cf = parsed.customFilters
    if (!Array.isArray(cf) || !cf.every(isUiFilter)) return null
    const ow = parsed.customOnlyWithStats
    if (typeof ow !== "boolean") return null
    const sp = parsed.selectedProfileId
    if (typeof sp !== "string") return null
    const sortRaw = parsed.sort
    const sort: DiscoverySortOption =
      sortRaw === undefined || sortRaw === "newestTransaction"
        ? "newestTransaction"
        : sortRaw === "lastName"
          ? "lastName"
          : sortRaw === "transactionType"
            ? "transactionType"
            : (() => {
                throw new Error("Invalid discovery sort")
              })()
    const ttRaw = parsed.transactionTypes
    const transactionTypes: DiscoveryTransactionType[] =
      ttRaw === undefined
        ? []
        : Array.isArray(ttRaw)
          ? ttRaw.filter(
              (v): v is DiscoveryTransactionType => v === "retired" || v === "released" || v === "freeAgent",
            )
          : (() => {
              throw new Error("Invalid transactionTypes")
            })()
    if (Array.isArray(ttRaw) && transactionTypes.length !== ttRaw.length) {
      throw new Error("Invalid transactionTypes")
    }
    return {
      searchMode: sm,
      customFilters: cf,
      customOnlyWithStats: ow,
      selectedProfileId: sp,
      sort,
      transactionTypes,
    }
  } catch {
    return null
  }
}

/** Call when the user opens a player profile from the discovery grid (before navigation). */
export function saveDiscoverySnapshotForPlayerNavigation(snapshot: DiscoverySnapshot): void {
  try {
    sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot))
  } catch {
    /* quota / private mode */
  }
}

/**
 * Returns saved state once and removes it from storage so it is only applied after
 * returning from a profile, not on unrelated visits to Home.
 */
export function takeDiscoverySnapshot(): DiscoverySnapshot | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(SNAPSHOT_KEY)
    if (raw == null) return null
    sessionStorage.removeItem(SNAPSHOT_KEY)
    return parseSnapshot(raw)
  } catch {
    return null
  }
}

/** Call when mounting routes that should not receive a restored discovery session (sidebar tabs, Preferences, …). */
export function clearDiscoverySnapshot(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(SNAPSHOT_KEY)
  } catch {
    /* ignore */
  }
}
