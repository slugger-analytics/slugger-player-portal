/**
 * @file positionFilter.ts
 * @description Position clause builder for discovery, extracted from {@link PlayerRepository} so
 * the matching rules are unit-testable without a database.
 *
 * Every token — single or compound — is delimiter-anchored (`equals` / `<tok>-` / `-<tok>` /
 * `-<tok>-`), so a `2B` request still matches `SS-2B`, `1B-2B`, `2B-LF` the way TBC does, while a
 * `C` request cannot leak into `CF-LF` or `Pitcher`. **Compound** input (`2B-SS`) is matched
 * token-by-token so it is order-insensitive: the feed stores `2B-SS` and `SS-2B` both ways, and
 * requesting one used to silently drop every row spelled the other way.
 *
 * A few positions are stored as full words rather than the abbreviation the UI ships; those are
 * listed in {@link POSITION_SPELLINGS}.
 */

import { Prisma } from "@prisma/client"

/**
 * Prisma passes `contains`/`startsWith`/`endsWith` values into a SQL `LIKE` pattern without
 * escaping the pattern metacharacters inside them, so `?position=%` and `?position=_` each
 * matched **every player in the league** (3657 of 3657, measured live) instead of returning
 * nothing. Real stored positions are letters, digits and hyphens only (`2B`, `SS-2B`, `Catcher`),
 * so anything else is a malformed request, not a position.
 */
const POSITION_TOKEN = /^[A-Za-z0-9]+$/

/** Matches no row, for a request that cannot name a real position. */
const NO_SUCH_POSITION = "__no_such_position__"
const MATCHES_NOTHING: Prisma.PlayerWhereInput = { position: { equals: NO_SUCH_POSITION } }

const PITCHER_MATCH: Prisma.PlayerWhereInput[] = [
  { position: { contains: "Pitch", mode: "insensitive" } },
  { position: { equals: "p", mode: "insensitive" } },
  { position: { startsWith: "p-", mode: "insensitive" } },
]

/**
 * Full-word spellings the feed uses for a position the UI ships as an abbreviation.
 *
 * Measured across every distinct stored value in production (19 of them): catchers are stored as
 * the word **`Catcher`** — a bare `C` appears nowhere — while `Pitcher`, 2925 rows, merely
 * *contains* a "c". Under the old bare-substring match, the dropdown's `C` option therefore
 * returned **2653 of 3657 players**, 79 of the first 100 of them pitchers. Anchoring alone would
 * have swung it the other way and matched no catchers at all, so the spelling has to be named.
 *
 * `P` / `Non-P` are handled by {@link PITCHER_MATCH} before tokenising.
 */
const POSITION_SPELLINGS: Record<string, readonly string[]> = {
  c: ["Catcher"],
}

/** The delimiter-anchored alternatives for one token of a stored position (`SS-2B`, `2B`, …). */
function tokenAlternatives(tok: string): Prisma.PlayerWhereInput[] {
  return [
    { position: { equals: tok, mode: "insensitive" } },
    { position: { startsWith: `${tok}-`, mode: "insensitive" } },
    { position: { endsWith: `-${tok}`, mode: "insensitive" } },
    { position: { contains: `-${tok}-`, mode: "insensitive" } },
  ]
}

/** Whole-token match against a hyphen-delimited stored position (`SS-2B`, `2B`, `CF-2B`, …). */
function tokenClause(tok: string): Prisma.PlayerWhereInput {
  const spellings = POSITION_SPELLINGS[tok.toLowerCase()] ?? []
  return {
    OR: [
      ...tokenAlternatives(tok),
      ...spellings.map((word) => ({
        position: { equals: word, mode: "insensitive" as const },
      })),
    ],
  }
}

/**
 * Flat `AND` clauses for the requested position (one per token), never a single wrapped `AND`
 * object — {@link PlayerRepository.collectDiscoveryWhereClauses} needs them flat so `OR`/`NOT`
 * never nest beside `experienceLevel`.
 */
export function buildPositionWhereClauses(rawInput: string): Prisma.PlayerWhereInput[] {
  const raw = rawInput.trim()
  if (!raw) return []
  const fp = raw.toLowerCase()
  // `non-p` contains a hyphen, so it must be claimed before the compound branch.
  if (fp === "non-p") return [{ NOT: { OR: PITCHER_MATCH } }]
  if (fp === "p" || fp.includes("pitch")) return [{ OR: PITCHER_MATCH }]
  const tokens = [...new Set(raw.split("-").map((t) => t.trim()).filter(Boolean))]
  if (!tokens.every((t) => POSITION_TOKEN.test(t))) return [MATCHES_NOTHING]
  return tokens.map(tokenClause)
}
