/**
 * Server-only proxy: triggers Express `POST /sync` so the browser never holds `SYNC_INTERNAL_KEY`.
 * Set `INTERNAL_API_URL` if the API is not reachable at `NEXT_PUBLIC_API_URL` from the Next server.
 */

import { NextResponse } from "next/server"

export async function POST() {
  const apiBase =
    process.env.INTERNAL_API_URL?.replace(/\/$/, "") ??
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
    "http://localhost:4000"

  const secret = process.env.SYNC_INTERNAL_KEY?.trim()
  const headers: Record<string, string> = {
    Accept: "application/json",
  }
  if (secret) {
    headers.Authorization = `Bearer ${secret}`
  }

  try {
    const res = await fetch(`${apiBase}/sync`, {
      method: "POST",
      headers,
      cache: "no-store",
    })

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      const msg = typeof data.error === "string" ? data.error : res.statusText
      return NextResponse.json({ ok: false, error: msg }, { status: res.status })
    }

    return NextResponse.json(data)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync request failed"
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}
