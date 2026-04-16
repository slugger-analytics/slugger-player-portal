/**
 * Server-rendered player detail (`GET /players/:id` + client `GET .../transactions`).
 * Styling uses portal tokens to match Player Discovery Home.
 */

import Link from "next/link"
import { notFound } from "next/navigation"
import {
  batHandDisplayLabel,
  experienceLevelDisplayLabel,
  throwHandDisplayLabel,
} from "@available-player-portal/shared"
import type { BattingStats, PitchingStats } from "@available-player-portal/shared"
import { TransactionHistoryView } from "@/components/discovery/TransactionHistoryView"
import { PlayerDetailFavoriteBar } from "@/components/favorites/PlayerDetailFavoriteBar"
import { PlayerHistoryTracker } from "@/components/history/PlayerHistoryTracker"
import { fetchPlayerProfile } from "@/lib/api"

type Props = { params: Promise<{ id: string }> }

export default async function PlayerDetailPage({ params }: Props) {
  const { id } = await params
  let profile
  try {
    profile = await fetchPlayerProfile(id)
  } catch {
    notFound()
  }

  const p = profile.player

  return (
    <main className="px-4 pb-10 sm:px-5">
      <div className="mb-5">
        <Link
          href="/dashboard"
          className="text-sm font-semibold text-portal-accent transition hover:text-portal-accent-hover hover:underline"
        >
          ← Back to Player Discovery Home
        </Link>
      </div>

      <PlayerDetailFavoriteBar playerId={p.id} playerName={p.name} />
      <PlayerHistoryTracker playerId={p.id} playerName={p.name} position={p.position} team={p.team} />

      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-black">{p.name}</h1>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-neutral-700">
          <span>
            <span className="text-neutral-500">Position:</span> {p.position}
          </span>
          <span>
            <span className="text-neutral-500">Team:</span> {p.team}
          </span>
          <span>
            <span className="text-neutral-500">Status:</span> {p.status}
          </span>
          {p.age != null ? (
            <span>
              <span className="text-neutral-500">Age:</span> {p.age}
            </span>
          ) : null}
          <span>
            <span className="text-neutral-500">Max experience level:</span>{" "}
            {experienceLevelDisplayLabel(p.experienceLevel)}
          </span>
          <span>
            <span className="text-neutral-500">Bats:</span>{" "}
            {p.bats != null ? batHandDisplayLabel(p.bats) : "—"}
          </span>
          <span>
            <span className="text-neutral-500">Throws:</span>{" "}
            {p.throws != null ? throwHandDisplayLabel(p.throws) : "—"}
          </span>
        </div>
      </header>

      <section className="mb-8 grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-portal-accent">
            Batting
          </h2>
          <BattingTable
            recent={profile.mostRecentBatting}
            previous={profile.previousBatting}
          />
        </div>
        <div>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-portal-accent">
            Pitching
          </h2>
          <PitchingTable
            recent={profile.mostRecentPitching}
            previous={profile.previousPitching}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-bold text-black">Recent transactions</h2>
        <p className="mb-4 text-xs text-neutral-500">Retired, released, and free agent only.</p>
        <TransactionHistoryView playerId={p.id} />
      </section>
    </main>
  )
}

function BattingTable({
  recent,
  previous,
}: {
  recent: BattingStats | null
  previous: BattingStats | null
}) {
  return (
    <div className="portal-surface overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead className="bg-portal-filter-bg/80 text-xs font-semibold uppercase tracking-wide text-neutral-600">
          <tr>
            <th className="px-3 py-2" />
            <th className="px-3 py-2">Season</th>
            <th className="px-3 py-2">AVG</th>
            <th className="px-3 py-2">OBP</th>
            <th className="px-3 py-2">SLG</th>
            <th className="px-3 py-2">OPS</th>
          </tr>
        </thead>
        <tbody>
          <BattingRow label="Most recent" row={recent} />
          <BattingRow label="Previous" row={previous} />
        </tbody>
      </table>
    </div>
  )
}

function BattingRow({ label, row }: { label: string; row: BattingStats | null }) {
  return (
    <tr className="border-t border-neutral-200">
      <td className="whitespace-nowrap px-3 py-2 text-xs text-neutral-500">{label}</td>
      <td className="px-3 py-2 text-neutral-700">{row ? row.season : "—"}</td>
      <td className="px-3 py-2">{row ? row.avg.toFixed(3) : "—"}</td>
      <td className="px-3 py-2">{row ? row.obp.toFixed(3) : "—"}</td>
      <td className="px-3 py-2">{row ? row.slg.toFixed(3) : "—"}</td>
      <td className="px-3 py-2">{row ? row.ops.toFixed(3) : "—"}</td>
    </tr>
  )
}

function PitchingTable({
  recent,
  previous,
}: {
  recent: PitchingStats | null
  previous: PitchingStats | null
}) {
  return (
    <div className="portal-surface overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead className="bg-portal-filter-bg/80 text-xs font-semibold uppercase tracking-wide text-neutral-600">
          <tr>
            <th className="px-3 py-2" />
            <th className="px-3 py-2">Season</th>
            <th className="px-3 py-2">ERA</th>
            <th className="px-3 py-2">WHIP</th>
            <th className="px-3 py-2">IP</th>
            <th className="px-3 py-2">K</th>
          </tr>
        </thead>
        <tbody>
          <PitchingRow label="Most recent" row={recent} />
          <PitchingRow label="Previous" row={previous} />
        </tbody>
      </table>
    </div>
  )
}

function PitchingRow({ label, row }: { label: string; row: PitchingStats | null }) {
  return (
    <tr className="border-t border-neutral-200">
      <td className="whitespace-nowrap px-3 py-2 text-xs text-neutral-500">{label}</td>
      <td className="px-3 py-2 text-neutral-700">{row ? row.season : "—"}</td>
      <td className="px-3 py-2">{row ? row.era.toFixed(2) : "—"}</td>
      <td className="px-3 py-2">{row ? row.whip.toFixed(3) : "—"}</td>
      <td className="px-3 py-2">{row ? row.ip.toFixed(1) : "—"}</td>
      <td className="px-3 py-2">{row ? row.k : "—"}</td>
    </tr>
  )
}
