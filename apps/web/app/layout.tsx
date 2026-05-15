/**
 * Root layout: global styles. Widget routes add the browser chrome in `(widget)/layout.tsx`.
 * Auth and other non-widget routes use the same soft page background for consistency.
 */

import type { Metadata } from "next"
import "./globals.css"
import { ThemeProvider } from "@/components/portal/ThemeProvider"

export const metadata: Metadata = {
  title: "Player Discovery Portal",
}

/** Runs before paint so the first frame matches saved or system theme (avoids flash). */
const themeInitScript = `(function(){try{var k='portal-theme';var t=localStorage.getItem(k);var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen bg-portal-page text-neutral-900 antialiased dark:text-neutral-100">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
