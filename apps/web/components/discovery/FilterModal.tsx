"use client"

import {
  EXPERIENCE_LEVEL_OPTIONS,
  LAST_TRANSACTION_DAYS_OPTIONS,
  type BatHand,
  type ThrowHand,
} from "@available-player-portal/shared"
import { useState } from "react"
import {
  ADD_PREFERENCE_OPTIONS,
  defaultUiFilterForPreset,
  EXPERIENCE_LEVEL_DIRECTION_OPTIONS,
  experienceLevelDirectionFromRaw,
  experienceLevelRangeLabel,
  newId,
  POSITION_FILTER_OPTIONS,
  reconcileExperienceLevelForDirection,
  type ExperienceLevelDirection,
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

  const [kind, setKind] = useState<FilterKind>(
    initial.kind === "experienceLevelMin" ? "experienceLevel" : initial.kind,
  )
  const [position, setPosition] = useState(initial.kind === "position" ? (initial.rawValue ?? "") : "")
  const [team, setTeam] = useState(initial.kind === "team" ? (initial.rawValue ?? "") : "")
  const [status, setStatus] = useState(initial.kind === "status" ? (initial.rawValue ?? "") : "")
  const [ageMode, setAgeMode] = useState<"lt" | "gt">(initial.kind === "age" ? (initial.ageMode ?? "lt") : "lt")
  const [ageValue, setAgeValue] = useState(
    initial.kind === "age" && initial.ageValue != null ? String(initial.ageValue) : "",
  )
  const [expMax, setExpMax] = useState(
    initial.kind === "experienceLevel"
      ? (initial.experienceLevelMaxRaw ?? initial.rawValue ?? "")
      : "",
  )
  const [expMin, setExpMin] = useState(
    initial.kind === "experienceLevel"
      ? (initial.experienceLevelMinRaw ?? "")
      : initial.kind === "experienceLevelMin"
        ? (initial.rawValue ?? "")
        : "",
  )
  const [expDirection, setExpDirection] = useState<ExperienceLevelDirection>(
    experienceLevelDirectionFromRaw(
      initial.kind === "experienceLevel"
        ? initial.experienceLevelMinRaw
        : initial.kind === "experienceLevelMin"
          ? initial.rawValue
          : undefined,
      initial.kind === "experienceLevel" ? (initial.experienceLevelMaxRaw ?? initial.rawValue) : undefined,
    ),
  )
  function changeExpDirection(next: ExperienceLevelDirection) {
    const { min, max } = reconcileExperienceLevelForDirection(next, expMin, expMax)
    setExpMin(min)
    setExpMax(max)
    setExpDirection(next)
  }
  const [lastTxDays, setLastTxDays] = useState(
    initial.kind === "lastTransactionDays" ? (initial.rawValue ?? "") : "",
  )
  const [asOfDate, setAsOfDate] = useState(
    initial.kind === "lastTransactionDays" ? (initial.asOfDateRaw ?? "") : "",
  )
  const [batHand, setBatHand] = useState(
    initial.kind === "handedness" ? (initial.bats ?? "any") : "any",
  )
  const [throwHand, setThrowHand] = useState(
    initial.kind === "handedness" ? (initial.throws ?? "any") : "any",
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
    if (kind === "experienceLevel") {
      const min = expMin.trim()
      const max = expMax.trim()
      if (!min && !max) return { id, kind, label: "Experience level: Select range", rawValue: "" }
      return {
        id,
        kind,
        label: `Experience level: ${experienceLevelRangeLabel(min, max)}`,
        rawValue: max,
        experienceLevelMinRaw: min || undefined,
        experienceLevelMaxRaw: max || undefined,
      }
    }
    if (kind === "experienceLevelMin") return { id, kind: "experienceLevel", label: "Experience level: Select range" }
    if (kind === "lastTransactionDays") {
      const v = lastTxDays.trim()
      if (!v) return { id, kind, label: "Last X days: Select", rawValue: "" }
      const asOf = asOfDate.trim()
      // Spread conditionally so a blank anchor leaves the key absent and saved profiles round-trip byte-stable.
      return {
        id,
        kind,
        label: asOf ? `Last ${v} days as of ${asOf}` : `Last ${v} days`,
        rawValue: v,
        ...(asOf ? { asOfDateRaw: asOf } : {}),
      }
    }
    if (kind === "handedness") {
      const b = batHand.trim()
      const th = throwHand.trim()
      const batsFilter = b !== "any" && b !== "" ? (b as BatHand) : undefined
      const throwsFilter = th !== "any" && th !== "" ? (th as ThrowHand) : undefined
      if (batsFilter == null && throwsFilter == null) {
        return { id, kind: "handedness", label: "Handedness: Any" }
      }
      const parts: string[] = []
      if (batsFilter != null) parts.push(`bats ${batsFilter}`)
      if (throwsFilter != null) parts.push(`throws ${throwsFilter}`)
      return {
        id,
        kind: "handedness",
        label: `Handedness: ${parts.join(" · ")}`,
        ...(batsFilter != null ? { bats: batsFilter } : {}),
        ...(throwsFilter != null ? { throws: throwsFilter } : {}),
      }
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

  /** Save allowed only when the user has moved off the placeholder “Select” / entered a valid value. */
  function isPreferenceComplete(): boolean {
    if (kind === "position") return position.trim() !== ""
    if (kind === "team") return team.trim() !== ""
    if (kind === "status") return status.trim() !== ""
    if (kind === "experienceLevel") return expMin.trim() !== "" || expMax.trim() !== ""
    if (kind === "experienceLevelMin") return expMin.trim() !== "" || expMax.trim() !== ""
    if (kind === "lastTransactionDays") return lastTxDays.trim() !== ""
    if (kind === "handedness") {
      const b = batHand.trim()
      const th = throwHand.trim()
      return (b !== "any" && b !== "") || (th !== "any" && th !== "")
    }
    if (kind === "age") {
      const t = ageValue.trim()
      if (t === "") return false
      return Number.isFinite(Number(t))
    }
    return false
  }

  const canSave = isPreferenceComplete()

  return (
    <div
      className="portal-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="filter-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="portal-modal-card max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 id="filter-modal-title" className="text-lg font-bold text-black dark:text-neutral-100">
          {state.mode === "edit" ? "Edit preference" : "Add preference"}
        </h2>
        <div className="mt-4 space-y-3">
          <label className="portal-field">
            Type
            <select
              className="portal-control"
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
            <label className="portal-field">
              Position
              <select
                className="portal-control"
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
            <label className="portal-field">
              Team
              <input
                className="portal-control"
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                placeholder="e.g. Yankees"
              />
            </label>
          ) : null}

          {kind === "status" ? (
            <label className="portal-field">
              Status
              <select
                className="portal-control"
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

          {kind === "experienceLevel" ? (
            <div className="space-y-3">
              <label className="portal-field">
                Direction
                <select
                  className="portal-control"
                  value={expDirection}
                  onChange={(e) => changeExpDirection(e.target.value as ExperienceLevelDirection)}
                >
                  {EXPERIENCE_LEVEL_DIRECTION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              {expDirection === "between" ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="portal-field">
                    Min level
                    <select
                      className="portal-control"
                      value={expMin}
                      onChange={(e) => setExpMin(e.target.value)}
                    >
                      <option value="">Any</option>
                      {EXPERIENCE_LEVEL_OPTIONS.map((o) => (
                        <option key={o.code} value={o.code}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="portal-field">
                    Max level
                    <select
                      className="portal-control"
                      value={expMax}
                      onChange={(e) => setExpMax(e.target.value)}
                    >
                      <option value="">Any</option>
                      {EXPERIENCE_LEVEL_OPTIONS.map((o) => (
                        <option key={o.code} value={o.code}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : (
                <label className="portal-field">
                  Level
                  <select
                    className="portal-control"
                    value={expDirection === "atMost" ? expMax : expMin}
                    onChange={(e) => {
                      const v = e.target.value
                      if (expDirection === "atMost") {
                        setExpMax(v)
                        setExpMin("")
                      } else if (expDirection === "exactly") {
                        setExpMin(v)
                        setExpMax(v)
                      } else {
                        setExpMin(v)
                        setExpMax("")
                      }
                    }}
                  >
                    <option value="" disabled hidden>
                      Select
                    </option>
                    {EXPERIENCE_LEVEL_OPTIONS.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          ) : null}

          {kind === "lastTransactionDays" ? (
            <div className="space-y-3">
              <label className="portal-field">
                Last X days
                <select
                  className="portal-control"
                  value={lastTxDays}
                  onChange={(e) => setLastTxDays(e.target.value)}
                >
                  <option value="" disabled hidden>
                    Select
                  </option>
                  {LAST_TRANSACTION_DAYS_OPTIONS.map((d) => (
                    <option key={d} value={String(d)}>
                      {d}
                    </option>
                  ))}
                  {lastTxDays &&
                  !LAST_TRANSACTION_DAYS_OPTIONS.some((d) => String(d) === lastTxDays) ? (
                    <option value={lastTxDays}>{lastTxDays}</option>
                  ) : null}
                </select>
              </label>
              <label className="portal-field">
                As of date (optional)
                <input
                  type="date"
                  className="portal-control"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                />
                <span className="text-xs opacity-70">
                  Leave blank for today. Matches The Baseball Cube&rsquo;s &ldquo;Transaction
                  Date&rdquo; — the window is the X days ending on this date, inclusive. Search
                  results only: saved alerts always use today.
                </span>
              </label>
              {asOfDate ? (
                <button type="button" className="portal-btn-ghost" onClick={() => setAsOfDate("")}>
                  Clear as of date
                </button>
              ) : null}
            </div>
          ) : null}

          {kind === "handedness" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="portal-field">
                Batting
                <select
                  className="portal-control"
                  value={batHand}
                  onChange={(e) => setBatHand(e.target.value)}
                >
                  <option value="any">Any</option>
                  <option value="L">L</option>
                  <option value="R">R</option>
                  <option value="B">B</option>
                </select>
              </label>
              <label className="portal-field">
                Throwing
                <select
                  className="portal-control"
                  value={throwHand}
                  onChange={(e) => setThrowHand(e.target.value)}
                >
                  <option value="any">Any</option>
                  <option value="L">L</option>
                  <option value="R">R</option>
                </select>
              </label>
            </div>
          ) : null}

          {kind === "age" ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="portal-field">
                Compare
                <select
                  className="portal-control"
                  value={ageMode}
                  onChange={(e) => setAgeMode(e.target.value as "lt" | "gt")}
                >
                  <option value="lt">Less than</option>
                  <option value="gt">Greater than</option>
                </select>
              </label>
              <label className="portal-field">
                Age
                <input
                  className="portal-control"
                  value={ageValue}
                  onChange={(e) => setAgeValue(e.target.value)}
                  inputMode="numeric"
                  placeholder="e.g. 25"
                />
              </label>
            </div>
          ) : null}
        </div>

        <div className="portal-modal-footer mt-8">
          <button type="button" className="portal-btn-ghost w-full sm:min-w-[5.5rem] sm:w-auto" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="portal-btn-primary w-full min-h-[2.5rem] sm:min-w-[5.5rem] sm:w-auto disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canSave}
            title={
              canSave
                ? undefined
                : kind === "handedness"
                  ? "Select at least one of batting or throwing; use Any to ignore that side"
                  : "Choose a value (not Select) before saving"
            }
            onClick={() => {
              if (!canSave) return
              onSave({ filter: buildFilter() })
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
