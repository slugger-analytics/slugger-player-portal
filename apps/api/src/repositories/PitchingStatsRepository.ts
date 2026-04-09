/**
 * @file PitchingStatsRepository.ts
 * @description Data access for `pitching_stats` — one row per (player, season).
 *
 * **Purpose:** Upsert ERA/WHIP/IP/K from the TBC pitching feed; `(player_id, season)` is unique.
 *
 * **Usage:** Same pattern as {@link BattingStatsRepository}.
 */

import { Prisma } from "@prisma/client"
import type { PitchingStats } from "../types/models"
import { prisma } from "../lib/prisma"
import { SYNC_UPSERT_CHUNK } from "../lib/syncBatch"

export class PitchingStatsRepository {
  /** Newest seasons first for downstream “most recent” / “previous” season picks. */
  async getStatsByPlayer(playerId: string): Promise<PitchingStats[]> {
    const rows = await prisma.pitchingStat.findMany({
      where: { playerId },
      orderBy: { season: "desc" },
    })
    return rows.map((r) => this.mapRow(r))
  }

  /** Batched variant of {@link getStatsByPlayer} (newest season first per player). */
  async getStatsByPlayerIds(playerIds: string[]): Promise<Map<string, PitchingStats[]>> {
    if (playerIds.length === 0) return new Map()
    const rows = await prisma.pitchingStat.findMany({
      where: { playerId: { in: playerIds } },
      orderBy: [{ playerId: "asc" }, { season: "desc" }],
    })
    const map = new Map<string, PitchingStats[]>()
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
    era: InstanceType<typeof Prisma.Decimal>
    whip: InstanceType<typeof Prisma.Decimal>
    ip: InstanceType<typeof Prisma.Decimal>
    k: number
  }): PitchingStats {
    return {
      playerId: r.playerId,
      season: r.season,
      era: Number(r.era),
      whip: Number(r.whip),
      ip: Number(r.ip),
      k: r.k,
    }
  }

  /** Batch upsert of parsed `PitchingStats` rows (chunked `INSERT … ON CONFLICT`). */
  async upsertStats(stats: PitchingStats[]): Promise<void> {
    if (stats.length === 0) return
    for (let i = 0; i < stats.length; i += SYNC_UPSERT_CHUNK) {
      const chunk = stats.slice(i, i + SYNC_UPSERT_CHUNK)
      const rows = chunk.map((s) =>
        Prisma.sql`(${s.playerId}, ${s.season}, ${new Prisma.Decimal(s.era.toFixed(2))}, ${new Prisma.Decimal(s.whip.toFixed(3))}, ${new Prisma.Decimal(s.ip.toFixed(1))}, ${s.k})`,
      )
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "PitchingStat" ("player_id","season","era","whip","ip","k")
        VALUES ${Prisma.join(rows)}
        ON CONFLICT ("player_id","season") DO UPDATE SET
          "era" = EXCLUDED."era",
          "whip" = EXCLUDED."whip",
          "ip" = EXCLUDED."ip",
          "k" = EXCLUDED."k"
      `)
    }
  }
}
