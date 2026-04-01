"use client"

import { Heart } from "lucide-react"
import { useFavorites } from "@/components/favorites/FavoritesProvider"

type Props = {
  playerId: string
  className?: string
  size?: "sm" | "md"
}

/** Icon-only control; stops click from bubbling to parent links/cards. */
export function FavoriteHeartButton({ playerId, className = "", size = "md" }: Props) {
  const { isFavorite, toggleFavorite } = useFavorites()
  const on = isFavorite(playerId)
  const iconClass = size === "sm" ? "h-4 w-4" : "h-5 w-5"

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggleFavorite(playerId)
      }}
      className={`rounded-full p-1.5 text-neutral-400 transition hover:bg-rose-50 hover:text-rose-600 ${on ? "text-rose-500" : ""} ${className}`}
      aria-label={on ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={on}
    >
      <Heart className={`${iconClass} ${on ? "fill-current" : ""}`} strokeWidth={2} />
    </button>
  )
}
