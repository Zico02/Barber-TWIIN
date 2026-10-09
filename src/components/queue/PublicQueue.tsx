"use client";
import Link from "next/link";
import clsx from "clsx";
import { Clock, MonitorPlay, Users, WifiOff } from "lucide-react";
import type { PublicQueueDTO } from "@/lib/server/publicQueue";
import { useLiveQueue } from "@/components/site/useLiveQueue";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n";
import { formatTime } from "@/lib/domain/time";
import { EmptyState, StatusBadge } from "@/components/ui";
import { ShavingChrono } from "@/components/ui/ShavingTimer";

export function BarberStatusDot({ status }: { status: PublicQueueDTO["barbers"][number]["status"] }) {
  return (
    <span
      className={clsx(
        "inline-block h-2 w-2 rounded-full",
        status === "free" && "bg-ok shadow-[0_0_10px] shadow-ok/60",
        status === "busy" && "animate-pulseGold bg-gold",
        status === "break" && "bg-ivory-dim",
        status === "off" && "bg-bad/60",
      )}
    />
  );
}

export function WaitBadge({ minutes, className }: { minutes: number | null; className?: string }) {
  const { t } = useI18n();
  return (
    <span className={clsx("tabular-nums", className)}>
      {minutes === null ? "—" : minutes === 0 ? t.queue.noWait : fmt(t.common.approxMin, { n: minutes })}
    </span>
  );
}

/** Compact preview used on the homepage. */
export function LiveWaitPreview({ initial }: { initial: PublicQueueDTO | null }) {
  const { t } = useI18n();
  const { data } = useLiveQueue(initial, 30_000);
  return (
    <div className="card p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-ivory-muted">
            <span className="h-2 w-2 animate-pulseGold rounded-full bg-gold" /> {t.queue.shopWait}
          </p>
          <p className="mt-3 font-serif text-5xl text-gold-metal sm:text-6xl">
            <WaitBadge minutes={data?.shopWaitMinutes ?? null} />
          </p>
          <p className="mt-2 text-xs text-ivory-dim">{t.queue.disclaimer}</p>
        </div>
        <Link href="/file-attente" className="btn-outline">
          {t.home.liveCta}
        </Link>
      </div>
      <ul className="mt-8 grid gap-3 sm:grid-cols-3">
        {data?.barbers.map((b) => (
          <li key={b.id} className="flex items-center justify-between rounded border border-hair bg-ink/40 px-4 py-3">
            <span className="flex items-center gap-2.5 font-serif text-lg">
              <BarberStatusDot status={b.status} />
              {b.name}
            </span>
            <span className="text-xs text-ivory-muted">
              {b.status === "off" ? t.queue.off : b.status === "break" ? t.queue.break : b.nextFreeMinutes === 0 ? t.queue.free : b.nextFreeMinutes !== null ? fmt(t.queue.freeIn, { n: b.nextFreeMinutes }) : t.queue.busy}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Full public waiting list (/file-attente). */
export function PublicQueue({ initial }: { initial: PublicQueueDTO | null }) {
  const { t } = useI18n();
  const { data, error } = useLiveQueue(initial);
  if (!data) return null;
  const serving = data.barbers.filter((b) => b.current);
  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
        <div className="card flex flex-col justify-between p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-ivory-muted">{t.queue.shopWait}</p>
          <p className="mt-4 font-serif text-5xl text-gold-metal">
            <WaitBadge minutes={data.shopWaitMinutes} />
          </p>
          <p className="mt-4 flex items-center gap-2 text-xs text-ivory-dim">
            {error ? <WifiOff className="h-3.5 w-3.5 text-bad" /> : <span className="h-1.5 w-1.5 animate-pulseGold rounded-full bg-gold" />}
            {fmt(t.queue.updated, { time: formatTime(data.generatedAt) })} · {t.queue.disclaimer}
          </p>
        </div>
        <div className="card p-6">
          <p className="mb-4 text-xs uppercase tracking-[0.2em] text-ivory-muted">{t.queue.barberAvailability}</p>
          <ul className="grid gap-3 sm:grid-cols-3">
            {data.barbers.map((b) => (
              <li key={b.id} className="rounded border border-hair bg-ink/40 p-4">
                <p className="flex items-center gap-2 font-serif text-xl">
                  <BarberStatusDot status={b.status} /> {b.name}
                </p>
                <p className="mt-1 text-xs text-ivory-muted">
                  {t.queue[b.status]}
                  {b.delayMinutes > 0 && b.status !== "off" ? ` · +${b.delayMinutes} min` : ""}
                </p>
                {b.current && (
                  <p className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gold-light">
                    <span>
                      {t.queue.nowServing} : {b.current.ticket ?? "RDV"}
                    </span>
                    {b.current.status === "in_progress" && <ShavingChrono startedAt={b.current.startedAt} durationMinutes={b.current.durationMinutes} className="text-sm" />}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-hair px-6 py-4">
          <h2 className="flex items-center gap-2 font-serif text-2xl">
            <Users className="h-5 w-5 text-gold" /> {t.queue.title}
          </h2>
          <Link href="/affichage" className="btn-ghost btn-sm" target="_blank">
            <MonitorPlay className="h-4 w-4" /> {t.queue.display}
          </Link>
        </div>
        {data.entries.length === 0 && serving.length === 0 ? (
          <div className="p-6">
            <EmptyState title={t.queue.empty} text={t.queue.walkInHint} icon={<Clock className="h-8 w-8" />} />
          </div>
        ) : (
          <ul className="divide-y divide-hair/70">
            {data.entries.map((e, i) => (
              <li key={e.ticket} className={clsx("flex flex-wrap items-center gap-x-6 gap-y-2 px-6 py-4", e.isNext && "bg-gold/[0.04]")}>
                <span className="w-8 text-center font-serif text-xl text-ivory-dim">{i + 1}</span>
                <span className="min-w-[4.5rem] rounded-sm border border-line px-2.5 py-1 text-center font-display text-lg tracking-wider text-gold-light">{e.ticket}</span>
                <span className="flex-1 text-sm">
                  <span className="text-ivory">{e.service}</span>
                  <span className="block text-xs text-ivory-dim">
                    {e.initials} · {e.barberName ?? t.common.anyBarber}
                  </span>
                </span>
                {e.status === "called" ? (
                  <StatusBadge status="called" label={t.status.called} />
                ) : e.isNext ? (
                  <span className="text-xs font-semibold uppercase tracking-wider text-gold">{t.queue.next}</span>
                ) : null}
                <span className="min-w-[8rem] text-end text-sm text-ivory-muted">
                  <WaitBadge minutes={e.waitMinutes} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-center text-xs text-ivory-dim">{t.queue.walkInHint}</p>
    </div>
  );
}
