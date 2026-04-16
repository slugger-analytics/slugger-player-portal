import { NextResponse } from "next/server"

/** Liveness for the Next.js app (and any upstream checks you add later). */
export async function GET() {
  return NextResponse.json({ ok: true })
}
