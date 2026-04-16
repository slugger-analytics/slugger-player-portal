/**
 * Loads up to {@link PROFILE_UPDATE_DISPLAY_LIMIT} **pending** profile matches by paging
 * `GET /players` until enough unread rows are found or the list is exhausted.
 */

import type { PlayerSummary } from "@available-player-portal/shared"
import { fetchPlayerSummaries } from "@/lib/api"
import { buildPlayerListParams } from "@/lib/discovery-query"
import type { PlayerSearchProfile } from "@/lib/player-profiles"
import {
  applyMigratedAckSnapshots,
  isPlayerPendingUpdate,
  type ProfileAckMap,
} from "@/lib/profileUpdatesAck"

const PAGE_SIZE = 100

export const PROFILE_UPDATE_DISPLAY_LIMIT = 12

function parseTransactionMs(d: string | null | undefined): number | null {
  const s = d?.trim()
  if (!s) return null
  const t = Date.parse(`${s}T12:00:00.000Z`)
  return Number.isNaN(t) ? null : t
}

function sortPendingByTransaction(players: PlayerSummary[]): PlayerSummary[] {
  return [...players].sort((a, b) => {
    const ta = parseTransactionMs(a.mostRecentTransactionDate)
    const tb = parseTransactionMs(b.mostRecentTransactionDate)
    if (ta != null && tb != null && tb !== ta) return tb - ta
    if (ta != null && tb == null) return -1
    if (ta == null && tb != null) return 1
    return a.name.localeCompare(b.name)
  })
}

export async function loadPendingMatchesForProfile(
  profile: PlayerSearchProfile,
  acks: ProfileAckMap,
): Promise<{
  players: PlayerSummary[]
  acks: ProfileAckMap
  migratedAcksPersist: boolean
  matchTotal: number
}> {
  let working = acks
  let migratedAcksPersist = false
  /** Newest profile-visible transaction first so we page through updates in recency order, not name. */
  const paramsBase = {
    ...buildPlayerListParams(profile.filters, profile.onlyWithStats),
    sortBy: "recentProfileTransaction" as const,
  }
  const pending: PlayerSummary[] = []
  let offset = 0
  let total = Infinity
  let matchTotal = 0

  while (pending.length < PROFILE_UPDATE_DISPLAY_LIMIT && offset < total) {
    const { players, total: t } = await fetchPlayerSummaries({
      ...paramsBase,
      limit: PAGE_SIZE,
      offset,
    })
    if (offset === 0) matchTotal = t
    total = t
    if (players.length === 0) break

    const migrated = applyMigratedAckSnapshots(profile.id, players, working)
    if (migrated.changed) {
      working = migrated.next
      migratedAcksPersist = true
    }

    for (const pl of players) {
      if (isPlayerPendingUpdate(profile.id, pl, working)) {
        pending.push(pl)
        if (pending.length >= PROFILE_UPDATE_DISPLAY_LIMIT) break
      }
    }

    if (pending.length >= PROFILE_UPDATE_DISPLAY_LIMIT) break
    if (offset + players.length >= total) break
    offset += PAGE_SIZE
  }

  return {
    players: sortPendingByTransaction(pending),
    acks: working,
    migratedAcksPersist,
    matchTotal,
  }
}
