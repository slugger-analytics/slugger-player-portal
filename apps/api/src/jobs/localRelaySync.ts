/**
 * Relay sync runner:
 * 1) Fetch BaseballCube feeds from a non-AWS network (GitHub-hosted runner or local
 *    workstation) so the Lambda never has to egress to TBC and never trips
 *    Cloudflare's Bot Fight Mode against AWS IPs.
 * 2) Upload the three feed bodies gzipped to S3 (`FEED_S3_BUCKET`).
 * 3) `POST /sync/ingest-raw` with the S3 keys. The Lambda reads the feeds from
 *    S3 via its VPC gateway endpoint, runs the same parse + upsert + notification
 *    matching as a normal sync, and sends emails through SES.
 *
 * Required env:
 * - TBC_FEED_PASSWORD
 * - SYNC_INTERNAL_KEY
 * - FEED_S3_BUCKET (S3 bucket the Lambda role can read from under `feeds/`)
 *
 * Optional env:
 * - REMOTE_SYNC_INGEST_URL — defaults to production ingest endpoint
 * - TBC_HTTPS_PROXY        — static egress for TBC fetches when needed
 * - AWS_REGION             — defaults to us-east-2 (matches Lambda region)
 * - SYNC_RUN_ID            — labels the S3 object prefix; defaults to ISO timestamp
 */

import { gzipSync } from "node:zlib"
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

import { config } from "../config"
import { ApiSyncTBC } from "../services/ApiSyncTBC"

type UploadedKeys = {
  bucket: string
  transactionsKey: string
  battingKey: string
  pitchingKey: string
}

function safeRunId(): string {
  const explicit = process.env.SYNC_RUN_ID?.trim()
  if (explicit) return explicit.replaceAll("/", "-")
  return new Date().toISOString().replaceAll(":", "-")
}

async function uploadFeeds(
  s3: S3Client,
  bucket: string,
  runId: string,
  feeds: { transactionsRaw: string; battingRaw: string; pitchingRaw: string },
): Promise<UploadedKeys> {
  const prefix = `feeds/${runId}`
  const items: Array<{ slot: keyof UploadedKeys; key: string; body: string }> = [
    { slot: "transactionsKey", key: `${prefix}/transactions.csv.gz`, body: feeds.transactionsRaw },
    { slot: "battingKey", key: `${prefix}/batting.csv.gz`, body: feeds.battingRaw },
    { slot: "pitchingKey", key: `${prefix}/pitching.csv.gz`, body: feeds.pitchingRaw },
  ]
  await Promise.all(
    items.map((item) =>
      s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: item.key,
          Body: gzipSync(Buffer.from(item.body, "utf8")),
          ContentType: "text/csv",
          ContentEncoding: "gzip",
        }),
      ),
    ),
  )
  const lookup = Object.fromEntries(items.map((i) => [i.slot, i.key])) as Record<keyof UploadedKeys, string>
  return {
    bucket,
    transactionsKey: lookup.transactionsKey,
    battingKey: lookup.battingKey,
    pitchingKey: lookup.pitchingKey,
  }
}

async function runLocalRelaySync(): Promise<void> {
  const remoteUrl =
    process.env.REMOTE_SYNC_INGEST_URL?.trim() ||
    "https://www.alpb-analytics.com/widgets/player-portal/api/sync/ingest-raw"
  const syncKey = process.env.SYNC_INTERNAL_KEY?.trim()
  if (!syncKey) {
    throw new Error("Missing SYNC_INTERNAL_KEY")
  }
  const bucket = process.env.FEED_S3_BUCKET?.trim()
  if (!bucket) {
    throw new Error(
      "Missing FEED_S3_BUCKET. The relay uploads gzipped feeds to S3 so the Lambda can read them via its VPC endpoint (avoids the ALB → Lambda 1 MB request limit).",
    )
  }

  const sync = new ApiSyncTBC(config.tbcFeedPassword, {
    proxyUrl: config.tbcHttpsProxyUrl || undefined,
  })
  const [transactionsRaw, battingRaw, pitchingRaw] = await Promise.all([
    sync.fetchTransactions(),
    sync.fetchBattingStats(),
    sync.fetchPitchingStats(),
  ])

  const s3 = new S3Client({ region: process.env.AWS_REGION?.trim() || "us-east-2" })
  const runId = safeRunId()
  const uploaded = await uploadFeeds(s3, bucket, runId, { transactionsRaw, battingRaw, pitchingRaw })

  // eslint-disable-next-line no-console
  console.log(
    `[sync:relay] uploaded feeds to s3://${uploaded.bucket}/feeds/${runId}/ — calling ingest-raw`,
  )

  const response = await fetch(remoteUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${syncKey}`,
    },
    body: JSON.stringify({
      s3Bucket: uploaded.bucket,
      transactionsKey: uploaded.transactionsKey,
      battingKey: uploaded.battingKey,
      pitchingKey: uploaded.pitchingKey,
    }),
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
