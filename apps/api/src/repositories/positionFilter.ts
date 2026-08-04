/**
 * @file positionFilter.ts
 * @description Position clause builder for discovery, extracted from {@link PlayerRepository} so
 * the matching rules are unit-testable without a database.
 *
 * **Single token** (`2B`, `SS`, `C`, …) keeps the legacy substring match, which is what makes a
 * `2B` request match `SS-2B`, `1B-2B`, `2B-LF` etc. exactly like TBC. **Compound** input
 * (`2B-SS`) is matched token-by-token so it is order-insensitive: `2B-SS` and `SS-2B` are stored
 * both ways in the feed, and requesting one used to silently drop every row spelled the other way.
 * Each token is delimiter-anchored (`equals` / `<tok>-` / `-<tok>` / `-<tok>-`) rather than a bare
 * substring, so a `C-1B` request cannot leak into the stored `CF-1B`.
 */

import { Prisma } from "@prisma/client"

const PITCHER_MATCH: Prisma.PlayerWhereInput[] = [
  { position: { contains: "Pitch", mode: "insensitive" } },
  { position: { equals: "p", mode: "insensitive" } },
  { position: { startsWith: "p-", mode: "insensitive" } },
]

/** Whole-token match against a hyphen-delimited stored position (`SS-2B`, `2B`, `CF-2B`, …). */
function tokenClause(tok: string): Prisma.PlayerWhereInput {
  return {
    OR: [
      { position: { equals: tok, mode: "insensitive" } },
      { position: { startsWith: `${tok}-`, mode: "insensitive" } },
      { position: { endsWith: `-${tok}`, mode: "insensitive" } },
      { position: { contains: `-${tok}-`, mode: "insensitive" } },
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
  if (tokens.length > 1) return tokens.map(tokenClause)
  return [{ position: { contains: raw, mode: "insensitive" } }]
}
