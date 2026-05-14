/**
 * Player profile transaction list / `GET /players/:id/transactions` — TBC `tranxType` filter.
 */

import type { TransactionTypeFilter } from "./models"

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
  // TBC often uses `tranxType` values like "Released by Braves" — same intent as "Released".
  if (n === "retired" || n.startsWith("retired ")) return true
  if (n === "released" || n.startsWith("released ")) return true
  if (n === "free agent") return true
  if (n.startsWith("free agency")) return true
  return false
}

const DEFAULT_DISCOVERY_TRANSACTION_TYPES = ["retired", "released", "freeAgent"] as const satisfies readonly TransactionTypeFilter[]

/**
 * When `transactionTypes` is omitted or empty, discovery uses all three families
 * (retired, released, free agent), matching list sorting without an explicit filter.
 */
export function effectiveDiscoveryTransactionTypeFilters(
  transactionTypes?: TransactionTypeFilter[],
): readonly TransactionTypeFilter[] {
  if (!transactionTypes || transactionTypes.length === 0) return DEFAULT_DISCOVERY_TRANSACTION_TYPES
  return transactionTypes
}
