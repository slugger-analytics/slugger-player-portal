import assert from "node:assert/strict"
import test from "node:test"
import { BattingStatsRepository } from "../repositories/BattingStatsRepository"
import { PitchingStatsRepository } from "../repositories/PitchingStatsRepository"
import { PlayerRepository } from "../repositories/PlayerRepository"
import { TransactionRepository } from "../repositories/TransactionRepository"
import { todayIsoUtc } from "../repositories/transactionWindow"
import type { Player, PlayerFilters } from "../types/models"
import { PlayerDataService } from "./PlayerDataService"

const PLAYER: Player = { id: "1001", name: "Sam Leonard", position: "2B", team: "Ducks", status: "available" }

/** Stubs every prisma-touching repository method and returns the card-lookup spy. */
function stubRepositories(t: { mock: { method: typeof import("node:test")["mock"]["method"] } }) {
  t.mock.method(PlayerRepository.prototype, "countPlayers", async () => 1)
  t.mock.method(PlayerRepository.prototype, "getPlayers", async () => [PLAYER])
  t.mock.method(BattingStatsRepository.prototype, "getStatsByPlayerIds", async () => new Map())
  t.mock.method(PitchingStatsRepository.prototype, "getStatsByPlayerIds", async () => new Map())
  return t.mock.method(
    TransactionRepository.prototype,
    "getMostRecentProfileTransactionsByPlayerIds",
    async () => new Map<string, { date: string; type: string }>(),
  )
}

async function anchorPassedToCardLookup(
  t: Parameters<typeof stubRepositories>[0],
  filters: PlayerFilters,
): Promise<unknown> {
  const spy = stubRepositories(t)
  await new PlayerDataService().listPlayerSummariesWithTotal(filters)
  assert.equal(spy.mock.calls.length, 1, "card lookup called once")
  return spy.mock.calls[0]!.arguments[2]
}

test("an explicit anchor reaches the discovery card lookup", async (t) => {
  const asOf = await anchorPassedToCardLookup(t, { lastTransactionDays: 30, asOfDate: "2026-07-26" })
  assert.equal(asOf, "2026-07-26")
})

test("a window with no anchor clamps cards to today, so card dates stay inside the window", async (t) => {
  const asOf = await anchorPassedToCardLookup(t, { lastTransactionDays: 30 })
  assert.equal(asOf, todayIsoUtc())
})

test("without a window the card lookup is unclamped (byte-identical to previous behaviour)", async (t) => {
  const asOf = await anchorPassedToCardLookup(t, { position: "2B" })
  assert.equal(asOf, undefined)
})
