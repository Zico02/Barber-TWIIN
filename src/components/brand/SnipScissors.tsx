import clsx from "clsx";

/**
 * Flat gold scissors drawn in two halves (blade + handle each) so they can really snip
 * around the pivot. Used in the hero: snips a few times on load, then the parent bounces.
 */
export function SnipScissors({ className }: { className?: string }) {
  // One half: long blade pointing up-left, shank + ring handle down-right. The other half is its mirror.
  const half = (
    <>
      <path d="M103 178 L52 14 C50 7 57 4 61 10 L117 172 Z" />
      <path d="M104 182 L134 236" fill="none" strokeWidth="13" strokeLinecap="round" />
      <ellipse cx="148" cy="272" rx="27" ry="36" transform="rotate(-24 148 272)" fill="none" strokeWidth="11" />
    </>
  );
  return (
    <svg viewBox="0 0 200 320" className={clsx("overflow-visible", className)} aria-hidden>
      <defs>
        <linearGradient id="snip-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F2C14E" />
          <stop offset="0.55" stopColor="#E0A93A" />
          <stop offset="1" stopColor="#C88F24" />
        </linearGradient>
      </defs>
      <g fill="url(#snip-gold)" stroke="url(#snip-gold)">
        <g className="animate-snipA [transform-box:view-box] [transform-origin:100px_180px]">{half}</g>
        <g className="animate-snipB [transform-box:view-box] [transform-origin:100px_180px]">
          <g transform="translate(200 0) scale(-1 1)">{half}</g>
        </g>
      </g>
      {/* Pivot screw */}
      <circle cx="100" cy="180" r="9" fill="#E0A93A" />
      <circle cx="100" cy="180" r="4" fill="#050505" />
    </svg>
  );
}
