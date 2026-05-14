"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react"
import { PreferenceFiltersPanel } from "@/components/discovery/PreferenceFiltersPanel"
import { POSITION_FILTER_OPTIONS, newId, type UiFilter } from "@/components/discovery/DiscoveryFilterTypes"
import { profileSummaryLine } from "@/lib/discovery-query"
import { clearDiscoverySnapshot } from "@/lib/discovery-session"
import {
  EMPTY_RANKING_DRAFT,
  isPitcherRankingTarget,
  isRankingDraftEmpty,
  rankingDraftToPreferences,
  rankingDraftWeightValidation,
  rankingPreferencesToDraft,
  type RankingDraft,
} from "@/lib/rankingPreferencesForm"
import { deleteProfile, loadProfiles, type PlayerSearchProfile, upsertProfile } from "@/lib/player-profiles"

export default function PreferencesPage() {
  const [profiles, setProfiles] = useState<PlayerSearchProfile[]>([])
  const [editor, setEditor] = useState<null | { id?: string }>(null)
  const [name, setName] = useState("")
  const [filters, setFilters] = useState<UiFilter[]>([])
  const [onlyWithStats, setOnlyWithStats] = useState(false)
  const [rankingDraft, setRankingDraft] = useState<RankingDraft>(EMPTY_RANKING_DRAFT)

  useEffect(() => {
    setProfiles(loadProfiles())
  }, [])

  useEffect(() => {
    clearDiscoverySnapshot()
  }, [])

  function openNew() {
    setEditor({})
    setName("")
    setFilters([])
    setOnlyWithStats(false)
    setRankingDraft({ ...EMPTY_RANKING_DRAFT })
  }

  function openEdit(p: PlayerSearchProfile) {
    setEditor({ id: p.id })
    setName(p.name)
    setFilters(p.filters)
    setOnlyWithStats(p.onlyWithStats)
    setRankingDraft(rankingPreferencesToDraft(p.rankingPreferences))
  }

  function saveProfile() {
    const parsed = rankingDraftToPreferences(rankingDraft)
    const empty = isRankingDraftEmpty(rankingDraft)
    if (!parsed && !empty) return
    const id = editor?.id ?? newId()
    const existing = profiles.find((x) => x.id === id)
    const profile: PlayerSearchProfile = {
      id,
      name: name.trim() || "Untitled profile",
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      filters,
      onlyWithStats,
      ...(parsed ? { rankingPreferences: parsed } : {}),
    }
    upsertProfile(profile)
    setProfiles(loadProfiles())
    setEditor(null)
  }

  const {
    pitcherTarget: rankingPitcherTarget,
    total: rankingWeightTotal,
    weightsValid,
    targetSelected: targetPositionSelected,
  } = rankingDraftWeightValidation(rankingDraft)

  function removeProfile(id: string) {
    deleteProfile(id)
    setProfiles(loadProfiles())
    if (editor?.id === id) setEditor(null)
  }

  return (
    <main className="portal-page">
      <h1 className="sr-only">Preferences</h1>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-portal-accent underline transition hover:text-portal-accent-hover"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to home
          </Link>
        </div>
        {!editor ? (
          <button
            type="button"
            onClick={openNew}
            className="portal-btn-secondary shrink-0"
          >
            <Plus className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
            New profile
          </button>
        ) : null}
      </div>

      {editor ? (
        <section>
          <div className="portal-filter-shell flex flex-col gap-5 sm:p-5">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
              {editor.id ? "Edit profile" : "New profile"}
            </h2>
            <div className="flex flex-row flex-wrap items-center gap-x-4 gap-y-2">
              <label
                htmlFor="profile-name"
                className="shrink-0 whitespace-nowrap text-sm font-medium text-neutral-700 dark:text-neutral-300"
              >
                Profile name
              </label>
              <input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Young AL East arms"
                className="portal-control min-w-0 flex-1 sm:max-w-md"
              />
            </div>
            <div className="flex max-w-xl flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Search criteria
              </p>
              <div className="portal-panel-well sm:p-5">
                <PreferenceFiltersPanel
                  filters={filters}
                  onFiltersChange={setFilters}
                  onlyWithStats={onlyWithStats}
                  onOnlyWithStatsChange={setOnlyWithStats}
                />
              </div>
            </div>
            <div className="flex max-w-2xl flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Ranking preferences
              </p>
              <div className="portal-panel-well grid grid-cols-1 gap-4 sm:grid-cols-2 sm:p-5">
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
                    rankingPitcherTarget ? "opacity-50 [&_input]:cursor-not-allowed" : undefined
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
              {rankingPitcherTarget ? (
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Pitcher target (<span className="font-mono">P</span>): position match is not used (counts as 0%).
                  Allocate its share across the other four weights so the total stays 100%.
                </p>
              ) : null}
              <p
                className={`text-xs ${weightsValid && targetPositionSelected ? "text-neutral-500 dark:text-neutral-400" : "text-red-600 dark:text-red-400"}`}
              >
                Total: {Number.isFinite(rankingWeightTotal) ? rankingWeightTotal.toFixed(0) : "—"}% (must equal 100%)
                {!targetPositionSelected ? " · Select a target position." : null}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                className="portal-btn-primary"
                onClick={saveProfile}
                disabled={
                  (!weightsValid || !targetPositionSelected) && !isRankingDraftEmpty(rankingDraft)
                }
              >
                Save profile
              </button>
              <button
                type="button"
                className="portal-btn-ghost"
                onClick={() => setEditor(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section>
        <div className="portal-filter-shell flex flex-col gap-4 sm:p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Saved profiles
          </h2>
          <div className="portal-panel-well sm:p-5">
            {profiles.length === 0 ? (
              <div className="portal-empty-well text-sm text-neutral-600 dark:text-neutral-400">
                <p className="text-sm text-neutral-700 dark:text-neutral-200">
                  No profiles yet. Create one above, then choose <strong>Saved profile</strong> on the home page to
                  search with it.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-4">
                {profiles.map((p) => (
                  <li
                    key={p.id}
                    className="portal-surface flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="font-semibold text-neutral-900 dark:text-neutral-100">{p.name}</p>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">
                        {profileSummaryLine(p.filters, p.onlyWithStats)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className="portal-btn-secondary-sm"
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => removeProfile(p.id)}
                        className="portal-btn-danger-outline"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
