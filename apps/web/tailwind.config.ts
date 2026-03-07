import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Legacy vars
        background: "var(--bg-primary)",
        foreground: "var(--text-primary)",
        // Antique design tokens
        antique: {
          bg:          "var(--bg-primary)",
          surface:     "var(--bg-surface)",
          muted:       "var(--bg-muted)",
          subtle:      "var(--bg-subtle)",
          text:        "var(--text-primary)",
          "text-sec":  "var(--text-secondary)",
          "text-mute": "var(--text-muted)",
          accent:      "var(--accent)",
          "accent-h":  "var(--accent-hover)",
          "accent-lt": "var(--accent-light)",
          "accent-s":  "var(--accent-surface)",
          border:      "var(--border)",
          "border-s":  "var(--border-strong)",
        },
      },
      fontFamily: {
        display: ["var(--font-playfair)", "Playfair Display", "Georgia", "serif"],
        body:    ["var(--font-inter)", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Arial", "sans-serif"],
      },
      borderRadius: {
        card: "0.75rem",
      },
    },
  },
  plugins: [],
};

export default config;
