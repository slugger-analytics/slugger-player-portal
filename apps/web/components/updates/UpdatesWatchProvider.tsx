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
import {
  addWatchOnServer,
  readUpdatesWatchIdsFromServer,
  removeWatchOnServer,
  readUpdatesWatchIds,
  UPDATES_WATCH_STORAGE_KEY,
  writeUpdatesWatchIds,
} from "@/lib/updatesWatchStorage"

type UpdatesWatchContextValue = {
  watchIds: string[]
  isWatching: (playerId: string) => boolean
  toggleWatch: (playerId: string) => void
  addWatch: (playerId: string) => void
  removeWatch: (playerId: string) => void
}

const UpdatesWatchContext = createContext<UpdatesWatchContextValue | null>(null)

export function UpdatesWatchProvider({ children }: { children: ReactNode }) {
  const [watchIds, setWatchIds] = useState<string[]>([])

  useEffect(() => {
    void readUpdatesWatchIdsFromServer().then(setWatchIds)
  }, [])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea === window.localStorage && e.key === UPDATES_WATCH_STORAGE_KEY) {
        setWatchIds(readUpdatesWatchIds())
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const persist = useCallback((next: string[]) => {
    writeUpdatesWatchIds(next)
    setWatchIds(next)
  }, [])

  const isWatching = useCallback((playerId: string) => watchIds.includes(playerId), [watchIds])

  const addWatch = useCallback(
    (playerId: string) => {
      if (watchIds.includes(playerId)) return
      void addWatchOnServer(playerId).then(() => {
        persist(readUpdatesWatchIds())
      })
    },
    [watchIds, persist],
  )

  const removeWatch = useCallback(
    (playerId: string) => {
      void removeWatchOnServer(playerId).then(() => {
        persist(readUpdatesWatchIds())
      })
    },
    [persist],
  )

  const toggleWatch = useCallback(
    (playerId: string) => {
      if (watchIds.includes(playerId)) removeWatch(playerId)
      else addWatch(playerId)
    },
    [watchIds, addWatch, removeWatch],
  )

  const value = useMemo(
    () => ({ watchIds, isWatching, toggleWatch, addWatch, removeWatch }),
    [watchIds, isWatching, toggleWatch, addWatch, removeWatch],
  )

  return <UpdatesWatchContext.Provider value={value}>{children}</UpdatesWatchContext.Provider>
}

export function useUpdatesWatch(): UpdatesWatchContextValue {
  const ctx = useContext(UpdatesWatchContext)
  if (!ctx) throw new Error("useUpdatesWatch must be used within UpdatesWatchProvider")
  return ctx
}
