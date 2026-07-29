import assert from "node:assert/strict"
import test from "node:test"
import {
  isTransactionShownOnPlayerProfile,
  PROFILE_VISIBLE_TRANSACTION_TYPE_RULES,
} from "@available-player-portal/shared"
import { profileVisibleTransactionTypeSql } from "./profileVisibleTransactionSql"

/** Emulates the generated SQL predicate in JS using the same shared rules + normalization. */
function sqlPredicateMatches(type: string): boolean {
  const norm = type.trim().toLowerCase().replace(/\s+/g, " ")
  const rules = Object.values(PROFILE_VISIBLE_TRANSACTION_TYPE_RULES).flat()
  return rules.some((r) => (r.kind === "exact" ? norm === r.value : norm.startsWith(r.value)))
}

const OBSERVED_TYPES: Array<[string, boolean]> = [
  ["Released", true],
  ["Free Agent", true],
  ["Retired", true],
  ["Free Agent (minors)", true],
  ["Free Agency (granted)", true],
  ["Released by Braves", true],
  ["Retired (voluntary)", true],
  ["  Free   Agent  ", true],
  ["Signed", false],
  ["DFA", false],
  ["Traded", false],
]

test("TS predicate and generated-SQL predicate cover the same set of observed feed types", () => {
  for (const [type, expected] of OBSERVED_TYPES) {
    assert.equal(isTransactionShownOnPlayerProfile(type), expected, `TS predicate for ${JSON.stringify(type)}`)
    assert.equal(sqlPredicateMatches(type), expected, `SQL predicate for ${JSON.stringify(type)}`)
  }
})

test("free agent suffix variants are now covered by both predicates", () => {
  assert.equal(isTransactionShownOnPlayerProfile("Free Agent (minors)"), true)
  assert.equal(sqlPredicateMatches("Free Agent (minors)"), true)
})

test("generated SQL is built structurally from the shared rules (IN list + LIKE prefixes, whitespace-class normalization)", () => {
  const built = profileVisibleTransactionTypeSql()
  const rules = Object.values(PROFILE_VISIBLE_TRANSACTION_TYPE_RULES).flat()
  const exacts = rules.flatMap((r) => (r.kind === "exact" ? [r.value] : []))
  const prefixes = rules.flatMap((r) => (r.kind === "prefix" ? [r.value] : []))
  assert.deepEqual(built.values, [...exacts, ...prefixes.map((p) => `${p}%`)])
  // Whitespace class \s+ (authored as \\s), mirroring the TS /\s+/ normalization — not a literal 's+'.
  assert.ok(
    built.sql.includes("regexp_replace(lower(trim(both from t.type)), '\\s+', ' ', 'g')"),
    built.sql,
  )
  assert.ok(built.values.includes("free agent %"), "new free-agent suffix coverage present")
})
