// PURPOSE: Cron-triggered route for ingesting Baseball Cube data.
import { NextResponse } from "next/server";

export async function POST() {
  // Verify cron secret; call tbc-scraper; normalize and persist.
  return NextResponse.json({ ok: true });
}
