/**
 * @file lib/api.ts
 * @description **Browser and server** HTTP helpers for the Player Discovery REST API.
 *
 * **Purpose:** Centralize `NEXT_PUBLIC_API_URL` (default `http://localhost:4000`) and
 * typed `fetch` wrappers for the three public endpoints (`/players`, `/players/:id`,
 * `/players/:id/transactions`). The UI must not import Prisma or server-only modules.
 *
 * **Usage:** Import from client components (`"use client"`) or server components; both
 * resolve the same base URL via `process.env.NEXT_PUBLIC_*`.
 */

import type {
  RankingPreferences,
  PlayerProfile,
  PlayerSummariesResponse,
  PlayerSummary,
  Transaction,
} from "@available-player-portal/shared"
import type { UiFilter } from "@/components/discovery/DiscoveryFilterTypes"

function normalizeApiBaseUrl(v: string | undefined): string {
  const raw = (v ?? "").trim()
  if (!raw) return "http://localhost:4000"
  return raw.replace(/\/$/, "")
}

/**
 * Base URL for the Express API (set in `.env` for production deployments).
 * Treats empty/whitespace the same as unset so we never do `fetch("/players")` against the
 * Next.js origin (404 / HTML) when `NEXT_PUBLIC_API_URL` is blank.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    return normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL)
  }
  return normalizeApiBaseUrl(process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL)
}

/** Builds `?a=1&b=2` from a params object; omits undefined, empty strings, and `false`. */
function qs(params: Record<string, string | number | boolean | undefined>): string {
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "" || v === false) continue
    u.set(k, String(v))
  }
  const s = u.toString()
  return s ? `?${s}` : ""
}

/** Maps network failures (API down / wrong URL) to a clear UI message. */
function rethrowNetworkError(e: unknown, context: string): never {
  if (e instanceof TypeError) {
    throw new Error(
      `Cannot reach the API at ${getApiBaseUrl()} (${context}). Start the API (e.g. npm run dev -w @available-player-portal/api), run a database sync if the list is empty, and check NEXT_PUBLIC_API_URL.`,
    )
  }
  throw e
}

async function errorDetailFromResponse(res: Response): Promise<string> {
  const text = await res.text()
  if (!text) return res.statusText || String(res.status)
  try {
    const j = JSON.parse(text) as { error?: string; message?: string }
    if (typeof j.error === "string" && j.error.trim()) return j.error.trim()
    if (typeof j.message === "string" && j.message.trim()) return j.message.trim()
  } catch {
    /* not JSON */
  }
  const t = text.trim()
  return t.length > 200 ? `${t.slice(0, 200)}…` : t
}

function notificationIdentityHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {}
  const sub =
    window.localStorage.getItem("slugger-cognito-sub") ??
    process.env.NEXT_PUBLIC_NOTIFICATION_DEV_COGNITO_SUB ??
    ""
  const email =
    window.localStorage.getItem("slugger-email") ??
    process.env.NEXT_PUBLIC_NOTIFICATION_DEV_EMAIL ??
    ""
  if (!sub || !email) return {}
  return {
    "x-slugger-cognito-sub": sub,
    "x-slugger-email": email,
  }
}

/** `GET /players` — filters + optional `limit` / `offset`; returns `{ players, total }`. */
export async function fetchPlayerSummaries(
  params: Record<string, string | number | boolean | undefined>,
): Promise<PlayerSummariesResponse> {
  const base = getApiBaseUrl()
  try {
    const res = await fetch(`${base}/players${qs(params)}`, { cache: "no-store" })
    if (!res.ok) {
      const detail = await errorDetailFromResponse(res)
      throw new Error(`Failed to load players (${res.status}): ${detail}`)
    }
    const data = (await res.json()) as unknown
    if (data && typeof data === "object" && "players" in data && "total" in data) {
      return data as PlayerSummariesResponse
    }
    if (Array.isArray(data)) {
      const players = data as PlayerSummary[]
      return { players, total: players.length }
    }
    return { players: [], total: 0 }
  } catch (e) {
    rethrowNetworkError(e, "GET /players")
  }
}

/**
 * Loads a single player as {@link PlayerSummary} for cards (e.g. Updates “watched” list).
 * Uses `GET /players/:id` and derives `minimalStatLine` from recent batting/pitching when present.
 */
export async function fetchPlayerSummaryForCard(id: string): Promise<PlayerSummary> {
  const profile = await fetchPlayerProfile(id)
  const p = profile.player
  let minimalStatLine = "—"
  if (profile.mostRecentBatting) {
    const b = profile.mostRecentBatting
    minimalStatLine = `AVG: ${Number(b.avg).toFixed(3)} | OBP: ${Number(b.obp).toFixed(3)} | SLG: ${Number(b.slg).toFixed(3)} | HR: ${b.hr}`
  } else if (profile.mostRecentPitching) {
    const pit = profile.mostRecentPitching
    const ipStr = Number.isFinite(pit.ip) ? pit.ip.toFixed(1).replace(/\.0$/, "") : "—"
    minimalStatLine = `ERA: ${Number(pit.era).toFixed(2)} | WHIP: ${Number(pit.whip).toFixed(2)} | K: ${pit.k} | IP: ${ipStr}`
  }
  return {
    id: p.id,
    name: p.name,
    position: p.position,
    team: p.team,
    status: p.status,
    experienceLevel: p.experienceLevel ?? null,
    minimalStatLine,
    mostRecentTeam: p.team,
    imageUrl: null,
    mostRecentTransactionDate: profile.mostRecentTransactionDate ?? null,
    mostRecentTransactionType: profile.transactions[0]?.type ?? null,
  }
}

