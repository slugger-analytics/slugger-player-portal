/**
 * When the app is served under a subpath (reverse proxy or CDN), set `NEXT_PUBLIC_BASE_PATH`
 * to match `basePath` in `next.config.ts`. Use this for client `fetch()` URLs; `next/link`
 * picks up `basePath` automatically.
 */
export function withBasePath(path: string): string {
  const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "")
  const p = path.startsWith("/") ? path : `/${path}`
  return base ? `${base}${p}` : p
}
