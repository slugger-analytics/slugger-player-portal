"use client"

import { useEffect, useState } from "react"
import { ChevronDown, MoreVertical, Plus, UserRound } from "lucide-react"
import { FilterModal } from "@/components/discovery/FilterModal"
import {
  ADD_PREFERENCE_OPTIONS,
  type FilterKind,
  type UiFilter,
} from "@/components/discovery/DiscoveryFilterTypes"

type Props = {
  filters: UiFilter[]
  onFiltersChange: (filters: UiFilter[]) => void
  onlyWithStats: boolean
  onOnlyWithStatsChange: (v: boolean) => void
}

export function PreferenceFiltersPanel({ filters, onFiltersChange, onlyWithStats, onOnlyWithStatsChange }: Props) {
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [addPrefsOpen, setAddPrefsOpen] = useState(false)
  const [modal, setModal] = useState<
    { mode: "add"; presetKind?: FilterKind } | { mode: "edit"; filter: UiFilter } | null
  >(null)

  useEffect(() => {
    if (!menuFor) return
    const onPointerDown = (e: PointerEvent) => {
      const el = e.target as HTMLElement | null
      if (!el) return
      if (el.closest("[data-filter-row]")) return
      setMenuFor(null)
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [menuFor])

  useEffect(() => {
    if (!addPrefsOpen) return
    const onPointerDown = (e: PointerEvent) => {
      const el = e.target as HTMLElement | null
      if (!el) return
      if (el.closest("[data-add-prefs-root]")) return
      setAddPrefsOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [addPrefsOpen])

  function removeFilter(id: string) {
    onFiltersChange(filters.filter((f) => f.id !== id))
    setMenuFor(null)
  }

  return (
    <>
      <div className="portal-filter-shell">
        <div className="flex flex-col gap-2.5">
          {filters.length === 0 ? (
            <div className="flex min-h-12 w-full items-center justify-center rounded-portal-sm bg-portal-surface px-3 py-3 text-center shadow-portal-card">
              <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">No preferences selected.</p>
            </div>
          ) : (
            filters.map((f) => (
              <div
                key={f.id}
                data-filter-row
                className="relative flex h-12 items-center gap-3 rounded-portal-sm bg-portal-surface px-3 shadow-portal-card"
              >
                <UserRound className="h-5 w-5 shrink-0 text-neutral-400" strokeWidth={1.75} />
                <div className="min-w-0 flex-1 text-sm font-medium text-neutral-900 dark:text-neutral-100">{f.label}</div>
                <button
                  type="button"
                  className="shrink-0 rounded-lg p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                  aria-label="Filter actions"
                  aria-expanded={menuFor === f.id}
                  onClick={() => setMenuFor((cur) => (cur === f.id ? null : f.id))}
                >
                  <MoreVertical className="h-5 w-5" />
                </button>
                {menuFor === f.id ? (
                  <div
                    data-filter-menu
                    className="portal-menu absolute right-2 top-[calc(100%+4px)] z-20 w-40"
                    role="menu"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className="portal-menu-item"
                      onClick={() => {
                        setModal({ mode: "edit", filter: f })
                        setMenuFor(null)
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="portal-menu-item-danger"
                      onClick={() => removeFilter(f.id)}
                    >
                      Remove
                    </button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>

        <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-portal-sm bg-portal-surface px-3 py-2.5 shadow-portal-card">
          <input
            type="checkbox"
            checked={onlyWithStats}
            onChange={(e) => onOnlyWithStatsChange(e.target.checked)}
            className="portal-checkbox"
          />
          <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Stats Available</span>
        </label>
      </div>

      <div className="relative mt-4" data-add-prefs-root>
        <button
          type="button"
          aria-expanded={addPrefsOpen}
          aria-haspopup="listbox"
          aria-controls="add-preferences-menu"
          id="add-preferences-button"
          onClick={() => setAddPrefsOpen((o) => !o)}
          className="portal-btn-primary inline-flex h-11 w-full items-center justify-center gap-2"
        >
          <Plus className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
          Add preferences
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${addPrefsOpen ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
        {addPrefsOpen ? (
          <ul
            id="add-preferences-menu"
            role="listbox"
            aria-labelledby="add-preferences-button"
            className="portal-menu absolute left-0 right-0 top-[calc(100%+6px)] z-[70]"
          >
            {ADD_PREFERENCE_OPTIONS.map(({ kind, label }) => (
              <li key={kind} role="none">
                <button
                  type="button"
                  role="option"
                  className="portal-menu-item"
                  onClick={() => {
                    setAddPrefsOpen(false)
                    setModal({ mode: "add", presetKind: kind })
                  }}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {modal ? (
        <FilterModal
          key={
            modal.mode === "edit" ? `edit-${modal.filter.id}` : `add-${modal.presetKind ?? "position"}`
          }
          state={modal}
          onClose={() => setModal(null)}
          onSave={(next) => {
            if (modal.mode === "edit") {
              onFiltersChange(filters.map((x) => (x.id === next.filter.id ? next.filter : x)))
            } else {
              onFiltersChange([...filters, next.filter])
            }
            setModal(null)
          }}
        />
      ) : null}
    </>
  )
}
