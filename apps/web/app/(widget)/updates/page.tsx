"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { PlayerCard } from "@/components/discovery/PlayerCard"
import {
  fetchNotificationEvents,
  fetchPlayerSummaryForCard,
  markNotificationEventsRead,
  type NotificationEventItem,
} from "@/lib/api"
import { clearDiscoverySnapshot } from "@/lib/discovery-session"
import {
  PROFILE_UPDATE_DISPLAY_LIMIT,
  loadPendingMatchesForProfile,
} from "@/lib/loadProfileUpdateMatches"
import { acknowledgePlayerSnapshots, readProfileAcks, writeProfileAcks } from "@/lib/profileUpdatesAck"
import { loadProfilesFromServer, type PlayerSearchProfile } from "@/lib/player-profiles"
import { useUpdatesWatch } from "@/components/updates/UpdatesWatchProvider"
import type { PlayerSummary } from "@available-player-portal/shared"

function parseTransactionMs(d: string | null | undefined): number | null {
  const s = d?.trim()
  if (!s) return null
  const t = Date.parse(`${s}T12:00:00.000Z`)
  return Number.isNaN(t) ? null : t
}

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
  matchTotal: number | null
}

export default function UpdatesPage() {
  const { watchIds } = useUpdatesWatch()
  const [profiles, setProfiles] = useState<PlayerSearchProfile[]>([])
  const [byProfile, setByProfile] = useState<Record<string, ProfileSectionState>>({})
  const [watchedSummaries, setWatchedSummaries] = useState<PlayerSummary[]>([])
  const [events, setEvents] = useState<NotificationEventItem[]>([])
  const [watchedLoading, setWatchedLoading] = useState(true)
  const [watchedError, setWatchedError] = useState<string | null>(null)

  useEffect(() => {
    clearDiscoverySnapshot()
  }, [])

  const refreshProfiles = useCallback(() => {
    void loadProfilesFromServer().then(setProfiles)
  }, [])

  const refreshEvents = useCallback(() => {
    void fetchNotificationEvents()
      .then(setEvents)
      .catch(() => setEvents([]))
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
    refreshEvents()
    const onVis = () => {
      if (document.visibilityState === "visible") refreshProfiles()
    }
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [refreshProfiles, refreshEvents])

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
          if (migratedAcksPersist) writeProfileAcks(acks)
          if (!cancelled) {
            setByProfile((prev) => ({
              ...prev,
              [p.id]: { loading: false, error: null, players, matchTotal },
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
        const { players: nextPlayers, acks, migratedAcksPersist, matchTotal } = await loadPendingMatchesForProfile(
          p,
          readProfileAcks(),
        )
        if (migratedAcksPersist) writeProfileAcks(acks)
        setByProfile((prev) => ({
          ...prev,
          [profileId]: { loading: false, error: null, players: nextPlayers, matchTotal },
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
    const profileEventIds = events
      .filter((e) => e.type === "PROFILE" && e.savedProfile?.id === profileId && !e.readAt)
      .map((e) => e.id)
    void markNotificationEventsRead(profileEventIds).then(refreshEvents)
  }

  const linkClass = "portal-link text-sm"
  const latestEventByPlayerId = useMemo(() => {
    const out = new Map<string, NotificationEventItem>()
    for (const event of events) {
      if (!out.has(event.player.id)) out.set(event.player.id, event)
    }
    return out
  }, [events])

  return (
    <main className="portal-page">
      <h1 className="sr-only">Updates</h1>
      <section>
        <div className="portal-filter-shell flex flex-col gap-4 sm:p-5">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">From your saved profiles</h2>
            <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
              Lists are built from the search criteria you save in{" "}
              <Link href="/preferences" className={linkClass}>
                Preferences
              </Link>
              .
            </p>
          </div>
          <div className="portal-panel-well sm:p-5">
            {profilesOrdered.length === 0 ? (
              <div className="portal-empty-well text-left text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                <p className="font-medium text-neutral-800 dark:text-neutral-200">No saved profiles yet</p>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {profilesOrdered.map((p) => {
                  const state = byProfile[p.id]
                  const players = state?.players ?? []
                  const matchTotal = state?.matchTotal
                  const latestProfileEvent = events.find(
                    (event) => event.type === "PROFILE" && event.savedProfile?.id === p.id && !event.readAt,
                  )
                  const caughtUp =
                    !state?.loading && !state?.error && players.length === 0 && matchTotal != null && matchTotal > 0
                  return (
                    <div key={p.id} className="portal-surface flex flex-col gap-4 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">{p.name}</h3>
                          <p className="text-xs text-neutral-500 dark:text-neutral-500">
                            Updates (up to {PROFILE_UPDATE_DISPLAY_LIMIT} at a time)
                          </p>
                          {latestProfileEvent ? (
                            <p className="text-xs text-neutral-500 dark:text-neutral-500">
                              Latest notification: {new Date(latestProfileEvent.createdAt).toLocaleString()}
                            </p>
                          ) : null}
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
                          You&apos;re caught up. Check{" "}
                          <Link href="/dashboard" className={linkClass}>
                            Discovery
                          </Link>{" "}
                          for more.
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
          </div>
          <div className="portal-panel-well sm:p-5">
            {watchedLoading ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>
            ) : watchedError ? (
              <p className="text-sm text-red-700 dark:text-red-400">{watchedError}</p>
            ) : watchIds.length === 0 ? (
              <div className="portal-empty-well text-left text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                <p className="font-medium text-neutral-800 dark:text-neutral-200">You aren’t following anyone yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {watchedSummaries.map((pl) => (
                  <div key={pl.id}>
                    <PlayerCard player={pl} className="!max-w-none" />
                    {latestEventByPlayerId.get(pl.id) ? (
                      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
                        Latest notification: {new Date(latestEventByPlayerId.get(pl.id)!.createdAt).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
