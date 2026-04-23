"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { PlayerCard } from "@/components/discovery/PlayerCard"
import { fetchPlayerSummaryForCard } from "@/lib/api"
import { clearDiscoverySnapshot } from "@/lib/discovery-session"
import {
  PROFILE_UPDATE_DISPLAY_LIMIT,
  loadPendingMatchesForProfile,
} from "@/lib/loadProfileUpdateMatches"
import { acknowledgePlayerSnapshots, readProfileAcks, writeProfileAcks } from "@/lib/profileUpdatesAck"
import { loadProfiles, type PlayerSearchProfile } from "@/lib/player-profiles"
import { useUpdatesWatch } from "@/components/updates/UpdatesWatchProvider"
import type { PlayerSummary } from "@available-player-portal/shared"

function parseTransactionMs(d: string | null | undefined): number | null {
  const s = d?.trim()
  if (!s) return null
  const t = Date.parse(`${s}T12:00:00.000Z`)
  return Number.isNaN(t) ? null : t
}

/** Order profile sections by newest pending activity. */
function maxPreviewTransactionMs(players: PlayerSummary[]): number {
  let max = -Infinity
  for (const pl of players) {
    const t = parseTransactionMs(pl.mostRecentTransactionDate)
    if (t != null) max = Math.max(max, t)
  }
  return max
}

type ProfileSectionState = {
  loading: boolean
  error: string | null
  players: PlayerSummary[]
  /** Row count matching the profile (from API); used for empty copy. */
  matchTotal: number | null
}

