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

export class BattingStatsRepository {
  /** Newest seasons first (by `season` desc) for “most recent” selection upstream. */
  async getStatsByPlayer(playerId: string): Promise<BattingStats[]> {
    const rows = await prisma.battingStat.findMany({
      where: { playerId },
      orderBy: { season: "desc" },
    })
    return rows.map((r) => ({
      playerId: r.playerId,
      season: r.season,
      avg: Number(r.avg),
      obp: Number(r.obp),
      slg: Number(r.slg),
      ops: Number(r.ops),
    }))
  }

  /** Batch upsert of parsed `BattingStats` rows (decimals stored as `Decimal(5,3)`). */
  async upsertStats(stats: BattingStats[]): Promise<void> {
    for (const s of stats) {
      await prisma.battingStat.upsert({
        where: {
          playerId_season: { playerId: s.playerId, season: s.season },
        },
        create: {
          playerId: s.playerId,
          season: s.season,
          avg: new Prisma.Decimal(s.avg.toFixed(3)),
          obp: new Prisma.Decimal(s.obp.toFixed(3)),
          slg: new Prisma.Decimal(s.slg.toFixed(3)),
          ops: new Prisma.Decimal(s.ops.toFixed(3)),
        },
        update: {
          avg: new Prisma.Decimal(s.avg.toFixed(3)),
          obp: new Prisma.Decimal(s.obp.toFixed(3)),
          slg: new Prisma.Decimal(s.slg.toFixed(3)),
          ops: new Prisma.Decimal(s.ops.toFixed(3)),
        },
      })
    }
  }
}
