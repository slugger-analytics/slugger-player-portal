import type { Config } from "tailwindcss"

/**
 * Portal UI tokens — use `portal-*` classes so future screens stay visually consistent
 * with Player Discovery Home (steel blue accent, lavender filters, soft radii).
 */
const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        portal: {
          page: "#DCE4EE",
          accent: "#6B8FB5",
          "accent-hover": "#5A7A9B",
          sidebar: "#F5F5F5",
          "filter-bg": "#FAFAFE",
          "filter-border": "#C5CAE9",
          panel: "#EEEEEE",
          chrome: "#E8ECF1",
          "chrome-border": "#C5CCD6",
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
