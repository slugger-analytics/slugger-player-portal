/**
 * @file mostRecentTransaction.ts
 * @description Pure picker for “newest profile-visible transaction per player”, extracted from
 * {@link TransactionRepository} so the tie-break is testable without a database.
 *
 * **Why it exists:** the repository used to reduce over an *unordered* `findMany` with a strict
 * `date >` comparison, so two profile-visible transactions on the same calendar date resolved to
 * whichever row Postgres happened to return first — the search-result card and the profile page
 * could disagree on the transaction type. Comparing on the total order `(date desc, id desc)`
 * makes the answer order-independent, and it is deliberately the *same* order as
 * `getTransactionsByPlayer`, so the card and the profile page cannot structurally disagree.
 */

/** Minimal projection needed to pick a winner (`id` is the autoincrement PK: unique, non-null). */
export type ProfileTxRow = { playerId: string; id: number; date: Date; type: string }

/**
 * Newest matching transaction per player as `{ date, type }`.
 * `matches` is applied **before** a winner is chosen, so a newer non-matching row never suppresses
 * an older matching one. `asOfDate` (`YYYY-MM-DD`, inclusive) caps rows to a discovery window
 * anchor; players whose rows all fall after it are absent from the map.
 */
export function pickMostRecentByPlayer(
  rows: ProfileTxRow[],
  matches: (type: string) => boolean,
  asOfDate?: string,
): Map<string, { date: string; type: string }> {
  const acc = new Map<string, { date: string; type: string; id: number }>()
  for (const r of rows) {
    if (!matches(r.type)) continue
    const d = r.date.toISOString().slice(0, 10)
    if (asOfDate != null && d > asOfDate) continue
    const prev = acc.get(r.playerId)
    if (!prev || d > prev.date || (d === prev.date && r.id > prev.id)) {
      acc.set(r.playerId, { date: d, type: r.type, id: r.id })
    }
  }
  const out = new Map<string, { date: string; type: string }>()
  for (const [playerId, v] of acc) out.set(playerId, { date: v.date, type: v.type })
  return out
}
