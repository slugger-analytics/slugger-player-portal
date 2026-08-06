import assert from "node:assert/strict"
import test from "node:test"
import type { Prisma } from "@prisma/client"
import { buildPositionWhereClauses } from "./positionFilter"

/**
 * Evaluates a SQL `LIKE` pattern, which is what Prisma turns `contains` / `startsWith` /
 * `endsWith` into — `%` matches any run of characters and `_` matches exactly one.
 *
 * Modelling these as JavaScript `String.includes` is why the wildcard leak below went
 * unnoticed: `"Pitcher".includes("%")` is false, but `'Pitcher' LIKE '%%%'` is true.
 */
function likeMatches(pattern: string, value: string): boolean {
  const rx = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/%/g, ".*")
    .replace(/_/g, ".")
  return new RegExp(`^${rx}$`).test(value)
}

/** Interprets the clauses this module emits against a plain stored row, so the tests assert meaning. */
function matchesPosition(clause: Prisma.PlayerWhereInput, stored: string): boolean {
  const c = clause as Record<string, unknown>
  if (Array.isArray(c.AND)) return (c.AND as Prisma.PlayerWhereInput[]).every((x) => matchesPosition(x, stored))
  if (Array.isArray(c.OR)) return (c.OR as Prisma.PlayerWhereInput[]).some((x) => matchesPosition(x, stored))
  if (c.NOT != null) return !matchesPosition(c.NOT as Prisma.PlayerWhereInput, stored)
  const pos = c.position as Record<string, string> | undefined
  if (pos == null) throw new Error(`unsupported clause: ${JSON.stringify(clause)}`)
  const s = pos.mode === "insensitive" ? stored.toLowerCase() : stored
  const v = pos.mode === "insensitive" ? String(pos.equals ?? pos.contains ?? pos.startsWith ?? pos.endsWith).toLowerCase() : ""
  if (pos.equals != null) return s === v
  if (pos.contains != null) return likeMatches(`%${v}%`, s)
  if (pos.startsWith != null) return likeMatches(`${v}%`, s)
  if (pos.endsWith != null) return likeMatches(`%${v}`, s)
  throw new Error(`unsupported position operator: ${JSON.stringify(pos)}`)
}

function matchesAll(requested: string, stored: string): boolean {
  const clauses = buildPositionWhereClauses(requested)
  return clauses.every((c) => matchesPosition(c, stored))
}

const sortClauses = (cs: Prisma.PlayerWhereInput[]) => [...cs].map((c) => JSON.stringify(c)).sort()

test("compound position matching is order-insensitive", () => {
  assert.deepStrictEqual(
    sortClauses(buildPositionWhereClauses("2B-SS")),
    sortClauses(buildPositionWhereClauses("SS-2B")),
  )
  assert.deepStrictEqual(
    sortClauses(buildPositionWhereClauses("1B-3B")),
    sortClauses(buildPositionWhereClauses("3B-1B")),
  )
})

test("single-token positions keep the legacy contains clause byte-for-byte", () => {
  assert.deepStrictEqual(buildPositionWhereClauses("2B"), [
    { position: { contains: "2B", mode: "insensitive" } },
  ])
  // Pinned deliberately: `C` still matches `CF` / `Catcher`; “improving” that is a behaviour change.
  assert.deepStrictEqual(buildPositionWhereClauses("C"), [
    { position: { contains: "C", mode: "insensitive" } },
  ])
})

test("pitcher branches are unchanged and still claim the hyphen in Non-P", () => {
  const nonP = buildPositionWhereClauses("Non-P")
  assert.equal(nonP.length, 1)
  assert.ok((nonP[0] as Record<string, unknown>).NOT != null, "Non-P stays a single NOT clause")
  assert.equal(buildPositionWhereClauses("P").length, 1)
  assert.deepStrictEqual(buildPositionWhereClauses("P"), buildPositionWhereClauses("Pitcher"))
})

test("compound clauses stay flat (no nested AND beside experienceLevel)", () => {
  const clauses = buildPositionWhereClauses("2B-SS")
  assert.equal(clauses.length, 2)
  for (const c of clauses) {
    assert.equal((c as Record<string, unknown>).AND, undefined)
  }
})

test("LIKE wildcards in the query cannot widen the filter", () => {
  // Measured live before the fix: `?position=%` and `?position=_` each returned all
  // 3657 players. Prisma does not escape pattern metacharacters inside a `contains`.
  const stored = ["2B", "SS-2B", "Catcher", "Pitcher", "CF-LF"]
  for (const bogus of ["%", "_", "%B", "2_", "a%b", "%-SS"]) {
    const matched = stored.filter((s) => matchesAll(bogus, s))
    assert.deepStrictEqual(matched, [], `${bogus} matched ${matched.join(", ")}`)
  }
})

test("a wildcard request is empty, not an error, and real positions still work", () => {
  assert.equal(buildPositionWhereClauses("%").length, 1)
  assert.deepStrictEqual(buildPositionWhereClauses("2B"), [
    { position: { contains: "2B", mode: "insensitive" } },
  ])
  assert.equal(buildPositionWhereClauses("Non-P").length, 1)
})

test("token matching is delimiter-anchored against real stored position strings", () => {
  const stored = [
    "2B", "SS", "2B-SS", "SS-2B", "ss-2b", "2B-LF", "CF-2B", "3B-2B", "1B-2B", "2B-3B",
    "1B-3B", "3B-1B", "C-1B", "C-P", "CF-LF", "IF-OF", "Pitcher", "Catcher", "IF", "OF",
  ]
  const matched = (requested: string) => stored.filter((s) => matchesAll(requested, s))
  assert.deepStrictEqual(matched("2B-SS"), ["2B-SS", "SS-2B", "ss-2b"])
  assert.deepStrictEqual(matched("SS-2B"), matched("2B-SS"), "either spelling gives the same answer")
  assert.deepStrictEqual(matched("1B-3B"), ["1B-3B", "3B-1B"])
  assert.deepStrictEqual(matched("3B-1B"), matched("1B-3B"))
  // A `C-1B` request must not leak into the stored `CF-1B`-style rows via a bare substring.
  assert.equal(matchesAll("C-1B", "CF-LF"), false)
  assert.deepStrictEqual(matched("2B"), ["2B", "2B-SS", "SS-2B", "ss-2b", "2B-LF", "CF-2B", "3B-2B", "1B-2B", "2B-3B"])
})
