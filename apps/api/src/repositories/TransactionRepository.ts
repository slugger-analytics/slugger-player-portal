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

import {
  isTransactionShownOnPlayerProfile,
  transactionTypeMatchesFamilies,
  type TransactionTypeFilter,
} from "@available-player-portal/shared"
import { createHash } from "crypto"
import { Prisma } from "@prisma/client"
import type { Transaction } from "../types/models"
import { prisma } from "../lib/prisma"
import { SYNC_UPSERT_CHUNK } from "../lib/syncBatch"
import { profileVisibleTransactionTypeSql } from "./profileVisibleTransactionSql"

/** Max player ids per `WHERE id IN (...)` refresh — PG bind-variable limit is ~32k. */
const REFRESH_PROFILE_TX_PLAYER_CHUNK = 4000
const EXISTING_PLAYER_ID_CHUNK = 4000

/** Drop transaction rows before this calendar date; then orphan players without profile-visible tx are removed. */
export const PORTAL_TRANSACTION_MIN_DATE = "2025-01-01"

/** Stable natural key for Prisma `upsert` when the feed does not supply a surrogate id. */
function uniqueHash(t: Transaction): string {
  return createHash("sha256")
    .update([t.playerId, t.date, t.type, t.description].join("|"))
    .digest("hex")
}

export class TransactionRepository {
  private matchesTransactionTypeFilter(type: string, filters?: TransactionTypeFilter[]): boolean {
    if (!filters || filters.length === 0) return isTransactionShownOnPlayerProfile(type)
    return transactionTypeMatchesFamilies(type, filters)
  }

  private async existingPlayerIds(playerIds: string[]): Promise<Set<string>> {
    const unique = [...new Set(playerIds)]
    const out = new Set<string>()
    for (let i = 0; i < unique.length; i += EXISTING_PLAYER_ID_CHUNK) {
      const chunk = unique.slice(i, i + EXISTING_PLAYER_ID_CHUNK)
      const rows = await prisma.player.findMany({
        where: { id: { in: chunk } },
        select: { id: true },
      })
      for (const r of rows) out.add(r.id)
    }
    return out
  }

  /**
   * Max transaction `date` per player among rows that appear on the player profile
   * ({@link isTransactionShownOnPlayerProfile}) — same filter as {@link getTransactionsByPlayer}.
   */
  async getMaxTransactionDatesByPlayerIds(
    playerIds: string[],
    transactionTypes?: TransactionTypeFilter[],
  ): Promise<Map<string, string>> {
    const out = new Map<string, string>()
    if (playerIds.length === 0) return out
    const rows = await prisma.transaction.findMany({
      where: { playerId: { in: playerIds } },
      select: { playerId: true, date: true, type: true },
    })
    for (const r of rows) {
      if (!this.matchesTransactionTypeFilter(r.type, transactionTypes)) continue
      const d = r.date.toISOString().slice(0, 10)
      const prev = out.get(r.playerId)
      if (prev === undefined || d > prev) out.set(r.playerId, d)
    }
    return out
  }

