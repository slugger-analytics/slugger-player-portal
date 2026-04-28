import type { UiFilter } from "@/components/discovery/DiscoveryFilterTypes"
import type { RankingPreferences } from "@available-player-portal/shared"
import {
  deleteNotificationProfile,
  fetchNotificationProfiles,
  saveNotificationProfile,
} from "@/lib/api"

const STORAGE_KEY = "portal-player-search-profiles"

export type PlayerSearchProfile = {
  id: string
  name: string
  createdAt: string
  filters: UiFilter[]
  onlyWithStats: boolean
  rankingPreferences?: RankingPreferences
}

export function loadProfiles(): PlayerSearchProfile[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (p): p is PlayerSearchProfile =>
        p != null &&
        typeof p === "object" &&
        typeof (p as PlayerSearchProfile).id === "string" &&
        typeof (p as PlayerSearchProfile).name === "string" &&
        Array.isArray((p as PlayerSearchProfile).filters),
    )
  } catch {
    return []
  }
}

export function saveProfiles(profiles: PlayerSearchProfile[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles))
  } catch {
    /* ignore */
  }
}

export function upsertProfile(profile: PlayerSearchProfile): void {
  const list = loadProfiles()
  const i = list.findIndex((p) => p.id === profile.id)
  if (i >= 0) list[i] = profile
  else list.push(profile)
  saveProfiles(list)
}

export function deleteProfile(id: string): void {
  saveProfiles(loadProfiles().filter((p) => p.id !== id))
}

export async function loadProfilesFromServer(): Promise<PlayerSearchProfile[]> {
  try {
    const profiles = await fetchNotificationProfiles()
    saveProfiles(profiles)
    return profiles
  } catch {
    return loadProfiles()
  }
}

export async function upsertProfileOnServer(profile: PlayerSearchProfile): Promise<PlayerSearchProfile> {
  try {
    const saved = await saveNotificationProfile(profile)
    upsertProfile(saved)
    return saved
  } catch {
    upsertProfile(profile)
    return profile
  }
}

export async function deleteProfileOnServer(id: string): Promise<void> {
  try {
    await deleteNotificationProfile(id)
  } finally {
    deleteProfile(id)
  }
}
