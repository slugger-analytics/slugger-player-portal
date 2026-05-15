/**
 * @file FeedObjectStore.ts
 * @description S3 staging area for TBC raw feed payloads.
 *
 * The Lambda sits behind ALB which caps the request body at ~1 MB, well below
 * a single gzipped BaseballCube feed. GitHub Actions runners therefore upload
 * raw feed bodies (gzip-compressed) to `FEED_S3_BUCKET` and `POST /sync/ingest-raw`
 * with the resulting object keys; this module hands the Lambda the decompressed
 * UTF-8 strings without storing anything on disk.
 */

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { gunzipSync } from "node:zlib"

import { config } from "../config"

export type FeedObjectKeys = {
  bucket?: string
  transactionsKey: string
  battingKey: string
  pitchingKey: string
}

export type RawFeedTriple = {
  transactionsRaw: string
  battingRaw: string
  pitchingRaw: string
}

export class FeedObjectStore {
  private readonly client: S3Client

  constructor(client?: S3Client) {
    this.client = client ?? new S3Client({ region: process.env.AWS_REGION || "us-east-2" })
  }

  /** Reads all three feed objects from S3, transparently gunzip'ing `.gz` keys. */
  async readFeeds(keys: FeedObjectKeys): Promise<RawFeedTriple> {
    const bucket = keys.bucket?.trim() || config.feedS3Bucket
    if (!bucket) {
      throw new Error("Missing FEED_S3_BUCKET configuration for relay ingest")
    }
    const [transactionsRaw, battingRaw, pitchingRaw] = await Promise.all([
      this.readObject(bucket, keys.transactionsKey),
      this.readObject(bucket, keys.battingKey),
      this.readObject(bucket, keys.pitchingKey),
    ])
    return { transactionsRaw, battingRaw, pitchingRaw }
  }

  private async readObject(bucket: string, key: string): Promise<string> {
    const response = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    const buffer = await this.streamToBuffer(response.Body as NodeJS.ReadableStream | undefined)
    const decoded = key.endsWith(".gz") ? gunzipSync(buffer) : buffer
    return decoded.toString("utf8")
  }

  private async streamToBuffer(stream: NodeJS.ReadableStream | undefined): Promise<Buffer> {
    if (!stream) return Buffer.alloc(0)
    const chunks: Buffer[] = []
    for await (const chunk of stream) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer))
    }
    return Buffer.concat(chunks)
  }
}
