"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { FAVORITES_STORAGE_KEY, readFavoriteIds, writeFavoriteIds } from "@/lib/favoritesStorage"

type FavoritesContextValue = {
  favoriteIds: string[]
  isFavorite: (playerId: string) => boolean
  toggleFavorite: (playerId: string) => void
  addFavorite: (playerId: string) => void
  removeFavorite: (playerId: string) => void
  moveFavorite: (fromIndex: number, toIndex: number) => void
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null)

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])

  useEffect(() => {
    setFavoriteIds(readFavoriteIds())
  }, [])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea === window.localStorage && e.key === FAVORITES_STORAGE_KEY) {
        setFavoriteIds(readFavoriteIds())
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const persist = useCallback((next: string[]) => {
    writeFavoriteIds(next)
    setFavoriteIds(next)
  }, [])

  const isFavorite = useCallback(
    (playerId: string) => favoriteIds.includes(playerId),
    [favoriteIds],
  )

  const addFavorite = useCallback(
    (playerId: string) => {
      if (favoriteIds.includes(playerId)) return
      persist([...favoriteIds, playerId])
    },
    [favoriteIds, persist],
  )

  const removeFavorite = useCallback(
    (playerId: string) => {
      persist(favoriteIds.filter((id) => id !== playerId))
    },
    [favoriteIds, persist],
  )

  const toggleFavorite = useCallback(
    (playerId: string) => {
      if (favoriteIds.includes(playerId)) removeFavorite(playerId)
      else addFavorite(playerId)
    },
    [favoriteIds, addFavorite, removeFavorite],
  )

  const moveFavorite = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return
      if (fromIndex < 0 || fromIndex >= favoriteIds.length) return
      if (toIndex < 0 || toIndex >= favoriteIds.length) return
      const next = [...favoriteIds]
      const [item] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, item)
      persist(next)
    },
    [favoriteIds, persist],
  )

  const value = useMemo(
    () => ({
      favoriteIds,
      isFavorite,
      toggleFavorite,
      addFavorite,
      removeFavorite,
      moveFavorite,
    }),
    [favoriteIds, isFavorite, toggleFavorite, addFavorite, removeFavorite, moveFavorite],
  )

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext)
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider")
  return ctx
}