/** `GET /players/:id` — full profile (stats + transactions embedded in JSON). */
export async function fetchPlayerProfile(id: string): Promise<PlayerProfile> {
  const base = getApiBaseUrl()
  try {
    const res = await fetch(`${base}/players/${encodeURIComponent(id)}`, { cache: "no-store" })
    if (!res.ok) throw new Error(`Failed to load player: ${res.status}`)
    return (await res.json()) as PlayerProfile
  } catch (e) {
    rethrowNetworkError(e, "GET /players/:id")
  }
}

/** `GET /players/:id/transactions` — used by `TransactionHistoryView` per product spec. */
export async function fetchPlayerTransactions(id: string): Promise<Transaction[]> {
  const base = getApiBaseUrl()
  try {
    const res = await fetch(`${base}/players/${encodeURIComponent(id)}/transactions`, {
      cache: "no-store",
    })
    if (!res.ok) throw new Error(`Failed to load transactions: ${res.status}`)
    return (await res.json()) as Transaction[]
  } catch (e) {
    rethrowNetworkError(e, "GET /players/:id/transactions")
  }
}

export type NotificationProfile = {
  id: string
  name: string
  createdAt: string
  filters: UiFilter[]
  onlyWithStats: boolean
  rankingPreferences?: RankingPreferences
}

export type NotificationEventItem = {
  id: string
  type: "PROFILE" | "WATCHED"
  createdAt: string
  readAt: string | null
  player: PlayerSummary
  savedProfile?: { id: string; name: string } | null
}

export async function fetchNotificationProfiles(): Promise<NotificationProfile[]> {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/notifications/profiles`, {
    cache: "no-store",
    headers: { ...notificationIdentityHeaders() },
  })
  if (!res.ok) throw new Error(`Failed to load notification profiles: ${res.status}`)
  const data = (await res.json()) as { profiles?: NotificationProfile[] }
  return data.profiles ?? []
}

export async function saveNotificationProfile(profile: NotificationProfile): Promise<NotificationProfile> {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/notifications/profiles`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...notificationIdentityHeaders(),
    },
    body: JSON.stringify(profile),
  })
  if (!res.ok) throw new Error(`Failed to save profile: ${res.status}`)
  const data = (await res.json()) as { profile: NotificationProfile }
  return data.profile
}

export async function deleteNotificationProfile(id: string): Promise<void> {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/notifications/profiles/${encodeURIComponent(id)}`, {
    method: "DELETE",
    cache: "no-store",
    headers: { ...notificationIdentityHeaders() },
  })
  if (!res.ok) throw new Error(`Failed to delete profile: ${res.status}`)
}

export async function fetchWatchedPlayerIds(): Promise<string[]> {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/notifications/watch`, {
    cache: "no-store",
    headers: { ...notificationIdentityHeaders() },
  })
  if (!res.ok) throw new Error(`Failed to load watched players: ${res.status}`)
  const data = (await res.json()) as { playerIds?: string[] }
  return data.playerIds ?? []
}

export async function addWatchedPlayer(playerId: string): Promise<void> {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/notifications/watch/${encodeURIComponent(playerId)}`, {
    method: "POST",
    cache: "no-store",
    headers: { ...notificationIdentityHeaders() },
  })
  if (!res.ok) throw new Error(`Failed to watch player: ${res.status}`)
}

export async function removeWatchedPlayer(playerId: string): Promise<void> {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/notifications/watch/${encodeURIComponent(playerId)}`, {
    method: "DELETE",
    cache: "no-store",
    headers: { ...notificationIdentityHeaders() },
  })
  if (!res.ok) throw new Error(`Failed to unwatch player: ${res.status}`)
}

export async function fetchNotificationEvents(): Promise<NotificationEventItem[]> {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/notifications/events`, {
    cache: "no-store",
    headers: { ...notificationIdentityHeaders() },
  })
  if (!res.ok) throw new Error(`Failed to load notifications: ${res.status}`)
  const data = (await res.json()) as { events?: NotificationEventItem[] }
  return data.events ?? []
}

export async function markNotificationEventsRead(eventIds: string[]): Promise<void> {
  if (eventIds.length === 0) return
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/notifications/events/read`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...notificationIdentityHeaders(),
    },
    body: JSON.stringify({ eventIds }),
  })
  if (!res.ok) throw new Error(`Failed to acknowledge notifications: ${res.status}`)
}
