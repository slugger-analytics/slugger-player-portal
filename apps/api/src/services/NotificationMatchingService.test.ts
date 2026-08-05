import assert from "node:assert/strict"
import test from "node:test"
import type { UiFilter } from "@available-player-portal/shared"
import { filtersJsonToQuery } from "./NotificationMatchingService"

/**
 * These tests previously hand-built `{field, value}` rows. Nothing in the product produces
 * that shape — the web POSTs `UiFilter` rows and the API stores them verbatim — so the suite
 * stayed green while every saved filter was being dropped and each alert matched all 3657
 * discovery-eligible players. Every case below now feeds a row shaped the way the web
 * actually saves it.
 */

/** A row exactly as apps/web persists it through POST /notifications/profiles. */
function savedRow(row: Partial<UiFilter> & Pick<UiFilter, "kind">): UiFilter {
  return { id: "row-1", label: "saved row", ...row } as UiFilter
}

test("a saved profile's filters reach the alert query", () => {
  const query = filtersJsonToQuery(
    [
      savedRow({ kind: "position", rawValue: "2B" }),
      savedRow({ kind: "status", rawValue: "available" }),
    ],
    true,
    null,
  )
  assert.equal(query.position, "2B")
  assert.equal(query.status, "available")
  assert.equal(query.hasStats, true)
  assert.equal(query.sortBy, "recentProfileTransaction")
  assert.equal(query.sortDir, "desc")
})

test("an alert never degrades to an unfiltered query when filters were saved", () => {
  // The regression itself: a query carrying only sort keys matches the whole league.
  const query = filtersJsonToQuery(
    [
      savedRow({ kind: "position", rawValue: "2B" }),
      savedRow({ kind: "experienceLevel", experienceLevelMaxRaw: "AAA" }),
      savedRow({ kind: "lastTransactionDays", rawValue: "30", asOfDateRaw: "2026-07-26" }),
    ],
    false,
    null,
  )
  const constraints = Object.keys(query).filter((k) => k !== "sortBy" && k !== "sortDir")
  assert.deepEqual(constraints.sort(), ["experienceLevel", "lastTransactionDays", "position"])
})

test("experience-level range rows carry both ends", () => {
  const query = filtersJsonToQuery(
    [savedRow({ kind: "experienceLevel", experienceLevelMinRaw: "AAA", experienceLevelMaxRaw: "MLB" })],
    false,
    null,
  )
  assert.equal(query.experienceLevelMin, "AAA")
  assert.equal(query.experienceLevel, "MLB")
})

test("handedness and age rows survive the round trip", () => {
  const query = filtersJsonToQuery(
    [
      savedRow({ kind: "handedness", bats: "L", throws: "R" }),
      savedRow({ kind: "age", ageMode: "lt", ageValue: 27 }),
    ],
    false,
    null,
  )
  assert.equal(query.bats, "L")
  assert.equal(query.throws, "R")
  assert.equal(query.ageMax, 27)
})

test("saved profiles keep the window but never freeze it on a stored as-of anchor", () => {
  const query = filtersJsonToQuery(
    [savedRow({ kind: "lastTransactionDays", rawValue: "30", asOfDateRaw: "2026-07-26" })],
    false,
    null,
  )
  // The window still applies — it just travels with time, as a standing query must.
  assert.equal(query.lastTransactionDays, 30)
  assert.equal(query.asOfDate, undefined, "a pinned anchor would stop this user's alerts forever")
})

test("legacy hand-written {field,value} rows are still honoured, not silently ignored", () => {
  const query = filtersJsonToQuery(
    [
      { field: "position", value: "P" },
      { field: "experienceLevel", value: "MLB" },
    ],
    false,
    null,
  )
  assert.equal(query.position, "P")
  assert.equal(query.experienceLevel, "MLB")
})

test("junk rows are dropped without taking the rest of the filters with them", () => {
  const query = filtersJsonToQuery(
    [null, "nonsense", { unrelated: true }, savedRow({ kind: "position", rawValue: "SS" })],
    false,
    null,
  )
  assert.equal(query.position, "SS")
})

test("filtersJsonToQuery maps ranking preferences", () => {
  const query = filtersJsonToQuery([], false, {
    weights: {
      performance: 0.3,
      experience: 0.2,
      positionMatch: 0.15,
      availability: 0.15,
      recentTransactions: 0.2,
    },
    targetPosition: "Pitcher",
  })
  assert.equal(query.rankWPerf, 0.3)
  assert.equal(query.rankTargetPosition, "Pitcher")
})
