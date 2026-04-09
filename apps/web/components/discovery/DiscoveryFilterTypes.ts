/**
 * Discovery filter row model + query helper shared by home (custom) and Preferences (profiles).
 */

export type FilterKind = "position" | "age" | "team" | "status"

export type UiFilter = {
  id: string
  kind: FilterKind
  label: string
  rawValue?: string
  ageMode?: "lt" | "gt"
  ageValue?: number
}

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
  }
}

export const ADD_PREFERENCE_OPTIONS: { kind: FilterKind; label: string }[] = [
  { kind: "position", label: "Position" },
  { kind: "age", label: "Age" },
  { kind: "team", label: "Team" },
  { kind: "status", label: "Status" },
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

export function filtersToQuery(filters: UiFilter[]): Record<string, string | number | boolean | undefined> {
  const q: Record<string, string | number | boolean | undefined> = {}
  for (const f of filters) {
    if (f.kind === "position" && f.rawValue) q.position = f.rawValue
    if (f.kind === "team" && f.rawValue) q.team = f.rawValue
    if (f.kind === "status" && f.rawValue) q.status = f.rawValue
    if (f.kind === "age" && f.ageMode && f.ageValue != null) {
      if (f.ageMode === "lt") q.ageMax = f.ageValue
      if (f.ageMode === "gt") q.ageMin = f.ageValue
    }
  }
  return q
}
