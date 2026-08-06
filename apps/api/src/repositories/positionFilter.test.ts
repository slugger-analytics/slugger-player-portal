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

/**
 * Every distinct position stored in production: all 82 of them, read off all 3657 players
 * via the live API on 2026-08-06 (`?limit=100&offset=…`).
 *
 * The two largest are full words — `Pitcher` (2143) and `Catcher` (270) — and a bare `C`
 * appears nowhere, which is why the dropdown's `C` option needs a named spelling and not
 * just an anchor. The feed is also inconsistent about case (`cf-lf`, `ss`, `1b`) and carries
 * a little junk (`H`, `R`), so matching stays case-insensitive and nothing may assume the
 * value is a position at all.
 */
const STORED_POSITIONS = [
  "Pitcher", "Catcher", "OF", "SS", "1B", "RF-LF", "2B", "LF-RF", "3B", "CF-RF",
  "3B-2B", "C-1B", "2B-3B", "CF-LF", "IF", "2B-SS", "CF", "3B-1B", "RF", "SS-2B",
  "SS-3B", "RF-CF", "LF", "LF-CF", "1B-3B", "3B-SS", "1B-LF", "1B-RF", "1B-C",
  "2B-LF", "1B-DH", "RF-1B", "2B-RF", "3B-DH", "LF-1B", "1B-2B", "CF-2B", "LF-2B",
  "RF-DH", "2B-1B", "DH", "LF-DH", "LF-3B", "IF-OF", "3B-LF", "SS-LF", "RF-2B",
  "DH-C", "CF-SS", "OF-IF", "SS-CF", "2B-CF", "C-RF", "cf-lf", "CF-1B", "c-lf",
  "2B-DH", "3B-C", "1B-CF", "LF-C", "H", "3B-RF", "rf", "C-OF", "OF-P", "R",
  "3B-CF", "IF-P", "C-P", "IF-C", "RF-3B", "ss", "C-DH", "DH-1B", "1B-SS", "1B-P",
  "C-2B", "C-LF", "1b", "DH-LF", "DH-RF", "LF-SS",
] as const

/** Independent reading of "this stored value plays position X" — split on the delimiter. */
function storedHasToken(stored: string, token: string): boolean {
  return stored.toLowerCase().split("-").includes(token.toLowerCase())
}

/** Every option the production dropdown offers (apps/web POSITION_FILTER_OPTIONS). */
const DROPDOWN_OPTIONS = [
  "P", "Non-P", "C", "1B", "2B", "3B", "SS", "OF", "LF", "CF", "RF", "IF",
  "2B-SS", "1B-3B", "DH",
] as const

test("the C option finds catchers, and only catchers", () => {
  // Was: 2653 of 3657 players, 79 of the first 100 of them pitchers, because the
  // single-token branch was a bare substring and "Pitcher" contains a "c".
  const matched = STORED_POSITIONS.filter((s) => matchesAll("C", s))
  const catchers = STORED_POSITIONS.filter(
    (s) => s.toLowerCase() === "catcher" || storedHasToken(s, "C"),
  )

  assert.deepStrictEqual(matched, catchers)
  assert.ok(matched.includes("Catcher"), "the feed spells the position 'Catcher'")
  assert.ok(matched.includes("C-1B") && matched.includes("1B-C"), "compound C records count")
  assert.ok(!matched.includes("Pitcher"), "'Pitcher' merely contains a c")
  assert.ok(!matched.includes("CF") && !matched.includes("CF-LF"), "CF is not C")
  // Live after the fix: 336 = 270 'Catcher' + 66 hyphenated C records.
})

test("a single-token option matches exactly the rows that play it", () => {
  // Property, not a restatement of the clause: a matched row must carry the
  // requested position as a whole delimiter-separated token, or be its full-word
  // spelling. Runs over the entire stored vocabulary.
  const spellings: Record<string, string> = { C: "catcher" }
  for (const option of DROPDOWN_OPTIONS) {
    if (option === "P" || option === "Non-P" || option.includes("-")) continue
    for (const stored of STORED_POSITIONS) {
      const spelled: string | undefined = spellings[option]
      const shouldMatch: boolean =
        storedHasToken(stored, option) || stored.toLowerCase() === spelled
      assert.equal(
        matchesAll(option, stored),
        shouldMatch,
        `${option} vs ${stored}`,
      )
    }
  }
})

test("compound options match either spelling and nothing else", () => {
  for (const option of ["2B-SS", "1B-3B"]) {
    const tokens = option.split("-")
    for (const stored of STORED_POSITIONS) {
      assert.equal(
        matchesAll(option, stored),
        tokens.every((t) => storedHasToken(stored, t)),
        `${option} vs ${stored}`,
      )
    }
  }
  assert.deepStrictEqual(
    STORED_POSITIONS.filter((s) => matchesAll("2B-SS", s)),
    ["2B-SS", "SS-2B"],
  )
})

test("Non-P is everyone the P option does not claim", () => {
  const pitchers = STORED_POSITIONS.filter((s) => matchesAll("P", s))
  const nonPitchers = STORED_POSITIONS.filter((s) => matchesAll("Non-P", s))

  assert.deepStrictEqual(nonPitchers, STORED_POSITIONS.filter((s) => !pitchers.includes(s)))
  assert.ok(nonPitchers.includes("Catcher"))
})

test("single tokens are anchored the same way compound tokens are", () => {
  assert.deepStrictEqual(buildPositionWhereClauses("2B"), [
    {
      OR: [
        { position: { equals: "2B", mode: "insensitive" } },
        { position: { startsWith: "2B-", mode: "insensitive" } },
        { position: { endsWith: "-2B", mode: "insensitive" } },
        { position: { contains: "-2B-", mode: "insensitive" } },
      ],
    },
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

test("every emitted clause is a value Postgres will accept", () => {
  // A sentinel written as a literal NUL shipped a 500: Postgres rejects 0x00 in a
  // string with `invalid byte sequence for encoding "UTF8"`, so the "match nothing"
  // clause failed the query instead of returning no rows.
  const values = (clause: unknown): string[] => {
    if (Array.isArray(clause)) return clause.flatMap(values)
    if (clause == null || typeof clause !== "object") {
      return typeof clause === "string" ? [clause] : []
    }
    return Object.values(clause as Record<string, unknown>).flatMap(values)
  }
  for (const requested of ["%", "_", "2B", "2B-SS", "Non-P", "P"]) {
    for (const v of values(buildPositionWhereClauses(requested))) {
      assert.ok(
        !/[\u0000-\u001f]/.test(v),
        `${requested} emitted a control character: ${JSON.stringify(v)}`,
      )
    }
  }
})

test("a wildcard request is empty, not an error, and real positions still work", () => {
  assert.equal(buildPositionWhereClauses("%").length, 1)
  assert.deepStrictEqual(STORED_POSITIONS.filter((s) => matchesAll("%", s)), [])
  assert.ok(STORED_POSITIONS.filter((s) => matchesAll("2B", s)).length > 5)
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
