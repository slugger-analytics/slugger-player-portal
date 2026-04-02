export type HistoryEntry = {
  playerId: string
  playerName: string
  position: string
  team: string
  viewedAt: string
}

export const PLAYER_HISTORY_STORAGE_KEY = "available-player-portal:history-v1"
export const MAX_HISTORY_ITEMS = 100

export function readHistoryEntries(): HistoryEntry[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(PLAYER_HISTORY_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is HistoryEntry => {
      if (!x || typeof x !== "object") return false
      const y = x as Record<string, unknown>
      return (
        typeof y.playerId === "string" &&
        typeof y.playerName === "string" &&
        typeof y.position === "string" &&
        typeof y.team === "string" &&
        typeof y.viewedAt === "string"
      )
    })
  } catch {
    return []
  }
}

export function writeHistoryEntries(entries: HistoryEntry[]): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(
    PLAYER_HISTORY_STORAGE_KEY,
    JSON.stringify(entries.slice(0, MAX_HISTORY_ITEMS)),
  )
}

export function pushHistoryEntry(entry: Omit<HistoryEntry, "viewedAt">): void {
  const now = new Date().toISOString()
  const prev = readHistoryEntries().filter((e) => e.playerId !== entry.playerId)
  writeHistoryEntries([{ ...entry, viewedAt: now }, ...prev])
}
