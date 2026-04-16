/**
 * Per-profile acknowledgment of which **snapshot** of each player’s profile-visible
 * transaction history the user has seen, so Updates can hide “read” rows, paginate
 * to the next unread batch, and show a player again when their transaction date moves.
 */

import type { PlayerSummary } from "@available-player-portal/shared"

/** Old v1 storage used a plain id list; migrated rows use this until first API hydrate. */
export const PROFILE_ACK_MIGRATED = "__migrated__"

const STORAGE_KEY_V2 = "available-player-portal:profile-updates-ack-v2"
/** @deprecated Legacy key — read once to migrate into v2 */
const STORAGE_KEY_V1 = "available-player-portal:profile-updates-seen-v1"

/** profileId → playerId → last acknowledged `mostRecentTransactionDate` (null = none at ack time) */
export type ProfileAckMap = Record<string, Record<string, string | null | typeof PROFILE_ACK_MIGRATED>>

function isRecord(x: unknown): x is Record<string, unknown> {
  return x != null && typeof x === "object" && !Array.isArray(x)
}

function parseAckMap(raw: unknown): ProfileAckMap {
  if (!isRecord(raw)) return {}
  const out: ProfileAckMap = {}
  for (const [pid, inner] of Object.entries(raw)) {
    if (!isRecord(inner)) continue
    const m: Record<string, string | null | typeof PROFILE_ACK_MIGRATED> = {}
    for (const [playerId, v] of Object.entries(inner)) {
      if (v === PROFILE_ACK_MIGRATED) {
        m[playerId] = PROFILE_ACK_MIGRATED
      } else if (v === null) {
        m[playerId] = null
      } else if (typeof v === "string") {
        m[playerId] = v
      }
    }
    out[pid] = m
  }
  return out
}

function migrateV1ToV2(parsed: unknown): ProfileAckMap {
  if (!isRecord(parsed)) return {}
  const out: ProfileAckMap = {}
  for (const [profileId, v] of Object.entries(parsed)) {
    if (!Array.isArray(v)) continue
    const m: Record<string, typeof PROFILE_ACK_MIGRATED> = {}
    for (const id of v) {
      if (typeof id === "string") m[id] = PROFILE_ACK_MIGRATED
    }
    if (Object.keys(m).length > 0) out[profileId] = m
  }
  return out
}

export function readProfileAcks(): ProfileAckMap {
  if (typeof window === "undefined") return {}
  try {
    const v2 = window.localStorage.getItem(STORAGE_KEY_V2)
    if (v2) return parseAckMap(JSON.parse(v2) as unknown)

    const v1 = window.localStorage.getItem(STORAGE_KEY_V1)
    if (v1) {
      const migrated = migrateV1ToV2(JSON.parse(v1) as unknown)
      if (Object.keys(migrated).length > 0) {
        writeProfileAcks(migrated)
        window.localStorage.removeItem(STORAGE_KEY_V1)
      }
      return migrated
    }
  } catch {
    return {}
  }
  return {}
}

export function writeProfileAcks(map: ProfileAckMap): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(map))
}

/**
 * Player counts as an **unread update** iff they have never been ack’d at this snapshot,
 * or their profile-visible latest transaction date is newer than the ack’d snapshot.
 */
export function isPlayerPendingUpdate(
  profileId: string,
  player: PlayerSummary,
  acks: ProfileAckMap,
): boolean {
  const ack = acks[profileId]?.[player.id]
  const cur = player.mostRecentTransactionDate?.trim() || null

  if (ack === undefined) return true
  if (ack === PROFILE_ACK_MIGRATED) return false
  if (ack === null) return cur != null
  if (cur == null) return false
  return cur > ack
}

/** Hydrate migrated placeholders using live API rows (same batch before filtering). */
export function applyMigratedAckSnapshots(
  profileId: string,
  players: PlayerSummary[],
  acks: ProfileAckMap,
): { next: ProfileAckMap; changed: boolean } {
  const inner = { ...(acks[profileId] ?? {}) }
  let changed = false
  for (const pl of players) {
    if (inner[pl.id] === PROFILE_ACK_MIGRATED) {
      inner[pl.id] = pl.mostRecentTransactionDate?.trim() || null
      changed = true
    }
  }
  if (!changed) return { next: acks, changed: false }
  return { next: { ...acks, [profileId]: inner }, changed: true }
}

export function acknowledgePlayerSnapshots(
  profileId: string,
  entries: { playerId: string; mostRecentTransactionDate: string | null }[],
): void {
  const map = readProfileAcks()
  const inner = { ...(map[profileId] ?? {}) }
  for (const { playerId, mostRecentTransactionDate } of entries) {
    inner[playerId] = mostRecentTransactionDate?.trim() || null
  }
  map[profileId] = inner
  writeProfileAcks(map)
}
