"use client"

import Link from "next/link"
import { FavoriteHeartButton } from "@/components/favorites/FavoriteHeartButton"
import { PlayerUpdatesBellButton } from "@/components/updates/PlayerUpdatesBellButton"

type Props = { playerId: string; playerName: string }

export function PlayerDetailFavoriteBar({ playerId, playerName }: Props) {
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-portal-sm border border-neutral-200/90 bg-portal-filter-bg/50 px-4 py-3 dark:border-neutral-600/50 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="flex items-center gap-1">
        <PlayerUpdatesBellButton playerId={playerId} size="md" />
        <FavoriteHeartButton playerId={playerId} size="md" />
      </div>
      <span className="text-sm text-neutral-700 dark:text-neutral-300">
        <span className="font-semibold text-black dark:text-neutral-100">{playerName}</span>: bell = track on{" "}
        <Link href="/updates" className="font-semibold text-portal-accent hover:underline">
          Updates
        </Link>
        ; heart = ranked{" "}
        <Link href="/favorites" className="font-semibold text-portal-accent hover:underline">
          favorites
        </Link>{" "}
        (this browser only).
      </span>
    </div>
  )
}
