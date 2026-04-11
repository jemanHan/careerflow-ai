import type { Config } from "tailwindcss";

/** Stitch / career_precision DESIGN.md — tonal tokens */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        outline: "#737686",
        "on-error": "#ffffff",
        "secondary-fixed-dim": "#7bd1fa",
        "tertiary-fixed-dim": "#bcc7de",
        "primary-container": "#2563eb",
        "on-surface-variant": "#434655",
        "on-tertiary-fixed": "#111c2d",
        "on-background": "#111c2d",
        surface: "#f9f9ff",
        background: "#f9f9ff",
        "on-tertiary-container": "#ecf1ff",
        "primary-fixed-dim": "#b4c5ff",
        "secondary-container": "#7ed4fd",
        "surface-dim": "#cfdaf2",
        secondary: "#006686",
        "on-secondary-fixed": "#001e2b",
        "surface-container-high": "#dee8ff",
        "surface-container-highest": "#d8e3fb",
        "tertiary-container": "#636e83",
        "surface-container": "#e7eeff",
        "surface-variant": "#d8e3fb",
        "on-primary-container": "#eeefff",
        "on-primary": "#ffffff",
        "surface-container-low": "#f0f3ff",
        "secondary-fixed": "#c0e8ff",
        "primary-fixed": "#dbe1ff",
        "on-secondary-fixed-variant": "#004d66",
        "on-primary-fixed-variant": "#003ea8",
        "on-primary-fixed": "#00174b",
        "surface-bright": "#f9f9ff",
        "inverse-primary": "#b4c5ff",
        "on-tertiary": "#ffffff",
        "on-surface": "#111c2d",
        "on-error-container": "#93000a",
        tertiary: "#4b566a",
        "on-secondary": "#ffffff",
        "inverse-on-surface": "#ecf1ff",
        "tertiary-fixed": "#d8e3fb",
        "error-container": "#ffdad6",
        error: "#ba1a1a",
        "on-secondary-container": "#005b78",
        "inverse-surface": "#263143",
        "on-tertiary-fixed-variant": "#3c475a",
        "surface-tint": "#0053db",
        "outline-variant": "#c3c6d7",
        "surface-container-lowest": "#ffffff",
        primary: "#004ac6"
      },
      borderRadius: {
        lg: "0.25rem",
        xl: "0.5rem",
        "2xl-editorial": "0.75rem"
      },
      fontFamily: {
        headline: ["var(--font-manrope)", "Manrope", "system-ui", "sans-serif"],
        body: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"]
      },
      boxShadow: {
        ambient: "0 12px 32px -4px rgba(17, 28, 45, 0.08)",
        "ambient-soft": "0 12px 32px -4px rgba(17, 28, 45, 0.04)"
      }
    }
  },
  plugins: []
};

export default config;
