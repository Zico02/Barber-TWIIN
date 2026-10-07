import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#050505", 2: "#0C0C0C", 3: "#141414", 4: "#1C1C1C" },
        gold: { DEFAULT: "#C99A35", light: "#E4BC62", dark: "#80601F", pale: "#F0DCA8" },
        ivory: { DEFAULT: "#F5F1E8", muted: "#A7A29A", dim: "#6E6A63" },
        ok: { DEFAULT: "#6F9A78", bg: "rgba(111,154,120,0.12)" },
        bad: { DEFAULT: "#B4534B", bg: "rgba(180,83,75,0.12)" },
        warn: { DEFAULT: "#D08A3C", bg: "rgba(208,138,60,0.14)" },
      },
      borderColor: { line: "rgba(201,154,53,0.35)", hair: "rgba(201,154,53,0.18)" },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        display: ["var(--font-display)", "var(--font-serif)", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        arabic: ["var(--font-arabic)", "var(--font-sans)", "sans-serif"],
      },
      borderRadius: { DEFAULT: "4px", md: "6px", lg: "8px" },
      boxShadow: {
        gold: "0 0 0 1px rgba(201,154,53,0.35), 0 10px 40px -12px rgba(201,154,53,0.25)",
        card: "0 20px 50px -20px rgba(0,0,0,0.8)",
      },
      keyframes: {
        rise: { from: { opacity: "0", transform: "translateY(14px)" }, to: { opacity: "1", transform: "none" } },
        sheen: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        pulseGold: { "0%,100%": { opacity: "1" }, "50%": { opacity: ".45" } },
        bounceSoftL: { "0%,100%": { transform: "translateY(0) rotate(-6deg)" }, "50%": { transform: "translateY(-18px) rotate(-2deg)" } },
        bounceSoftR: { "0%,100%": { transform: "translateY(-14px) rotate(8deg)" }, "50%": { transform: "translateY(6px) rotate(3deg)" } },
      },
      animation: {
        rise: "rise .7s cubic-bezier(.2,.7,.2,1) both",
        sheen: "sheen 6s linear infinite",
        pulseGold: "pulseGold 2.4s ease-in-out infinite",
        bounceSoftL: "bounceSoftL 4.2s ease-in-out infinite",
        bounceSoftR: "bounceSoftR 4.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
