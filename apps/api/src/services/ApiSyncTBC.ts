/**
 * @file ApiSyncTBC.ts
 * @description Data ingestion layer for The Baseball Cube (TBC) “JHU” CSV feeds.
 *
 * **Purpose:** Fetch raw text responses from the three feed endpoints (transactions,
 * batting, pitching). All network I/O to thebaseballcube.com runs **only on the server**
 * so the feed password never ships to the browser.
 *
 * **Usage:** Instantiate with `config.tbcFeedPassword` (from `TBC_FEED_PASSWORD`), then
 * call `fetchTransactions()`, `fetchBattingStats()`, or `fetchPitchingStats()`. The
 * returned strings are passed to `RawDataStorage` and `DataParser` in `syncPipeline.ts`.
 *
 * **Note:** Spec URLs use `http://`; production traffic redirects to HTTPS, so this
 * module uses HTTPS directly to avoid extra redirects.
 */

const TBC_BASE = "https://thebaseballcube.com/data/feed/jhu"

/** Builds `.../tranx.asp?pw=...` (etc.) with URL-encoded password. */
function buildUrl(path: string, password: string): string {
  const enc = encodeURIComponent(password)
  return `${TBC_BASE}/${path}?pw=${enc}`
}

/**
 * Thin client for TBC feed endpoints. Each `fetch*` method delegates to {@link GET}.
 */
export class ApiSyncTBC {
  constructor(private readonly password: string) {}

  /** Low-level GET returning response body as plain text (feeds are CSV-in-HTML). */
  async GET(url: string): Promise<string> {
    const res = await fetch(url, {
      headers: { Accept: "text/plain,text/html,*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(180_000),
    })
    if (!res.ok) {
      throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`)
    }
    return res.text()
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
