/**
 * @file config/index.ts
 * @description Centralized **runtime configuration** for the API process.
 *
 * **Environment variables:**
 * - `PORT` — HTTP listen port (default 4000)
 * - `DATABASE_URL` — PostgreSQL connection string for Prisma
 * - `TBC_FEED_PASSWORD` — Baseball Cube feed password (**server-only**; never `NEXT_PUBLIC_*`)
 */

import { loadDotenv } from "../loadDotenv"

loadDotenv()

function parseCsvIds(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
}

export const config = {
  port: Number(process.env.PORT) || 4000,
  databaseUrl: process.env.DATABASE_URL ?? "",
  /** Server-only; never use NEXT_PUBLIC_ for this value. */
  tbcFeedPassword: process.env.TBC_FEED_PASSWORD ?? "jhu$",
  /**
   * Optional HTTP(S) proxy for BaseballCube feed fetches.
   * Use this when the feed blocks AWS/NAT egress IPs in production.
   * Example: http://user:pass@proxyhost:port
   */
  tbcHttpsProxyUrl: process.env.TBC_HTTPS_PROXY?.trim() ?? "",
  /**
   * Demo/testing override for deterministic sync-triggered notification proof.
   * When set, these player IDs are force-included in changedPlayerIds for that run.
   * Example: SYNC_FORCE_CHANGED_PLAYER_IDS=181000,187959
   */
  syncForceChangedPlayerIds: parseCsvIds(process.env.SYNC_FORCE_CHANGED_PLAYER_IDS),
  /**
   * S3 bucket the relay job stages BaseballCube feed payloads into before
   * triggering `/sync/ingest-raw`. Reading from S3 bypasses the ALB → Lambda
   * 1 MB sync request limit and means the Lambda never needs egress to TBC.
   */
  feedS3Bucket: process.env.FEED_S3_BUCKET?.trim() ?? "",
}
