"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Trash2 } from "lucide-react"
import {
  PLAYER_HISTORY_STORAGE_KEY,
  readHistoryEntries,
  writeHistoryEntries,
  type HistoryEntry,
} from "@/lib/historyStorage"

function formatViewedAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "Unknown time"
  return d.toLocaleString()
}

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([])

  useEffect(() => {
    setEntries(readHistoryEntries())
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea === window.localStorage && e.key === PLAYER_HISTORY_STORAGE_KEY) {
        setEntries(readHistoryEntries())
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  function removeOne(playerId: string) {
    const next = entries.filter((e) => e.playerId !== playerId)
    writeHistoryEntries(next)
    setEntries(next)
  }

  function clearAll() {
    writeHistoryEntries([])
    setEntries([])
  }

  return (
    <main className="px-4 pb-10 sm:px-5">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-black">History</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Players you open are tracked here in recent-to-oldest order (this browser only).
          </p>
        </div>
        {entries.length > 0 ? (
          <button
            type="button"
            onClick={clearAll}
            className="rounded-portal-sm border border-neutral-200 bg-portal-surface px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800/80"
          >
            Clear all
          </button>
        ) : null}
      </div>

      {entries.length === 0 ? (
        <div className="rounded-portal border border-neutral-200/90 bg-portal-filter-bg/40 px-4 py-8 text-center">
          <p className="text-sm text-neutral-700">No player views yet.</p>
          <p className="mt-2 text-sm text-neutral-600">
            Open any player from discovery and it will appear here.
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
          {entries.map((e, index) => (
            <li
              key={e.playerId}
              className="flex items-stretch gap-3 rounded-portal border border-neutral-200/80 bg-portal-surface p-3 shadow-portal-card dark:border-neutral-600/50"
            >
              <div className="flex w-9 shrink-0 items-center justify-center rounded-portal-sm bg-portal-filter-bg/80 text-xs font-bold text-neutral-600">
                #{index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/players/${encodeURIComponent(e.playerId)}`}
                  className="text-sm font-semibold text-black hover:text-portal-accent-hover hover:underline"
                >
                  {e.playerName}
                </Link>
                <div className="text-xs text-neutral-600">
                  {e.position} · {e.team}
                </div>
                <div className="mt-1 text-[11px] text-neutral-500">Viewed {formatViewedAt(e.viewedAt)}</div>
              </div>
              <div className="flex items-center border-l border-neutral-100 pl-2">
                <button
                  type="button"
                  className="rounded p-2 text-neutral-500 hover:bg-rose-50 hover:text-rose-600"
                  aria-label="Remove from history"
                  onClick={() => removeOne(e.playerId)}
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
