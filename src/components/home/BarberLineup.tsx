"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import clsx from "clsx";
import type { Barber } from "@/lib/domain/types";
import { BarberCard, Spotlight } from "@/components/site/cards";
import { useI18n } from "@/lib/i18n/client";

/**
 * "Starting lineup" reveal, like a football TV line-up:
 *   1. the centre barber fades in as a ghost, becomes solid, name plate slides in, then crosses his arms;
 *   2. the two others appear on his sides at the same time and do the same;
 *   3. the lineup fades out and turns into the regular barber cards.
 * The arm cross uses `introPhotoUrl` (arms relaxed) → `photoUrl` (arms crossed) when available;
 * otherwise a short "settle into pose" motion is used.
 */
type Phase = 0 | 1 | 2 | 3; // 0 hidden · 1 ghost · 2 solid + plate · 3 arms crossed

const TIMELINE = {
  centre: { ghost: 200, solid: 750, cross: 1500 },
  sides: { ghost: 2100, solid: 2650, cross: 3400 },
  out: 4900, // hold the full lineup, then fade it out…
  cards: 5400, // …and reveal the barber cards
};

export function BarberLineup({ barbers, centreSlug, leftSlug, rightSlug }: { barbers: Barber[]; centreSlug: string; leftSlug: string; rightSlug: string }) {
  const { t } = useI18n();
  const stage = useRef<HTMLDivElement>(null);
  const [centre, setCentre] = useState<Phase>(0);
  const [sides, setSides] = useState<Phase>(0);

  const by = (slug: string) => barbers.find((b) => b.slug === slug);
  const left = by(leftSlug);
  const mid = by(centreSlug);
  const right = by(rightSlug);

  // After the lineup: 'out' fades the stage away, 'cards' shows the barber cards.
  const [stageState, setStageState] = useState<"lineup" | "out" | "cards">("lineup");

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStageState("cards");
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    const play = () => {
      const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
      at(TIMELINE.centre.ghost, () => setCentre(1));
      at(TIMELINE.centre.solid, () => setCentre(2));
      at(TIMELINE.centre.cross, () => setCentre(3));
      at(TIMELINE.sides.ghost, () => setSides(1));
      at(TIMELINE.sides.solid, () => setSides(2));
      at(TIMELINE.sides.cross, () => setSides(3));
      at(TIMELINE.out, () => setStageState("out"));
      at(TIMELINE.cards, () => setStageState("cards"));
    };
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          play();
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach(clearTimeout);
    };
  }, []);

  if (!left || !mid || !right) return null;

  if (stageState === "cards") {
    // Cards in reading order (Reda, Nasro, Ziko), rising one after another.
    return (
      <div className="grid gap-6 md:grid-cols-3">
        {[left, mid, right].map((b, i) => (
          <div key={b.id} className="animate-rise" style={{ animationDelay: `${i * 140}ms` }}>
            <BarberCard barber={b} t={t} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div ref={stage} className={clsx("relative transition-all duration-500", stageState === "out" && "scale-[0.97] opacity-0")}>
      {/* Stage: gold "pitch" lines + spotlight */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[18%] h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
      <div className="pointer-events-none absolute left-1/2 top-[8%] h-[70%] w-[min(520px,70%)] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(201,154,53,0.18),transparent_65%)]" />

      <div className="relative mx-auto flex h-[340px] max-w-5xl items-end justify-center sm:h-[460px] lg:h-[560px]">
        <Player barber={left} phase={sides} side="left" />
        <Player barber={mid} phase={centre} side="centre" />
        <Player barber={right} phase={sides} side="right" />
      </div>
    </div>
  );
}

function Player({ barber, phase, side }: { barber: Barber; phase: Phase; side: "left" | "centre" | "right" }) {
  const centre = side === "centre";
  // Ghost entrance comes from the outside edge, like the TV line-up.
  const from = side === "left" ? "-translate-x-6" : side === "right" ? "translate-x-6" : "-translate-x-4";
  const crossed = phase >= 3;
  const hasIntro = !!barber.introPhotoUrl;

  return (
    <Link
      href={`/barbiers/${barber.slug}`}
      aria-label={barber.name}
      className={clsx(
        "group relative flex h-full flex-col items-center justify-end",
        centre ? "z-20 w-[40%] sm:w-[36%]" : "z-10 w-[34%] sm:w-[31%]",
        side === "left" && "-me-[6%]",
        side === "right" && "-ms-[6%]",
      )}
    >
      {/* Soft stage glow behind the barber on hover */}
      {phase >= 2 && <Spotlight />}
      <div
        className={clsx(
          "relative w-full transition-all ease-out",
          // Ziko's photo is framed tighter, so he gets a slightly taller box to match Reda's height.
          centre ? "h-[92%]" : barber.slug === "ziko" ? "h-[86%]" : "h-[80%]",
          phase === 0 && `opacity-0 ${from} blur-sm duration-0`,
          phase === 1 && "translate-x-0 opacity-40 blur-[2px] brightness-150 duration-500",
          phase >= 2 && "translate-x-0 opacity-100 blur-0 brightness-100 duration-500",
          // Without an "arms relaxed" photo, the arm cross becomes a short settle into pose.
          phase === 2 && !hasIntro && "scale-[1.04]",
          crossed && "scale-100 duration-700",
        )}
      >
        {/* Ghost trail during the entrance */}
        {phase === 1 && (
          <Image src={barber.lineupPhotoUrl ?? barber.photoUrl!} alt="" aria-hidden width={800} height={1100} sizes="35vw" className={clsx("absolute bottom-0 left-1/2 h-full w-auto max-w-none -translate-x-1/2 opacity-30", side === "right" ? "ms-4" : "-ms-4")} />
        )}
        {hasIntro && (
          <Image
            src={barber.introPhotoUrl!}
            alt=""
            aria-hidden
            width={800}
            height={1100}
            sizes="(min-width: 1024px) 35vw, 40vw"
            className={clsx("absolute bottom-0 left-1/2 h-full w-auto max-w-none -translate-x-1/2 transition-opacity duration-300", crossed ? "opacity-0" : "opacity-100")}
          />
        )}
        <Image
          src={barber.lineupPhotoUrl ?? barber.photoUrl!}
          alt={barber.name}
          width={800}
          height={1100}
          sizes="(min-width: 1024px) 35vw, 40vw"
          className={clsx(
            "absolute bottom-0 left-1/2 h-full w-auto max-w-none -translate-x-1/2 drop-shadow-[0_20px_30px_rgba(0,0,0,0.6)] transition duration-300 group-hover:brightness-110",
            hasIntro && !crossed ? "opacity-0" : "opacity-100",
          )}
        />
      </div>

      {/* Gold name plate */}
      <span
        className={clsx(
          "absolute bottom-[4%] z-30 rounded-sm border border-gold-light/60 bg-gradient-to-b from-gold-light via-gold to-gold-dark px-4 py-1.5 font-display font-semibold uppercase tracking-[0.2em] text-ink shadow-[0_8px_24px_-6px_rgba(201,154,53,0.6)] transition-all duration-500 sm:px-7 sm:py-2",
          centre ? "text-sm sm:text-xl" : "text-xs sm:text-lg",
          phase >= 2 ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
        )}
      >
        {barber.name}
      </span>
    </Link>
  );
}
