"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Maximize } from "lucide-react";
import type { PublicQueueDTO } from "@/lib/server/publicQueue";
import { useLiveQueue } from "@/components/site/useLiveQueue";
import { useI18n } from "@/lib/i18n/client";
import { Logo, Ornament } from "@/components/brand/Logo";
import { BarberStatusDot, WaitBadge } from "./PublicQueue";
import { formatTime } from "@/lib/domain/time";
import { ShavingChrono, ShavingFill } from "@/components/ui/ShavingTimer";

/** TV / tablet mode for the shop: large type, auto-refresh, no personal data. */
export function ShopDisplay({ initial }: { initial: PublicQueueDTO | null }) {
  const { t } = useI18n();
  const { data } = useLiveQueue(initial, 10_000);
  const [clock, setClock] = useState(() => formatTime(new Date()));
  useEffect(() => {
    const id = setInterval(() => setClock(formatTime(new Date())), 10_000);
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
          <h2 className="eyebrow text-sm">{t.queue.nowServing}</h2>
          <div className="mt-6 grid flex-1 gap-4 sm:grid-cols-2">
            {called.map((c) => (
              <div key={c.ticket} className="flex animate-pulseGold flex-col items-center justify-center rounded-md border border-gold bg-gold/10 p-6 text-center">
                <span className="font-display text-6xl tracking-wider text-gold-metal lg:text-8xl">{c.ticket}</span>
                <span className="mt-3 font-serif text-2xl text-ivory lg:text-3xl">{c.barberName ?? ""}</span>
                <span className="mt-1 text-sm uppercase tracking-[0.2em] text-ivory-muted">{t.status.called}</span>
              </div>
            ))}
            {serving.map((b) => (
              <div key={b.id} className="relative flex flex-col items-center justify-center overflow-hidden rounded-md border border-shave/60 p-6 text-center">
                <ShavingFill startedAt={b.current!.startedAt} durationMinutes={b.current!.durationMinutes} />
                <span className="relative font-display text-6xl tracking-wider text-gold-metal lg:text-8xl">{b.current!.ticket ?? "RDV"}</span>
                <span className="relative mt-3 font-serif text-2xl text-ivory lg:text-3xl">{b.name}</span>
                <span className="relative mt-1 text-sm uppercase tracking-[0.2em] text-ivory-muted">{b.current!.service}</span>
                <ShavingChrono startedAt={b.current!.startedAt} durationMinutes={b.current!.durationMinutes} className="relative mt-4 text-3xl lg:text-4xl" />
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
              {waiting.length === 0 && <li className="py-6 text-center text-ivory-muted">—</li>}
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
                  {b.current?.status === "in_progress" ? (
                    <ShavingChrono startedAt={b.current.startedAt} durationMinutes={b.current.durationMinutes} className="text-lg" />
                  ) : (
                    <span className="text-sm uppercase tracking-wider text-ivory-muted">{t.queue[b.status]}</span>
                  )}
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
