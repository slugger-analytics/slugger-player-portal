import assert from "node:assert/strict"
import test from "node:test"
import {
  parseAsOfDateInput,
  resolveTransactionWindowFilters,
  shiftIsoDaysUtc,
  todayIsoUtc,
  transactionWindow,
} from "./transactionWindow"

test("the window is invariant across the whole UTC day (no wall-clock arithmetic)", () => {
  const instants = [
    "2026-08-04T00:00:00.001Z",
    "2026-08-04T11:59:59.999Z",
    "2026-08-04T12:00:00.001Z",
    "2026-08-04T23:59:59.999Z",
  ]
  const windows = instants.map((i) => {
    const filters = resolveTransactionWindowFilters({ lastTransactionDays: 7 }, new Date(i))
    assert.equal(filters.asOfDate, "2026-08-04", `anchor pinned to the UTC day at ${i}`)
    return transactionWindow(filters)
  })
  for (const w of windows) {
    assert.deepStrictEqual(w, windows[0], "same UTC calendar day ⇒ identical window")
  }
})

test("todayIsoUtc reads the UTC calendar date, never the local one", () => {
  // 03:30Z is still Aug 4 on a US-Eastern machine; local-time accessors would fail here.
  assert.equal(todayIsoUtc(new Date("2026-08-05T03:30:00.000Z")), "2026-08-05")
  assert.equal(todayIsoUtc(new Date("2026-08-04T23:59:59.999Z")), "2026-08-04")
  assert.equal(todayIsoUtc(new Date("2026-08-05T00:00:00.000Z")), "2026-08-05")
})

test("an explicit anchor reproduces the TBC window and pins both bind values", () => {
  const w = transactionWindow({ lastTransactionDays: 30, asOfDate: "2026-07-26" })
  assert.equal(w.fromDate, "2026-06-26")
  assert.equal(w.gte.toISOString(), "2026-06-26T00:00:00.000Z")
  // Asymmetric on purpose: a midnight `lte` would exclude every row dated on the anchor if the
  // column were ever promoted from DATE to a timestamp.
  assert.equal(w.lte.toISOString(), "2026-07-26T23:59:59.999Z")
  for (const now of ["2000-01-01T00:00:00.000Z", "2026-08-04T12:00:00.000Z", "2099-12-31T23:00:00.000Z"]) {
    assert.deepStrictEqual(transactionWindow({ lastTransactionDays: 30, asOfDate: "2026-07-26" }, new Date(now)), w)
  }
})

test("the default (unanchored) lower bound is unchanged from the rolling behaviour", () => {
  const now = new Date("2026-08-04T07:51:00.000Z")
  const at = (days: number) => transactionWindow(resolveTransactionWindowFilters({ lastTransactionDays: days }, now))
  assert.equal(at(7).gte.toISOString(), "2026-07-28T00:00:00.000Z")
  assert.equal(at(30).gte.toISOString(), "2026-07-05T00:00:00.000Z")
  for (const days of [7, 14, 21, 30, 45, 60]) {
    const morning = transactionWindow(
      resolveTransactionWindowFilters({ lastTransactionDays: days }, new Date("2026-08-04T01:00:00.000Z")),
    )
    const evening = transactionWindow(
      resolveTransactionWindowFilters({ lastTransactionDays: days }, new Date("2026-08-04T19:00:00.000Z")),
    )
    assert.equal(morning.fromDate, evening.fromDate, `lower bound stable within the day for ${days}`)
  }
})

test("calendar arithmetic crosses months, leap days, years and DST boundaries", () => {
  assert.equal(transactionWindow({ lastTransactionDays: 7, asOfDate: "2026-03-01" }).fromDate, "2026-02-22")
  assert.equal(shiftIsoDaysUtc("2024-03-01", -1), "2024-02-29")
  assert.equal(transactionWindow({ lastTransactionDays: 30, asOfDate: "2026-01-05" }).fromDate, "2025-12-06")
  // A setDate-based implementation on a DST-observing local clock can produce a 25-hour day here.
  assert.equal(shiftIsoDaysUtc("2026-11-02", -1), "2026-11-01")
})

test("parseAsOfDateInput accepts ISO and TBC US dates, and rejects rollover / out-of-range input", () => {
  assert.equal(parseAsOfDateInput("2026-07-26"), "2026-07-26")
  assert.equal(parseAsOfDateInput("7/26/2026"), "2026-07-26")
  assert.equal(parseAsOfDateInput("07/26/2026"), "2026-07-26")
  assert.equal(parseAsOfDateInput("  2026-07-26  "), "2026-07-26")
  // Date.UTC silently rolls 2026-02-31 to 2026-03-03 rather than returning NaN.
  assert.equal(parseAsOfDateInput("2026-02-31"), null)
  for (const bad of [
    "2026-13-01",
    "26-07-2026",
    "2026-7-26",
    "0026-07-26",
    "1999-01-01",
    "2101-01-01",
    "",
    "today",
    "2026-07-26T00:00:00Z",
  ]) {
    assert.equal(parseAsOfDateInput(bad), null, `rejects ${JSON.stringify(bad)}`)
  }
})

test("every thrown message keeps the Invalid prefix the 400/500 split keys off", () => {
  assert.throws(
    () => resolveTransactionWindowFilters({ lastTransactionDays: 30, asOfDate: "2026-02-31" }),
    (e: unknown) => e instanceof Error && /^Invalid asOfDate/.test(e.message),
  )
  assert.throws(
    () => transactionWindow({ lastTransactionDays: 31 }),
    (e: unknown) => e instanceof Error && e.message === "Invalid lastTransactionDays: 31",
  )
})

test("an anchor without a window is dropped, and the input filters are never mutated", () => {
  const input = { asOfDate: "2026-07-26" }
  const out = resolveTransactionWindowFilters(input)
  assert.equal(out.asOfDate, undefined)
  assert.equal(input.asOfDate, "2026-07-26", "returns a new object")
})
