import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Core surfaces
        void: "hsl(var(--void))",
        surface: "hsl(var(--surface))",
        "surface-raised": "hsl(var(--surface-raised))",
        paper: "hsl(var(--paper))",

        // Text
        ink: "hsl(var(--ink))",
        mist: "hsl(var(--mist))",

        // Accents — Prophezy's two-color signature
        signal: {
          DEFAULT: "hsl(var(--signal))",
          soft: "hsl(var(--signal-soft))",
        },
        pulse: {
          DEFAULT: "hsl(var(--pulse))",
          soft: "hsl(var(--pulse-soft))",
        },

        // Semantic
        success: "hsl(var(--success))",
        danger: "hsl(var(--danger))",
        border: "hsl(var(--border))",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
      },
      backgroundImage: {
        "signal-glow":
          "radial-gradient(circle at 30% 20%, hsl(var(--signal) / 0.35), transparent 60%)",
        "pulse-glow":
          "radial-gradient(circle at 70% 80%, hsl(var(--pulse) / 0.25), transparent 55%)",
        "grain": "url('/noise.png')",
      },
      boxShadow: {
        glass: "0 8px 32px -8px hsl(var(--void) / 0.5)",
        "glass-sm": "0 4px 16px -4px hsl(var(--void) / 0.4)",
      },
      keyframes: {
        "ring-draw": {
          from: { strokeDashoffset: "var(--ring-circumference)" },
          to: { strokeDashoffset: "var(--ring-offset)" },
        },
        "float-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "ring-draw": "ring-draw 1.1s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "float-in": "float-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      },
    },
  },
  plugins: [],
};

export default config;
