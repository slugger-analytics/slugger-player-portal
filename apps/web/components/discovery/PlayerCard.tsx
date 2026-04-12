"use client"

/**
 * @file PlayerCard.tsx
 * @description Discovery result card: grey placeholder avatar, name, team, stat line (level on profile page).
 * Data: `PlayerSummary` from `GET /players` — fully driven by the sync pipeline + DB.
 */

import Link from "next/link"
import type { PlayerSummary } from "@available-player-portal/shared"
import { PlayerAvatarPlaceholder } from "@/components/discovery/PlayerAvatarPlaceholder"
import { FavoriteHeartButton } from "@/components/favorites/FavoriteHeartButton"
import { PlayerUpdatesBellButton } from "@/components/updates/PlayerUpdatesBellButton"

type Props = {
  player: PlayerSummary
  /** Merged onto the card link (e.g. `!max-w-none min-w-0` for grid layouts). */
  className?: string
}

export function PlayerCard({ player, className = "" }: Props) {
  return (
    <Link
      href={`/players/${encodeURIComponent(player.id)}`}
      className={`group relative flex w-full min-w-0 shrink-0 items-start gap-3 rounded-portal border border-neutral-200/80 bg-portal-surface p-3 shadow-portal-card transition hover:border-portal-filter-border hover:shadow-portal dark:border-neutral-600/50 ${className}`}
    >
      <div className="absolute right-1 top-1 z-10 flex items-center gap-0.5">
        <PlayerUpdatesBellButton playerId={player.id} />
        <FavoriteHeartButton playerId={player.id} />
      </div>
      <PlayerAvatarPlaceholder size="md" />
      <div className="min-w-0 flex-1 overflow-hidden text-left">
        <div className="break-words text-sm font-semibold leading-tight text-black group-hover:text-portal-accent-hover dark:text-neutral-100 dark:group-hover:text-portal-accent">
          {player.name}
        </div>
        <div className="mt-1 break-words text-xs font-medium text-neutral-600 dark:text-neutral-400">{player.position}</div>
        <div className="break-words text-xs text-neutral-500 dark:text-neutral-500">{player.team}</div>
        <div className="mt-1.5 break-words font-mono text-[11px] leading-snug text-neutral-800 dark:text-neutral-300">
          {player.minimalStatLine}
        </div>
      </div>
    </Link>
  )
}
