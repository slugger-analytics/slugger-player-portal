/**
 * @file transactionWindow.ts
 * @description Calendar-date arithmetic for the discovery “last X days” window, extracted so it is
 * a pure function of its inputs (no Prisma, no ambient clock) and can be unit-tested directly.
 *
 * **Semantics:** the window is `[asOfDate − lastTransactionDays, asOfDate]`, **both ends
 * inclusive** (N+1 calendar days), mirroring TBC’s “Transaction Date” + “Last X Days” pair.
 * Omitting `asOfDate` anchors on today, which reproduces the previous rolling behaviour exactly.
 *
 * **Timezone:** every date here is a **UTC** calendar date. Two bans apply to this file: never
 * `new Date(isoString)` without an explicit `T…Z`, and never local-time accessors
 * (`getFullYear` / `getMonth` / `getDate`) — either would shift the window by a day for anyone
 * west of UTC and reintroduce the hour-of-day dependence this module exists to remove.
 */

import { isLastTransactionDaysOption } from "@available-player-portal/shared"
import type { PlayerFilters } from "../types/models"

export interface TransactionWindow {
  asOfDate: string
  days: number
  fromDate: string
  gte: Date
  lte: Date
}

/** Today as a `YYYY-MM-DD` UTC calendar date. */
export function todayIsoUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/**
 * Canonicalizes an as-of anchor to `YYYY-MM-DD`, accepting `YYYY-MM-DD` and `M/D/YYYY` (so a TBC
 * “Transaction Date” can be pasted verbatim). Returns `null` for anything else. The round-trip
 * check is what rejects `2026-02-31`: `Date.UTC` silently rolls it to 2026-03-03 rather than NaN.
 */
export function parseAsOfDateInput(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  let y: number
  let mo: number
  let d: number
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t)
  if (iso) {
    y = Number(iso[1])
    mo = Number(iso[2])
    d = Number(iso[3])
  } else {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t)
    if (!m) return null
    y = Number(m[3])
    mo = Number(m[1])
    d = Number(m[2])
  }
  if (y < 2000 || y > 2100) return null
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null
  return dt.toISOString().slice(0, 10)
}

/** Adds `days` calendar days to a `YYYY-MM-DD` date using UTC millisecond math only. */
export function shiftIsoDaysUtc(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00.000Z`) + days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
}

/**
 * Reads the clock **once per request** and pins the anchor onto the filters, so every downstream
 * repository call sees the same window (the count and the list used to derive it from two
 * independent `new Date()` calls and could straddle UTC midnight). Returns a new object.
 * An anchor without a window is meaningless, so it is dropped rather than half-applied.
 */
export function resolveTransactionWindowFilters(filters: PlayerFilters, now: Date = new Date()): PlayerFilters {
  if (filters.lastTransactionDays == null) {
    return filters.asOfDate == null ? filters : { ...filters, asOfDate: undefined }
  }
  const raw = filters.asOfDate?.trim()
  const asOf = raw ? parseAsOfDateInput(raw) : todayIsoUtc(now)
  if (asOf == null) throw new Error(`Invalid asOfDate: ${raw}`)
  return { ...filters, asOfDate: asOf }
}

/**
 * Bind values for the transaction `date` filter. Every thrown message starts with `Invalid` —
 * `PlayerAPI` keys its 400-vs-500 decision off that prefix.
 */
export function transactionWindow(filters: PlayerFilters, now: Date = new Date()): TransactionWindow {
  const n = filters.lastTransactionDays!
  if (!isLastTransactionDaysOption(n)) {
    throw new Error(`Invalid lastTransactionDays: ${n}`)
  }
  /** Defensive: any direct repository caller still gets today; the service pre-resolves this. */
  const asOfDate = filters.asOfDate ?? todayIsoUtc(now)
  const fromDate = shiftIsoDaysUtc(asOfDate, -n)
  /**
   * The bind times are deliberately asymmetric. `Transaction.date` is a Postgres `DATE`, so both
   * collapse to the intended calendar day today; if the column were ever promoted to a timestamp,
   * a midnight `lte` would silently exclude every row dated on the anchor. Do not “simplify”.
   */
  return {
    asOfDate,
    days: n,
    fromDate,
    gte: new Date(`${fromDate}T00:00:00.000Z`),
    lte: new Date(`${asOfDate}T23:59:59.999Z`),
  }
}
