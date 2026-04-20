"use client"

import Link from "next/link"
import { FavoriteHeartButton } from "@/components/favorites/FavoriteHeartButton"
import { PlayerUpdatesBellButton } from "@/components/updates/PlayerUpdatesBellButton"

type Props = { playerId: string; playerName: string }

export function PlayerDetailFavoriteBar({ playerId, playerName }: Props) {
  return (
    <div className="portal-callout mb-6">
      <div className="flex items-center gap-1">
        <PlayerUpdatesBellButton playerId={playerId} size="md" />
        <FavoriteHeartButton playerId={playerId} size="md" />
      </div>
      <span className="text-sm text-neutral-700 dark:text-neutral-300">
        <span className="font-semibold text-black dark:text-neutral-100">{playerName}</span>: bell = track on{" "}
        <Link href="/updates" className="portal-link-subtle text-sm">
          Updates
        </Link>
        ; heart = ranked{" "}
        <Link href="/favorites" className="portal-link-subtle text-sm">
          favorites
        </Link>
        .
      </span>
    </div>
  )
}