  async getMostRecentProfileTransactionsByPlayerIds(
    playerIds: string[],
    transactionTypes?: TransactionTypeFilter[],
  ): Promise<Map<string, { date: string; type: string }>> {
    const out = new Map<string, { date: string; type: string }>()
    if (playerIds.length === 0) return out
    const rows = await prisma.transaction.findMany({
      where: { playerId: { in: playerIds } },
      select: { playerId: true, date: true, type: true },
    })
    for (const r of rows) {
      if (!this.matchesTransactionTypeFilter(r.type, transactionTypes)) continue
      const d = r.date.toISOString().slice(0, 10)
      const prev = out.get(r.playerId)
      if (!prev || d > prev.date) out.set(r.playerId, { date: d, type: r.type })
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

  /** Creates or updates by `uniqueHash`; bulk upsert per chunk for sync performance. */
  async upsertTransactions(txs: Transaction[]): Promise<void> {
    if (txs.length === 0) return
    const existingIds = await this.existingPlayerIds(txs.map((t) => t.playerId))
    const byHash = new Map<string, Transaction>()
    for (const t of txs) {
      if (!existingIds.has(t.playerId)) continue
      byHash.set(uniqueHash(t), t)
    }
    const uniqueTxs = [...byHash.values()]
    if (uniqueTxs.length === 0) return
    for (let i = 0; i < uniqueTxs.length; i += SYNC_UPSERT_CHUNK) {
      const chunk = uniqueTxs.slice(i, i + SYNC_UPSERT_CHUNK)
      const rows = chunk.map((t) => {
        const hash = uniqueHash(t)
        const d = new Date(t.date + "T12:00:00.000Z")
        return Prisma.sql`(${t.playerId}, ${d}::date, ${t.type}, ${t.description}, ${hash})`
      })
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "Transaction" ("player_id","date","type","description","unique_hash")
        SELECT v.player_id, v.date, v.type, v.description, v.unique_hash
        FROM (VALUES ${Prisma.join(rows)}) AS v(player_id, date, type, description, unique_hash)
        INNER JOIN "Player" p ON p.id = v.player_id
        ON CONFLICT ("unique_hash") DO UPDATE SET
          "player_id" = EXCLUDED."player_id",
          "date" = EXCLUDED."date",
          "type" = EXCLUDED."type",
          "description" = EXCLUDED."description"
      `)
    }
  }

  /**
   * 1) Delete transactions before {@link PORTAL_TRANSACTION_MIN_DATE}.
   * 2) Recompute {@link Player.hasProfileVisibleTransaction} for every player.
   * 3) Anyone with a profile-visible transaction is marked discovery-eligible (feed beats heuristics).
   * 4) Delete players with no profile-visible transactions (cascades stats + remaining transactions).
   * Call after sync upserts so the portal only retains 2025+ transaction history for eligibility.
   */
  async enforcePortalTransactionRetentionPolicy(): Promise<void> {
    await prisma.$executeRaw`
      DELETE FROM "Transaction" WHERE date < ${PORTAL_TRANSACTION_MIN_DATE}::date
    `
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "Player" p
      SET has_profile_visible_transaction = EXISTS (
        SELECT 1 FROM "Transaction" t
        WHERE t.player_id = p.id
        AND (${profileVisibleTransactionTypeSql()})
      )
    `)
    await prisma.$executeRaw`
      UPDATE "Player"
      SET discovery_eligible = true
      WHERE has_profile_visible_transaction = true
    `
    await prisma.$executeRaw`
      DELETE FROM "Player"
      WHERE has_profile_visible_transaction = false
    `
  }

  /**
   * Recompute {@link Player.hasProfileVisibleTransaction} from DB for these players
   * (matches {@link isTransactionShownOnPlayerProfile} in SQL).
   */
  async refreshHasProfileVisibleTransactionForPlayerIds(playerIds: string[]): Promise<void> {
    if (playerIds.length === 0) return
    const unique = [...new Set(playerIds)]
    for (let i = 0; i < unique.length; i += REFRESH_PROFILE_TX_PLAYER_CHUNK) {
      const chunk = unique.slice(i, i + REFRESH_PROFILE_TX_PLAYER_CHUNK)
      await prisma.$executeRaw(Prisma.sql`
        UPDATE "Player" p
        SET has_profile_visible_transaction = EXISTS (
          SELECT 1 FROM "Transaction" t
          WHERE t.player_id = p.id
          AND (${profileVisibleTransactionTypeSql()})
        )
        WHERE p.id IN (${Prisma.join(chunk.map((id) => Prisma.sql`${id}`))})
      `)
    }
  }

  async getPlayerIdsWithNewTransactionsSince(since: Date): Promise<string[]> {
    const rows = await prisma.transaction.findMany({
      where: { createdAt: { gte: since } },
      select: { playerId: true },
      distinct: ["playerId"],
    })
    return rows.map((row) => row.playerId)
  }
}
