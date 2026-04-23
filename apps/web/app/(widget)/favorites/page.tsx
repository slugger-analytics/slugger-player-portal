"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react"
import { PlayerAvatarPlaceholder } from "@/components/discovery/PlayerAvatarPlaceholder"
import { useFavorites } from "@/components/favorites/FavoritesProvider"
import { fetchPlayerProfile } from "@/lib/api"
import { clearDiscoverySnapshot } from "@/lib/discovery-session"
import type { PlayerProfile } from "@available-player-portal/shared"

type RowState =
  | { status: "loading"; id: string }
  | { status: "ok"; id: string; profile: PlayerProfile }
  | { status: "missing"; id: string }

export default function FavoritesPage() {
  const { favoriteIds, removeFavorite, moveFavorite } = useFavorites()
  const [rows, setRows] = useState<RowState[]>([])

  useEffect(() => {
    clearDiscoverySnapshot()
  }, [])

  useEffect(() => {
    let cancelled = false
    setRows(favoriteIds.map((id) => ({ status: "loading" as const, id })))

    async function load() {
      const next: RowState[] = await Promise.all(
        favoriteIds.map(async (id): Promise<RowState> => {
          try {
            const profile = await fetchPlayerProfile(id)
            return { status: "ok", id, profile }
          } catch {
            return { status: "missing", id }
          }
        }),
      )
      if (!cancelled) setRows(next)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [favoriteIds])

  return (
    <main className="portal-page">
      <h1 className="sr-only">Favorites</h1>

      <div className="portal-panel-well max-w-xl sm:p-5">
        {favoriteIds.length === 0 ? (
          <div className="portal-empty-well flex flex-col items-center gap-3 text-sm text-neutral-600 dark:text-neutral-400">
            <p className="text-sm text-neutral-700 dark:text-neutral-200">No favorites yet.</p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              On the home screen, tap the heart on a player card to add them here.
            </p>
            <Link
              href="/dashboard"
              className="portal-link text-sm"
            >
              Go to Player Discovery Home
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {rows.map((row, index) => (
              <li
                key={row.id}
                className="portal-surface flex items-stretch gap-3 p-4"
              >
                <div className="flex w-9 shrink-0 flex-col items-center justify-center rounded-portal-sm bg-portal-filter-bg text-xs font-bold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                  #{index + 1}
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {row.status === "loading" ? (
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>
                  ) : row.status === "missing" ? (
                    <p className="text-sm text-neutral-600 dark:text-neutral-300">
                      Player <code className="rounded bg-portal-chrome/80 px-1 text-xs dark:bg-neutral-800/80">{row.id}</code>{" "}
                      is no longer available.
                    </p>
                  ) : (
                    <>
                      <PlayerAvatarPlaceholder size="sm" />
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/players/${encodeURIComponent(row.id)}`}
                          className="text-sm font-semibold text-neutral-900 hover:text-portal-accent-hover hover:underline dark:text-neutral-100"
                        >
                          {row.profile.player.name}
                        </Link>
                        <div className="text-xs text-neutral-600 dark:text-neutral-400">
                          {row.profile.player.position} · {row.profile.player.team}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-center justify-center gap-0.5 border-l border-portal-filter-border/60 pl-2 dark:border-neutral-600/60">
                  <button
                    type="button"
                    className="portal-icon-btn"
                    aria-label="Move up"
                    disabled={index === 0}
                    onClick={() => moveFavorite(index, index - 1)}
                  >
                    <ChevronUp className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    className="portal-icon-btn"
                    aria-label="Move down"
                    disabled={index >= favoriteIds.length - 1}
                    onClick={() => moveFavorite(index, index + 1)}
                  >
                    <ChevronDown className="h-5 w-5" />
                  </button>
                </div>
                <div className="flex items-center border-l border-portal-filter-border/60 pl-2 dark:border-neutral-600/60">
                  <button
                    type="button"
                    className="portal-icon-btn-danger"
                    aria-label="Remove from favorites"
                    onClick={() => removeFavorite(row.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
