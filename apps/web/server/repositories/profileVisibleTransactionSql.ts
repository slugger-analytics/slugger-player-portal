/**
 * @file profileVisibleTransactionSql.ts
 * @description Postgres predicate for profile-visible transaction types, generated from the
 * shared {@link PROFILE_VISIBLE_TRANSACTION_TYPE_RULES} so it can never drift from the TS
 * predicate ({@link isTransactionShownOnPlayerProfile}).
 */

import { Prisma } from "@prisma/client"
import { PROFILE_VISIBLE_TRANSACTION_TYPE_RULES } from "@available-player-portal/shared"

/**
 * SQL boolean expression matching a normalized `t.type` against every profile-visible family.
 * `t.type` is normalized (lowercased, trimmed, internal whitespace collapsed) to mirror
 * {@link normalizeTransactionTypeForDisplayMatch}. The template is authored with `\\s` so it
 * cooks to a literal backslash and Postgres receives the whitespace class `\s+`.
 *
 * Intended to be embedded inside an `EXISTS (SELECT 1 FROM "Transaction" t ... AND (<here>))`.
 */
export function profileVisibleTransactionTypeSql(): Prisma.Sql {
  const norm = Prisma.sql`regexp_replace(lower(trim(both from t.type)), '\\s+', ' ', 'g')`
  const rules = Object.values(PROFILE_VISIBLE_TRANSACTION_TYPE_RULES).flat()
  const exacts = rules.flatMap((r) => (r.kind === "exact" ? [r.value] : []))
  const prefixes = rules.flatMap((r) => (r.kind === "prefix" ? [r.value] : []))
  const clauses: Prisma.Sql[] = []
  if (exacts.length > 0) {
    clauses.push(Prisma.sql`${norm} IN (${Prisma.join(exacts.map((v) => Prisma.sql`${v}`))})`)
  }
  for (const p of prefixes) {
    clauses.push(Prisma.sql`${norm} LIKE ${`${p}%`}`)
  }
  return Prisma.join(clauses, " OR ")
}
