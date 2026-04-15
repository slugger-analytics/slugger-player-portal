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
      where: {
        playerId,
        NOT: { teamName: { contains: "|" } },
      },
      orderBy: [{ season: "desc" }, { teamName: "desc" }],
    })
    return rows.map((r) => ({
      playerId: r.playerId,
      season: r.season,
      teamName: r.teamName || null,
      avg: Number(r.avg),
      obp: Number(r.obp),
      slg: Number(r.slg),
      ops: Number(r.ops),
      bb: r.bb,
    }))
  }

  async getStatsByPlayerIds(playerIds: string[]): Promise<Map<string, BattingStats[]>> {
    if (playerIds.length === 0) return new Map()
    const rows = await prisma.battingStat.findMany({
      where: {
        playerId: { in: playerIds },
        NOT: { teamName: { contains: "|" } },
      },
      orderBy: [{ playerId: "asc" }, { season: "desc" }, { teamName: "desc" }],
    })
    const map = new Map<string, BattingStats[]>()
    for (const r of rows) {
      const list = map.get(r.playerId) ?? []
      list.push({
        playerId: r.playerId,
        season: r.season,
        teamName: r.teamName || null,
        avg: Number(r.avg),
        obp: Number(r.obp),
        slg: Number(r.slg),
        ops: Number(r.ops),
        bb: r.bb,
      })
      map.set(r.playerId, list)
    }
    return map
  }

  /** Batch upsert of parsed `BattingStats` rows (decimals stored as `Decimal(5,3)`). */
  async upsertStats(stats: BattingStats[]): Promise<void> {
    const byKey = new Map<string, BattingStats>()
    for (const s of stats) byKey.set(`${s.playerId}\0${s.season}\0${s.teamName ?? ""}`, s)
    for (const s of byKey.values()) {
      await prisma.battingStat.upsert({
        where: {
          playerId_season_teamName: {
            playerId: s.playerId,
            season: s.season,
            teamName: s.teamName ?? "",
          },
        },
        create: {
          playerId: s.playerId,
          season: s.season,
          teamName: s.teamName ?? "",
          avg: new Prisma.Decimal(s.avg.toFixed(3)),
          obp: new Prisma.Decimal(s.obp.toFixed(3)),
          slg: new Prisma.Decimal(s.slg.toFixed(3)),
          ops: new Prisma.Decimal(s.ops.toFixed(3)),
          bb: s.bb,
        },
        update: {
          teamName: s.teamName ?? "",
          avg: new Prisma.Decimal(s.avg.toFixed(3)),
          obp: new Prisma.Decimal(s.obp.toFixed(3)),
          slg: new Prisma.Decimal(s.slg.toFixed(3)),
          ops: new Prisma.Decimal(s.ops.toFixed(3)),
          bb: s.bb,
        },
      })
    }
  }
}
