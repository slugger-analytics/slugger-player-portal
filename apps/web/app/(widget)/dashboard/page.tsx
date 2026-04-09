"use client"

/**
 * @file dashboard/page.tsx — Player Discovery Home (mockup-aligned).
 * Filters → query `GET /players` → cards from DB-backed API. See `lib/api.ts` + sync pipeline.
 */

import { useEffect, useMemo, useState } from "react"
import { MoreVertical, Plus, RefreshCw, UserRound } from "lucide-react"
import { PlayerCard } from "@/components/discovery/PlayerCard"
import { fetchPlayerSummaries } from "@/lib/api"
import { withBasePath } from "@/lib/base-path"
import type { PlayerSummary } from "@available-player-portal/shared"

type FilterKind = "position" | "age" | "team" | "status"

type UiFilter = {
  id: string
  kind: FilterKind
  label: string
  rawValue?: string
  ageMode?: "lt" | "gt"
  ageValue?: number
}

function newId(): string {
  return globalThis.crypto.randomUUID()
}

/** Each batch from `GET /players` (2 columns × 4 rows); “Load more” appends the next batch below. */
const DISCOVERY_HOME_PAGE_SIZE = 8

/** Position filter values (aligned with API substring / P vs Non-P semantics in `PlayerRepository`). */
const POSITION_FILTER_OPTIONS = [
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

function filtersToQuery(filters: UiFilter[]): Record<string, string | number | undefined> {
  const q: Record<string, string | number | undefined> = {}
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

export default function PlayerDiscoveryHomePage() {
  const [filters, setFilters] = useState<UiFilter[]>([])
  const [players, setPlayers] = useState<PlayerSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Bumps after a successful DB sync so the player list refetches with current filters. */
  const [refreshTick, setRefreshTick] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [syncBanner, setSyncBanner] = useState<{ variant: "success" | "error"; text: string } | null>(null)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [modal, setModal] = useState<
    | { mode: "add" }
    | { mode: "edit"; filter: UiFilter }
    | null
  >(null)

  const filterParams = useMemo(() => filtersToQuery(filters), [filters])

  /** Filters or DB sync → first batch only (replaces list; “Load more” appends below). */
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadingMore(false)
    setError(null)
    fetchPlayerSummaries({
      ...filterParams,
      limit: DISCOVERY_HOME_PAGE_SIZE,
      offset: 0,
    })
      .then(({ players: rows, total: t }) => {
        if (!cancelled) {
          setPlayers(rows)
          setTotal(t)
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load players")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [filterParams, refreshTick])

  async function handleLoadMore() {
    if (loadingMore || loading || players.length >= total) return
    setLoadingMore(true)
    setError(null)
    try {
      const { players: rows, total: t } = await fetchPlayerSummaries({
        ...filterParams,
        limit: DISCOVERY_HOME_PAGE_SIZE,
        offset: players.length,
      })
      setPlayers((prev) => [...prev, ...rows])
      setTotal(t)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load players")
    } finally {
      setLoadingMore(false)
    }
  }

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

  function removeFilter(id: string) {
    setFilters((prev) => prev.filter((f) => f.id !== id))
    setMenuFor(null)
  }

  function openAdd() {
    setModal({ mode: "add" })
    setMenuFor(null)
  }

  async function handleRefreshDatabase() {
    setSyncing(true)
    setSyncBanner(null)
    try {
      const res = await fetch(withBasePath("/api/sync"), { method: "POST" })
      const body = (await res.json()) as {
        ok?: boolean
        error?: string
        players?: number
        transactions?: number
        batting?: number
        pitching?: number
      }
      if (!res.ok || body.ok === false) {
        throw new Error(typeof body.error === "string" ? body.error : `Sync failed (${res.status})`)
      }
      setSyncBanner({
        variant: "success",
        text: `Database updated from feeds: ${body.players ?? 0} players merged, ${body.transactions ?? 0} transactions, ${body.batting ?? 0} batting / ${body.pitching ?? 0} pitching rows parsed.`,
      })
      setRefreshTick((t) => t + 1)
    } catch (e) {
      setSyncBanner({
        variant: "error",
        text: e instanceof Error ? e.message : "Could not refresh the database.",
      })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <main className="px-4 pb-10 sm:px-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-black dark:text-neutral-100">Player Discovery Home</h1>
        <button
          type="button"
          onClick={handleRefreshDatabase}
          disabled={syncing}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-portal-sm border border-portal-filter-border bg-portal-surface px-4 py-2.5 text-sm font-semibold text-[#4A5F78] shadow-portal-card transition hover:border-portal-accent hover:bg-portal-filter-bg/60 disabled:cursor-not-allowed disabled:opacity-60 dark:text-portal-accent"
          title="Fetch latest Baseball Cube feeds, parse, and upsert into PostgreSQL"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} aria-hidden />
          {syncing ? "Refreshing…" : "Refresh database"}
        </button>
      </div>

      {syncBanner ? (
        <div
          role="status"
          className={`mb-6 rounded-portal-sm border px-3 py-3 text-sm leading-relaxed ${
            syncBanner.variant === "success"
              ? "border-emerald-200/90 bg-emerald-50/90 text-emerald-950"
              : "border-red-200/90 bg-red-50/90 text-red-950"
          }`}
        >
          {syncBanner.text}
        </div>
      ) : null}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-5">
        <section className="w-full shrink-0 lg:w-[420px] lg:flex-shrink-0">
          <div className="portal-filter-shell">
            <div className="flex flex-col gap-2.5">
              {filters.length === 0 ? (
                <div className="flex min-h-12 items-center rounded-portal-sm bg-portal-surface px-3 py-3 shadow-portal-card">
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
                      className="shrink-0 rounded-lg p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-800"
                      aria-label="Filter actions"
                      aria-expanded={menuFor === f.id}
                      onClick={() => setMenuFor((cur) => (cur === f.id ? null : f.id))}
                    >
                      <MoreVertical className="h-5 w-5" />
                    </button>
                    {menuFor === f.id ? (
                      <div
                        data-filter-menu
                        className="absolute right-2 top-[calc(100%+4px)] z-20 w-40 overflow-hidden rounded-portal-sm border border-neutral-200/90 bg-portal-surface py-1 shadow-portal dark:border-neutral-600/80"
                        role="menu"
                      >
                        <button
                          type="button"
                          role="menuitem"
                          className="block w-full px-3 py-2.5 text-left text-sm text-neutral-800 hover:bg-portal-filter-bg"
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
                          className="block w-full px-3 py-2.5 text-left text-sm text-red-700 hover:bg-red-50"
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
          </div>

          <button
            type="button"
            onClick={openAdd}
            className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-portal-sm border border-portal-filter-border bg-portal-surface px-4 text-sm font-semibold text-[#4A5F78] shadow-portal-card transition hover:border-portal-accent hover:bg-portal-filter-bg/60 dark:text-portal-accent"
          >
            <Plus className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
            Add preferences
          </button>
        </section>

        <section className="min-w-0 w-full flex-1 lg:min-w-0">
          <div className="portal-panel-well min-h-[480px] w-full min-w-0">
            {loading ? (
              <div
                className="grid grid-cols-2 gap-3 sm:gap-4"
                style={{ gridTemplateRows: "repeat(4, minmax(0, 1fr))" }}
                aria-busy
                aria-label="Loading players"
              >
                {Array.from({ length: DISCOVERY_HOME_PAGE_SIZE }, (_, i) => (
                  <div
                    key={i}
                    className="flex min-h-[112px] min-w-0 animate-pulse gap-3 rounded-portal border border-neutral-200/80 bg-portal-surface p-3 shadow-portal-card dark:border-neutral-600/40"
                  >
                    <div className="h-[88px] w-[88px] shrink-0 rounded-full bg-neutral-200" />
                    <div className="min-w-0 flex-1 space-y-2 py-1">
                      <div className="h-3.5 w-[72%] rounded bg-neutral-200" />
                      <div className="h-3 w-[40%] rounded bg-neutral-200" />
                      <div className="h-3 w-[55%] rounded bg-neutral-200" />
                      <div className="h-3 w-full rounded bg-neutral-200" />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="rounded-portal-sm border border-amber-200/80 bg-amber-50/90 px-3 py-3 text-sm text-amber-950">
                <p className="font-semibold">Could not load players</p>
                <p className="mt-1 leading-relaxed text-amber-900/90">{error}</p>
              </div>
            ) : players.length === 0 ? (
              <p className="text-sm leading-relaxed text-neutral-600">
                No players match these filters. If the database is empty, use{" "}
                <strong>Refresh database</strong> above (or run{" "}
                <code className="rounded bg-portal-chrome/80 px-1 py-0.5 text-xs dark:bg-neutral-800/80">npm run sync -w @available-player-portal/api</code>
                ), then the list will reload.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:gap-5">
                  {players.map((p) => (
                    <PlayerCard key={p.id} player={p} className="!max-w-none min-w-0" />
                  ))}
                </div>
                <div className="mt-5 flex flex-col items-stretch gap-3 border-t border-neutral-200/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-center text-sm text-neutral-600 dark:text-neutral-400 sm:text-left">
                    <span className="font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{players.length}</span>
                    {" of "}
                    <span className="font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{total}</span>
                    {" total results shown"}
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 sm:justify-end">
                    {players.length < total ? (
                      <button
                        type="button"
                        onClick={() => void handleLoadMore()}
                        disabled={loading || loadingMore}
                        className="inline-flex min-w-[7rem] shrink-0 items-center justify-center rounded-portal-sm border border-portal-filter-border bg-portal-surface px-4 py-2.5 text-sm font-semibold text-[#4A5F78] shadow-portal-card transition hover:border-portal-accent hover:bg-portal-filter-bg/60 disabled:cursor-not-allowed disabled:opacity-50 dark:text-portal-accent"
                      >
                        {loadingMore ? "Loading…" : "Load more"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      {modal ? (
        <FilterModal
          state={modal}
          onClose={() => setModal(null)}
          onSave={(next) => {
            if (modal.mode === "edit") {
              setFilters((prev) => prev.map((x) => (x.id === next.filter.id ? next.filter : x)))
            } else {
              setFilters((prev) => [...prev, next.filter])
            }
            setModal(null)
          }}
        />
      ) : null}
    </main>
  )
}

function FilterModal({
  state,
  onClose,
  onSave,
}: {
  state: { mode: "add" } | { mode: "edit"; filter: UiFilter }
  onClose: () => void
  onSave: (next: { filter: UiFilter }) => void
}) {
  const initial =
    state.mode === "edit"
      ? state.filter
      : ({
          id: newId(),
          kind: "position" as const,
          label: "Position: Select",
          rawValue: "",
        } satisfies UiFilter)

  const [kind, setKind] = useState<FilterKind>(initial.kind)
  const [position, setPosition] = useState(initial.kind === "position" ? initial.rawValue ?? "" : "")
  const [team, setTeam] = useState(initial.kind === "team" ? initial.rawValue ?? "" : "")
  const [status, setStatus] = useState(initial.kind === "status" ? initial.rawValue ?? "" : "")
  const [ageMode, setAgeMode] = useState<"lt" | "gt">(initial.kind === "age" ? initial.ageMode ?? "lt" : "lt")
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
        <h2 id="filter-modal-title" className="text-lg font-bold text-black">
          {state.mode === "edit" ? "Edit preferences" : "Add preferences"}
        </h2>
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-neutral-700">
            Type
            <select
              className="mt-1.5 w-full rounded-portal-sm border border-neutral-300 px-3 py-2.5 text-sm shadow-sm focus:border-portal-accent focus:outline-none focus:ring-2 focus:ring-portal-accent/25"
              value={kind}
              onChange={(e) => setKind(e.target.value as FilterKind)}
            >
              <option value="position">Position</option>
              <option value="age">Age</option>
              <option value="team">Team</option>
              <option value="status">Status</option>
            </select>
          </label>

          {kind === "position" ? (
            <label className="block text-sm font-medium text-neutral-700">
              Position
              <select
                className="mt-1.5 w-full rounded-portal-sm border border-neutral-300 px-3 py-2.5 text-sm shadow-sm focus:border-portal-accent focus:outline-none focus:ring-2 focus:ring-portal-accent/25"
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
            <label className="block text-sm font-medium text-neutral-700">
              Team
              <input
                className="mt-1.5 w-full rounded-portal-sm border border-neutral-300 px-3 py-2.5 text-sm shadow-sm focus:border-portal-accent focus:outline-none focus:ring-2 focus:ring-portal-accent/25"
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                placeholder="e.g. Yankees"
              />
            </label>
          ) : null}

          {kind === "status" ? (
            <label className="block text-sm font-medium text-neutral-700">
              Status
              <select
                className="mt-1.5 w-full rounded-portal-sm border border-neutral-300 px-3 py-2.5 text-sm shadow-sm focus:border-portal-accent focus:outline-none focus:ring-2 focus:ring-portal-accent/25"
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
              <label className="block text-sm font-medium text-neutral-700">
                Compare
                <select
                  className="mt-1.5 w-full rounded-portal-sm border border-neutral-300 px-3 py-2.5 text-sm shadow-sm focus:border-portal-accent focus:outline-none focus:ring-2 focus:ring-portal-accent/25"
                  value={ageMode}
                  onChange={(e) => setAgeMode(e.target.value as "lt" | "gt")}
                >
                  <option value="lt">Less than</option>
                  <option value="gt">Greater than</option>
                </select>
              </label>
              <label className="block text-sm font-medium text-neutral-700">
                Age
                <input
                  className="mt-1.5 w-full rounded-portal-sm border border-neutral-300 px-3 py-2.5 text-sm shadow-sm focus:border-portal-accent focus:outline-none focus:ring-2 focus:ring-portal-accent/25"
                  value={ageValue}
                  onChange={(e) => setAgeValue(e.target.value)}
                  inputMode="numeric"
                  placeholder="e.g. 25"
                />
              </label>
            </div>
          ) : null}
        </div>

        <div className="mt-8 flex justify-end gap-2 border-t border-neutral-100 pt-4">
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
