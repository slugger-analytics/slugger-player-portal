/**
 * Baseball **highest level** ladder (Rookie → … → MLB). Parsed from TBC’s `highlevel` column and stored
 * in PostgreSQL as `experience_level` (Prisma field `experienceLevel`). Discovery filters match that value.
 *
 * Helpers for other code paths: {@link experienceLevelsAtOrAbove}, {@link experienceLevelsAtOrBelow} (not used for list filters).
 *
 * UI labels match common feed tokens (Rookie, A, A+, AA, AAA, MLB).
 */
export const EXPERIENCE_LEVEL_OPTIONS = [
  { code: "ROOKIE", label: "Rookie" },
  { code: "A", label: "A" },
  { code: "A_PLUS", label: "A+" },
  { code: "AA", label: "AA" },
  { code: "AAA", label: "AAA" },
  { code: "MLB", label: "MLB" },
] as const

export type ExperienceLevelCode = (typeof EXPERIENCE_LEVEL_OPTIONS)[number]["code"]

const ORDER: ExperienceLevelCode[] = EXPERIENCE_LEVEL_OPTIONS.map((o) => o.code)

export function experienceLevelRank(code: string | null | undefined): number {
  if (code == null || code === "") return -1
  const i = ORDER.indexOf(code as ExperienceLevelCode)
  return i >= 0 ? i : -1
}

/** Level codes at or below `maxCode` (inclusive), for `WHERE experience_level IN (...)`. */
export function experienceLevelsAtOrBelow(maxCode: string): ExperienceLevelCode[] {
  const maxR = experienceLevelRank(maxCode)
  if (maxR < 0) return []
  return ORDER.filter((_, i) => i <= maxR)
}

/** Level codes at or above `minCode` (inclusive), for highest-level / “highlevel” preference filters. */
export function experienceLevelsAtOrAbove(minCode: string): ExperienceLevelCode[] {
  const minR = experienceLevelRank(minCode)
  if (minR < 0) return []
  return ORDER.filter((_, i) => i >= minR)
}

export function isExperienceLevelCode(s: string): s is ExperienceLevelCode {
  return ORDER.includes(s as ExperienceLevelCode)
}

/** Normalizes `GET` query values (spaces, `A+` vs `A_PLUS`, etc.). */
export function normalizeExperienceLevelQueryParam(raw: string): string {
  let t = raw.trim().replace(/\s+/g, "_").toUpperCase()
  if (t === "A+" || t === "APLUS") return "A_PLUS"
  return t
}

/** UI label for a stored enum code — uses {@link EXPERIENCE_LEVEL_OPTIONS} (feed-style text). */
export function experienceLevelDisplayLabel(code: string | null | undefined): string {
  if (code == null || code === "") return "—"
  const opt = EXPERIENCE_LEVEL_OPTIONS.find((o) => o.code === code)
  return opt?.label ?? code
}

/**
 * Reads the TBC **transaction** feed column `highlevel` (and aliases) after headers are camelCased.
 * Schema example: `...,age,highlevel,playerid` with values like `MLB`, `AA`, `A+`, `Rk`.
 */
export function extractHighLevelRawCell(raw: Record<string, unknown>): string {
  const g = (k: string) => String(raw[k] ?? "").trim()
  const direct =
    g("highlevel") ||
    g("highLevel") ||
    g("high_level") ||
    g("experienceLevel") ||
    g("highestLevel") ||
    g("highestlevel") ||
    g("maxLevel") ||
    g("maxlevel") ||
    g("orgLevel") ||
    g("orglevel")
  if (direct) return direct
  for (const key of Object.keys(raw)) {
    const compact = key.toLowerCase().replace(/_/g, "")
    if (compact === "highlevel" || compact === "maxlevel" || compact === "orglevel") {
      const v = g(key)
      if (v) return v
    }
  }
  return ""
}

export function parseExperienceLevelFromText(raw: string): ExperienceLevelCode | undefined {
  let s = raw.trim()
  if (!s) return undefined
  // Fullwidth plus (common in exports) so "A＋" maps like "A+"
  s = s.replace(/\uFF0B/g, "+").replace(/＋/g, "+")
  const compact = s.toUpperCase().replace(/\s+/g, "_")
  if (isExperienceLevelCode(compact)) return compact

  // TBC / feed "highlevel" columns often use short tokens (not full words).
  const token = s.replace(/[^a-zA-Z0-9+]/g, "")
  const U = token.toUpperCase()
  if (U === "RK" || U === "RKT" || U === "COMPLEX") return "ROOKIE"
  if (U === "HIA" || U === "A+" || U === "APLUS" || U === "HIGHA") return "A_PLUS"
  if (U === "AA") return "AA"
  if (U === "AAA") return "AAA"
  if (U === "A" && token.length <= 2) return "A"
  if (U === "MLB") return "MLB"

  const low = s.toLowerCase()
  if (/\b(mlb|major\b|majors|big\s*league)\b/.test(low)) return "MLB"
  if (/\b(triple[\s-]?a|aaa)\b/i.test(low)) return "AAA"
  if (/\b(double[\s-]?a|\baa\b)\b/i.test(low) || /^aa$/i.test(s.trim())) return "AA"
  if (/\b(high[\s-]?a|a\s*[+＋]|a-plus)\b/i.test(low)) return "A_PLUS"
  if (/\b(class[\s-]?a|single[\s-]?a|low[\s-]?a)\b/.test(low)) return "A"
  if (/^a$/i.test(s.trim())) return "A"
  if (/\b(rookie|complex|dsl|azl)\b/.test(low)) return "ROOKIE"
  return undefined
}

/** Resolves API query / UI values (codes, `A+`, `Triple-A`, etc.) to a canonical level code. */
export function parseExperienceLevelFilterInput(raw: string): ExperienceLevelCode | undefined {
  const normalized = normalizeExperienceLevelQueryParam(raw)
  if (isExperienceLevelCode(normalized)) return normalized
  return parseExperienceLevelFromText(raw)
}

/** When merging feeds, keep the higher rung on the ladder. */
export function mergeExperienceLevels(
  a: string | null | undefined,
  b: string | null | undefined,
): string | undefined {
  const ra = experienceLevelRank(a ?? undefined)
  const rb = experienceLevelRank(b ?? undefined)
  if (rb > ra) return b ?? undefined
  if (ra > rb) return a ?? undefined
  return (a ?? b) || undefined
}
