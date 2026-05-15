/** Ordered player IDs the user wants updates for (bell). Persisted in localStorage. */
import { addWatchedPlayer, fetchWatchedPlayerIds, removeWatchedPlayer } from "@/lib/api"

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

export async function readUpdatesWatchIdsFromServer(): Promise<string[]> {
  try {
    const ids = await fetchWatchedPlayerIds()
    writeUpdatesWatchIds(ids)
    return ids
  } catch {
    return readUpdatesWatchIds()
  }
}

export async function addWatchOnServer(playerId: string): Promise<void> {
  try {
    await addWatchedPlayer(playerId)
  } finally {
    const next = readUpdatesWatchIds()
    if (!next.includes(playerId)) writeUpdatesWatchIds([...next, playerId])
  }
}

export async function removeWatchOnServer(playerId: string): Promise<void> {
  try {
    await removeWatchedPlayer(playerId)
  } finally {
    writeUpdatesWatchIds(readUpdatesWatchIds().filter((id) => id !== playerId))
  }
}
