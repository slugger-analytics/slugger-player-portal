"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react"
import { useFavorites } from "@/components/favorites/FavoritesProvider"
import { fetchPlayerProfile } from "@/lib/api"
import type { PlayerProfile } from "@available-player-portal/shared"

type RowState =
  | { status: "loading"; id: string }
  | { status: "ok"; id: string; profile: PlayerProfile }
  | { status: "missing"; id: string }

export default function FavoritesPage() {
  const { favoriteIds, removeFavorite, moveFavorite } = useFavorites()
  const [rows, setRows] = useState<RowState[]>([])

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
    <main className="px-4 pb-10 sm:px-5">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-black">Favorites</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Your list is saved in this browser only. Use the arrows to set your ranking (#1 is top).
        </p>
      </div>

      {favoriteIds.length === 0 ? (
        <div className="rounded-portal border border-neutral-200/90 bg-portal-filter-bg/40 px-4 py-8 text-center">
          <p className="text-sm text-neutral-700">No favorites yet.</p>
          <p className="mt-2 text-sm text-neutral-600">
            On the home screen, tap the heart on a player card to add them here.
          </p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block text-sm font-semibold text-portal-accent transition hover:text-portal-accent-hover hover:underline"
          >
            Go to Player Discovery Home
          </Link>
        </div>
      ) : (
        <ul className="flex max-w-xl flex-col gap-3">
          {rows.map((row, index) => (
            <li
              key={row.id}
              className="flex items-stretch gap-2 rounded-portal border border-white/80 bg-white p-3 shadow-portal-card"
            >
              <div className="flex w-9 shrink-0 flex-col items-center justify-center rounded-portal-sm bg-portal-filter-bg/80 text-xs font-bold text-neutral-600">
                #{index + 1}
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {row.status === "loading" ? (
                  <p className="text-sm text-neutral-500">Loading…</p>
                ) : row.status === "missing" ? (
                  <p className="text-sm text-neutral-600">
                    Player <code className="rounded bg-neutral-100 px-1 text-xs">{row.id}</code> is no
                    longer available.
                  </p>
                ) : (
                  <>
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-neutral-100 bg-neutral-50">
                      {(() => {
                        const src =
                          (row.profile.player as { imageUrl?: string | null }).imageUrl || "/player-placeholder.png"
                        return (
                          <Image
                            src={src}
                            alt=""
                            fill
                            className="object-cover object-top"
                            sizes="56px"
                            unoptimized={src.startsWith("http")}
                          />
                        )
                      })()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/players/${encodeURIComponent(row.id)}`}
                        className="text-sm font-semibold text-black hover:text-portal-accent-hover hover:underline"
                      >
                        {row.profile.player.name}
                      </Link>
                      <div className="text-xs text-neutral-600">
                        {row.profile.player.position} · {row.profile.player.team}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-center justify-center gap-0.5 border-l border-neutral-100 pl-2">
                <button
                  type="button"
                  className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 disabled:opacity-30"
                  aria-label="Move up"
                  disabled={index === 0}
                  onClick={() => moveFavorite(index, index - 1)}
                >
                  <ChevronUp className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 disabled:opacity-30"
                  aria-label="Move down"
                  disabled={index >= favoriteIds.length - 1}
                  onClick={() => moveFavorite(index, index + 1)}
                >
                  <ChevronDown className="h-5 w-5" />
                </button>
              </div>
              <div className="flex items-center border-l border-neutral-100 pl-2">
                <button
                  type="button"
                  className="rounded p-2 text-neutral-500 hover:bg-rose-50 hover:text-rose-600"
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
    </main>
  )
}