export default function UpdatesPage() {
  const { watchIds } = useUpdatesWatch()

  useEffect(() => {
    clearDiscoverySnapshot()
  }, [])

  const [profiles, setProfiles] = useState<PlayerSearchProfile[]>([])
  const [byProfile, setByProfile] = useState<Record<string, ProfileSectionState>>({})
  const [watchedSummaries, setWatchedSummaries] = useState<PlayerSummary[]>([])
  const [watchedLoading, setWatchedLoading] = useState(true)
  const [watchedError, setWatchedError] = useState<string | null>(null)

  const refreshProfiles = useCallback(() => {
    setProfiles(loadProfiles())
  }, [])

  const profilesOrdered = useMemo(() => {
    return [...profiles].sort((a, b) => {
      const sa = maxPreviewTransactionMs(byProfile[a.id]?.players ?? [])
      const sb = maxPreviewTransactionMs(byProfile[b.id]?.players ?? [])
      if (sb !== sa) return sb - sa
      return a.name.localeCompare(b.name)
    })
  }, [profiles, byProfile])

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
      next[p.id] = { loading: true, error: null, players: [], matchTotal: null }
    }
    setByProfile(next)

    void (async () => {
      for (const p of profiles) {
        try {
          const acksNow = readProfileAcks()
          const { players, acks, migratedAcksPersist, matchTotal } = await loadPendingMatchesForProfile(p, acksNow)
          if (migratedAcksPersist) {
            writeProfileAcks(acks)
          }
          if (!cancelled) {
            setByProfile((prev) => ({
              ...prev,
              [p.id]: {
                loading: false,
                error: null,
                players,
                matchTotal,
              },
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
                matchTotal: null,
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

  function handleMarkProfileRead(profileId: string, players: PlayerSummary[]) {
    if (players.length === 0) return
    acknowledgePlayerSnapshots(
      profileId,
      players.map((pl) => ({
        playerId: pl.id,
        mostRecentTransactionDate: pl.mostRecentTransactionDate?.trim() || null,
      })),
    )
    void (async () => {
      const p = profiles.find((x) => x.id === profileId)
      if (!p) return
      try {
        const { players: nextPlayers, acks, migratedAcksPersist, matchTotal } =
          await loadPendingMatchesForProfile(p, readProfileAcks())
        if (migratedAcksPersist) writeProfileAcks(acks)
        setByProfile((prev) => ({
          ...prev,
          [profileId]: {
            loading: false,
            error: null,
            players: nextPlayers,
            matchTotal,
          },
        }))
      } catch (e) {
        setByProfile((prev) => ({
          ...prev,
          [profileId]: {
            loading: false,
            error: e instanceof Error ? e.message : "Failed to load",
            players: [],
            matchTotal: null,
          },
        }))
      }
    })()
  }

  const linkClass = "portal-link text-sm"

  return (
    <main className="portal-page">
      <h1 className="sr-only">Updates</h1>

      <section>
        <div className="portal-filter-shell flex flex-col gap-4 sm:p-5">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              From your saved profiles
            </h2>
            <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
              Lists are built from the search criteria you save in{" "}
              <Link href="/preferences" className={linkClass}>Preferences</Link>.
            </p>
            <ul className="list-inside list-disc space-y-1.5 pl-0.5 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400 sm:list-outside sm:pl-5">
              <li>
                You only see players with <strong className="font-medium text-neutral-800 dark:text-neutral-200">new or
                unread</strong> updates.
              </li>
              <li>
                We show at most <strong className="font-medium text-neutral-800 dark:text-neutral-200">
                  {PROFILE_UPDATE_DISPLAY_LIMIT} players
                </strong>{" "}
                per profile at once.
              </li>
              <li>
                <strong className="font-medium text-neutral-800 dark:text-neutral-200">Mark as read</strong> clears
                the current list so the next batch can load.
              </li>
              <li>
                If a player&apos;s transactions change again later, they can reappear here.
              </li>
            </ul>
          </div>

          <div className="portal-panel-well sm:p-5">
            {profilesOrdered.length === 0 ? (
              <div className="portal-empty-well text-left text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                <p className="font-medium text-neutral-800 dark:text-neutral-200">No saved profiles yet</p>
                <p className="mt-2">
                  Add a search profile in{" "}
                  <Link href="/preferences" className={linkClass}>Preferences</Link>{" "}
                  to see new matches for that criteria in this section.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {profilesOrdered.map((p) => {
                  const state = byProfile[p.id]
                  const players = state?.players ?? []
                  const matchTotal = state?.matchTotal
                  const caughtUp =
                    !state?.loading &&
                    !state?.error &&
                    players.length === 0 &&
                    matchTotal != null &&
                    matchTotal > 0
                  return (
                    <div key={p.id} className="portal-surface flex flex-col gap-4 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">{p.name}</h3>
                          <p className="text-xs text-neutral-500 dark:text-neutral-500">
                            Updates (up to {PROFILE_UPDATE_DISPLAY_LIMIT} at a time)
                          </p>
                        </div>
                        {players.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => handleMarkProfileRead(p.id, players)}
                            className="portal-btn-secondary-xs shrink-0"
                          >
                            Mark as read
                          </button>
                        ) : null}
                      </div>
                      {state?.loading ? (
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>
                      ) : state?.error ? (
                        <p className="text-sm text-red-700 dark:text-red-400">{state.error}</p>
                      ) : players.length === 0 && matchTotal === 0 ? (
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">
                          No players match this profile right now.
                        </p>
                      ) : caughtUp ? (
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">
                          You&apos;re caught up — no new updates for this profile. Check back after more transaction
                          activity, or review matches in <Link href="/dashboard" className={linkClass}>Discovery</Link>.
                        </p>
                      ) : players.length === 0 ? (
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">No new updates right now.</p>
                      ) : (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          {players.map((pl) => (
                            <PlayerCard key={pl.id} player={pl} className="!max-w-none" />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="portal-filter-shell flex flex-col gap-4 sm:p-5">
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Players you follow</h2>
            <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
              On any player card, tap the{" "}
              <strong className="font-medium text-neutral-800 dark:text-neutral-200">bell</strong> next to the heart to
              follow or unfollow. Players you follow appear here when there is something new to check.
            </p>
          </div>

          <div className="portal-panel-well sm:p-5">
            {watchedLoading ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>
            ) : watchedError ? (
              <p className="text-sm text-red-700 dark:text-red-400">{watchedError}</p>
            ) : watchIds.length === 0 ? (
              <div className="portal-empty-well text-left text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                <p className="font-medium text-neutral-800 dark:text-neutral-200">You aren’t following anyone yet</p>
                <p className="mt-2">
                  Open a player from <Link href="/dashboard" className={linkClass}>Discovery</Link> or{" "}
                  <Link href="/favorites" className={linkClass}>Favorites</Link>, then tap the bell on their card to add
                  them here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {watchedSummaries.map((pl) => (
                  <PlayerCard key={pl.id} player={pl} className="!max-w-none" />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
