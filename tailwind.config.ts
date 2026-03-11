// PURPOSE: Tailwind CSS configuration for Available Player Portal.
// Design tokens aligned with Figma: light gray sidebar, light blue active state, rounded corners.
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        /* Sidebar and surface */
        sidebar: "#F3F4F6",
        surface: "#FAFAFA",
        /* Active nav item (light blue) */
        navActive: "#E0F2FE",
        navActiveIcon: "#0284C7",
        /* Card/input backgrounds */
        card: "#F0F0F0",
        inputBg: "#F3F4F6",
        /* Toggle active (green) */
        toggleOn: "#22C55E",
      },
      borderRadius: {
        card: "0.75rem",
        input: "0.5rem",
      },
    },
  },
  plugins: [],
};

export default config;
