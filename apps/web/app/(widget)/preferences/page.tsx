"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react"
import type { RankingPreferences } from "@available-player-portal/shared"
import { PreferenceFiltersPanel } from "@/components/discovery/PreferenceFiltersPanel"
import { newId, type UiFilter } from "@/components/discovery/DiscoveryFilterTypes"
import { profileSummaryLine } from "@/lib/discovery-query"
import { clearDiscoverySnapshot } from "@/lib/discovery-session"
import { deleteProfile, loadProfiles, type PlayerSearchProfile, upsertProfile } from "@/lib/player-profiles"

const DEFAULT_RANKING_PREFERENCES: RankingPreferences = {
  weights: {
    performance: 0.3,
    experience: 0.2,
    positionMatch: 0.15,
    availability: 0.15,
    recentTransactions: 0.2,
  },
  targetPosition: "",
}

export default function PreferencesPage() {
  const [profiles, setProfiles] = useState<PlayerSearchProfile[]>([])
  const [editor, setEditor] = useState<null | { id?: string }>(null)
  const [name, setName] = useState("")
  const [filters, setFilters] = useState<UiFilter[]>([])
  const [onlyWithStats, setOnlyWithStats] = useState(false)
  const [rankingPreferences, setRankingPreferences] = useState<RankingPreferences>(DEFAULT_RANKING_PREFERENCES)

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
    setRankingPreferences(DEFAULT_RANKING_PREFERENCES)
  }

  function openEdit(p: PlayerSearchProfile) {
    setEditor({ id: p.id })
    setName(p.name)
    setFilters(p.filters)
    setOnlyWithStats(p.onlyWithStats)
    setRankingPreferences(p.rankingPreferences ?? DEFAULT_RANKING_PREFERENCES)
  }

  function saveProfile() {
    const id = editor?.id ?? newId()
    const existing = profiles.find((x) => x.id === id)
    const profile: PlayerSearchProfile = {
      id,
      name: name.trim() || "Untitled profile",
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      filters,
      onlyWithStats,
      rankingPreferences,
    }
    upsertProfile(profile)
    setProfiles(loadProfiles())
    setEditor(null)
  }

  const weightTotal =
    rankingPreferences.weights.performance +
    rankingPreferences.weights.experience +
    rankingPreferences.weights.positionMatch +
    rankingPreferences.weights.availability +
    rankingPreferences.weights.recentTransactions
  const weightsValid = Math.abs(weightTotal - 1) < 0.00001

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
              Performance weight (%)
              <input
                type="number"
                min={0}
                max={100}
                value={Math.round(rankingPreferences.weights.performance * 100)}
                onChange={(e) =>
                  setRankingPreferences((prev) => ({
                    ...prev,
                    weights: { ...prev.weights, performance: Number(e.target.value || 0) / 100 },
                  }))
                }
                className="portal-control"
              />
              </label>
              <label className="portal-field">
              Experience weight (%)
              <input
                type="number"
                min={0}
                max={100}
                value={Math.round(rankingPreferences.weights.experience * 100)}
                onChange={(e) =>
                  setRankingPreferences((prev) => ({
                    ...prev,
                    weights: { ...prev.weights, experience: Number(e.target.value || 0) / 100 },
                  }))
                }
                className="portal-control"
              />
              </label>
              <label className="portal-field">
              Position match weight (%)
              <input
                type="number"
                min={0}
                max={100}
                value={Math.round(rankingPreferences.weights.positionMatch * 100)}
                onChange={(e) =>
                  setRankingPreferences((prev) => ({
                    ...prev,
                    weights: { ...prev.weights, positionMatch: Number(e.target.value || 0) / 100 },
                  }))
                }
                className="portal-control"
              />
              </label>
              <label className="portal-field">
              Availability weight (%)
              <input
                type="number"
                min={0}
                max={100}
                value={Math.round(rankingPreferences.weights.availability * 100)}
                onChange={(e) =>
                  setRankingPreferences((prev) => ({
                    ...prev,
                    weights: { ...prev.weights, availability: Number(e.target.value || 0) / 100 },
                  }))
                }
                className="portal-control"
              />
              </label>
              <label className="portal-field">
              Recent transactions weight (%)
              <input
                type="number"
                min={0}
                max={100}
                value={Math.round(rankingPreferences.weights.recentTransactions * 100)}
                onChange={(e) =>
                  setRankingPreferences((prev) => ({
                    ...prev,
                    weights: { ...prev.weights, recentTransactions: Number(e.target.value || 0) / 100 },
                  }))
                }
                className="portal-control"
              />
              </label>
              <label className="portal-field">
              Target position (exact match bonus)
              <input
                value={rankingPreferences.targetPosition ?? ""}
                onChange={(e) =>
                  setRankingPreferences((prev) => ({
                    ...prev,
                    targetPosition: e.target.value,
                  }))
                }
                placeholder="e.g. Pitcher"
                className="portal-control"
              />
              </label>
            </div>
              <p
                className={`text-xs ${weightsValid ? "text-neutral-500 dark:text-neutral-400" : "text-red-600 dark:text-red-400"}`}
              >
                Weight total: {(weightTotal * 100).toFixed(0)}% (must equal 100%)
              </p>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" className="portal-btn-primary" onClick={saveProfile} disabled={!weightsValid}>
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
