"use client"

import { Bell } from "lucide-react"
import { useUpdatesWatch } from "@/components/updates/UpdatesWatchProvider"

type Props = {
  playerId: string
  className?: string
  size?: "sm" | "md"
}

/** Filled bell (solid path) — Lucide’s Bell is stroke-only, so we use SVG fill when active. */
function BellFilled({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h18v-1l-2-2z" />
    </svg>
  )
}

/** Toggle this player into the Updates “watched” list (local browser storage). */
export function PlayerUpdatesBellButton({ playerId, className = "", size = "md" }: Props) {
  const { isWatching, toggleWatch } = useUpdatesWatch()
  const on = isWatching(playerId)
  const iconClass = size === "sm" ? "h-4 w-4" : "h-5 w-5"

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggleWatch(playerId)
      }}
      className={`rounded-full p-1.5 text-neutral-400 transition hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950/40 dark:hover:text-amber-400 ${on ? "text-amber-600 dark:text-amber-400" : ""} ${className}`}
      aria-label={on ? "Stop updates for this player" : "Get updates for this player"}
      aria-pressed={on}
    >
      {on ? (
        <BellFilled className={iconClass} />
      ) : (
        <Bell className={iconClass} strokeWidth={2} aria-hidden />
      )}
    </button>
  )
}
