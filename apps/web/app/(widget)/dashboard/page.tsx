"use client"

/**
 * @file dashboard/page.tsx — Player Discovery Home.
 * Custom search (filters on this page) or saved profiles (built under Preferences).
 */

import Link from "next/link"
import { ListFilter, Search, SlidersHorizontal } from "lucide-react"
import { useEffect, useLayoutEffect, useMemo, useState } from "react"
import { PlayerCard } from "@/components/discovery/PlayerCard"
import { PreferenceFiltersPanel } from "@/components/discovery/PreferenceFiltersPanel"
import { SortOrderButton } from "@/components/discovery/SortOrderButton"
import { POSITION_FILTER_OPTIONS } from "@/components/discovery/DiscoveryFilterTypes"
import type { UiFilter } from "@/components/discovery/DiscoveryFilterTypes"
import { fetchPlayerSummaries } from "@/lib/api"
import {
  buildDiscoveryListParams,
  type DiscoverySortOption,
  type DiscoveryTransactionType,
} from "@/lib/discovery-query"
import {
  saveDiscoverySnapshotForPlayerNavigation,
  takeDiscoverySnapshot,
} from "@/lib/discovery-session"
import { loadProfiles, type PlayerSearchProfile } from "@/lib/player-profiles"
import {
  EMPTY_RANKING_DRAFT,
  isPitcherRankingTarget,
  rankingDraftToPreferences,
  rankingDraftWeightValidation,
  rankingPreferencesToDraft,
  type RankingDraft,
} from "@/lib/rankingPreferencesForm"
import type { PlayerSummary, RankingPreferences } from "@available-player-portal/shared"
import { upsertProfile } from "@/lib/player-profiles"

const DISCOVERY_HOME_PAGE_SIZE = 8

/** Defensive: stable-ordered API responses should not repeat ids; keeps React keys unique. */
function dedupePlayersById(players: PlayerSummary[]): PlayerSummary[] {
  const seen = new Set<string>()
  const out: PlayerSummary[] = []
  for (const p of players) {
    if (seen.has(p.id)) continue
    seen.add(p.id)
    out.push(p)
  }
  return out
}

type SearchMode = "custom" | "profile"

