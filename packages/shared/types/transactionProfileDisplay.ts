/**
 * Player profile transaction list / `GET /players/:id/transactions` — TBC `tranxType` filter.
 *
 * **Single source of truth:** {@link PROFILE_VISIBLE_TRANSACTION_TYPE_RULES} defines which
 * normalized `tranxType` strings belong to each profile-visible family (retired / released /
 * free agent). Every predicate derives from it so the TS matcher, the discovery Prisma filter
 * (`PlayerRepository.discoveryTransactionTypeWhere`), and the retention/refresh SQL builders
 * (`TransactionRepository`) can never drift.
 */

import type { TransactionTypeFilter } from "./models"

/** Collapses whitespace; lowercases for comparison. */
export function normalizeTransactionTypeForDisplayMatch(type: string): string {
  return type.trim().toLowerCase().replace(/\s+/g, " ")
}

/** A single match rule against a {@link normalizeTransactionTypeForDisplayMatch}-normalized string. */
export type TransactionTypeMatchRule =
  | { readonly kind: "exact"; readonly value: string }
  | { readonly kind: "prefix"; readonly value: string }

/**
 * Which normalized `tranxType` strings map to each profile-visible family. Values are already
 * normalized (lowercased, single-spaced). `prefix` values keep the trailing space where the
 * family name is a standalone word (`released ` matches "released by Braves") so an unrelated
 * word is never matched; `free agency` has no trailing space so it also matches
 * "free agency (granted)". `free agent ` covers suffix variants like "free agent (minors)".
 */
export const PROFILE_VISIBLE_TRANSACTION_TYPE_RULES: Readonly<
  Record<TransactionTypeFilter, readonly TransactionTypeMatchRule[]>
> = {
  retired: [
    { kind: "exact", value: "retired" },
    { kind: "prefix", value: "retired " },
  ],
  released: [
    { kind: "exact", value: "released" },
    { kind: "prefix", value: "released " },
  ],
  freeAgent: [
    { kind: "exact", value: "free agent" },
    { kind: "prefix", value: "free agent " },
    { kind: "prefix", value: "free agency" },
  ],
}

const ALL_PROFILE_VISIBLE_RULES: readonly TransactionTypeMatchRule[] = Object.values(
  PROFILE_VISIBLE_TRANSACTION_TYPE_RULES,
).flat()

/** True when an already-normalized type matches a single rule. */
export function normalizedTypeMatchesRule(normalized: string, rule: TransactionTypeMatchRule): boolean {
  return rule.kind === "exact" ? normalized === rule.value : normalized.startsWith(rule.value)
}

/** True when `type` matches any rule for the given families (retired / released / free agent). */
export function transactionTypeMatchesFamilies(
  type: string,
  families: readonly TransactionTypeFilter[],
): boolean {
  const n = normalizeTransactionTypeForDisplayMatch(type)
  return families.some((f) =>
    PROFILE_VISIBLE_TRANSACTION_TYPE_RULES[f].some((r) => normalizedTypeMatchesRule(n, r)),
  )
}

/**
 * Retired, released, and free-agent lines only — the rows shown on a player profile and used
 * for portal eligibility. Includes suffix variants (`free agent (minors)`, `released by …`,
 * `free agency (granted)`) via {@link PROFILE_VISIBLE_TRANSACTION_TYPE_RULES}.
 */
export function isTransactionShownOnPlayerProfile(type: string): boolean {
  const n = normalizeTransactionTypeForDisplayMatch(type)
  return ALL_PROFILE_VISIBLE_RULES.some((r) => normalizedTypeMatchesRule(n, r))
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
