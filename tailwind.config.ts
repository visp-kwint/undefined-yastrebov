import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        dm: {
          bg: "#1a1a1a",
          sidebar: "#2d2d2d",
          card: "#2d2d2d",
          surface: "#3a3a3a",
          surfaceHover: "#4a4a4a",
          border: "#3a3a3a",
          text: "#e0e0e0",
          textSecondary: "#b0b0b0",
          textMuted: "#888888",
          accent: "#3d3d5c",
          accentHover: "#4a4a6c",
          btn: "#e0e0e0",
          btnHover: "#c0c0c0",
          danger: "#ff4444",
          success: "#4ade80",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system","BlinkMacSystemFont","Segoe UI","Roboto",
          "Oxygen","Ubuntu","Cantarell","sans-serif"
        ],
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