export default function PlayerDiscoveryHomePage() {
  const [searchMode, setSearchMode] = useState<SearchMode>("custom")
  const [customFilters, setCustomFilters] = useState<UiFilter[]>([])
  const [customOnlyWithStats, setCustomOnlyWithStats] = useState(false)
  const [profiles, setProfiles] = useState<PlayerSearchProfile[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState("")
  const [sort, setSort] = useState<DiscoverySortOption>("newestTransaction")
  const [customRankingPreferences, setCustomRankingPreferences] = useState<RankingPreferences | undefined>(undefined)
  const [transactionTypes, setTransactionTypes] = useState<DiscoveryTransactionType[]>([
    "retired",
    "released",
    "freeAgent",
  ])
  const [transactionTypeModalOpen, setTransactionTypeModalOpen] = useState(false)
  const [rankingModalOpen, setRankingModalOpen] = useState(false)
  const [rankingDraft, setRankingDraft] = useState<RankingDraft>(EMPTY_RANKING_DRAFT)
  const [players, setPlayers] = useState<PlayerSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** False until client applies optional return-from-profile snapshot (avoids fetch with default then snapshot). */
  const [discoveryReady, setDiscoveryReady] = useState(false)
  const [nameSearchInput, setNameSearchInput] = useState("")
  const [nameSearch, setNameSearch] = useState("")

  useLayoutEffect(() => {
    const snap = takeDiscoverySnapshot()
    if (snap) {
      setSearchMode(snap.searchMode)
      setCustomFilters(snap.customFilters)
      setCustomOnlyWithStats(snap.customOnlyWithStats)
      setSelectedProfileId(snap.selectedProfileId)
      setSort(snap.sort)
      setTransactionTypes(snap.transactionTypes)
      setCustomRankingPreferences(snap.customRankingPreferences)
      setNameSearchInput(snap.nameSearch)
      setNameSearch(snap.nameSearch)
    }
    setDiscoveryReady(true)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      setNameSearch(nameSearchInput.trim().slice(0, 200))
    }, 250)
    return () => clearTimeout(t)
  }, [nameSearchInput])

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
      buildDiscoveryListParams(
        searchMode,
        profiles,
        selectedProfileId,
        customFilters,
        customOnlyWithStats,
        sort,
        transactionTypes,
        customRankingPreferences,
        nameSearch,
      ),
    [
      searchMode,
      profiles,
      selectedProfileId,
      customFilters,
      customOnlyWithStats,
      sort,
      transactionTypes,
      customRankingPreferences,
      nameSearch,
    ],
  )

  /** Filter changes → first page with full loading state. */
  useEffect(() => {
    if (!discoveryReady) return
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
      sort,
      transactionTypes,
      customRankingPreferences,
      nameSearch,
    )
    fetchPlayerSummaries({
      ...params,
      limit: DISCOVERY_HOME_PAGE_SIZE,
      offset: 0,
    })
      .then(({ players: rows, total: t }) => {
        if (!cancelled) {
          setPlayers(dedupePlayersById(rows))
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
  }, [
    discoveryReady,
    searchMode,
    profiles,
    selectedProfileId,
    customFilters,
    customOnlyWithStats,
    sort,
    transactionTypes,
    customRankingPreferences,
    nameSearch,
  ])

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
      setPlayers((prev) => {
        const seen = new Set(prev.map((p) => p.id))
        const merged = [...prev]
        for (const p of rows) {
          if (seen.has(p.id)) continue
          seen.add(p.id)
          merged.push(p)
        }
        return merged
      })
      setTotal(t)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load players")
    } finally {
      setLoadingMore(false)
    }
  }

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId)
  const hasRankingPreferencesConfigured =
    searchMode === "profile" ? Boolean(selectedProfile?.rankingPreferences) : Boolean(customRankingPreferences)

  function saveDiscoverySnapshotBeforeProfile() {
    saveDiscoverySnapshotForPlayerNavigation({
      searchMode,
      customFilters,
      customOnlyWithStats,
      selectedProfileId,
      sort,
      transactionTypes,
      customRankingPreferences,
      nameSearch: nameSearchInput.trim().slice(0, 200),
    })
  }

  function openRankingModal() {
    const source = searchMode === "profile" ? selectedProfile?.rankingPreferences : customRankingPreferences
    setRankingDraft(rankingPreferencesToDraft(source))
    setRankingModalOpen(true)
  }

  function saveRankingPreferences() {
    const parsed = rankingDraftToPreferences(rankingDraft)
    if (!parsed) return
    if (searchMode === "profile") {
      const selected = profiles.find((p) => p.id === selectedProfileId)
      if (selected) {
        upsertProfile({
          ...selected,
          rankingPreferences: parsed,
        })
        refreshProfilesList()
      }
    } else {
      setCustomRankingPreferences(parsed)
    }
    setSort("ranking")
    setRankingModalOpen(false)
  }

  const {
    pitcherTarget: rankingPitcherTarget,
    total: rankingWeightTotal,
    weightsValid: rankingWeightsValid,
    targetSelected: rankingTargetPositionValid,
  } = rankingDraftWeightValidation(rankingDraft)

  function toggleTransactionType(type: DiscoveryTransactionType) {
    setTransactionTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]))
  }

  return (
    <main className="portal-page mx-auto max-w-[1600px]">
      <h1 className="sr-only">Player Discovery Home</h1>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-8">
        <section
          className="flex w-full shrink-0 flex-col gap-3 self-start lg:sticky lg:top-[4.75rem] lg:z-10 lg:max-h-[calc(100dvh-5.5rem)] lg:w-[420px] lg:max-w-[420px] lg:overflow-y-auto lg:overscroll-y-contain lg:pr-1"
          aria-label="Search and filters"
        >
          <div className="w-full">
            <label className="portal-field mb-0">
              <span className="sr-only">Search by player name</span>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                  aria-hidden
                />
                <input
                  type="search"
                  value={nameSearchInput}
                  onChange={(e) => setNameSearchInput(e.target.value)}
                  placeholder="Search by name"
                  className="portal-control w-full pl-9"
                  autoComplete="off"
                />
              </div>
            </label>
          </div>
          <div className="flex flex-col gap-5 rounded-portal-lg border border-neutral-200/70 bg-portal-surface/85 p-5 shadow-portal backdrop-blur-md dark:border-neutral-600/45 dark:bg-neutral-900/55">
            <div className="portal-tablist" role="tablist" aria-label="Search source">
              <button
                type="button"
                role="tab"
                aria-selected={searchMode === "custom"}
                aria-current={searchMode === "custom" ? "true" : undefined}
                onClick={() => setSearchMode("custom")}
                className={`portal-tab ${searchMode === "custom" ? "portal-tab-active" : "portal-tab-inactive"}`}
              >
                Custom search
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={searchMode === "profile"}
                aria-current={searchMode === "profile" ? "true" : undefined}
                onClick={() => setSearchMode("profile")}
                className={`portal-tab ${searchMode === "profile" ? "portal-tab-active" : "portal-tab-inactive"}`}
              >
                Saved profile
              </button>
            </div>

            <div>
              <p className="mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400">
                <span className="h-2 w-2 shrink-0 rounded-full bg-portal-accent/80" aria-hidden />
                Sort &amp; order
              </p>
              <div className="portal-filter-shell space-y-3 sm:p-5">
                <SortOrderButton
                  sort={sort}
                  onSelectSort={(next) => {
                    if (next === "ranking" && !hasRankingPreferencesConfigured) {
                      openRankingModal()
                      return
                    }
                    setSort(next)
                    if (next === "transactionType") setTransactionTypeModalOpen(true)
                  }}
                />
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={openRankingModal}
                    className="portal-btn-secondary inline-flex w-full items-center justify-center gap-2"
                  >
                    <SlidersHorizontal className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                    {hasRankingPreferencesConfigured ? "Edit ranking weights" : "Set ranking weights"}
                  </button>
                  {sort === "transactionType" ? (
                    <button
                      type="button"
                      onClick={() => setTransactionTypeModalOpen(true)}
                      className="portal-btn-secondary inline-flex w-full items-center justify-center gap-2"
                    >
                      <ListFilter className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                      Transaction types
                      <span className="tabular-nums">({transactionTypes.length})</span>
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            {searchMode === "custom" ? (
              <div className="flex flex-col gap-3">
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-portal-accent/80" aria-hidden />
                  Custom preferences
                </p>
                <PreferenceFiltersPanel
                  filters={customFilters}
                  onFiltersChange={setCustomFilters}
                  onlyWithStats={customOnlyWithStats}
                  onOnlyWithStatsChange={setCustomOnlyWithStats}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-portal-accent/80" aria-hidden />
                  Saved profile
                </p>
                {profiles.length === 0 ? (
                  <div className="rounded-portal border border-dashed border-portal-filter-border bg-portal-filter-bg/50 px-4 py-5 text-sm leading-relaxed text-neutral-600 dark:border-neutral-600 dark:bg-neutral-800/40 dark:text-neutral-400">
                    No profiles yet.{" "}
                    <Link href="/preferences" className="portal-link text-sm">
                      Create profiles in Preferences
                    </Link>{" "}
                    with the search fields you want, then return here.
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <label className="portal-field">
                      Profile
                      <select
                        value={selectedProfileId}
                        onChange={(e) => setSelectedProfileId(e.target.value)}
                        className="portal-control"
                      >
                        {profiles.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {selectedProfile ? (
                      <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-500">
                        {selectedProfile.filters.length === 0
                          ? "No row filters · "
                          : `${selectedProfile.filters.length} preference row(s) · `}
                        {selectedProfile.onlyWithStats ? "Stats required" : "Stats optional"}
                      </p>
                    ) : null}
                    <p className="text-xs text-neutral-500 dark:text-neutral-500">
                      <Link href="/preferences" className="portal-link text-sm">
                        Preferences
                      </Link>{" "}
                      — edit names and criteria
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="min-w-0 w-full flex-1 lg:min-w-0">
          <div className="overflow-hidden rounded-portal-lg border border-neutral-200/60 bg-gradient-to-b from-portal-surface via-portal-surface to-portal-filter-bg/25 shadow-portal dark:border-neutral-600/40 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900/95">
            {!loading && !error && players.length > 0 ? (
              <div className="flex flex-wrap items-center gap-3 border-b border-neutral-200/60 px-4 py-3.5 sm:px-5 dark:border-neutral-700/50">
                <span className="portal-badge tabular-nums text-sm">{total}</span>
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">players match your criteria</span>
              </div>
            ) : null}
            <div className="portal-panel-well min-h-[min(480px,70vh)] w-full min-w-0 border-0 bg-transparent shadow-none sm:p-5">
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
                      className="flex min-h-[112px] min-w-0 animate-pulse gap-3 rounded-portal border border-neutral-200/60 bg-portal-surface/90 p-3 shadow-portal-card dark:border-neutral-600/35 dark:bg-neutral-800/50"
                    >
                      <div className="h-[88px] w-[88px] shrink-0 rounded-full bg-neutral-200/90 dark:bg-neutral-700" />
                      <div className="min-w-0 flex-1 space-y-2 py-1">
                        <div className="h-3.5 w-[72%] rounded-md bg-neutral-200/90 dark:bg-neutral-700" />
                        <div className="h-3 w-[40%] rounded-md bg-neutral-200/90 dark:bg-neutral-700" />
                        <div className="h-3 w-[55%] rounded-md bg-neutral-200/90 dark:bg-neutral-700" />
                        <div className="h-3 w-full rounded-md bg-neutral-200/90 dark:bg-neutral-700" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="rounded-portal border border-amber-200/90 bg-amber-50/95 px-4 py-4 text-sm text-amber-950 shadow-sm dark:border-amber-900/45 dark:bg-amber-950/35 dark:text-amber-100">
                  <p className="font-semibold">Could not load players</p>
                  <p className="mt-1.5 leading-relaxed text-amber-900/85 dark:text-amber-100/90">{error}</p>
                </div>
              ) : players.length === 0 ? (
                <div className="portal-empty-well border-neutral-200/70 dark:border-neutral-600">
                  <p className="mx-auto max-w-md text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                    No players match these filters. If data is still syncing, try again shortly. For local development
                    run{" "}
                    <code className="rounded-md bg-portal-chrome/90 px-1.5 py-0.5 text-xs dark:bg-neutral-800">
                      npm run sync -w @available-player-portal/api
                    </code>
                    .
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:gap-5">
                    {players.map((p) => (
                      <PlayerCard
                        key={p.id}
                        player={p}
                        className="!max-w-none min-w-0 transition duration-200 hover:-translate-y-0.5 hover:shadow-portal"
                        onBeforeNavigate={saveDiscoverySnapshotBeforeProfile}
                      />
                    ))}
                  </div>
                  <div className="mt-6 flex flex-col items-stretch gap-4 rounded-portal-sm border border-neutral-200/50 bg-portal-filter-bg/40 px-4 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-700/45 dark:bg-neutral-800/35">
                    <p className="text-center text-sm text-neutral-600 dark:text-neutral-400 sm:text-left">
                      Showing{" "}
                      <span className="font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                        {players.length}
                      </span>
                      {" of "}
                      <span className="font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{total}</span>
                    </p>
                    <div className="flex flex-wrap justify-center gap-2 sm:justify-end">
                      {players.length < total ? (
                        <button
                          type="button"
                          onClick={() => void handleLoadMore()}
                          disabled={loading || loadingMore}
                          className="portal-btn-primary min-w-[7.5rem] shrink-0 disabled:opacity-50"
                        >
                          {loadingMore ? "Loading…" : "Load more"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </div>
      {transactionTypeModalOpen ? (
        <div
          className="portal-modal-overlay px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setTransactionTypeModalOpen(false)
          }}
        >
          <div
            className="portal-modal-card max-w-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tx-type-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="tx-type-modal-title"
              className="text-base font-semibold text-neutral-900 dark:text-neutral-100"
            >
              Transaction types
            </h3>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Players are sorted by newest matching transaction.
            </p>
            <div className="mt-2">
              <button
                type="button"
                className="text-sm font-semibold text-portal-accent underline-offset-2 transition hover:text-portal-accent-hover hover:underline dark:text-portal-accent"
                onClick={() => {
                  setTransactionTypes(["retired", "released", "freeAgent"])
                }}
              >
                Select all types
              </button>
            </div>
            <div className="portal-modal-inset mt-3 space-y-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-800 dark:text-neutral-200">
                <input
                  type="checkbox"
                  checked={transactionTypes.includes("retired")}
                  onChange={() => toggleTransactionType("retired")}
                  className="portal-checkbox"
                />
                Retired
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-800 dark:text-neutral-200">
                <input
                  type="checkbox"
                  checked={transactionTypes.includes("released")}
                  onChange={() => toggleTransactionType("released")}
                  className="portal-checkbox"
                />
                Released
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-800 dark:text-neutral-200">
                <input
                  type="checkbox"
                  checked={transactionTypes.includes("freeAgent")}
                  onChange={() => toggleTransactionType("freeAgent")}
                  className="portal-checkbox"
                />
                Free agent
              </label>
            </div>
            <div className="mt-5 flex flex-col border-t border-neutral-200/80 pt-4 dark:border-neutral-700/80 sm:flex-row sm:justify-end">
              <p className="mb-2 text-center text-xs text-neutral-500 sm:mb-0 sm:mr-auto sm:self-center sm:text-left dark:text-neutral-500">
                Changes apply as you tap; close when you’re done.
              </p>
              <button
                type="button"
                onClick={() => setTransactionTypeModalOpen(false)}
                className="portal-btn-primary w-full min-h-[2.5rem] sm:min-w-[6.5rem] sm:w-auto"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {rankingModalOpen ? (
        <div
          className="portal-modal-overlay px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRankingModalOpen(false)
          }}
        >
          <div
            className="portal-modal-card max-w-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ranking-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="ranking-modal-title"
              className="text-base font-semibold text-neutral-900 dark:text-neutral-100"
            >
              Set ranking preferences
            </h3>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Weights must add to 100%. Applies to {searchMode === "profile" ? "this saved profile" : "custom search"}.
            </p>
            {rankingPitcherTarget ? (
              <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                Pitcher target (<span className="font-mono">P</span>): position match is disabled (0%). Distribute 100%
                across the other four fields.
              </p>
            ) : null}
            <div className="portal-modal-inset mt-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="portal-field">
                Performance (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={rankingDraft.performance}
                  onChange={(e) =>
                    setRankingDraft((prev) => ({
                      ...prev,
                      performance: e.target.value,
                    }))
                  }
                  placeholder="eg 30"
                  className="portal-control"
                />
              </label>
              <label className="portal-field">
                Experience (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={rankingDraft.experience}
                  onChange={(e) =>
                    setRankingDraft((prev) => ({
                      ...prev,
                      experience: e.target.value,
                    }))
                  }
                  placeholder="eg 20"
                  className="portal-control"
                />
              </label>
              <div
                className={
                  rankingPitcherTarget
                    ? "opacity-50 [&_input]:cursor-not-allowed"
                    : undefined
                }
              >
                <label className="portal-field">
                  Position match (%)
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={rankingPitcherTarget ? "" : rankingDraft.positionMatch}
                    readOnly={rankingPitcherTarget}
                    disabled={rankingPitcherTarget}
                    onChange={(e) =>
                      setRankingDraft((prev) => ({
                        ...prev,
                        positionMatch: e.target.value,
                      }))
                    }
                    placeholder="eg 15"
                    className="portal-control"
                  />
                </label>
              </div>
              <label className="portal-field">
                Availability (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={rankingDraft.availability}
                  onChange={(e) =>
                    setRankingDraft((prev) => ({
                      ...prev,
                      availability: e.target.value,
                    }))
                  }
                  placeholder="eg 15"
                  className="portal-control"
                />
              </label>
              <label className="portal-field">
                Recent transactions (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={rankingDraft.recentTransactions}
                  onChange={(e) =>
                    setRankingDraft((prev) => ({
                      ...prev,
                      recentTransactions: e.target.value,
                    }))
                  }
                  placeholder="eg 20"
                  className="portal-control"
                />
              </label>
              <label className="portal-field">
                Target position
                <select
                  value={rankingDraft.targetPosition}
                  onChange={(e) =>
                    setRankingDraft((prev) => {
                      const targetPosition = e.target.value
                      return {
                        ...prev,
                        targetPosition,
                        positionMatch: isPitcherRankingTarget(targetPosition) ? "" : prev.positionMatch,
                      }
                    })
                  }
                  className="portal-control"
                >
                  <option value="">Select position</option>
                  {(() => {
                    const raw = rankingDraft.targetPosition.trim()
                    const known = (POSITION_FILTER_OPTIONS as readonly string[]).includes(raw)
                    if (raw && !known) {
                      return (
                        <option key="__saved__" value={raw}>
                          {raw} (saved)
                        </option>
                      )
                    }
                    return null
                  })()}
                  {POSITION_FILTER_OPTIONS.map((pos) => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                </select>
              </label>
              </div>
            </div>
            <p
              className={`mt-3 text-xs ${
                rankingWeightsValid
                  ? "text-neutral-500 dark:text-neutral-400"
                  : "text-red-600"
              }`}
            >
              Total:{" "}
              {rankingWeightTotal.toFixed(0)}
              %
            </p>
            {!rankingTargetPositionValid ? (
              <p className="mt-1 text-xs text-red-600">Please select a target position.</p>
            ) : null}
            <div className="portal-modal-footer !mt-5">
              <button
                type="button"
                onClick={() => setRankingModalOpen(false)}
                className="portal-btn-ghost w-full sm:min-w-[5.5rem] sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveRankingPreferences}
                disabled={!rankingWeightsValid || !rankingTargetPositionValid}
                className="portal-btn-primary w-full min-h-[2.5rem] sm:min-w-[5.5rem] sm:w-auto"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
