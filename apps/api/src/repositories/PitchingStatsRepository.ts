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
      where: {
        playerId,
        NOT: { teamName: { contains: "|" } },
      },
      orderBy: [{ season: "desc" }, { teamName: "desc" }],
    })
    return rows.map((r) => this.mapRow(r))
  }

  /** Batched variant of {@link getStatsByPlayer} (newest season first per player). */
  async getStatsByPlayerIds(playerIds: string[]): Promise<Map<string, PitchingStats[]>> {
    if (playerIds.length === 0) return new Map()
    const rows = await prisma.pitchingStat.findMany({
      where: {
        playerId: { in: playerIds },
        NOT: { teamName: { contains: "|" } },
      },
      orderBy: [{ playerId: "asc" }, { season: "desc" }, { teamName: "desc" }],
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
    teamName?: string | null
    g: number
    era: InstanceType<typeof Prisma.Decimal>
    whip: InstanceType<typeof Prisma.Decimal>
    ip: InstanceType<typeof Prisma.Decimal>
    k: number
    bb: number
  }): PitchingStats {
    return {
      playerId: r.playerId,
      season: r.season,
      teamName: r.teamName || null,
      g: r.g,
      era: Number(r.era),
      whip: Number(r.whip),
      ip: Number(r.ip),
      k: r.k,
      bb: r.bb,
    }
  }

  /** Batch upsert of parsed `PitchingStats` rows (chunked `INSERT … ON CONFLICT`). */
  async upsertStats(stats: PitchingStats[]): Promise<void> {
    if (stats.length === 0) return
    const byKey = new Map<string, PitchingStats>()
    for (const s of stats) byKey.set(`${s.playerId}\0${s.season}\0${s.teamName ?? ""}`, s)
    const uniqueStats = [...byKey.values()]
    for (let i = 0; i < uniqueStats.length; i += SYNC_UPSERT_CHUNK) {
      const chunk = uniqueStats.slice(i, i + SYNC_UPSERT_CHUNK)
      const rows = chunk.map((s) =>
        Prisma.sql`(${s.playerId}, ${s.season}, ${s.teamName ?? ""}, ${s.g}, ${new Prisma.Decimal(s.era.toFixed(2))}, ${new Prisma.Decimal(s.whip.toFixed(3))}, ${new Prisma.Decimal(s.ip.toFixed(1))}, ${s.k}, ${s.bb})`,
      )
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "PitchingStat" ("player_id","season","team_name","g","era","whip","ip","k","bb")
        VALUES ${Prisma.join(rows)}
        ON CONFLICT ("player_id","season","team_name") DO UPDATE SET
          "team_name" = EXCLUDED."team_name",
          "g" = EXCLUDED."g",
          "era" = EXCLUDED."era",
          "whip" = EXCLUDED."whip",
          "ip" = EXCLUDED."ip",
          "k" = EXCLUDED."k",
          "bb" = EXCLUDED."bb"
      `)
    }
  }
}
