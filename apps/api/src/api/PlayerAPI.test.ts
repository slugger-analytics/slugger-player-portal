import assert from "node:assert/strict"
import test from "node:test"
import { parseFilters } from "./PlayerAPI"

test("every as-of alias parses, including a TBC Transaction Date pasted verbatim", () => {
  for (const key of ["asOfDate", "asOf", "transactionDate", "tranxDate"]) {
    const filters = parseFilters({ lastTransactionDays: "30", [key]: "2026-07-26" })
    assert.equal(filters.asOfDate, "2026-07-26", `${key} is accepted`)
    assert.equal(filters.lastTransactionDays, 30)
  }
  assert.equal(parseFilters({ lastTransactionDays: "30", transactionDate: "07/26/2026" }).asOfDate, "2026-07-26")
  assert.equal(parseFilters({ lastTransactionDays: "30", asOfDate: ["2026-07-26", "x"] }).asOfDate, "2026-07-26")
})

test("an omitted anchor stays undefined (defaulting happens once, in the service)", () => {
  assert.equal(parseFilters({ lastTransactionDays: "30" }).asOfDate, undefined)
  assert.equal(parseFilters({ position: "2B" }).asOfDate, undefined)
})

test("an anchor without a window is a 400, not a silently unwindowed list", () => {
  assert.throws(
    () => parseFilters({ asOfDate: "2026-07-26" }),
    (e: unknown) =>
      e instanceof Error &&
      e.message === "Invalid asOfDate: requires lastTransactionDays" &&
      e.message.startsWith("Invalid"),
  )
})

test("a malformed anchor is rejected with the Invalid prefix", () => {
  assert.throws(
    () => parseFilters({ lastTransactionDays: "30", asOfDate: "2026-02-31" }),
    (e: unknown) => e instanceof Error && /^Invalid asOfDate/.test(e.message),
  )
})

test("unknown query keys are still ignored (additive contract)", () => {
  const filters = parseFilters({ position: "2B", someFutureParam: "x" })
  assert.equal(filters.position, "2B")
})
