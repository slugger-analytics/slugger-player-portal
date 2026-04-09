"use client"

import { useEffect } from "react"
import { pushHistoryEntry } from "@/lib/historyStorage"

type Props = {
  playerId: string
  playerName: string
  position: string
  team: string
}

/** Persists a "viewed player" event to local history (most recent first). */
export function PlayerHistoryTracker({ playerId, playerName, position, team }: Props) {
  useEffect(() => {
    pushHistoryEntry({ playerId, playerName, position, team })
  }, [playerId, playerName, position, team])

  return null
}
