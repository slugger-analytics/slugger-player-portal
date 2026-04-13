/**
 * Player profile transaction list / `GET /players/:id/transactions` — TBC `tranxType` filter.
 */

/** Collapses whitespace; lowercases for comparison. */
export function normalizeTransactionTypeForDisplayMatch(type: string): string {
  return type.trim().toLowerCase().replace(/\s+/g, " ")
}

/**
 * Retired, released, and free-agent lines only. “Free agent” includes common feed variants
 * such as `free agency (granted)` via a `free agency` prefix match.
 */
export function isTransactionShownOnPlayerProfile(type: string): boolean {
  const n = normalizeTransactionTypeForDisplayMatch(type)
  if (n === "retired" || n === "released") return true
  if (n === "free agent") return true
  if (n.startsWith("free agency")) return true
  return false
}
