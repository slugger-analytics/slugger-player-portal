import assert from "node:assert/strict"
import test from "node:test"
import { DataParser } from "./DataParser"

/**
 * Transaction-feed header modelled on TBC's documented `tranx.asp` schema, whose tail is
 * `...,age,highlevel,playerid`. Column labels exercise the real camelCase normalization
 * (`Tranx Date` → `tranxDate`, `StatusShort` → `statusshort`, `Highlevel` → `highlevel`).
 */
const TX_HEADER =
  "Player,Posit,Team,StatusShort,Tranx Date,Tranx Type,Description,Age,Highlevel,playerid"

function txFeed(rows: string[]): string {
  return [TX_HEADER, ...rows].join("<br>")
}

test("parsePlayersFromTransactionFeed emits one Player per id, keeping the newest (first-seen) row's position", () => {
  const parser = new DataParser()
  // The feed is globally date-DESC, so the first row for a player is the newest.
  const feed = txFeed([
    "Sam Leonard,SS-2B,Long Island Ducks,Free Agt,7/20/2026,Free Agent,released to free agency,29.1,AA,1001",
    "Sam Leonard,1B,Long Island Ducks,Signed,3/02/2026,Signed,signed by club,29.0,AAA,1001",
  ])
  const players = parser.parsePlayersFromTransactionFeed(feed)
  const leonard = players.filter((p) => p.id === "1001")
  assert.equal(leonard.length, 1, "one Player row per player id")
  assert.equal(leonard[0]!.position, "SS-2B", "newest transaction row wins for position")
})

test("parsePlayersFromTransactionFeed folds experienceLevel max-wins across all of a player's rows", () => {
  const parser = new DataParser()
  const feed = txFeed([
    "Sam Leonard,SS-2B,Long Island Ducks,Free Agt,7/20/2026,Free Agent,released,29.1,AA,1001",
    "Sam Leonard,1B,Long Island Ducks,Signed,3/02/2026,Signed,signed,29.0,AAA,1001",
  ])
  const players = parser.parsePlayersFromTransactionFeed(feed)
  const leonard = players.find((p) => p.id === "1001")
  assert.ok(leonard)
  assert.equal(leonard!.experienceLevel, "AAA", "highest level reached across rows wins")
})

test("oldest transaction row does not override a newer row's position (regression)", () => {
  const parser = new DataParser()
  const feed = txFeed([
    "Nery Bastidas,SS-2B,Ducks,Free Agt,6/01/2026,Free Agent,released,28.2,AA,2002",
    "Nery Bastidas,2B,Ducks,Signed,1/15/2026,Signed,signed,28.0,AA,2002",
  ])
  const players = parser.parsePlayersFromTransactionFeed(feed)
  const bastidas = players.find((p) => p.id === "2002")
  assert.equal(bastidas?.position, "SS-2B")
})

test("parsePlayersFromBattingFeed uses the stat feed position cell for a stats-only player", () => {
  const parser = new DataParser()
  const feed = ["Player,Posit,Team,Year,Bavg,playerid", "Cody Bell,CF,Chihuahuas,2026,0.285,3003"].join(
    "<br>",
  )
  const players = parser.parsePlayersFromBattingFeed(feed)
  const p = players.find((pl) => pl.id === "3003")
  assert.equal(p?.position, "CF")
})
