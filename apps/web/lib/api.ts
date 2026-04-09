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
  PlayerProfile,
  PlayerSummariesResponse,
  PlayerSummary,
  Transaction,
} from "@available-player-portal/shared"

/** Base URL for the Express API (set in `.env` for production deployments). */
export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
}

/** Builds `?a=1&b=2` from a params object; omits undefined and empty strings. */
function qs(params: Record<string, string | number | undefined>): string {
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "") continue
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

/** `GET /players` — filters + optional `limit` / `offset`; returns `{ players, total }`. */
export async function fetchPlayerSummaries(
  params: Record<string, string | number | undefined>,
): Promise<PlayerSummariesResponse> {
  const base = getApiBaseUrl()
  try {
    const res = await fetch(`${base}/players${qs(params)}`, { cache: "no-store" })
    if (!res.ok) throw new Error(`Failed to load players: ${res.status}`)
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
