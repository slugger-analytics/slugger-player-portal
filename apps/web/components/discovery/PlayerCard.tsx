"use client"

/**
 * @file PlayerCard.tsx
 * @description Discovery result card: circular headshot (mockup), name, team, stat line from API.
 * Data: `PlayerSummary` from `GET /players` — fully driven by the sync pipeline + DB.
 */

import Image from "next/image"
import Link from "next/link"
import type { PlayerSummary } from "@available-player-portal/shared"
import { FavoriteHeartButton } from "@/components/favorites/FavoriteHeartButton"

type Props = {
  player: PlayerSummary
}

export function PlayerCard({ player }: Props) {
  const src = player.imageUrl || "/player-placeholder.png"

  return (
    <Link
      href={`/players/${encodeURIComponent(player.id)}`}
      className="group relative flex max-w-[240px] shrink-0 gap-3 rounded-portal border border-white/80 bg-white p-3 shadow-portal-card transition hover:border-portal-filter-border hover:shadow-portal"
    >
      <div className="absolute right-1 top-1 z-10">
        <FavoriteHeartButton playerId={player.id} />
      </div>
      <div className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-full border border-neutral-100 bg-neutral-50 shadow-sm">
        <Image
          src={src}
          alt=""
          fill
          className="object-cover object-top"
          sizes="88px"
          unoptimized={src.startsWith("http")}
        />
      </div>
      <div className="min-w-0 flex-1 text-left">
        <div className="text-sm font-semibold leading-tight text-black group-hover:text-portal-accent-hover">
          {player.name}
        </div>
        <div className="mt-1 text-xs font-medium text-neutral-600">{player.position}</div>
        <div className="text-xs text-neutral-500">{player.team}</div>
        <div className="mt-1.5 font-mono text-[11px] text-neutral-800">{player.minimalStatLine}</div>
      </div>
    </Link>
  )
}
