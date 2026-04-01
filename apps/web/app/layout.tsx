/**
 * Root layout: global styles. Widget routes add the browser chrome in `(widget)/layout.tsx`.
 * Auth and other non-widget routes use the same soft page background for consistency.
 */

import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Player Discovery Portal",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-portal-page text-neutral-900 antialiased">{children}</body>
    </html>
  )
}
