import type { Config } from "tailwindcss"

/**
 * Portal UI tokens — use `portal-*` classes so future screens stay visually consistent
 * with Player Discovery Home.
 */
const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        portal: {
          page: "var(--portal-page)",
          accent: "var(--portal-accent)",
          "accent-hover": "var(--portal-accent-hover)",
          sidebar: "var(--portal-sidebar)",
          "filter-bg": "var(--portal-filter-bg)",
          "filter-border": "var(--portal-filter-border)",
          panel: "var(--portal-panel)",
          chrome: "var(--portal-chrome)",
          "chrome-border": "var(--portal-chrome-border)",
          surface: "var(--portal-surface)",
          main: "var(--portal-main-bg)",
        },
      },
      borderRadius: {
        portal: "16px",
        "portal-sm": "12px",
        "portal-lg": "20px",
      },
      boxShadow: {
        portal: "0 2px 12px rgba(74, 95, 120, 0.08)",
        "portal-card": "0 2px 8px rgba(0, 0, 0, 0.06)",
        "portal-nav": "0 1px 4px rgba(0, 0, 0, 0.08)",
      },
    },
  },
  plugins: [],
}

export default config
