import clsx from "clsx";
import { ScissorsGlyph } from "./Logo";

// Each tile shows a different crop of the black marble so placeholders never look repetitive.
const CROPS = ["12% 30%", "80% 18%", "45% 70%", "90% 85%", "20% 90%", "65% 40%", "5% 10%", "55% 5%"];

export function cropFor(key: string) {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return CROPS[h % CROPS.length];
}

/**
 * Elegant placeholder used until real photos are uploaded:
 * a marble crop, a thin gold frame and a serif monogram.
 */
export function MarbleTile({
  seed,
  monogram,
  caption,
  className,
  rounded = false,
}: {
  seed: string;
  monogram: string;
  caption?: string;
  className?: string;
  rounded?: boolean;
}) {
  return (
    <div
      className={clsx("relative isolate flex items-center justify-center overflow-hidden bg-ink-2", rounded ? "rounded-full" : "", className)}
      style={{ backgroundImage: "url(/images/marble.webp)", backgroundSize: "260%", backgroundPosition: cropFor(seed) }}
    >
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-ink/55 via-ink/70 to-ink/90" />
      {!rounded && <div className="pointer-events-none absolute inset-3 border border-gold/25" />}
      <div className="text-center">
        <span className="block font-serif text-5xl font-medium text-gold-metal sm:text-6xl">{monogram}</span>
        {caption && (
          <span className="mt-2 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.3em] text-ivory-muted">
            <ScissorsGlyph className="h-4 w-auto opacity-80" />
            {caption}
          </span>
        )}
      </div>
    </div>
  );
}
