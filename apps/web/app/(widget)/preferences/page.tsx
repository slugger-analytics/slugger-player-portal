"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react"
import { PreferenceFiltersPanel } from "@/components/discovery/PreferenceFiltersPanel"
import { newId, type UiFilter } from "@/components/discovery/DiscoveryFilterTypes"
import { profileSummaryLine } from "@/lib/discovery-query"
import { deleteProfile, loadProfiles, type PlayerSearchProfile, upsertProfile } from "@/lib/player-profiles"

export default function PreferencesPage() {
  const [profiles, setProfiles] = useState<PlayerSearchProfile[]>([])
  const [editor, setEditor] = useState<null | { id?: string }>(null)
  const [name, setName] = useState("")
  const [filters, setFilters] = useState<UiFilter[]>([])
  const [onlyWithStats, setOnlyWithStats] = useState(false)

  useEffect(() => {
    setProfiles(loadProfiles())
  }, [])

  function openNew() {
    setEditor({})
    setName("")
    setFilters([])
    setOnlyWithStats(false)
  }

  function openEdit(p: PlayerSearchProfile) {
    setEditor({ id: p.id })
    setName(p.name)
    setFilters(p.filters)
    setOnlyWithStats(p.onlyWithStats)
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
    }
    upsertProfile(profile)
    setProfiles(loadProfiles())
    setEditor(null)
  }

  function removeProfile(id: string) {
    deleteProfile(id)
    setProfiles(loadProfiles())
    if (editor?.id === id) setEditor(null)
  }

  return (
    <main className="px-4 pb-10 sm:px-5">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/dashboard"
            className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-[#4A5F78] hover:underline dark:text-portal-accent"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to home
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-black dark:text-neutral-100">Preferences</h1>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            Create <strong>player profiles</strong> with manual search criteria (position, age, team, status, max
            experience level, and whether stats are required). Use them on the home page under{" "}
            <strong>Saved profile</strong>.
          </p>
        </div>
        {!editor ? (
          <button
            type="button"
            onClick={openNew}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-portal-sm border border-portal-filter-border bg-portal-surface px-4 py-2.5 text-sm font-semibold text-[#4A5F78] shadow-portal-card transition hover:border-portal-accent hover:bg-portal-filter-bg/60 dark:text-portal-accent"
          >
            <Plus className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
            New profile
          </button>
        ) : null}
      </div>

      {editor ? (
        <section className="mb-10 rounded-portal-lg border border-portal-filter-border bg-portal-filter-bg/30 p-4 dark:border-neutral-600/50 sm:p-5">
          <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
            {editor.id ? "Edit profile" : "New profile"}
          </h2>
          <div className="mt-3 flex flex-row flex-wrap items-center gap-x-4 gap-y-2">
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
              className="min-w-0 flex-1 rounded-portal-sm border border-neutral-300 bg-portal-surface px-3 py-2.5 text-sm shadow-sm focus:border-portal-accent focus:outline-none focus:ring-2 focus:ring-portal-accent/25 dark:border-neutral-600 sm:max-w-md"
            />
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Search criteria
          </p>
          <div className="mt-2 max-w-xl">
            <PreferenceFiltersPanel
              filters={filters}
              onFiltersChange={setFilters}
              onlyWithStats={onlyWithStats}
              onOnlyWithStatsChange={setOnlyWithStats}
            />
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <button type="button" className="portal-btn-primary" onClick={saveProfile}>
              Save profile
            </button>
            <button type="button" className="portal-btn-ghost" onClick={() => setEditor(null)}>
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Saved profiles
        </h2>
        {profiles.length === 0 ? (
          <p className="rounded-portal-sm border border-dashed border-portal-filter-border bg-portal-surface px-4 py-8 text-center text-sm text-neutral-600 dark:border-neutral-600 dark:text-neutral-400">
            No profiles yet. Create one above, then choose <strong>Saved profile</strong> on the home page to search with
            it.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {profiles.map((p) => (
              <li
                key={p.id}
                className="flex flex-col gap-3 rounded-portal-sm border border-neutral-200/90 bg-portal-surface p-4 shadow-portal-card dark:border-neutral-600/50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-neutral-900 dark:text-neutral-100">{p.name}</p>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                    {profileSummaryLine(p.filters, p.onlyWithStats)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    className="inline-flex items-center gap-1.5 rounded-portal-sm border border-portal-filter-border px-3 py-2 text-sm font-semibold text-[#4A5F78] transition hover:bg-portal-filter-bg dark:text-portal-accent"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => removeProfile(p.id)}
                    className="inline-flex items-center gap-1.5 rounded-portal-sm border border-red-200/90 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
