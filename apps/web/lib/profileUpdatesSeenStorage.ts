/**
 * Tracks which player rows the user has already seen under each saved profile on the Updates page,
 * so we can show a "New" badge for fresh matches (this browser only).
 */
export const PROFILE_UPDATES_SEEN_KEY = "available-player-portal:profile-updates-seen-v1"

export type ProfileSeenMap = Record<string, string[]>

export function readProfileUpdatesSeen(): ProfileSeenMap {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(PROFILE_UPDATES_SEEN_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    const out: ProfileSeenMap = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === "string")
    }
    return out
  } catch {
    return {}
  }
}

export function writeProfileUpdatesSeen(map: ProfileSeenMap): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(PROFILE_UPDATES_SEEN_KEY, JSON.stringify(map))
}

export function markProfilePlayersSeen(profileId: string, playerIds: string[]): void {
  const map = readProfileUpdatesSeen()
  const prev = new Set(map[profileId] ?? [])
  for (const id of playerIds) prev.add(id)
  map[profileId] = [...prev]
  writeProfileUpdatesSeen(map)
}
