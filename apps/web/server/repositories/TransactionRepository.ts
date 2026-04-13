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

import { isTransactionShownOnPlayerProfile } from "@available-player-portal/shared"
import { createHash } from "crypto"
import type { Transaction } from "../types/models"
import { prisma } from "../lib/prisma"

/** Stable natural key for Prisma `upsert` when the feed does not supply a surrogate id. */
function uniqueHash(t: Transaction): string {
  return createHash("sha256")
    .update([t.playerId, t.date, t.type, t.description].join("|"))
    .digest("hex")
}

export class TransactionRepository {
  /**
   * Max transaction `date` per player among rows that appear on the player profile
   * ({@link isTransactionShownOnPlayerProfile}) — same filter as {@link getTransactionsByPlayer}.
   */
  async getMaxTransactionDatesByPlayerIds(playerIds: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>()
    if (playerIds.length === 0) return out
    const rows = await prisma.transaction.findMany({
      where: { playerId: { in: playerIds } },
      select: { playerId: true, date: true, type: true },
    })
    for (const r of rows) {
      if (!isTransactionShownOnPlayerProfile(r.type)) continue
      const d = r.date.toISOString().slice(0, 10)
      const prev = out.get(r.playerId)
      if (prev === undefined || d > prev) out.set(r.playerId, d)
    }
    return out
  }

  /**
   * Reverse chronological (newest first); tie-break by id for same calendar date.
   * Only retired, released, and free-agent types (see shared `isTransactionShownOnPlayerProfile`).
   */
  async getTransactionsByPlayer(playerId: string): Promise<Transaction[]> {
    const rows = await prisma.transaction.findMany({
      where: { playerId },
      orderBy: [{ date: "desc" }, { id: "desc" }],
    })
    return rows
      .filter((r) => isTransactionShownOnPlayerProfile(r.type))
      .map((r) => ({
        playerId: r.playerId,
        date: r.date.toISOString().slice(0, 10),
        type: r.type,
        description: r.description,
      }))
  }

  /** Creates or updates by `uniqueHash`; safe to run on a cron without duplicating rows. */
  async upsertTransactions(txs: Transaction[]): Promise<void> {
    for (const t of txs) {
      const hash = uniqueHash(t)
      const d = new Date(t.date + "T12:00:00.000Z")
      await prisma.transaction.upsert({
        where: { uniqueHash: hash },
        create: {
          playerId: t.playerId,
          date: d,
          type: t.type,
          description: t.description,
          uniqueHash: hash,
        },
        update: {
          playerId: t.playerId,
          date: d,
          type: t.type,
          description: t.description,
        },
      })
    }
  }
}
