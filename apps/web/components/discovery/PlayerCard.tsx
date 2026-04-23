"use client"

/**
 * @file PlayerCard.tsx
 * @description Discovery result card: grey placeholder avatar, name, team, stat line (level on profile page).
 * Data: `PlayerSummary` from `GET /players` — fully driven by the sync pipeline + DB.
 *
 * Toolbar actions stay **outside** the profile `Link` so we never nest `<button>` inside `<a>` (invalid HTML, breaks clicks in several browsers).
 */

import Link from "next/link"
import { experienceLevelDisplayLabel, type PlayerSummary } from "@available-player-portal/shared"
import { PlayerAvatarPlaceholder } from "@/components/discovery/PlayerAvatarPlaceholder"
import { FavoriteHeartButton } from "@/components/favorites/FavoriteHeartButton"
import { PlayerUpdatesBellButton } from "@/components/updates/PlayerUpdatesBellButton"

/** Strikeouts: normalize legacy `SO:` / `k:` from API to `K:` on the card. */
function normalizePitchingStrikeoutLabel(line: string): string {
  return line.replace(/\bSO\s*:/gi, "K:").replace(/\bk\s*:/g, "K:")
}

type Props = {
  player: PlayerSummary
  /** Applied to the outer card shell (e.g. `!max-w-none min-w-0` for grid layouts). */
  className?: string
  /** Discovery home saves search state before opening a profile so Back can restore it. */
  onBeforeNavigate?: () => void
}

export function PlayerCard({ player, className = "", onBeforeNavigate }: Props) {
  const mostRecentTransactionDate = player.mostRecentTransactionDate
    ? new Date(`${player.mostRecentTransactionDate}T12:00:00.000Z`).toLocaleDateString(undefined, {
        dateStyle: "medium",
      })
    : "—"
  const maxLevel = experienceLevelDisplayLabel(player.experienceLevel)
  const rankScoreOutOf100 = player.rankScore != null ? Math.round(player.rankScore * 100) : null
  const profileHref =
    rankScoreOutOf100 != null
      ? `/players/${encodeURIComponent(player.id)}?rankScore=${encodeURIComponent(String(rankScoreOutOf100))}`
      : `/players/${encodeURIComponent(player.id)}`

  return (
    <div
      className={`group relative w-full min-w-0 shrink-0 rounded-portal border border-neutral-200/80 bg-portal-surface p-3 shadow-portal-card transition hover:border-portal-filter-border hover:shadow-portal dark:border-neutral-600/50 ${className}`}
    >
      <div className="pointer-events-auto absolute right-1 top-1 z-20 flex items-center gap-0.5">
        <PlayerUpdatesBellButton playerId={player.id} />
        <FavoriteHeartButton playerId={player.id} />
      </div>
      <Link
        href={profileHref}
        onClick={() => onBeforeNavigate?.()}
        className="flex min-h-0 min-w-0 items-start gap-3 rounded-portal-sm outline-offset-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/45 dark:focus-visible:ring-neutral-500/50"
      >
        <PlayerAvatarPlaceholder size="md" />
        <div className="min-w-0 flex-1 overflow-hidden text-left">
          <div className="break-words text-sm font-semibold leading-tight text-black group-hover:text-portal-accent-hover dark:text-neutral-100 dark:group-hover:text-portal-accent">
            {player.name}
          </div>
          <div className="mt-1 break-words text-xs font-medium text-neutral-600 dark:text-neutral-400">{player.position}</div>
          <div className="break-words text-xs text-neutral-500 dark:text-neutral-500">{player.mostRecentTeam || player.team}</div>
          <div className="mt-0.5 break-words text-xs text-neutral-500 dark:text-neutral-500">Max level: {maxLevel}</div>
          <div className="mt-1.5 break-words font-mono text-[11px] leading-snug text-neutral-800 dark:text-neutral-300">
            {normalizePitchingStrikeoutLabel(player.minimalStatLine)}
          </div>
          <div className="mt-1 break-words text-[11px] leading-snug text-neutral-600 dark:text-neutral-400">
            Most recent transaction: {player.mostRecentTransactionType ? `${player.mostRecentTransactionType} | ` : ""}
            {mostRecentTransactionDate}
          </div>
          {rankScoreOutOf100 != null ? (
            <div className="mt-0.5 break-words text-[11px] font-semibold leading-snug text-neutral-700 dark:text-neutral-300">
              Rank score: {rankScoreOutOf100}/100
              {player.rankOrdinal != null ? ` (#${player.rankOrdinal})` : ""}
            </div>
          ) : null}
        </div>
      </Link>
    </div>
  )
}
