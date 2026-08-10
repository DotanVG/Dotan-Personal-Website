import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./content/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        // Optical sizing: leading and tracking tighten as the type grows, so the
        // clamps are expressed in rem/vw rather than em (em would scale with the
        // font-size and hold the ratio constant).
        "display-xl": [
          "clamp(3rem, 11vw, 9rem)",
          {
            lineHeight: "clamp(2.85rem, 0.4rem + 8.95vw, 7.75rem)",
            letterSpacing: "clamp(-0.45rem, 0.09rem - 0.66vw, -0.065rem)",
          },
        ],
        "display-lg": [
          "clamp(2.25rem, 1.63rem + 2.65vw, 3.75rem)",
          {
            lineHeight: "1.05",
            letterSpacing: "clamp(-0.11rem, -0.012rem - 0.17vw, -0.032rem)",
          },
        ],
      },
      colors: {
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)",
          muted: "rgb(var(--ink-muted) / <alpha-value>)",
          subtle: "rgb(var(--ink-subtle) / <alpha-value>)",
        },
        canvas: {
          DEFAULT: "rgb(var(--canvas) / <alpha-value>)",
          raised: "rgb(var(--canvas-raised) / <alpha-value>)",
          inset: "rgb(var(--canvas-inset) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          glow: "rgb(var(--accent-glow) / <alpha-value>)",
        },
        line: "rgb(var(--line) / <alpha-value>)",
      },
      maxWidth: {
        prose: "65ch",
        page: "1200px",
      },
      animation: {
        "fade-in": "fadeIn 0.6s ease-out forwards",
        "slide-up": "slideUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        marquee: "marquee 40s linear infinite",
        "pulse-slow": "pulseSlow 4s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(24px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        pulseSlow: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.9" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
