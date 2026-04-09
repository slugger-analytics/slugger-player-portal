/** Ordered player IDs the user wants updates for (bell). Persisted in localStorage. */
export const UPDATES_WATCH_STORAGE_KEY = "available-player-portal:updates-watch-v1"

export function readUpdatesWatchIds(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(UPDATES_WATCH_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === "string" && x.length > 0)
  } catch {
    return []
  }
}

export function writeUpdatesWatchIds(ids: string[]): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(UPDATES_WATCH_STORAGE_KEY, JSON.stringify(ids))
}
