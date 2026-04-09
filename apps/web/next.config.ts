import type { NextConfig } from "next"

const raw = process.env.NEXT_PUBLIC_BASE_PATH?.trim()
const basePath =
  raw && raw !== "/"
    ? (raw.startsWith("/") ? raw : `/${raw}`).replace(/\/$/, "")
    : undefined

const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
}

export default nextConfig
