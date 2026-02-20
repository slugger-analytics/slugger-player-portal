// PURPOSE: Cron-triggered route for ingesting MLB/Independent League RSS transaction feeds.
import { NextResponse } from "next/server";

export async function POST() {
  // Verify cron secret; call mlb-feed-parser; normalize timestamps (Mexico Delay); persist.
  return NextResponse.json({ ok: true });
}
