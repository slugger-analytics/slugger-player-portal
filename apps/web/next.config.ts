import type { NextConfig } from "next"
import path from "path"

const raw = process.env.NEXT_PUBLIC_BASE_PATH?.trim()
const basePath =
  raw && raw !== "/"
    ? (raw.startsWith("/") ? raw : `/${raw}`).replace(/\/$/, "")
    : undefined

const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),
  // Required for Lambda deployment: produces .next/standalone/server.js
  output: "standalone",
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
  // Trace file dependencies from the monorepo root so packages/shared/ is
  // included in the standalone bundle when building inside Docker
  outputFileTracingRoot: path.join(__dirname, "../../"),
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            // Allow the SLUGGER website to embed this widget in an iframe.
            // Both are served from the same domain (alpb-analytics.com via the ALB)
            // so 'self' is sufficient. Extend this list if other origins need access.
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https://alpb-analytics.com https://www.alpb-analytics.com",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
        ],
      },
    ]
  },
}

export default nextConfig
