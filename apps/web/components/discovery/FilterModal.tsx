"use client"

import { useState } from "react"
import {
  ADD_PREFERENCE_OPTIONS,
  defaultUiFilterForPreset,
  newId,
  POSITION_FILTER_OPTIONS,
  type FilterKind,
  type UiFilter,
} from "@/components/discovery/DiscoveryFilterTypes"

export function FilterModal({
  state,
  onClose,
  onSave,
}: {
  state: { mode: "add"; presetKind?: FilterKind } | { mode: "edit"; filter: UiFilter }
  onClose: () => void
  onSave: (next: { filter: UiFilter }) => void
}) {
  const initial =
    state.mode === "edit" ? state.filter : defaultUiFilterForPreset(state.presetKind ?? "position")

  const [kind, setKind] = useState<FilterKind>(initial.kind)
  const [position, setPosition] = useState(initial.kind === "position" ? (initial.rawValue ?? "") : "")
  const [team, setTeam] = useState(initial.kind === "team" ? (initial.rawValue ?? "") : "")
  const [status, setStatus] = useState(initial.kind === "status" ? (initial.rawValue ?? "") : "")
  const [ageMode, setAgeMode] = useState<"lt" | "gt">(initial.kind === "age" ? (initial.ageMode ?? "lt") : "lt")
  const [ageValue, setAgeValue] = useState(
    initial.kind === "age" && initial.ageValue != null ? String(initial.ageValue) : "",
  )

  function buildFilter(): UiFilter {
    const id = state.mode === "edit" ? state.filter.id : newId()
    if (kind === "position") {
      const v = position.trim()
      if (!v) return { id, kind, label: "Position: Select", rawValue: "" }
      return { id, kind, label: `Position: ${v}`, rawValue: v }
    }
    if (kind === "team") {
      const v = team.trim() || "—"
      return { id, kind, label: `Team: ${v}`, rawValue: v }
    }
    if (kind === "status") {
      const s = status.trim()
      if (!s) return { id, kind, label: "Status: Select", rawValue: "" }
      return { id, kind, label: `Status: ${s}`, rawValue: s }
    }
    const trimmed = ageValue.trim()
    const n = Number(trimmed)
    if (!trimmed || !Number.isFinite(n)) {
      return { id, kind: "age", label: "Age: Select" }
    }
    return {
      id,
      kind: "age",
      label: ageMode === "lt" ? `Age: Less than ${n}` : `Age: Greater than ${n}`,
      ageMode,
      ageValue: n,
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="filter-modal-title"
    >
      <div className="w-full max-w-md rounded-portal border border-portal-filter-border bg-portal-surface p-5 shadow-portal">
        <h2 id="filter-modal-title" className="text-lg font-bold text-black dark:text-neutral-100">
          {state.mode === "edit" ? "Edit preference" : "Add preference"}
        </h2>
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Type
            <select
              className="mt-1.5 w-full rounded-portal-sm border border-neutral-300 bg-portal-surface px-3 py-2.5 text-sm shadow-sm focus:border-portal-accent focus:outline-none focus:ring-2 focus:ring-portal-accent/25 dark:border-neutral-600"
              value={kind}
              onChange={(e) => setKind(e.target.value as FilterKind)}
            >
              {ADD_PREFERENCE_OPTIONS.map(({ kind: k, label }) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          {kind === "position" ? (
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Position
              <select
                className="mt-1.5 w-full rounded-portal-sm border border-neutral-300 bg-portal-surface px-3 py-2.5 text-sm shadow-sm focus:border-portal-accent focus:outline-none focus:ring-2 focus:ring-portal-accent/25 dark:border-neutral-600"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              >
                <option value="" disabled hidden>
                  Select
                </option>
                {POSITION_FILTER_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
                {position && !POSITION_FILTER_OPTIONS.some((o) => o === position) ? (
                  <option value={position}>{position}</option>
                ) : null}
              </select>
            </label>
          ) : null}

          {kind === "team" ? (
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Team
              <input
                className="mt-1.5 w-full rounded-portal-sm border border-neutral-300 bg-portal-surface px-3 py-2.5 text-sm shadow-sm focus:border-portal-accent focus:outline-none focus:ring-2 focus:ring-portal-accent/25 dark:border-neutral-600"
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                placeholder="e.g. Yankees"
              />
            </label>
          ) : null}

          {kind === "status" ? (
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Status
              <select
                className="mt-1.5 w-full rounded-portal-sm border border-neutral-300 bg-portal-surface px-3 py-2.5 text-sm shadow-sm focus:border-portal-accent focus:outline-none focus:ring-2 focus:ring-portal-accent/25 dark:border-neutral-600"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="" disabled hidden>
                  Select
                </option>
                <option value="available">available</option>
                <option value="signed">signed</option>
                <option value="injured">injured</option>
              </select>
            </label>
          ) : null}

          {kind === "age" ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Compare
                <select
                  className="mt-1.5 w-full rounded-portal-sm border border-neutral-300 bg-portal-surface px-3 py-2.5 text-sm shadow-sm focus:border-portal-accent focus:outline-none focus:ring-2 focus:ring-portal-accent/25 dark:border-neutral-600"
                  value={ageMode}
                  onChange={(e) => setAgeMode(e.target.value as "lt" | "gt")}
                >
                  <option value="lt">Less than</option>
                  <option value="gt">Greater than</option>
                </select>
              </label>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Age
                <input
                  className="mt-1.5 w-full rounded-portal-sm border border-neutral-300 bg-portal-surface px-3 py-2.5 text-sm shadow-sm focus:border-portal-accent focus:outline-none focus:ring-2 focus:ring-portal-accent/25 dark:border-neutral-600"
                  value={ageValue}
                  onChange={(e) => setAgeValue(e.target.value)}
                  inputMode="numeric"
                  placeholder="e.g. 25"
                />
              </label>
            </div>
          ) : null}
        </div>

        <div className="mt-8 flex justify-end gap-2 border-t border-neutral-100 pt-4 dark:border-neutral-700">
          <button type="button" className="portal-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="portal-btn-primary" onClick={() => onSave({ filter: buildFilter() })}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
