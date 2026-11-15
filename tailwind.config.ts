import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        soc: {
          bg: "#05080f",
          panel: "#0a101d",
          border: "rgba(16, 185, 129, 0.2)",
          neonGreen: "#10b981",
          neonCyan: "#06b6d4",
          danger: "#ef4444",
          warning: "#f59e0b",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "JetBrains Mono", "monospace"],
      },
      boxShadow: {
        "neon-green": "0 0 20px rgba(16, 185, 129, 0.28), inset 0 0 12px rgba(16, 185, 129, 0.08)",
        "neon-cyan": "0 0 20px rgba(6, 182, 212, 0.28), inset 0 0 12px rgba(6, 182, 212, 0.08)",
        "neon-red": "0 0 25px rgba(239, 68, 68, 0.35), inset 0 0 14px rgba(239, 68, 68, 0.12)",
        "neon-amber": "0 0 22px rgba(245, 158, 11, 0.32), inset 0 0 12px rgba(245, 158, 11, 0.1)",
      },
      backgroundImage: {
        "cyber-grid":
          "linear-gradient(to right, rgba(16, 185, 129, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(6, 182, 212, 0.05) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};

export default config;
