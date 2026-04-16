/**
 * Filters out mis-parsed or junk TBC rows from **Player Discovery** lists and sync upserts.
 * Feeds sometimes misalign CSV columns or emit placeholder ids like "000", producing nonsense cards.
 */

import type { Player } from "../types/models"

/**
 * True if the row looks like a real person for discovery.
 * Drops mis-parsed TBC rows (ids like `000`, names that are only years / `R` / `L`, etc.).
 */
export function isPlayerDiscoveryEligible(p: Pick<Player, "id" | "name">): boolean {
  const id = (p.id ?? "").trim()
  const name = (p.name ?? "").trim()
  if (id.length === 0 || name.length < 2) return false
  const letterRuns = name.match(/[A-Za-z]+/g) ?? []
  if (!letterRuns.some((w) => w.length >= 2)) return false
  if (/^0+$/.test(id)) return false
  if (/^\d{1,4}$/.test(id)) return false
  const lower = name.toLowerCase()
  if (lower === "unknown" || lower === "—" || lower === "-") return false
  return true
}
