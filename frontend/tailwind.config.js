/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0F4C81",
          dark: "#0B3A63",
          light: "#3D72A4",
        },
        accent: {
          DEFAULT: "#00B8D9",
          dark: "#0093AD",
          light: "#4DD8EF",
        },
        surface: {
          light: "#F5F7FA",
          card: "#FFFFFF",
          dark: "#0F172A",
          "dark-card": "#1E293B",
        },
        ink: {
          DEFAULT: "#172033",
          muted: "#64748B",
          inverted: "#E7ECF3",
          "inverted-muted": "#94A3B8",
        },
        border: {
          DEFAULT: "#E4E9F0",
          dark: "#2C3B52",
        },
      },
      fontFamily: {
        display: ["Plus Jakarta Sans", "Inter", "sans-serif"],
        sans: ["Inter", "sans-serif"],
      },
      borderRadius: {
        xl2: "1.25rem",
        xl3: "1.75rem",
      },
      boxShadow: {
        soft: "0 2px 14px rgba(15, 32, 51, 0.06)",
        "soft-hover": "0 8px 28px rgba(15, 32, 51, 0.10)",
        "soft-dark": "0 2px 16px rgba(0, 0, 0, 0.35)",
        "soft-dark-hover": "0 10px 30px rgba(0, 0, 0, 0.5)",
        glow: "0 0 0 3px rgba(0, 184, 217, 0.18)",
      },
      keyframes: {
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.8" },
          "70%": { transform: "scale(1.4)", opacity: "0" },
          "100%": { transform: "scale(1.4)", opacity: "0" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 1.4s cubic-bezier(0.2,0.6,0.4,1) infinite",
        shimmer: "shimmer 1.8s linear infinite",
      },
    },
  },
  plugins: [],
};
