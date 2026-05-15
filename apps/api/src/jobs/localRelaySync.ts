/**
 * Relay sync runner:
 * 1) Fetches BaseballCube feeds from the runner or configured proxy
 * 2) Uploads raw payloads to production `/sync/ingest-raw`, where DB writes
 *    and notification matching happen in the API environment.
 *
 * Required env:
 * - TBC_FEED_PASSWORD
 * - SYNC_INTERNAL_KEY
 *
 * Optional env:
 * - REMOTE_SYNC_INGEST_URL (default production endpoint)
 * - TBC_HTTPS_PROXY (static/whitelisted egress for TBC fetches)
 */

import { config } from "../config"
import { ApiSyncTBC } from "../services/ApiSyncTBC"
import { gzipSync } from "node:zlib"

async function runLocalRelaySync(): Promise<void> {
  const remoteUrl =
    process.env.REMOTE_SYNC_INGEST_URL?.trim() ||
    "https://www.alpb-analytics.com/widgets/player-portal/api/sync/ingest-raw"
  const syncKey = process.env.SYNC_INTERNAL_KEY?.trim()
  if (!syncKey) {
    throw new Error("Missing SYNC_INTERNAL_KEY")
  }

  const sync = new ApiSyncTBC(config.tbcFeedPassword, {
    proxyUrl: config.tbcHttpsProxyUrl || undefined,
  })
  const [transactionsRaw, battingRaw, pitchingRaw] = await Promise.all([
    sync.fetchTransactions(),
    sync.fetchBattingStats(),
    sync.fetchPitchingStats(),
  ])

  const payload = JSON.stringify({
    transactionsRaw,
    battingRaw,
    pitchingRaw,
  })
  const compressed = gzipSync(Buffer.from(payload, "utf8"))

  const response = await fetch(remoteUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "content-encoding": "gzip",
      authorization: `Bearer ${syncKey}`,
    },
    body: compressed,
  })
  const bodyText = await response.text()
  if (!response.ok) {
    throw new Error(`Ingest failed (${response.status}): ${bodyText}`)
  }
  // eslint-disable-next-line no-console
  console.log(bodyText)
}

runLocalRelaySync().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error)
  process.exit(1)
})

