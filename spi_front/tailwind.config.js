/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "brand-hr-primary": {
          DEFAULT: "#1E293B",
          soft: "#E2E8F0",
          muted: "#64748B",
          contrast: "#F8FAFC",
        },
        "hr-success": {
          DEFAULT: "#15803D",
          soft: "#DCFCE7",
          muted: "#166534",
        },
        "hr-warning": {
          DEFAULT: "#D97706",
          soft: "#FEF3C7",
          muted: "#92400E",
        },
        primary: {
          DEFAULT: "#1E293B",
          light: "#334155",
          dark: "#0F172A",
        },
        accent: {
          DEFAULT: "#0EA5E9",
          dark: "#0284C7",
        },
        success: "#16A34A",
        error: "#DC2626",
        warning: "#FACC15",
      },
      boxShadow: {
        soft: "0 2px 10px rgba(0,0,0,0.06)",
        hover: "0 4px 16px rgba(0,0,0,0.1)",
      },
    },
  },
  plugins: [],
};
