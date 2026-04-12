/**
 * @file TransactionRepository.ts
 * @description Data access for `transactions` with **idempotent** upserts.
 *
 * **Purpose:** Store one row per logical transaction line from TBC. Duplicate syncs
 * must not insert duplicates: `uniqueHash` is a SHA-256 of `(playerId|date|type|description)`.
 *
 * **Usage:** `getTransactionsByPlayer` returns rows newest→oldest for profile/history UI;
 * `upsertTransactions` is called from `syncPipeline.ts` with parsed feed rows.
 */

import { createHash } from "crypto"
import { Prisma } from "@prisma/client"
import type { Transaction } from "../types/models"
import { prisma } from "../lib/prisma"
import { SYNC_UPSERT_CHUNK } from "../lib/syncBatch"

/** Stable natural key for Prisma `upsert` when the feed does not supply a surrogate id. */
function uniqueHash(t: Transaction): string {
  return createHash("sha256")
    .update([t.playerId, t.date, t.type, t.description].join("|"))
    .digest("hex")
}

export class TransactionRepository {
  /** Reverse chronological (newest first); tie-break by id for same calendar date. */
  async getTransactionsByPlayer(playerId: string): Promise<Transaction[]> {
    const rows = await prisma.transaction.findMany({
      where: { playerId },
      orderBy: [{ date: "desc" }, { id: "desc" }],
    })
    return rows.map((r) => ({
      playerId: r.playerId,
      date: r.date.toISOString().slice(0, 10),
      type: r.type,
      description: r.description,
    }))
  }

  /** Creates or updates by `uniqueHash`; bulk upsert per chunk for sync performance. */
  async upsertTransactions(txs: Transaction[]): Promise<void> {
    if (txs.length === 0) return
    const byHash = new Map<string, Transaction>()
    for (const t of txs) byHash.set(uniqueHash(t), t)
    const uniqueTxs = [...byHash.values()]
    for (let i = 0; i < uniqueTxs.length; i += SYNC_UPSERT_CHUNK) {
      const chunk = uniqueTxs.slice(i, i + SYNC_UPSERT_CHUNK)
      const rows = chunk.map((t) => {
        const hash = uniqueHash(t)
        const d = new Date(t.date + "T12:00:00.000Z")
        return Prisma.sql`(${t.playerId}, ${d}::date, ${t.type}, ${t.description}, ${hash})`
      })
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "Transaction" ("player_id","date","type","description","unique_hash")
        VALUES ${Prisma.join(rows)}
        ON CONFLICT ("unique_hash") DO UPDATE SET
          "player_id" = EXCLUDED."player_id",
          "date" = EXCLUDED."date",
          "type" = EXCLUDED."type",
          "description" = EXCLUDED."description"
      `)
    }
  }
}
