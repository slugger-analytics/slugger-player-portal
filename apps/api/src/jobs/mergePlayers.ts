/**
 * @file mergePlayers.ts
 * @description Merge `Player` rows parsed from the three TBC feeds into one row per id.
 *
 * **Position authority:** the transaction feed carries a player's true (often compound,
 * e.g. `SS-2B`) position. Batting/pitching feeds carry a single-position cell that must
 * never clobber a transaction-feed position — they may only *fill* position when the
 * transaction feed supplied none. Every other field keeps the historical later-wins merge
 * (name/team `—` handling, status stickiness, experience level max-wins).
 */

import { mergeExperienceLevels } from "@available-player-portal/shared"
import type { Player } from "../types/models"

/** One feed's parsed players plus whether its position column is authoritative (transactions feed). */
export type MergePlayerSource = { players: Player[]; positionAuthoritative: boolean }

export function mergePlayers(sources: MergePlayerSource[]): Player[] {
  const map = new Map<string, Player>()
  /** Tracks whether the accumulated position came from an authoritative (transaction) feed. */
  const positionFromAuthoritative = new Map<string, boolean>()
  for (const { players, positionAuthoritative } of sources) {
    for (const p of players) {
      const incomingHasPosition = !!p.position && p.position !== "—"
      const prev = map.get(p.id)
      if (!prev) {
        map.set(p.id, { ...p })
        positionFromAuthoritative.set(p.id, positionAuthoritative && incomingHasPosition)
        continue
      }
      // Authoritative (transaction) position always wins; a non-authoritative stats feed
      // may only fill position when the accumulated value is missing or itself non-authoritative.
      const prevPositionAuthoritative = positionFromAuthoritative.get(p.id) ?? false
      const takeIncomingPosition =
        incomingHasPosition && (positionAuthoritative || !prevPositionAuthoritative)
      const merged: Player = {
        ...prev,
        ...p,
        name: p.name && p.name !== "Unknown" ? p.name : prev.name,
        team: p.team && p.team !== "—" ? p.team : prev.team,
        position: takeIncomingPosition ? p.position : prev.position,
        status: p.status !== "available" ? p.status : prev.status,
        age: p.age ?? prev.age,
        experienceLevel: mergeExperienceLevels(prev.experienceLevel, p.experienceLevel),
      }
      map.set(p.id, merged)
      if (takeIncomingPosition) positionFromAuthoritative.set(p.id, positionAuthoritative)
    }
  }
  return [...map.values()]
}
