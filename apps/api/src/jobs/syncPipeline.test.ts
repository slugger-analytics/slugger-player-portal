import assert from "node:assert/strict"
import test from "node:test"
import { RawDataStorage } from "../services/RawDataStorage"
import { PlayerRepository } from "../repositories/PlayerRepository"
import { TransactionRepository } from "../repositories/TransactionRepository"
import { BattingStatsRepository } from "../repositories/BattingStatsRepository"
import { PitchingStatsRepository } from "../repositories/PitchingStatsRepository"
import { runSyncPipelineFromRaw } from "./syncPipeline"

const TX_HEADER =
  "Player,Posit,Team,StatusShort,Tranx Date,Tranx Type,Description,Age,Highlevel,playerid"

test("processRawFeeds refreshes profile-visible flags with the distinct touched ids, after the transaction upsert", async (t) => {
  const order: string[] = []

  // Stub every prisma-touching repository method so no DB connection is made.
  t.mock.method(RawDataStorage.prototype, "storeTransactions", async () => {})
  t.mock.method(RawDataStorage.prototype, "storeBatting", async () => {})
  t.mock.method(RawDataStorage.prototype, "storePitching", async () => {})
  t.mock.method(PlayerRepository.prototype, "upsertPlayers", async () => {})
  t.mock.method(BattingStatsRepository.prototype, "upsertStats", async () => {})
  t.mock.method(PitchingStatsRepository.prototype, "upsertStats", async () => {})
  t.mock.method(TransactionRepository.prototype, "upsertTransactions", async () => {
    order.push("upsert")
  })
  t.mock.method(TransactionRepository.prototype, "enforcePortalTransactionRetentionPolicy", async () => {})
  t.mock.method(TransactionRepository.prototype, "getPlayerIdsWithNewTransactionsSince", async () => [])
  const refreshSpy = t.mock.method(
    TransactionRepository.prototype,
    "refreshHasProfileVisibleTransactionForPlayerIds",
    async () => {
      order.push("refresh")
    },
  )

  // Transaction feed has player 1001 twice + 2002 once → distinct set {1001, 2002}.
  const transactionsRaw = [
    TX_HEADER,
    "Al Pha,SS,Ducks,Free Agt,7/20/2026,Free Agent,released,29,AA,1001",
    "Al Pha,SS,Ducks,Signed,3/01/2026,Signed,signed,29,AA,1001",
    "Be Ta,2B,Ducks,Free Agt,6/01/2026,Free Agent,released,28,AA,2002",
  ].join("<br>")
  const battingRaw = ["Player,Posit,Team,Year,Bavg,playerid", "Al Pha,SS,Ducks,2026,0.3,1001"].join("<br>")
  const pitchingRaw = ["Player,Posit,Team,Year,ERA,playerid", "Ce Ta,P,Ducks,2026,3.5,4004"].join("<br>")

  await runSyncPipelineFromRaw({ transactionsRaw, battingRaw, pitchingRaw })

  assert.equal(refreshSpy.mock.calls.length, 1, "refresh called exactly once")
  const ids = refreshSpy.mock.calls[0]!.arguments[0] as string[]
  assert.deepEqual([...ids].sort(), ["1001", "2002"], "refresh receives the distinct touched player ids")
  assert.deepEqual(order, ["upsert", "refresh"], "refresh runs after the transaction upsert")
})
