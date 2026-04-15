/**
 * @file ApiSyncTBC.ts
 * @description Data ingestion layer for The Baseball Cube (TBC) "JHU" CSV feeds.
 *
 * **Purpose:** Fetch raw text responses from the three feed endpoints (transactions,
 * batting, pitching). All network I/O to thebaseballcube.com runs **only on the server**
 * so the feed password never ships to the browser.
 *
 * **Usage:** Instantiate with `config.tbcFeedPassword` (from `TBC_FEED_PASSWORD`), then
 * call `fetchTransactions()`, `fetchBattingStats()`, or `fetchPitchingStats()`. The
 * returned strings are passed to `RawDataStorage` and `DataParser` in `syncPipeline.ts`.
 *
 * **Note:** Uses Node.js `https` module (HTTP/1.1) rather than `fetch` (HTTP/2 via undici)
 * to avoid Cloudflare bot-detection that blocks undici's TLS fingerprint from cloud IPs.
 */

import https from "https"

const TBC_BASE = "https://thebaseballcube.com/data/feed/jhu"

/** Builds `.../tranx.asp?pw=...` (etc.) with URL-encoded password. */
function buildUrl(path: string, password: string): string {
  const enc = encodeURIComponent(password)
  return `${TBC_BASE}/${path}?pw=${enc}`
}

/** HTTP/1.1 GET via Node.js https module, following up to 5 redirects. */
function httpsGet(url: string, redirectsLeft = 5): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          Accept: "text/plain,text/html,*/*",
          "User-Agent": "curl/8.7.1",
        },
        timeout: 180_000,
      },
      (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          if (redirectsLeft <= 0) {
            reject(new Error(`Too many redirects for ${url}`))
            return
          }
          res.resume()
          httpsGet(res.headers.location, redirectsLeft - 1).then(resolve, reject)
          return
        }
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`GET ${url} failed: ${res.statusCode} ${res.statusMessage}`))
          res.resume()
          return
        }
        const chunks: Buffer[] = []
        res.on("data", (chunk: Buffer) => chunks.push(chunk))
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
        res.on("error", reject)
      },
    )
    req.on("timeout", () => {
      req.destroy()
      reject(new Error(`GET ${url} timed out`))
    })
    req.on("error", reject)
  })
}

/**
 * Thin client for TBC feed endpoints. Each `fetch*` method delegates to {@link GET}.
 */
export class ApiSyncTBC {
  constructor(private readonly password: string) {}

  /** Low-level GET returning response body as plain text (feeds are CSV-in-HTML). */
  async GET(url: string): Promise<string> {
    return httpsGet(url)
  }

  /** Transaction rows feed (`tranx.asp`). */
  async fetchTransactions(): Promise<string> {
    return this.GET(buildUrl("tranx.asp", this.password))
  }

  /** Season batting lines (`batting.asp`). */
  async fetchBattingStats(): Promise<string> {
    return this.GET(buildUrl("batting.asp", this.password))
  }

  /** Season pitching lines (`pitching.asp`). */
  async fetchPitchingStats(): Promise<string> {
    return this.GET(buildUrl("pitching.asp", this.password))
  }
}
