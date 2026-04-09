/** Ordered player IDs: index 0 = highest rank. Persisted in localStorage. */
export const FAVORITES_STORAGE_KEY = "available-player-portal:favorites-v1"

export function readFavoriteIds(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === "string" && x.length > 0)
  } catch {
    return []
  }
}

export function writeFavoriteIds(ids: string[]): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(ids))
}
