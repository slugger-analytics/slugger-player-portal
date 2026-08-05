/**
 * Discovery filter rows and the one conversion from a saved row to API query params.
 *
 * **Single source of truth:** the web persists {@link UiFilter} rows verbatim into a saved
 * profile (`POST /notifications/profiles` stores `req.body.filters` as JSON), and the alert
 * matcher later has to turn those same rows back into the query it evaluates. Those two sides
 * had drifted: the matcher read a `{field, value}` shape the web has never produced, so every
 * saved filter was silently skipped and each alert query collapsed to "every discovery-eligible
 * player" — 3657 of them against live data, where the filters the user actually saved returned 8.
 *
 * Both sides now call {@link filtersToQuery} from here so a new filter kind cannot reach the UI
 * without also reaching alerts.
 */

import type { BatHand, ThrowHand } from "./handedness"

export type FilterKind =
  | "position"
  | "age"
  | "team"
  | "status"
  | "experienceLevel"
  /** Backward compatibility for older saved profiles; new UI uses a single range row. */
  | "experienceLevelMin"
  | "lastTransactionDays"
  | "handedness"

export type UiFilter = {
  id: string
  kind: FilterKind
  label: string
  rawValue?: string
  ageMode?: "lt" | "gt"
  ageValue?: number
  /** For `experienceLevel` range row. */
  experienceLevelMinRaw?: string
  experienceLevelMaxRaw?: string
  /**
   * When {@link FilterKind} is `handedness`: set one or both. Omitted side means “any”
   * (no filter on that column).
   */
  bats?: BatHand
  throws?: ThrowHand
  /** ISO YYYY-MM-DD anchor for the lastTransactionDays window (TBC “Transaction Date”). Blank/absent = today. */
  asOfDateRaw?: string
}

export type DiscoveryQuery = Record<string, string | number | boolean | undefined>

export function filtersToQuery(filters: UiFilter[]): DiscoveryQuery {
  const q: DiscoveryQuery = {}
  for (const f of filters) {
    if (f.kind === "position" && f.rawValue) q.position = f.rawValue
    if (f.kind === "team" && f.rawValue) q.team = f.rawValue
    if (f.kind === "status" && f.rawValue) q.status = f.rawValue
    if (f.kind === "age" && f.ageMode && f.ageValue != null) {
      if (f.ageMode === "lt") q.ageMax = f.ageValue
      if (f.ageMode === "gt") q.ageMin = f.ageValue
    }
    if (f.kind === "experienceLevel") {
      const max = f.experienceLevelMaxRaw ?? f.rawValue
      const min = f.experienceLevelMinRaw
      if (max) q.experienceLevel = max
      if (min) q.experienceLevelMin = min
    }
    if (f.kind === "experienceLevelMin" && f.rawValue) q.experienceLevelMin = f.rawValue
    if (f.kind === "lastTransactionDays" && f.rawValue) {
      const n = Number(f.rawValue)
      if (Number.isInteger(n)) {
        q.lastTransactionDays = n
        // Nested inside the days guard: the API rejects an anchor without a window.
        const asOf = (f.asOfDateRaw ?? "").trim()
        if (/^\d{4}-\d{2}-\d{2}$/.test(asOf)) q.asOfDate = asOf
      }
    }
    if (f.kind === "handedness") {
      if (f.bats != null) q.bats = f.bats
      if (f.throws != null) q.throws = f.throws
    }
  }
  return q
}

/**
 * Coerce whatever a saved profile holds into {@link UiFilter} rows.
 *
 * Rows are stored as opaque JSON, so this is the boundary where they are validated. It also
 * accepts the legacy `{field, value}` pairs the alert matcher used to be written against: no
 * shipped client has ever produced one, but a hand-made row must not silently become "match
 * every player".
 */
export function parseStoredFilters(filters: unknown): UiFilter[] {
  if (!Array.isArray(filters)) return []
  const out: UiFilter[] = []
  for (const item of filters) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    if (typeof row.kind === "string") {
      out.push(row as unknown as UiFilter)
      continue
    }
    const field = typeof row.field === "string" ? row.field : ""
    const value = row.value
    if (!field || value == null || value === "") continue
    out.push(legacyPairToUiFilter(field, value))
  }
  return out
}

function legacyPairToUiFilter(field: string, value: unknown): UiFilter {
  const raw = String(value)
  const base = { id: `legacy:${field}`, label: `${field}: ${raw}` }
  switch (field) {
    case "ageMin":
      return { ...base, kind: "age", ageMode: "gt", ageValue: Number(raw) }
    case "ageMax":
      return { ...base, kind: "age", ageMode: "lt", ageValue: Number(raw) }
    case "experienceLevel":
      return { ...base, kind: "experienceLevel", experienceLevelMaxRaw: raw }
    case "bats":
      return { ...base, kind: "handedness", bats: raw as BatHand }
    case "throws":
      return { ...base, kind: "handedness", throws: raw as ThrowHand }
    default:
      return { ...base, kind: field as FilterKind, rawValue: raw }
  }
}
