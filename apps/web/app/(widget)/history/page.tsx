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
import { clearDiscoverySnapshot } from "@/lib/discovery-session"

function formatViewedAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "Unknown time"
  return d.toLocaleString()
}

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([])

  useEffect(() => {
    clearDiscoverySnapshot()
  }, [])

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
    <main className="portal-page">
      <header className="portal-page-header">
        <div className="portal-title-stack">
          <h1 className="text-3xl font-bold tracking-tight text-black dark:text-neutral-100">History</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Players you open are tracked here in recent-to-oldest order.
          </p>
        </div>
        {entries.length > 0 ? (
          <button
            type="button"
            onClick={clearAll}
            className="portal-btn-secondary shrink-0"
          >
            Clear all
          </button>
        ) : null}
      </header>

      <div className="portal-panel-well max-w-xl sm:p-5">
        {entries.length === 0 ? (
          <div className="portal-empty-well flex flex-col items-center gap-3 text-sm text-neutral-600 dark:text-neutral-400">
            <p className="text-sm text-neutral-700 dark:text-neutral-200">No player views yet.</p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Open any player from discovery and it will appear here.
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
            {entries.map((e, index) => (
              <li key={e.playerId} className="portal-surface flex items-stretch gap-4 p-4">
                <div className="flex w-9 shrink-0 items-center justify-center rounded-portal-sm bg-portal-filter-bg text-xs font-bold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                  #{index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/players/${encodeURIComponent(e.playerId)}`}
                    className="text-sm font-semibold text-neutral-900 hover:text-portal-accent-hover hover:underline dark:text-neutral-100"
                  >
                    {e.playerName}
                  </Link>
                  <div className="text-xs text-neutral-600 dark:text-neutral-400">
                    {e.position} · {e.team}
                  </div>
                  <div className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-500">
                    Viewed {formatViewedAt(e.viewedAt)}
                  </div>
                </div>
                <div className="flex items-center border-l border-portal-filter-border/60 pl-2 dark:border-neutral-600/60">
                  <button
                    type="button"
                    className="portal-icon-btn-danger"
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
      </div>
    </main>
  )
}
