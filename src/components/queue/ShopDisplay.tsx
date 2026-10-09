"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Clock, Maximize } from "lucide-react";
import type { PublicQueueDTO } from "@/lib/server/publicQueue";
import { useLiveQueue } from "@/components/site/useLiveQueue";
import { useI18n } from "@/lib/i18n/client";
import { Logo, Ornament } from "@/components/brand/Logo";
import { BarberStatusDot, WaitBadge, useAvailabilityLabel } from "./PublicQueue";
import { formatTime, SHOP_TZ } from "@/lib/domain/time";
import { FreeCountdown, ShavingChrono, ShavingFill } from "@/components/ui/ShavingTimer";

/** TV / tablet mode for the shop: large type, auto-refresh, no personal data. */
export function ShopDisplay({ initial }: { initial: PublicQueueDTO | null }) {
  const { t } = useI18n();
  const { data } = useLiveQueue(initial, 10_000);
  const availability = useAvailabilityLabel();
  const [clock, setClock] = useState(() => formatTime(new Date()));
  // Shop-time clock with seconds, next to « En cours » (empty until mounted to avoid a hydration mismatch).
  const [clockSec, setClockSec] = useState("");
  useEffect(() => {
    const secFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: SHOP_TZ, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
    const tick = () => {
      setClock(formatTime(new Date()));
      setClockSec(secFmt.format(new Date()));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (!data) return null;
  const serving = data.barbers.filter((b) => b.current?.status === "in_progress");
  const waiting = data.entries.filter((e) => e.status !== "called");
  const called = data.entries.filter((e) => e.status === "called");

  return (
    <div className="marble flex min-h-dvh flex-col p-6 lg:p-10">
      <header className="flex items-center justify-between">
        <Logo size="md" className="lg:text-4xl" />
        <div className="flex items-center gap-4">
          <span className="font-display text-3xl tabular-nums text-ivory lg:text-5xl">{clock}</span>
          <button onClick={() => document.documentElement.requestFullscreen?.()} className="btn-ghost btn-sm" aria-label="Plein écran">
            <Maximize className="h-5 w-5" />
          </button>
        </div>
      </header>
      <Ornament className="my-6" diamond={false} />

      <div className="grid flex-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="card flex flex-col p-6 lg:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="eyebrow text-sm">{t.queue.nowServing}</h2>
            {/* Live shop time with seconds */}
            <span className="inline-flex items-center gap-2 text-2xl font-semibold tabular-nums text-ok lg:text-3xl">
              <Clock className="h-[0.9em] w-[0.9em]" />
              {clockSec}
            </span>
          </div>
          <div className="mt-6 grid flex-1 gap-4 sm:grid-cols-2">
            {called.map((c) => (
              <div key={c.ticket} className="flex animate-pulseGold flex-col items-center justify-center rounded-md border border-gold bg-gold/10 p-6 text-center">
                <span className="font-display text-6xl tracking-wider text-gold-metal lg:text-8xl">{c.ticket}</span>
                <span className="mt-3 font-serif text-2xl text-ivory lg:text-3xl">{c.barberName ?? ""}</span>
                <span className="mt-1 text-sm uppercase tracking-[0.2em] text-ivory-muted">{t.status.called}</span>
              </div>
            ))}
            {serving.map((b) => (
              <div key={b.id} className="relative flex min-w-0 flex-col items-center justify-center overflow-hidden rounded-md border border-shave/60 p-4 text-center lg:p-6">
                <ShavingFill startedAt={b.current!.startedAt} durationMinutes={b.current!.durationMinutes} />
                <span className="relative max-w-full break-words font-display text-[clamp(2.25rem,4.5vw,5.5rem)] leading-none tracking-wider text-gold-metal">{b.name}</span>
                <span className="relative mt-2 text-sm uppercase tracking-[0.2em] text-ivory-muted">{b.current!.service}</span>
                {/* Countdown to when this barber is free (current client + any client booked right after) */}
                <span className="relative mt-5 text-xs uppercase tracking-[0.2em] text-gold-light">{t.queue.freeInLabel}</span>
                <FreeCountdown freeAt={b.nextFreeAt} doneLabel={t.queue.almostDone} className="relative mt-1 text-[clamp(1.5rem,2.8vw,3rem)]" />
              </div>
            ))}
            {called.length + serving.length === 0 && <p className="col-span-full self-center text-center font-serif text-3xl text-ivory-muted">{t.queue.empty}</p>}
          </div>
        </section>

        <section className="flex flex-col gap-6">
          <div className="card p-6 lg:p-8">
            <h2 className="eyebrow text-sm">{t.queue.next}</h2>
            <ul className="mt-4 divide-y divide-hair">
              {waiting.slice(0, 6).map((e) => (
                <li key={e.ticket} className="flex items-center justify-between py-3">
                  <span className="font-display text-3xl tracking-wider text-gold-light lg:text-4xl">{e.ticket}</span>
                  <span className="text-end">
                    <span className="block font-serif text-xl">{e.barberName ?? t.common.anyBarber}</span>
                    <WaitBadge minutes={e.waitMinutes} className="text-sm text-ivory-muted" />
                  </span>
                </li>
              ))}
              {/* Then the next booked clients, by time */}
              {(data.upcoming ?? []).slice(0, Math.max(0, 6 - waiting.length)).map((u) => (
                <li key={u.id} className="flex items-center justify-between py-3">
                  <span className="font-display text-3xl tabular-nums tracking-wider text-gold-light lg:text-4xl">{formatTime(u.startAt)}</span>
                  <span className="text-end">
                    <span className="block font-serif text-xl">{u.barberName ?? t.common.anyBarber}</span>
                    <span className="text-sm text-ivory-muted">{u.service}</span>
                  </span>
                </li>
              ))}
              {waiting.length === 0 && !data.upcoming?.length && <li className="py-6 text-center text-ivory-muted">—</li>}
            </ul>
          </div>
          <div className="card p-6 lg:p-8">
            <h2 className="eyebrow text-sm">{t.queue.estimated}</h2>
            <p className="mt-3 font-serif text-5xl text-gold-metal lg:text-6xl">
              <WaitBadge minutes={data.shopWaitMinutes} />
            </p>
            <ul className="mt-6 space-y-3">
              {data.barbers.map((b) => (
                <li key={b.id} className="flex items-center justify-between text-lg">
                  <span className="flex items-center gap-3 font-serif text-2xl">
                    <BarberStatusDot status={b.status} /> {b.name}
                  </span>
                  <span className="flex flex-col items-end">
                    {b.current?.status === "in_progress" && <ShavingChrono startedAt={b.current.startedAt} durationMinutes={b.current.durationMinutes} className="text-lg" />}
                    <span className="text-sm uppercase tracking-wider text-ivory-muted">{availability(b)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
      <p className="mt-6 text-center text-sm text-ivory-dim">{t.queue.walkInHint} · {t.queue.disclaimer}</p>
    </div>
  );
}
