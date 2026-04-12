"use client"

/**
 * @file dashboard/page.tsx — Player Discovery Home.
 * Custom search (filters on this page) or saved profiles (built under Preferences).
 */

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { RefreshCw } from "lucide-react"
import { PlayerCard } from "@/components/discovery/PlayerCard"
import { PreferenceFiltersPanel } from "@/components/discovery/PreferenceFiltersPanel"
import type { UiFilter } from "@/components/discovery/DiscoveryFilterTypes"
import { fetchPlayerSummaries } from "@/lib/api"
import { withBasePath } from "@/lib/base-path"
import { buildDiscoveryListParams } from "@/lib/discovery-query"
import { loadProfiles, type PlayerSearchProfile } from "@/lib/player-profiles"
import type { PlayerSummary } from "@available-player-portal/shared"

const DISCOVERY_HOME_PAGE_SIZE = 8

type SearchMode = "custom" | "profile"

export default function PlayerDiscoveryHomePage() {
  const [searchMode, setSearchMode] = useState<SearchMode>("custom")
  const [customFilters, setCustomFilters] = useState<UiFilter[]>([])
  const [customOnlyWithStats, setCustomOnlyWithStats] = useState(false)
  const [profiles, setProfiles] = useState<PlayerSearchProfile[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState("")
  const [players, setPlayers] = useState<PlayerSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [syncBanner, setSyncBanner] = useState<{ variant: "success" | "error"; text: string } | null>(null)

  function refreshProfilesList() {
    setProfiles(loadProfiles())
  }

  useEffect(() => {
    refreshProfilesList()
    const onVis = () => {
      if (document.visibilityState === "visible") refreshProfilesList()
    }
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [])

  useEffect(() => {
    if (searchMode !== "profile") return
    if (!profiles.length) {
      setSelectedProfileId("")
      return
    }
    if (!selectedProfileId || !profiles.some((p) => p.id === selectedProfileId)) {
      setSelectedProfileId(profiles[0].id)
    }
  }, [searchMode, profiles, selectedProfileId])

  const filterParams = useMemo(
    () =>
      buildDiscoveryListParams(searchMode, profiles, selectedProfileId, customFilters, customOnlyWithStats),
    [searchMode, profiles, selectedProfileId, customFilters, customOnlyWithStats],
  )

  const filterParamsRef = useRef(filterParams)
  filterParamsRef.current = filterParams

  /** Filter changes → first page with full loading state. */
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadingMore(false)
    setError(null)
    const params = buildDiscoveryListParams(
      searchMode,
      profiles,
      selectedProfileId,
      customFilters,
      customOnlyWithStats,
    )
    fetchPlayerSummaries({
      ...params,
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
  }, [searchMode, profiles, selectedProfileId, customFilters, customOnlyWithStats])

  /** After “Refresh database” sync: reload first page without blanking the grid (sync button already shows progress). */
  useEffect(() => {
    if (refreshTick === 0) return
    let cancelled = false
    fetchPlayerSummaries({
      ...filterParamsRef.current,
      limit: DISCOVERY_HOME_PAGE_SIZE,
      offset: 0,
    })
      .then(({ players: rows, total: t }) => {
        if (!cancelled) {
          setPlayers(rows)
          setTotal(t)
          setError(null)
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load players")
      })
    return () => {
      cancelled = true
    }
  }, [refreshTick])

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

  async function handleRefreshDatabase() {
    setSyncing(true)
    setSyncBanner(null)
    try {
      const res = await fetch(withBasePath("/api/sync"), { method: "POST" })
      const body = (await res.json()) as {
        ok?: boolean
        error?: string
        players?: number
      }
      if (!res.ok || body.ok === false) {
        throw new Error(typeof body.error === "string" ? body.error : `Sync failed (${res.status})`)
      }
      const parsed = body.players ?? 0
      const playerPhrase =
        parsed === 1 ? "1 player parsed" : `${parsed.toLocaleString()} players parsed`
      const at = new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
      setSyncBanner({
        variant: "success",
        text: `Database updated: ${playerPhrase} at ${at}.`,
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

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId)

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
          <div
            className="mb-3 flex gap-1 rounded-portal-sm border border-portal-filter-border bg-portal-filter-bg/60 p-1 dark:border-neutral-600/60"
            role="tablist"
            aria-label="Search source"
          >
            <button
              type="button"
              role="tab"
              aria-selected={searchMode === "custom"}
              aria-current={searchMode === "custom" ? "true" : undefined}
              onClick={() => setSearchMode("custom")}
              className={`relative flex-1 rounded-portal-sm px-3 py-2.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-accent focus-visible:ring-offset-2 focus-visible:ring-offset-portal-filter-bg dark:focus-visible:ring-offset-neutral-900 ${
                searchMode === "custom"
                  ? "bg-portal-surface font-bold text-[#4A5F78] shadow-portal-card ring-2 ring-portal-accent dark:bg-neutral-800 dark:text-portal-accent dark:ring-portal-accent"
                  : "font-medium text-neutral-500 hover:bg-white/70 hover:text-neutral-800 dark:text-neutral-500 dark:hover:bg-neutral-800/60 dark:hover:text-neutral-200"
              }`}
            >
              Custom search
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={searchMode === "profile"}
              aria-current={searchMode === "profile" ? "true" : undefined}
              onClick={() => setSearchMode("profile")}
              className={`relative flex-1 rounded-portal-sm px-3 py-2.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-accent focus-visible:ring-offset-2 focus-visible:ring-offset-portal-filter-bg dark:focus-visible:ring-offset-neutral-900 ${
                searchMode === "profile"
                  ? "bg-portal-surface font-bold text-[#4A5F78] shadow-portal-card ring-2 ring-portal-accent dark:bg-neutral-800 dark:text-portal-accent dark:ring-portal-accent"
                  : "font-medium text-neutral-500 hover:bg-white/70 hover:text-neutral-800 dark:text-neutral-500 dark:hover:bg-neutral-800/60 dark:hover:text-neutral-200"
              }`}
            >
              Saved profile
            </button>
          </div>

          {searchMode === "custom" ? (
            <>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Custom preferences
              </p>
              <PreferenceFiltersPanel
                filters={customFilters}
                onFiltersChange={setCustomFilters}
                onlyWithStats={customOnlyWithStats}
                onOnlyWithStatsChange={setCustomOnlyWithStats}
              />
            </>
          ) : (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Saved profile
              </p>
              {profiles.length === 0 ? (
                <div className="rounded-portal-sm border border-dashed border-portal-filter-border bg-portal-surface px-3 py-4 text-sm leading-relaxed text-neutral-600 dark:border-neutral-600 dark:text-neutral-400">
                  No profiles yet.{" "}
                  <Link href="/preferences" className="font-semibold text-[#4A5F78] underline dark:text-portal-accent">
                    Create profiles in Preferences
                  </Link>{" "}
                  with the search fields you want, then return here.
                </div>
              ) : (
                <>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Profile
                    <select
                      value={selectedProfileId}
                      onChange={(e) => setSelectedProfileId(e.target.value)}
                      className="mt-1.5 w-full rounded-portal-sm border border-neutral-300 bg-portal-surface px-3 py-2.5 text-sm text-neutral-900 focus:border-portal-accent focus:outline-none focus:ring-2 focus:ring-portal-accent/25 dark:border-neutral-600 dark:text-neutral-100"
                    >
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selectedProfile ? (
                    <p className="mt-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-500">
                      {selectedProfile.filters.length === 0
                        ? "No row filters · "
                        : `${selectedProfile.filters.length} preference row(s) · `}
                      {selectedProfile.onlyWithStats ? "Stats required" : "Stats optional"}
                    </p>
                  ) : null}
                  <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-500">
                    <Link href="/preferences" className="font-semibold text-[#4A5F78] underline dark:text-portal-accent">
                      Preferences
                    </Link>{" "}
                    — edit names and criteria
                  </p>
                </>
              )}
            </div>
          )}
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
              <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                No players match these filters. If the database is empty, use{" "}
                <strong>Refresh database</strong> above (or run{" "}
                <code className="rounded bg-portal-chrome/80 px-1 py-0.5 text-xs dark:bg-neutral-800/80">
                  npm run sync -w @available-player-portal/api
                </code>
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
                    <span className="font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                      {players.length}
                    </span>
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
    </main>
  )
}
