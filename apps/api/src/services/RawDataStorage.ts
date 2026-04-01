/**
 * @file RawDataStorage.ts
 * @description Persists **raw** TBC feed bodies to PostgreSQL for auditing and debugging.
 *
 * **Purpose:** Every sync run appends three rows to `raw_feed_snapshots` (transactions,
 * batting, pitching) so operators can diff feeds or replay parsing without re-fetching.
 *
 * **Usage:** Called from `syncPipeline.ts` immediately after each `ApiSyncTBC.fetch*`
 * call. This is intentionally append-only (not upsert) so history is preserved.
 */

import { prisma } from "../lib/prisma"

export class RawDataStorage {
  /** Stores the full `tranx.asp` response body. */
  async storeTransactions(raw: string): Promise<void> {
    await prisma.rawFeedSnapshot.create({
      data: { feedType: "transactions", rawContent: raw },
    })
  }

  /** Stores the full `batting.asp` response body. */
  async storeBatting(raw: string): Promise<void> {
    await prisma.rawFeedSnapshot.create({
      data: { feedType: "batting", rawContent: raw },
    })
  }

  /** Stores the full `pitching.asp` response body. */
  async storePitching(raw: string): Promise<void> {
    await prisma.rawFeedSnapshot.create({
      data: { feedType: "pitching", rawContent: raw },
    })
  }
}
