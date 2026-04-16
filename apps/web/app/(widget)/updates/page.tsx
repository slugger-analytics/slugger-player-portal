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
          . Only players with <strong>new</strong> updates (or not yet marked read) appear — up to{" "}
          {PROFILE_UPDATE_DISPLAY_LIMIT} at a time. Use <strong>Mark as read</strong> to see the next batch. If
          someone&apos;s transaction history changes again, they show up here again.
        </p>

        {profilesOrdered.length === 0 ? (
          <p className="mt-4 rounded-portal-sm border border-dashed border-portal-filter-border bg-portal-surface px-4 py-6 text-sm text-neutral-600 dark:border-neutral-600 dark:text-neutral-400">
            No saved profiles yet.{" "}
            <Link href="/preferences" className="font-semibold text-[#4A5F78] underline dark:text-portal-accent">
              Create a profile
            </Link>{" "}
            to see matching players here.
          </p>
        ) : (
          <div className="mt-6 flex flex-col gap-8">
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
                <div
                  key={p.id}
                  className="rounded-portal-lg border border-portal-filter-border bg-portal-filter-bg/20 p-4 dark:border-neutral-600/50"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">{p.name}</h3>
                      <p className="text-xs text-neutral-500 dark:text-neutral-500">
                        Updates (up to {PROFILE_UPDATE_DISPLAY_LIMIT} at a time)
                      </p>
                    </div>
                    {players.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => handleMarkProfileRead(p.id, players)}
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
                  ) : players.length === 0 && matchTotal === 0 ? (
                    <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
                      No players match this profile right now.
                    </p>
                  ) : caughtUp ? (
                    <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
                      You&apos;re caught up — no new updates for this profile. Check back after more transaction
                      activity, or review matches in{" "}
                      <Link href="/dashboard" className="font-semibold text-[#4A5F78] underline dark:text-portal-accent">
                        Discovery
                      </Link>
                      .
                    </p>
                  ) : players.length === 0 ? (
                    <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">No new updates right now.</p>
                  ) : (
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
