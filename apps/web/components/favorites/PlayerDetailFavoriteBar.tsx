"use client"

import Link from "next/link"
import { FavoriteHeartButton } from "@/components/favorites/FavoriteHeartButton"

type Props = { playerId: string; playerName: string }

export function PlayerDetailFavoriteBar({ playerId, playerName }: Props) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-portal-sm border border-neutral-200/90 bg-portal-filter-bg/50 px-4 py-3">
      <FavoriteHeartButton playerId={playerId} size="md" />
      <span className="text-sm text-neutral-700">
        Save <span className="font-semibold text-black">{playerName}</span> to your ranked favorites (this
        browser only — stored locally).
      </span>
      <Link
        href="/favorites"
        className="text-sm font-semibold text-portal-accent transition hover:text-portal-accent-hover hover:underline"
      >
        View favorites
      </Link>
    </div>
  )
}
