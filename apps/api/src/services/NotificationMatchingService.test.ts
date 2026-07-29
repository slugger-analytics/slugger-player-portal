import assert from "node:assert/strict"
import test from "node:test"
import { filtersJsonToQuery } from "./NotificationMatchingService"

test("filtersJsonToQuery maps basic filters and flags", () => {
  const query = filtersJsonToQuery(
    [
      { field: "position", value: "P" },
      { field: "status", value: "available" },
    ],
    true,
    null,
  )
  assert.equal(query.position, "P")
  assert.equal(query.status, "available")
  assert.equal(query.hasStats, true)
  assert.equal(query.sortBy, "recentProfileTransaction")
  assert.equal(query.sortDir, "desc")
})

test("filtersJsonToQuery passes experience-level min and max through so level saved searches are honored", () => {
  const query = filtersJsonToQuery(
    [
      { field: "experienceLevelMin", value: "AAA" },
      { field: "experienceLevel", value: "MLB" },
    ],
    false,
    null,
  )
  assert.equal(query.experienceLevelMin, "AAA")
  assert.equal(query.experienceLevel, "MLB")
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
