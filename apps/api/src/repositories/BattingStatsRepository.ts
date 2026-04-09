/**
 * @file BattingStatsRepository.ts
 * @description Data access for `batting_stats` — one row per (player, season).
 *
 * **Purpose:** Upsert season batting lines from the TBC batting feed; unique key
 * `(player_id, season)` ensures sync idempotency.
 *
 * **Usage:** Read paths feed `PlayerDataService`; writes run from `syncPipeline.ts`.
 */

import { Prisma } from "@prisma/client"
import type { BattingStats } from "../types/models"
import { prisma } from "../lib/prisma"
import { SYNC_UPSERT_CHUNK } from "../lib/syncBatch"

export class BattingStatsRepository {
  /** Newest seasons first (by `season` desc) for “most recent” selection upstream. */
  async getStatsByPlayer(playerId: string): Promise<BattingStats[]> {
    const rows = await prisma.battingStat.findMany({
      where: { playerId },
      orderBy: { season: "desc" },
    })
    return rows.map((r) => this.mapRow(r))
  }

  /** One query for many players; each array is newest season first (same as {@link getStatsByPlayer}). */
  async getStatsByPlayerIds(playerIds: string[]): Promise<Map<string, BattingStats[]>> {
    if (playerIds.length === 0) return new Map()
    const rows = await prisma.battingStat.findMany({
      where: { playerId: { in: playerIds } },
      orderBy: [{ playerId: "asc" }, { season: "desc" }],
    })
    const map = new Map<string, BattingStats[]>()
    for (const r of rows) {
      const list = map.get(r.playerId) ?? []
      list.push(this.mapRow(r))
      map.set(r.playerId, list)
    }
    return map
  }

  private mapRow(r: {
    playerId: string
    season: number
    avg: InstanceType<typeof Prisma.Decimal>
    obp: InstanceType<typeof Prisma.Decimal>
    slg: InstanceType<typeof Prisma.Decimal>
    ops: InstanceType<typeof Prisma.Decimal>
  }): BattingStats {
    return {
      playerId: r.playerId,
      season: r.season,
      avg: Number(r.avg),
      obp: Number(r.obp),
      slg: Number(r.slg),
      ops: Number(r.ops),
    }
  }

  /** Batch upsert of parsed `BattingStats` rows (chunked `INSERT … ON CONFLICT`). */
  async upsertStats(stats: BattingStats[]): Promise<void> {
    if (stats.length === 0) return
    for (let i = 0; i < stats.length; i += SYNC_UPSERT_CHUNK) {
      const chunk = stats.slice(i, i + SYNC_UPSERT_CHUNK)
      const rows = chunk.map((s) =>
        Prisma.sql`(${s.playerId}, ${s.season}, ${new Prisma.Decimal(s.avg.toFixed(3))}, ${new Prisma.Decimal(s.obp.toFixed(3))}, ${new Prisma.Decimal(s.slg.toFixed(3))}, ${new Prisma.Decimal(s.ops.toFixed(3))})`,
      )
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "BattingStat" ("player_id","season","avg","obp","slg","ops")
        VALUES ${Prisma.join(rows)}
        ON CONFLICT ("player_id","season") DO UPDATE SET
          "avg" = EXCLUDED."avg",
          "obp" = EXCLUDED."obp",
          "slg" = EXCLUDED."slg",
          "ops" = EXCLUDED."ops"
      `)
    }
  }
}
