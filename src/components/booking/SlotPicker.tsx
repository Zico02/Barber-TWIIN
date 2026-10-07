"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { CalendarX2, ChevronLeft, ChevronRight } from "lucide-react";
import { getSlotsAction } from "@/actions/booking";
import { useI18n } from "@/lib/i18n/client";
import { addDays, formatTime, weekdayOf, zonedParts } from "@/lib/domain/time";
import { EmptyState, Skeleton } from "@/components/ui";

export interface PickedSlot {
  start: string;
  end: string;
  barberId: string;
}

export function DateStrip({
  today,
  days = 21,
  value,
  onChange,
  isOff,
}: {
  today: string;
  days?: number;
  value: string;
  onChange: (d: string) => void;
  isOff?: (d: string) => boolean;
}) {
  const { t, locale } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const list = Array.from({ length: days }, (_, i) => addDays(today, i));
  const month = (d: string) => new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * 280, behavior: "smooth" });
  return (
    <div className="relative">
      <div ref={ref} className="no-scrollbar flex snap-x gap-2 overflow-x-auto pb-2" role="listbox" aria-label={t.booking.chooseDate}>
        {list.map((d, i) => {
          const off = isOff?.(d) ?? false;
          const active = d === value;
          return (
            <button
              key={d}
              role="option"
              aria-selected={active}
              disabled={off}
              onClick={() => onChange(d)}
              className={clsx(
                "flex min-w-[4.5rem] snap-start flex-col items-center rounded border px-2 py-3 transition",
                active ? "border-gold bg-gold/10 text-gold-light shadow-gold" : "border-hair hover:border-line",
                off && "cursor-not-allowed opacity-30 line-through",
              )}
            >
              <span className="text-[10px] uppercase tracking-[0.15em] text-ivory-muted">{i === 0 ? t.common.today : t.daysShort[weekdayOf(d)]}</span>
              <span className="mt-1 font-serif text-2xl leading-none">{Number(d.slice(8))}</span>
              <span className="mt-1 text-[10px] uppercase text-ivory-dim">{month(d)}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 hidden justify-end gap-1 sm:flex">
        <button className="btn-ghost btn-sm" onClick={() => scroll(-1)} aria-label="Précédent">
          <ChevronLeft className="h-4 w-4 rtl:-scale-x-100" />
        </button>
        <button className="btn-ghost btn-sm" onClick={() => scroll(1)} aria-label="Suivant">
          <ChevronRight className="h-4 w-4 rtl:-scale-x-100" />
        </button>
      </div>
    </div>
  );
}

/**
 * Loads real availability from the server for one barber — or for several barbers
 * ("first available") and merges them, keeping the first barber free at each time.
 */
export function SlotGrid({
  barberIds,
  date,
  serviceIds,
  value,
  onPick,
  excludeAppointmentId,
  refreshKey = 0,
  barberNames,
}: {
  barberIds: string[];
  date: string;
  serviceIds: string[];
  value: string | null;
  onPick: (slot: PickedSlot) => void;
  excludeAppointmentId?: string;
  refreshKey?: number;
  barberNames?: Record<string, string>;
}) {
  const { t } = useI18n();
  const [state, setState] = useState<{ loading: boolean; slots: PickedSlot[]; working: boolean; error?: string }>({ loading: true, slots: [], working: true });
  const key = `${barberIds.join(",")}|${date}|${serviceIds.join(",")}|${refreshKey}`;

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    Promise.all(barberIds.map((barberId) => getSlotsAction({ barberId, date, serviceIds, excludeAppointmentId }).then((r) => ({ barberId, r })))).then((results) => {
      if (!alive) return;
      const merged = new Map<string, PickedSlot>();
      let working = false;
      let error: string | undefined;
      for (const { barberId, r } of results) {
        if (!r.ok) {
          error = r.message;
          continue;
        }
        working ||= r.data.working;
        for (const s of r.data.slots) if (s.available && !merged.has(s.start)) merged.set(s.start, { start: s.start, end: s.end, barberId });
      }
      setState({ loading: false, slots: [...merged.values()].sort((a, b) => a.start.localeCompare(b.start)), working, error });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const groups = useMemo(() => {
    const g: { label: string; slots: PickedSlot[] }[] = [
      { label: "Matin", slots: [] },
      { label: "Après-midi", slots: [] },
      { label: "Soir", slots: [] },
    ];
    for (const s of state.slots) {
      const m = zonedParts(new Date(s.start)).minutes;
      g[m < 12 * 60 ? 0 : m < 17 * 60 ? 1 : 2]!.slots.push(s);
    }
    return g.filter((x) => x.slots.length);
  }, [state.slots]);

  if (state.loading)
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" aria-busy="true" aria-label={t.booking.loadingSlots}>
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-11" />
        ))}
      </div>
    );
  if (state.error && !state.slots.length) return <EmptyState title={state.error} icon={<CalendarX2 className="h-8 w-8" />} />;
  if (!state.working) return <EmptyState title={t.booking.barberUnavailable} text={t.booking.noSlots} icon={<CalendarX2 className="h-8 w-8" />} />;
  if (!state.slots.length) return <EmptyState title={t.booking.noSlots} icon={<CalendarX2 className="h-8 w-8" />} />;

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-ivory-dim">{g.label}</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {g.slots.map((s) => (
              <button
                key={s.start}
                onClick={() => onPick(s)}
                aria-pressed={value === s.start}
                className={clsx(
                  "rounded border py-2.5 text-sm tabular-nums transition",
                  value === s.start ? "border-gold bg-gradient-to-b from-gold-light to-gold font-semibold text-ink" : "border-hair text-ivory hover:border-gold/60 hover:text-gold-light",
                )}
                title={barberNames && barberIds.length > 1 ? barberNames[s.barberId] : undefined}
              >
                {formatTime(s.start)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
