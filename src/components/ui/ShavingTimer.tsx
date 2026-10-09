"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Hourglass } from "lucide-react";

/** Seconds elapsed since `startedAt`, ticking every second (null until mounted, avoids hydration mismatch). */
export function useElapsed(startedAt: string | null | undefined) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!startedAt) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  if (!startedAt || now === null) return null;
  return Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
}

export function formatChrono(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Hourglass that keeps flipping upside down while a client is in the chair. */
export function FlippingHourglass({ className }: { className?: string }) {
  return <Hourglass aria-hidden className={clsx("animate-hourglass", className)} />;
}

/** Stopwatch « 12:34 » with the flipping hourglass; turns orange once the booked time is exceeded. */
export function ShavingChrono({ startedAt, durationMinutes, className }: { startedAt: string | null | undefined; durationMinutes: number; className?: string }) {
  const elapsed = useElapsed(startedAt);
  const over = elapsed !== null && elapsed > durationMinutes * 60;
  return (
    <span className={clsx("inline-flex items-center gap-1.5 font-semibold tabular-nums", over ? "text-warn" : "text-shave-light", className)}>
      <FlippingHourglass className="h-[1em] w-[1em]" />
      {elapsed === null ? "--:--" : formatChrono(elapsed)}
    </span>
  );
}

/** Blue fill growing from 0 to 100 % over the booked duration. Place inside a `relative overflow-hidden` box. */
export function ShavingFill({ startedAt, durationMinutes, className }: { startedAt: string | null | undefined; durationMinutes: number; className?: string }) {
  const elapsed = useElapsed(startedAt);
  const pct = elapsed === null ? 0 : Math.min(100, (elapsed / Math.max(60, durationMinutes * 60)) * 100);
  return (
    <div
      aria-hidden
      className={clsx("pointer-events-none absolute inset-y-0 start-0 bg-gradient-to-r from-shave/10 to-shave/30 transition-[width] duration-1000 ease-linear", className)}
      style={{ width: `${pct}%` }}
    />
  );
}

/** Seconds left until `targetIso`, ticking every second (null until mounted). */
export function useCountdown(targetIso: string | null | undefined) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!targetIso) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetIso]);
  if (!targetIso || now === null) return null;
  return Math.max(0, Math.ceil((new Date(targetIso).getTime() - now) / 1000));
}

/** Countdown in minutes:seconds (« 78:59 », never hours) to when the barber is free, with the flipping hourglass; `doneLabel` once it reaches zero. */
export function FreeCountdown({ freeAt, doneLabel, className }: { freeAt: string | null | undefined; doneLabel: string; className?: string }) {
  const left = useCountdown(freeAt);
  if (left === 0) return <span className={clsx("text-gold-light", className)}>{doneLabel}</span>;
  return (
    <span className={clsx("inline-flex items-center gap-2 font-semibold tabular-nums text-shave-light", className)}>
      <FlippingHourglass className="h-[0.8em] w-[0.8em]" />
      {left === null ? "--:--" : `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`}
    </span>
  );
}

/** Hair-clipper (tondeuse) icon, same stroke style as lucide icons. */
export function ClipperIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M7 3h10" />
      <path d="M9 3v2.5M12 3v2.5M15 3v2.5" />
      <path d="M6.5 6h11l-1.6 13.2a2 2 0 0 1-2 1.8h-3.8a2 2 0 0 1-2-1.8z" />
      <path d="M12 10v3" />
    </svg>
  );
}
