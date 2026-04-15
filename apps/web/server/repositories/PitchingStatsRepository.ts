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
    return rows.map((r) => ({
      playerId: r.playerId,
      season: r.season,
      teamName: r.teamName || null,
      g: r.g,
      era: Number(r.era),
      whip: Number(r.whip),
      ip: Number(r.ip),
      k: r.k,
      bb: r.bb,
    }))
  }

  /** Batch upsert of parsed `PitchingStats` rows. */
  async upsertStats(stats: PitchingStats[]): Promise<void> {
    const byKey = new Map<string, PitchingStats>()
    for (const s of stats) byKey.set(`${s.playerId}\0${s.season}\0${s.teamName ?? ""}`, s)
    for (const s of byKey.values()) {
      await prisma.pitchingStat.upsert({
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
          g: s.g,
          era: new Prisma.Decimal(s.era.toFixed(2)),
          whip: new Prisma.Decimal(s.whip.toFixed(3)),
          ip: new Prisma.Decimal(s.ip.toFixed(1)),
          k: s.k,
          bb: s.bb,
        },
        update: {
          teamName: s.teamName ?? "",
          g: s.g,
          era: new Prisma.Decimal(s.era.toFixed(2)),
          whip: new Prisma.Decimal(s.whip.toFixed(3)),
          ip: new Prisma.Decimal(s.ip.toFixed(1)),
          k: s.k,
          bb: s.bb,
        },
      })
    }
  }
}
