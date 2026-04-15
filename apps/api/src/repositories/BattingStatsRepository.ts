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
      where: {
        playerId,
        NOT: { teamName: { contains: "|" } },
      },
      orderBy: [{ season: "desc" }, { teamName: "desc" }],
    })
    return rows.map((r) => this.mapRow(r))
  }

  /** One query for many players; each array is newest season first (same as {@link getStatsByPlayer}). */
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
      list.push(this.mapRow(r))
      map.set(r.playerId, list)
    }
    return map
  }

  private mapRow(r: {
    playerId: string
    season: number
    teamName?: string | null
    avg: InstanceType<typeof Prisma.Decimal>
    obp: InstanceType<typeof Prisma.Decimal>
    slg: InstanceType<typeof Prisma.Decimal>
    ops: InstanceType<typeof Prisma.Decimal>
    bb: number
    hr: number
  }): BattingStats {
    return {
      playerId: r.playerId,
      season: r.season,
      teamName: r.teamName || null,
      avg: Number(r.avg),
      obp: Number(r.obp),
      slg: Number(r.slg),
      ops: Number(r.ops),
      bb: r.bb,
      hr: r.hr,
    }
  }

  /** Batch upsert of parsed `BattingStats` rows (chunked `INSERT … ON CONFLICT`). */
  async upsertStats(stats: BattingStats[]): Promise<void> {
    if (stats.length === 0) return
    const byKey = new Map<string, BattingStats>()
    for (const s of stats) byKey.set(`${s.playerId}\0${s.season}\0${s.teamName ?? ""}`, s)
    const uniqueStats = [...byKey.values()]
    for (let i = 0; i < uniqueStats.length; i += SYNC_UPSERT_CHUNK) {
      const chunk = uniqueStats.slice(i, i + SYNC_UPSERT_CHUNK)
      const rows = chunk.map((s) =>
        Prisma.sql`(${s.playerId}, ${s.season}, ${s.teamName ?? ""}, ${new Prisma.Decimal(s.avg.toFixed(3))}, ${new Prisma.Decimal(s.obp.toFixed(3))}, ${new Prisma.Decimal(s.slg.toFixed(3))}, ${new Prisma.Decimal(s.ops.toFixed(3))}, ${s.bb}, ${s.hr})`,
      )
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "BattingStat" ("player_id","season","team_name","avg","obp","slg","ops","bb","hr")
        VALUES ${Prisma.join(rows)}
        ON CONFLICT ("player_id","season","team_name") DO UPDATE SET
          "team_name" = EXCLUDED."team_name",
          "avg" = EXCLUDED."avg",
          "obp" = EXCLUDED."obp",
          "slg" = EXCLUDED."slg",
          "ops" = EXCLUDED."ops",
          "bb" = EXCLUDED."bb",
          "hr" = EXCLUDED."hr"
      `)
    }
  }
}
