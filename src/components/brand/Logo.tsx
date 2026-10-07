import clsx from "clsx";

/** Gold scissors that stand in for the "II" of TWIIN (two blades = two I's). */
export function ScissorsGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 100" className={className} aria-hidden fill="none">
      {/* blades */}
      <path d="M12 4 L22.5 62 L19.5 63 Z" fill="#D4A64A" />
      <path d="M33 2 L17.5 62 L20.5 63 Z" fill="#D4A64A" />
      <circle cx="20" cy="61" r="1.6" fill="#050505" stroke="#D4A64A" strokeWidth="1" />
      {/* handles */}
      <path d="M18.5 63 L13 76" stroke="#D4A64A" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M21.5 63 L27 76" stroke="#D4A64A" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="10.5" cy="84" r="8" stroke="#D4A64A" strokeWidth="2.6" />
      <circle cx="29.5" cy="84" r="8" stroke="#D4A64A" strokeWidth="2.6" />
    </svg>
  );
}

/** Typographic wordmark: "Barber TW✂N" — read as Barber TWIIN. */
export function Logo({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const text = size === "lg" ? "text-5xl sm:text-7xl" : size === "sm" ? "text-xl" : "text-2xl";
  const glyph = size === "lg" ? "h-[1.25em] -mb-[0.22em]" : "h-[1.3em] -mb-[0.24em]";
  return (
    <span className={clsx("inline-flex items-baseline whitespace-nowrap font-serif leading-none", text, className)} aria-label="Barber TWIIN">
      <span aria-hidden className="text-gold-metal font-semibold">Barber</span>
      <span aria-hidden className="ms-[0.28em] font-display font-semibold tracking-[0.04em] text-gold-metal">
        TW
      </span>
      <ScissorsGlyph className={clsx("mx-[0.02em] inline-block w-auto", glyph)} />
      <span aria-hidden className="font-display font-semibold tracking-[0.04em] text-gold-metal">N</span>
    </span>
  );
}

export function Crown({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 36" className={className} aria-hidden fill="none">
      <path d="M6 30 L4 10 L18 20 L32 4 L46 20 L60 10 L58 30 Z" stroke="#C99A35" strokeWidth="2" strokeLinejoin="round" fill="rgba(201,154,53,.12)" />
      <circle cx="4" cy="9" r="2.5" fill="#C99A35" />
      <circle cx="32" cy="4" r="2.5" fill="#E4BC62" />
      <circle cx="60" cy="9" r="2.5" fill="#C99A35" />
      <path d="M8 34 H56" stroke="#C99A35" strokeWidth="2" />
    </svg>
  );
}

/** Thin ornamental divider inspired by the logo's flourishes. */
export function Ornament({ className, diamond = true }: { className?: string; diamond?: boolean }) {
  return (
    <div className={clsx("flex items-center justify-center gap-3", className)} aria-hidden>
      <span className="h-px w-16 bg-gradient-to-r from-transparent to-gold/70 sm:w-24" />
      {diamond ? <span className="h-2 w-2 rotate-45 border border-gold" /> : <Crown className="h-4 w-7" />}
      <span className="h-px w-16 bg-gradient-to-l from-transparent to-gold/70 sm:w-24" />
    </div>
  );
}
