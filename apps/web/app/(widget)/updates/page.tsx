"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { PlayerCard } from "@/components/discovery/PlayerCard"
import { buildPlayerListParams } from "@/lib/discovery-query"
import { fetchPlayerSummaries, fetchPlayerSummaryForCard } from "@/lib/api"
import { loadProfiles, type PlayerSearchProfile } from "@/lib/player-profiles"
import {
  markProfilePlayersSeen,
  readProfileUpdatesSeen,
  type ProfileSeenMap,
} from "@/lib/profileUpdatesSeenStorage"
import { useUpdatesWatch } from "@/components/updates/UpdatesWatchProvider"
import type { PlayerSummary } from "@available-player-portal/shared"

const PROFILE_PREVIEW_LIMIT = 12

type ProfileSectionState = {
  loading: boolean
  error: string | null
  players: PlayerSummary[]
}

export default function UpdatesPage() {
  const { watchIds } = useUpdatesWatch()
  const [profiles, setProfiles] = useState<PlayerSearchProfile[]>([])
  const [byProfile, setByProfile] = useState<Record<string, ProfileSectionState>>({})
  const [watchedSummaries, setWatchedSummaries] = useState<PlayerSummary[]>([])
  const [watchedLoading, setWatchedLoading] = useState(true)
  const [watchedError, setWatchedError] = useState<string | null>(null)
  const [seenMap, setSeenMap] = useState<ProfileSeenMap>({})

  const refreshProfiles = useCallback(() => {
    setProfiles(loadProfiles())
  }, [])

  useEffect(() => {
    setSeenMap(readProfileUpdatesSeen())
  }, [])

  useEffect(() => {
    refreshProfiles()
    const onVis = () => {
      if (document.visibilityState === "visible") refreshProfiles()
    }
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [refreshProfiles])

  useEffect(() => {
    if (profiles.length === 0) {
      setByProfile({})
      return
    }
    let cancelled = false
    const next: Record<string, ProfileSectionState> = {}
    for (const p of profiles) {
      next[p.id] = { loading: true, error: null, players: [] }
    }
    setByProfile(next)

    void (async () => {
      for (const p of profiles) {
        try {
          const { players } = await fetchPlayerSummaries({
            ...buildPlayerListParams(p.filters, p.onlyWithStats),
            limit: PROFILE_PREVIEW_LIMIT,
            offset: 0,
          })
          if (!cancelled) {
            setByProfile((prev) => ({
              ...prev,
              [p.id]: { loading: false, error: null, players },
            }))
          }
        } catch (e) {
          if (!cancelled) {
            setByProfile((prev) => ({
              ...prev,
              [p.id]: {
                loading: false,
                error: e instanceof Error ? e.message : "Failed to load",
                players: [],
              },
            }))
          }
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [profiles])

  useEffect(() => {
    if (watchIds.length === 0) {
      setWatchedSummaries([])
      setWatchedLoading(false)
      setWatchedError(null)
      return
    }
    let cancelled = false
    setWatchedLoading(true)
    setWatchedError(null)
    void (async () => {
      try {
        const rows = await Promise.all(
          watchIds.map(async (id) => {
            try {
              return await fetchPlayerSummaryForCard(id)
            } catch {
              return null
            }
          }),
        )
        if (!cancelled) {
          setWatchedSummaries(rows.filter((x): x is PlayerSummary => x != null))
          setWatchedLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          setWatchedError(e instanceof Error ? e.message : "Failed to load watched players")
          setWatchedLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [watchIds])

  /** “New” only after you’ve marked a profile at least once (baseline); then any newly appearing row is new. */
  function isNewForProfile(profileId: string, playerId: string): boolean {
    const list = seenMap[profileId]
    if (!list || list.length === 0) return false
    return !list.includes(playerId)
  }

  function handleMarkProfileRead(profileId: string, playerIds: string[]) {
    if (playerIds.length === 0) return
    markProfilePlayersSeen(profileId, playerIds)
    setSeenMap(readProfileUpdatesSeen())
  }

  return (
    <main className="px-4 pb-10 sm:px-5">
      <h1 className="text-3xl font-bold tracking-tight text-black dark:text-neutral-100">Updates</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        See recent players that match your saved profiles, and players you&apos;ve marked with the bell icon for
        follow-ups.
      </p>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          From your saved profiles
        </h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Matches your criteria from{" "}
          <Link href="/preferences" className="font-semibold text-[#4A5F78] underline dark:text-portal-accent">
            Preferences
          </Link>
          . Use <strong>Mark as read</strong> to set a baseline; players that appear in the list later show a{" "}
          <strong>New</strong> badge until you mark again.
        </p>

        {profiles.length === 0 ? (
          <p className="mt-4 rounded-portal-sm border border-dashed border-portal-filter-border bg-portal-surface px-4 py-6 text-sm text-neutral-600 dark:border-neutral-600 dark:text-neutral-400">
            No saved profiles yet.{" "}
            <Link href="/preferences" className="font-semibold text-[#4A5F78] underline dark:text-portal-accent">
              Create a profile
            </Link>{" "}
            to see matching players here.
          </p>
        ) : (
          <div className="mt-6 flex flex-col gap-8">
            {profiles.map((p) => {
              const state = byProfile[p.id]
              const players = state?.players ?? []
              return (
                <div key={p.id} className="rounded-portal-lg border border-portal-filter-border bg-portal-filter-bg/20 p-4 dark:border-neutral-600/50">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">{p.name}</h3>
                      <p className="text-xs text-neutral-500 dark:text-neutral-500">
                        Recent matches (up to {PROFILE_PREVIEW_LIMIT})
                      </p>
                    </div>
                    {players.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => handleMarkProfileRead(p.id, players.map((x) => x.id))}
                        className="shrink-0 rounded-portal-sm border border-portal-filter-border bg-portal-surface px-3 py-1.5 text-xs font-semibold text-[#4A5F78] shadow-portal-card transition hover:border-portal-accent dark:text-portal-accent"
                      >
                        Mark as read
                      </button>
                    ) : null}
                  </div>
                  {state?.loading ? (
                    <p className="mt-4 text-sm text-neutral-500">Loading…</p>
                  ) : state?.error ? (
                    <p className="mt-4 text-sm text-red-700 dark:text-red-400">{state.error}</p>
                  ) : players.length === 0 ? (
                    <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">No players match this profile right now.</p>
                  ) : (
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {players.map((pl) => (
                        <div key={pl.id} className="relative">
                          {isNewForProfile(p.id, pl.id) ? (
                            <span className="absolute left-2 top-2 z-20 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white shadow-sm">
                              New
                            </span>
                          ) : null}
                          <PlayerCard player={pl} className="!max-w-none" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="mt-12 border-t border-neutral-200/80 pt-10 dark:border-neutral-700/80">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Players you follow
        </h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Use the bell on any player card (next to the heart) to add or remove them here.
        </p>
        {watchedLoading ? (
          <p className="mt-4 text-sm text-neutral-500">Loading…</p>
        ) : watchedError ? (
          <p className="mt-4 text-sm text-red-700 dark:text-red-400">{watchedError}</p>
        ) : watchIds.length === 0 ? (
          <p className="mt-4 rounded-portal-sm border border-dashed border-portal-filter-border bg-portal-surface px-4 py-6 text-sm text-neutral-600 dark:border-neutral-600 dark:text-neutral-400">
            No players yet. Open a player from discovery or favorites and tap the bell to track them for updates.
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {watchedSummaries.map((pl) => (
              <PlayerCard key={pl.id} player={pl} className="!max-w-none" />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
