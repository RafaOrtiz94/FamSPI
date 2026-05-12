/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Geist'", "system-ui", "-apple-system", "sans-serif"],
        mono: ["'Geist Mono'", "ui-monospace", "monospace"],
      },
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
        /* DESIGN.md Naval Slate palette */
        "naval-slate": "#1E293B",
        "storm-slate": "#334155",
        "midnight-slate": "#0F172A",
        "action-blue": "#2563EB",
        "sky-signal": "#0EA5E9",
        "ink-slate": "#1F2937",
        "warm-ash": "#6B7280",
        "soft-border": "#E5E7EB",
        "operative-green": "#16A34A",
        "alert-red": "#DC2626",
        "caution-amber": "#D97706",
      },
      boxShadow: {
        soft:       "0 2px 10px rgba(0,0,0,0.06)",
        hover:      "0 4px 16px rgba(0,0,0,0.1)",
        ambient:    "0 2px 10px rgba(0,0,0,0.06)",
        lifted:     "0 4px 16px rgba(0,0,0,0.10)",
        structural: "0 15px 35px rgba(15,23,42,0.08)",
        overlay:    "0 20px 60px rgba(15,23,42,0.18), 0 4px 16px rgba(15,23,42,0.10)",
      },
    },
  },
  plugins: [],
};
