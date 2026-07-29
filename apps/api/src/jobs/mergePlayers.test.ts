import assert from "node:assert/strict"
import test from "node:test"
import { mergePlayers, type MergePlayerSource } from "./mergePlayers"
import type { Player } from "../types/models"

function player(overrides: Partial<Player> & { id: string }): Player {
  return {
    name: "Player",
    position: "—",
    team: "—",
    status: "available",
    experienceLevel: undefined,
    ...overrides,
  }
}

function tranx(players: Player[]): MergePlayerSource {
  return { players, positionAuthoritative: true }
}
function stats(players: Player[]): MergePlayerSource {
  return { players, positionAuthoritative: false }
}

test("transaction-feed position is not clobbered by a stats feed (Leonard-like)", () => {
  const merged = mergePlayers([
    tranx([player({ id: "1", name: "Leonard", position: "SS-2B", experienceLevel: "AA" })]),
    stats([player({ id: "1", name: "Leonard", position: "1B", experienceLevel: "AAA" })]),
  ])
  assert.equal(merged.find((x) => x.id === "1")!.position, "SS-2B")
})

test("stats feed fills position when the transaction feed had none", () => {
  const merged = mergePlayers([
    tranx([player({ id: "2", name: "Doe", position: "—" })]),
    stats([player({ id: "2", name: "Doe", position: "2B" })]),
  ])
  assert.equal(merged.find((x) => x.id === "2")!.position, "2B")
})

test("stats-only player (absent from transaction feed) keeps its stats position", () => {
  const merged = mergePlayers([tranx([]), stats([player({ id: "3", name: "Roe", position: "CF" })])])
  assert.equal(merged.find((x) => x.id === "3")!.position, "CF")
})

test("a later stats feed may still override an earlier stats feed position", () => {
  const merged = mergePlayers([
    stats([player({ id: "6", position: "2B" })]),
    stats([player({ id: "6", position: "SS" })]),
  ])
  assert.equal(merged.find((x) => x.id === "6")!.position, "SS")
})

test("experience level is max-wins across feeds", () => {
  const merged = mergePlayers([
    tranx([player({ id: "4", position: "SS", experienceLevel: "AA" })]),
    stats([player({ id: "4", position: "SS", experienceLevel: "MLB" })]),
  ])
  assert.equal(merged.find((x) => x.id === "4")!.experienceLevel, "MLB")
})

test("status stickiness: a non-available transaction status survives an available stats row", () => {
  const merged = mergePlayers([
    tranx([player({ id: "5", position: "1B", status: "signed" })]),
    stats([player({ id: "5", position: "1B", status: "available" })]),
  ])
  assert.equal(merged.find((x) => x.id === "5")!.status, "signed")
})
