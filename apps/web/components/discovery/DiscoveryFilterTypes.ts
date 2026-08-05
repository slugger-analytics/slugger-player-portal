/**
 * Discovery filter row model + query helper shared by home (custom) and Preferences (profiles).
 */

import { EXPERIENCE_LEVEL_OPTIONS } from "@available-player-portal/shared"
import type { BatHand, ThrowHand, FilterKind, UiFilter } from "@available-player-portal/shared"

// FilterKind, UiFilter and filtersToQuery live in the shared package: a saved
// profile stores these rows verbatim and the API's alert matcher has to turn the
// same rows back into a query, so a second copy here is a copy that drifts.
export type { FilterKind, UiFilter } from "@available-player-portal/shared"
export { filtersToQuery } from "@available-player-portal/shared"

export function newId(): string {
  return globalThis.crypto.randomUUID()
}

export function defaultUiFilterForPreset(preset: FilterKind): UiFilter {
  const id = newId()
  switch (preset) {
    case "position":
      return { id, kind: "position", label: "Position: Select", rawValue: "" }
    case "age":
      return { id, kind: "age", label: "Age: Less than 25", ageMode: "lt", ageValue: 25 }
    case "team":
      return { id, kind: "team", label: "Team: —", rawValue: "" }
    case "status":
      return { id, kind: "status", label: "Status: available", rawValue: "available" }
    case "experienceLevel":
      return {
        id,
        kind: "experienceLevel",
        label: "Experience level: Select range",
        rawValue: "",
      }
    case "experienceLevelMin":
      return { id, kind: "experienceLevelMin", label: "Min experience level: Select", rawValue: "" }
    case "lastTransactionDays":
      return {
        id,
        kind: "lastTransactionDays",
        label: "Last X days: Select",
        rawValue: "",
      }
    case "handedness":
      return {
        id,
        kind: "handedness",
        label: "Handedness: Any",
      }
  }
}

export const ADD_PREFERENCE_OPTIONS: { kind: FilterKind; label: string }[] = [
  { kind: "position", label: "Position" },
  { kind: "age", label: "Age" },
  { kind: "team", label: "Team" },
  { kind: "status", label: "Status" },
  { kind: "experienceLevel", label: "Experience level" },
  { kind: "lastTransactionDays", label: "Last X days" },
  { kind: "handedness", label: "Handedness" },
]

export const POSITION_FILTER_OPTIONS = [
  "P",
  "Non-P",
  "C",
  "1B",
  "2B",
  "3B",
  "SS",
  "OF",
  "LF",
  "CF",
  "RF",
  "IF",
  "2B-SS",
  "1B-3B",
  "DH",
] as const

/**
 * Experience-level range direction. The UiFilter only ever stores `experienceLevelMinRaw` /
 * `experienceLevelMaxRaw` (backward compatible); the direction is derived from which of those
 * are present, so saved profiles always round-trip without a new field.
 */
export type ExperienceLevelDirection = "atLeast" | "atMost" | "between" | "exactly"

export const EXPERIENCE_LEVEL_DIRECTION_OPTIONS: { value: ExperienceLevelDirection; label: string }[] = [
  { value: "atLeast", label: "At least (level+)" },
  { value: "atMost", label: "At most (up to level)" },
  { value: "between", label: "Between" },
  { value: "exactly", label: "Exactly" },
]

/** Derive the direction selector from stored raw min/max (backward compatible with saved profiles). */
export function experienceLevelDirectionFromRaw(minRaw?: string, maxRaw?: string): ExperienceLevelDirection {
  const min = (minRaw ?? "").trim()
  const max = (maxRaw ?? "").trim()
  if (min && max) return min === max ? "exactly" : "between"
  if (max) return "atMost"
  return "atLeast"
}

/** Reconcile the stored min/max values when the user switches direction (keeps a sensible carry-over). */
export function reconcileExperienceLevelForDirection(
  direction: ExperienceLevelDirection,
  minRaw?: string,
  maxRaw?: string,
): { min: string; max: string } {
  const min = (minRaw ?? "").trim()
  const max = (maxRaw ?? "").trim()
  const primary = min || max
  switch (direction) {
    case "atLeast":
      return { min: primary, max: "" }
    case "atMost":
      return { min: "", max: max || min }
    case "exactly":
      return { min: primary, max: primary }
    case "between":
      return { min, max }
  }
}

/** Human label for a stored experience-level range: `AAA+`, `Up to AAA`, `A to AAA`, or `Exactly AAA`. */
export function experienceLevelRangeLabel(minRaw?: string, maxRaw?: string): string {
  const min = (minRaw ?? "").trim()
  const max = (maxRaw ?? "").trim()
  if (!min && !max) return "Select range"
  const labelOf = (code: string) => EXPERIENCE_LEVEL_OPTIONS.find((o) => o.code === code)?.label ?? code
  switch (experienceLevelDirectionFromRaw(min, max)) {
    case "atLeast":
      return `${labelOf(min)}+`
    case "atMost":
      return `Up to ${labelOf(max)}`
    case "exactly":
      return `Exactly ${labelOf(min)}`
    case "between":
      return `${labelOf(min)} to ${labelOf(max)}`
  }
}

