"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { Check, Clock3, X, Phone, Pencil, Trash2, Plus, Ban, ChevronLeft, ChevronRight, GripVertical, StickyNote, Unlock, AlertTriangle, CalendarOff } from "lucide-react";
import type { Appointment, AppointmentStatus, BlockedPeriod, Service } from "@/lib/domain/types";
import { addMinutes, formatDuration, formatTime } from "@/lib/domain/time";
import { formatDH } from "@/lib/domain/pricing";
import { formatPhone, whatsappLink } from "@/lib/domain/phone";
import { saveDayEntryAction, moveDayEntryAction, deleteDayEntryAction, setDayStatusAction } from "@/actions/day";
import { addBlockAction, deleteBlockAction } from "@/actions/availability";
import { useToast } from "@/components/ui/Toast";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import { EmptyState, Field } from "@/components/ui";
import { WhatsAppIcon } from "@/components/brand/SocialIcons";
import { supabaseBrowser } from "@/lib/supabase/client";

type Win = { start: string; end: string; breaks: { start: string; end: string; label: string }[] } | null;
const SLOT_MIN = 30;
const INACTIVE: AppointmentStatus[] = ["cancelled", "no_show"];
const isActive = (a: Appointment) => !INACTIVE.includes(a.status);
const amount = (a: Appointment) => a.finalPrice ?? a.totalPrice;
const t0 = (iso: string) => new Date(iso).getTime();
const overlaps = (s1: number, e1: number, s2: number, e2: number) => s1 < e2 && s2 < e1;
const floorSlot = (iso: string) => new Date(Math.floor(t0(iso) / (SLOT_MIN * 60_000)) * SLOT_MIN * 60_000).toISOString();

interface Props {
  date: string;
  today: string;
  barber: { id: string; name: string };
  isOwnDay: boolean;
  window: Win;
  blocks: BlockedPeriod[];
  appointments: Appointment[];
  services: Service[];
  barberQuery: string;
}

export function DayView(props: Props) {
  const { date, today, barber, window: win, blocks, services, barberQuery } = props;
  const toast = useToast();
  const router = useRouter();
  const [, start] = useTransition();
  const [items, setItems] = useState(props.appointments);
  const [editing, setEditing] = useState<{ appt: Appointment | null; startAt: string } | null>(null);
  const [blockOpen, setBlockOpen] = useState<{ from?: string } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }));

  useEffect(() => setItems(props.appointments), [props.appointments]);

  // Live sync: refresh when anything changes (Supabase Realtime) + light polling fallback.
  useEffect(() => {
    const id = setInterval(() => !document.hidden && router.refresh(), 20_000);
    const sb = supabaseBrowser();
    const ch = sb?.channel(`day-${barber.id}`).on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => router.refresh()).subscribe();
    return () => {
      clearInterval(id);
      if (ch) sb?.removeChannel(ch);
    };
  }, [router, barber.id]);

  // 30-minute rows: hh:00 and hh:30 only.
  const slots = useMemo(() => {
    if (!win) return [] as string[];
    const out = new Set<string>();
    for (let t = new Date(win.start); t < new Date(win.end); t = addMinutes(t, SLOT_MIN)) out.add(t.toISOString());
    // Never hide a booking that falls outside today's hours (e.g. hours changed after booking).
    for (const a of items) if (a.startAt) out.add(floorSlot(a.startAt));
    return [...out].sort();
  }, [win, items]);

  const scheduled = items.filter((a) => a.startAt);
  const unscheduled = items.filter((a) => !a.startAt);
  const startsAt = useMemo(() => {
    const m = new Map<string, Appointment[]>();
    for (const a of scheduled) {
      const k = floorSlot(a.startAt!);
      m.set(k, [...(m.get(k) ?? []), a].sort((x, y) => Number(isActive(y)) - Number(isActive(x))));
    }
    return m;
  }, [scheduled]);

  const breakAt = (iso: string) => win?.breaks.find((b) => overlaps(t0(iso), t0(iso) + SLOT_MIN * 60_000, t0(b.start), t0(b.end)));
  const blockAt = (iso: string) => blocks.find((b) => overlaps(t0(iso), t0(iso) + SLOT_MIN * 60_000, t0(b.startAt), t0(b.endAt)));
  const coveredBy = (iso: string) =>
    scheduled.find((a) => isActive(a) && t0(a.startAt!) < t0(iso) && t0(a.endAt!) > t0(iso) && floorSlot(a.startAt!) !== iso);

  /** Can a client of `duration` minutes start at `iso` (ignoring `exceptId`)? Mirrors the server check. */
  const canPlace = (iso: string, duration: number, exceptId?: string) => {
    if (!win) return false;
    const s = t0(iso);
    const e = s + duration * 60_000;
    if (s < t0(win.start) || e > t0(win.end)) return false;
    if (win.breaks.some((b) => overlaps(s, e, t0(b.start), t0(b.end)))) return false;
    if (blocks.some((b) => overlaps(s, e, t0(b.startAt), t0(b.endAt)))) return false;
    return !scheduled.some((a) => a.id !== exceptId && isActive(a) && overlaps(s, e, t0(a.startAt!), t0(a.endAt!)));
  };

  const done = items.filter((a) => a.status === "completed");
  const totalDone = done.reduce((s, a) => s + amount(a), 0);
  const planned = items.filter(isActive).reduce((s, a) => s + amount(a), 0);
  const counts = {
    clients: items.filter(isActive).length,
    done: done.length,
    late: items.filter((a) => a.status === "late").length,
    cancelled: items.filter((a) => a.status === "cancelled").length,
  };

  const changeStatus = (a: Appointment, status: AppointmentStatus) => {
    const target = a.status === status ? (a.startAt ? "confirmed" : "waiting") : status;
    setItems((list) => list.map((x) => (x.id === a.id ? { ...x, status: target } : x)));
    start(async () => {
      const r = await setDayStatusAction({ id: a.id, status });
      if (!r.ok) {
        toast("error", r.message);
        setItems(props.appointments);
      } else router.refresh();
    });
  };

  const onDragEnd = (e: DragEndEvent) => {
    const a = items.find((x) => x.id === e.active.id);
    const target = typeof e.over?.id === "string" && e.over.id.startsWith("slot:") ? e.over.id.slice(5) : null;
    if (!a || !target || (a.startAt && floorSlot(a.startAt) === target)) return;
    if (!canPlace(target, a.durationMinutes, a.id)) return toast("error", `Pas assez de place à ${formatTime(target)} pour ${formatDuration(a.durationMinutes)}.`);
    const end = addMinutes(new Date(target), a.durationMinutes).toISOString();
    setItems((list) => list.map((x) => (x.id === a.id ? { ...x, startAt: target, endAt: end } : x)));
    start(async () => {
      const r = await moveDayEntryAction({ id: a.id, startAt: target, barberId: barber.id });
      toast(r.ok ? "success" : "error", r.ok ? `${a.customerName} déplacé à ${formatTime(target)}` : r.message);
      if (!r.ok) setItems(props.appointments);
      router.refresh();
    });
  };

  const quickBlock = (iso: string) =>
    start(async () => {
      const r = await addBlockAction({ barberId: barber.id, kind: "time_block", startDate: date, endDate: date, startTime: formatTime(iso), endTime: formatTime(addMinutes(new Date(iso), SLOT_MIN)), reason: "Indisponible" });
      toast(r.ok ? "success" : "error", r.ok ? `${formatTime(iso)} bloqué` : r.message);
      router.refresh();
    });

  const unblock = (b: BlockedPeriod) =>
    start(async () => {
      const r = await deleteBlockAction(b.id);
      toast(r.ok ? "success" : "error", r.ok ? "Créneau débloqué" : r.message);
      router.refresh();
    });

  const shiftDate = (n: number) => {
    const d = new Date(`${date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return `/dashboard/journee?date=${d.toISOString().slice(0, 10)}${barberQuery}`;
  };
  const dateLabel = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
  const firstFree = slots.find((s) => !breakAt(s) && !blockAt(s) && canPlace(s, SLOT_MIN) && (date !== today || t0(s) + SLOT_MIN * 60_000 > Date.now())) ?? slots[0];
  const dayBlocked = !!win && blocks.some((b) => t0(b.startAt) <= t0(win.start) && t0(b.endAt) >= t0(win.end));

  return (
    <div className="pb-28">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-hair pb-6">
        <div>
          <p className="eyebrow">{props.isOwnDay ? "Ma journée" : `Journée de ${barber.name}`}</p>
          <h1 className="mt-2 font-serif text-3xl font-medium first-letter:uppercase sm:text-4xl">{date === today ? `Aujourd'hui · ${dateLabel}` : dateLabel}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={shiftDate(-1)} className="btn-outline btn-sm" aria-label="Jour précédent">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          {date !== today && (
            <Link href={`/dashboard/journee?date=${today}${barberQuery}`} className="btn-outline btn-sm">
              Aujourd&apos;hui
            </Link>
          )}
          <Link href={shiftDate(1)} className="btn-outline btn-sm" aria-label="Jour suivant">
            <ChevronRight className="h-4 w-4" />
          </Link>
          {win && (
            <>
              <button className="btn-outline btn-sm" onClick={() => setBlockOpen({})}>
                <Ban className="h-4 w-4" /> Indisponible
              </button>
              <button className="btn-gold btn-sm" disabled={!firstFree || dayBlocked} onClick={() => firstFree && setEditing({ appt: null, startAt: firstFree })}>
                <Plus className="h-4 w-4" /> Ajouter un client
              </button>
            </>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Clients" value={counts.clients} />
        <Stat label="Terminés" value={counts.done} tone="ok" />
        <Stat label="En retard" value={counts.late} tone="warn" />
        <Stat label="Total encaissé" value={formatDH(totalDone)} tone="gold" hint={`Prévu : ${formatDH(planned)}`} />
      </div>

      {!win ? (
        <EmptyState
          title="Jour de repos"
          text="Aucun horaire ce jour-là. Pour travailler exceptionnellement, ajoutez une disponibilité."
          icon={<CalendarOff className="h-8 w-8" />}
          action={
            <Link href="/dashboard/disponibilites" className="btn-outline btn-sm">
              Disponibilités
            </Link>
          }
        />
      ) : (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          {unscheduled.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-ivory-muted">Sur place, sans heure fixe (file d&apos;attente)</h2>
              <div className="space-y-2">
                {unscheduled.map((a) => (
                  <EntryCard key={a.id} a={a} onStatus={changeStatus} onEdit={() => setEditing({ appt: a, startAt: firstFree ?? slots[0]! })} />
                ))}
              </div>
            </section>
          )}

          <ol className="space-y-1.5" aria-label="Planning de la journée">
            {slots.map((iso) => {
              const here = startsAt.get(iso) ?? [];
              const br = breakAt(iso);
              const bl = blockAt(iso);
              const cover = coveredBy(iso);
              const past = date === today && t0(iso) + SLOT_MIN * 60_000 <= Date.now();
              return (
                <li key={iso} className="grid grid-cols-[52px_1fr] gap-2 sm:grid-cols-[64px_1fr] sm:gap-3">
                  <span className={clsx("pt-3 text-end font-display text-sm tabular-nums", formatTime(iso).endsWith(":00") ? "text-gold-light" : "text-ivory-dim")}>
                    {formatTime(iso)}
                  </span>
                  <div className="min-w-0 space-y-1.5">
                    {here.map((a) => (
                      <EntryCard key={a.id} a={a} onStatus={changeStatus} onEdit={() => setEditing({ appt: a, startAt: a.startAt! })} />
                    ))}
                    {here.some(isActive) ? null : br ? (
                      <div className="rounded border border-dashed border-hair px-4 py-3 text-sm text-ivory-dim">☕ {br.label}</div>
                    ) : bl ? (
                      <div className="flex items-center justify-between gap-3 rounded border border-bad/40 bg-bad/10 px-4 py-3 text-sm">
                        <span className="flex items-center gap-2 text-ivory-muted">
                          <Ban className="h-4 w-4 text-bad" /> Indisponible{bl.reason && bl.reason !== "Indisponible" ? ` · ${bl.reason}` : ""}
                        </span>
                        <button className="btn-ghost btn-sm px-2 text-xs" onClick={() => unblock(bl)}>
                          <Unlock className="h-3.5 w-3.5" /> Débloquer
                        </button>
                      </div>
                    ) : cover ? (
                      <div className="rounded border-s-2 border-gold/40 bg-white/[0.02] px-4 py-2 text-xs text-ivory-dim">↳ {cover.customerName} (suite)</div>
                    ) : (
                      <FreeSlot iso={iso} past={past} onAdd={() => setEditing({ appt: null, startAt: iso })} onBlock={() => quickBlock(iso)} />
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </DndContext>
      )}

      {/* Day total — always visible */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/95 px-4 py-3 backdrop-blur lg:left-[260px]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <span className="hidden text-xs text-ivory-muted sm:inline">
            {counts.done} terminé(s) · {counts.clients} client(s) · prévu {formatDH(planned)}
          </span>
          <span className="flex w-full items-baseline justify-between gap-3 sm:w-auto">
            <span className="whitespace-nowrap text-[11px] uppercase tracking-[0.2em] text-ivory-muted">Total du jour <span className="normal-case tracking-normal text-ivory-dim sm:hidden">· {counts.done} terminé(s)</span></span>
            <span className="whitespace-nowrap font-serif text-3xl text-gold-metal">{formatDH(totalDone)}</span>
          </span>
        </div>
      </div>

      {editing && (
        <EntryDialog
          key={editing.appt?.id ?? editing.startAt}
          appt={editing.appt}
          startAt={editing.startAt}
          barberId={barber.id}
          services={services}
          slots={slots.filter((s) => !breakAt(s) && !blockAt(s))}
          canPlace={canPlace}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
      {blockOpen && <BlockDialog date={date} barberId={barber.id} slots={slots} windowEnd={win!.end} onClose={() => setBlockOpen(null)} onDone={() => { setBlockOpen(null); router.refresh(); }} />}
    </div>
  );
}

function Stat({ label, value, tone, hint }: { label: string; value: React.ReactNode; tone?: "ok" | "warn" | "gold"; hint?: string }) {
  return (
    <div className={clsx("card px-4 py-3", tone === "gold" && "border-gold/40")}>
      <p className="text-[10px] uppercase tracking-[0.18em] text-ivory-muted">{label}</p>
      <p className={clsx("mt-1 font-serif text-3xl tabular-nums", tone === "ok" && "text-ok", tone === "warn" && "text-warn", tone === "gold" && "text-gold-metal")}>{value}</p>
      {hint && <p className="text-[11px] text-ivory-dim">{hint}</p>}
    </div>
  );
}

function FreeSlot({ iso, past, onAdd, onBlock }: { iso: string; past: boolean; onAdd: () => void; onBlock: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot:${iso}` });
  return (
    <div
      ref={setNodeRef}
      className={clsx(
        "group flex min-h-[46px] items-center justify-between gap-2 rounded border border-dashed px-3 transition",
        isOver ? "border-gold bg-gold/10" : "border-hair/70 hover:border-line",
        past && "opacity-50",
      )}
    >
      <span className="text-xs text-ivory-dim">{isOver ? "Déposer ici" : "Libre"}</span>
      <span className="flex gap-1">
        <button onClick={onAdd} className="btn-ghost btn-sm px-2 py-1 text-xs text-gold">
          <Plus className="h-3.5 w-3.5" /> Client
        </button>
        <button onClick={onBlock} className="btn-ghost btn-sm px-2 py-1 text-xs" title="Bloquer ce créneau" aria-label={`Bloquer ${formatTime(iso)}`}>
          <Ban className="h-3.5 w-3.5" />
        </button>
      </span>
    </div>
  );
}

const STATE_STYLE: Partial<Record<AppointmentStatus, string>> = {
  completed: "border-ok/60 bg-ok/[0.12]",
  late: "border-warn/70 bg-warn/[0.12]",
  cancelled: "border-bad/60 bg-bad/[0.12]",
  no_show: "border-bad/60 bg-bad/[0.12]",
  in_progress: "border-gold/70 bg-gold/[0.08]",
};

function EntryCard({ a, onStatus, onEdit }: { a: Appointment; onStatus: (a: Appointment, s: AppointmentStatus) => void; onEdit: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: a.id, disabled: !a.startAt });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const servicesMin = a.services.reduce((s, x) => s + x.durationMinutes, 0);
  const extra = a.durationMinutes - servicesMin;
  const cancelled = INACTIVE.includes(a.status);
  const btn = "flex items-center gap-1 rounded-sm border px-2.5 py-1.5 text-xs font-semibold transition";
  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx("rounded border bg-ink p-3 shadow-card sm:p-4", STATE_STYLE[a.status] ?? "border-hair", isDragging && "z-50 border-gold opacity-90")}
    >
      <div className="grid gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)_auto] md:items-center">
        {/* Client */}
        <div className="flex min-w-0 items-start gap-2">
          {a.startAt && (
            <button {...listeners} {...attributes} className="mt-0.5 cursor-grab touch-none text-ivory-dim hover:text-gold active:cursor-grabbing" aria-label="Glisser pour changer l'heure">
              <GripVertical className="h-5 w-5" />
            </button>
          )}
          <div className="min-w-0">
            <p className={clsx("truncate text-base font-semibold text-ivory", cancelled && "line-through decoration-bad/70")}>
              {a.queue && <span className="me-2 font-display text-sm text-gold-light">{a.queue.ticketCode}</span>}
              {a.customerName}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {a.customerPhone ? (
                <>
                  <span className="text-xs tabular-nums text-ivory-muted">{formatPhone(a.customerPhone)}</span>
                  <a href={`tel:${a.customerPhone}`} className="flex h-7 w-7 items-center justify-center rounded-full border border-line text-gold hover:bg-gold/10" aria-label={`Appeler ${a.customerName}`}>
                    <Phone className="h-3.5 w-3.5" />
                  </a>
                  <a href={whatsappLink(a.customerPhone)} target="_blank" rel="noopener noreferrer" className="flex h-7 w-7 items-center justify-center rounded-full border border-line text-ok hover:bg-ok/10" aria-label={`WhatsApp ${a.customerName}`}>
                    <WhatsAppIcon className="h-3.5 w-3.5" />
                  </a>
                </>
              ) : (
                <span className="text-xs text-ivory-dim">Pas de téléphone</span>
              )}
            </div>
          </div>
        </div>

        {/* Services, time, note */}
        <div className="min-w-0">
          <div className="flex flex-wrap gap-1">
            {a.services.map((s, i) => (
              <span key={`${s.serviceId}-${i}`} className="rounded-sm border border-hair bg-white/[0.03] px-2 py-0.5 text-xs text-ivory">
                {s.name}
              </span>
            ))}
            {extra > 0 && <span className="rounded-sm border border-gold/40 px-2 py-0.5 text-xs text-gold-light">+{formatDuration(extra)}</span>}
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-ivory-dim">
            <Clock3 className="h-3 w-3" />
            {a.startAt ? `${formatTime(a.startAt)} – ${formatTime(a.endAt!)} · ` : ""}
            {formatDuration(a.durationMinutes)}
          </p>
          {a.note && (
            <p className="mt-1.5 flex gap-1.5 text-xs text-ivory-muted">
              <StickyNote className="mt-0.5 h-3 w-3 shrink-0 text-gold" /> {a.note}
            </p>
          )}
        </div>

        {/* Price + actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 md:flex-col md:items-end">
          <span className={clsx("font-serif text-2xl tabular-nums", a.status === "completed" ? "text-ok" : cancelled ? "text-ivory-dim line-through" : "text-gold-metal")}>
            {formatDH(amount(a))}
          </span>
          <div className="flex flex-wrap gap-1">
            <button onClick={() => onStatus(a, "completed")} aria-pressed={a.status === "completed"} className={clsx(btn, a.status === "completed" ? "border-ok bg-ok text-ink" : "border-ok/50 text-ok hover:bg-ok/10")}>
              <Check className="h-3.5 w-3.5" /> Terminé
            </button>
            {a.startAt && (
              <button onClick={() => onStatus(a, "late")} aria-pressed={a.status === "late"} className={clsx(btn, a.status === "late" ? "border-warn bg-warn text-ink" : "border-warn/50 text-warn hover:bg-warn/10")}>
                <Clock3 className="h-3.5 w-3.5" /> Retard
              </button>
            )}
            <button onClick={() => onStatus(a, "cancelled")} aria-pressed={a.status === "cancelled"} className={clsx(btn, a.status === "cancelled" ? "border-bad bg-bad text-ivory" : "border-bad/50 text-bad hover:bg-bad/10")}>
              <X className="h-3.5 w-3.5" /> Annulé
            </button>
            <button onClick={onEdit} className={clsx(btn, "border-hair text-ivory-muted hover:border-gold hover:text-gold-light")} aria-label={`Modifier ${a.customerName}`}>
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

const EXTRA_OPTIONS = [0, 30, 60, 90];

function EntryDialog({
  appt,
  startAt,
  barberId,
  services,
  slots,
  canPlace,
  onClose,
  onSaved,
}: {
  appt: Appointment | null;
  startAt: string;
  barberId: string;
  services: Service[];
  slots: string[];
  canPlace: (iso: string, duration: number, exceptId?: string) => boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [name, setName] = useState(appt?.customerName ?? "");
  const [phone, setPhone] = useState(appt?.customerPhone ?? "");
  const [serviceIds, setServiceIds] = useState<string[]>(appt?.services.map((s) => s.serviceId) ?? []);
  const initialExtra = appt ? Math.max(0, appt.durationMinutes - appt.services.reduce((s, x) => s + x.durationMinutes, 0)) : 0;
  const [extra, setExtra] = useState(initialExtra);
  const [time, setTime] = useState(appt?.startAt ? floorSlot(appt.startAt) : startAt);
  const [note, setNote] = useState(appt?.note ?? "");
  const [finalPrice, setFinalPrice] = useState(appt?.finalPrice?.toString() ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const chosen = services.filter((s) => serviceIds.includes(s.id));
  const duration = chosen.reduce((s, x) => s + x.durationMinutes, 0) + extra;
  const price = chosen.reduce((s, x) => s + x.price, 0);
  const fits = !!time && canPlace(time, duration || SLOT_MIN, appt?.id);
  const options = Array.from(new Set([...(appt?.startAt ? [floorSlot(appt.startAt)] : []), ...slots])).sort();

  const save = () =>
    start(async () => {
      const r = await saveDayEntryAction({
        id: appt?.id,
        barberId,
        serviceIds,
        startAt: time,
        name,
        phone,
        note,
        extraMinutes: extra,
        finalPrice: finalPrice === "" ? null : Number(finalPrice),
      });
      toast(r.ok ? "success" : "error", r.ok ? (appt ? "Client mis à jour" : "Client ajouté") : r.message);
      if (r.ok) onSaved();
    });

  return (
    <Dialog
      open
      onClose={onClose}
      title={appt ? `Modifier — ${appt.customerName}` : "Ajouter un client"}
      size="lg"
      footer={
        <>
          {appt && (
            <button className="btn-ghost btn-sm me-auto hover:text-bad" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4" /> Supprimer
            </button>
          )}
          <span className="self-center text-xs text-ivory-muted">
            {duration ? `${formatDuration(duration)} · ${formatTime(time)} – ${formatTime(addMinutes(new Date(time), duration))} · ${formatDH(price)}` : ""}
          </span>
          <button className="btn-gold btn-sm" disabled={pending || name.trim().length < 2 || !serviceIds.length || !fits} onClick={save}>
            <Check className="h-4 w-4" /> Enregistrer
          </button>
        </>
      }
    >
      <div className="grid gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom du client" htmlFor="de-name">
            <input id="de-name" className="field" value={name} onChange={(e) => setName(e.target.value)} autoFocus={!appt} />
          </Field>
          <Field label="Téléphone (facultatif)" htmlFor="de-phone">
            <input id="de-phone" className="field" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 / 07…" />
          </Field>
        </div>

        <div>
          <p className="label">Services</p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {services.map((s) => {
              const on = serviceIds.includes(s.id);
              return (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => setServiceIds(on ? serviceIds.filter((x) => x !== s.id) : [...serviceIds, s.id])}
                  className={clsx("rounded-sm border px-2.5 py-2 text-start text-xs transition", on ? "border-gold bg-gold/10 text-gold-light" : "border-hair text-ivory-muted hover:border-line")}
                >
                  <span className="block font-semibold">{s.name}</span>
                  <span className="text-[10px] text-ivory-dim">
                    {s.durationMinutes} min · {s.priceFrom ? "dès " : ""}
                    {formatDH(s.price)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Heure" htmlFor="de-time" error={time && duration && !fits ? "Pas assez de place à cette heure" : undefined}>
            <select id="de-time" className="field" value={time} onChange={(e) => setTime(e.target.value)}>
              {options.map((s) => (
                <option key={s} value={s} disabled={!canPlace(s, duration || SLOT_MIN, appt?.id)}>
                  {formatTime(s)}
                  {canPlace(s, duration || SLOT_MIN, appt?.id) ? "" : " — occupé"}
                </option>
              ))}
            </select>
          </Field>
          <div>
            <p className="label">Temps en plus</p>
            <div className="flex gap-1">
              {EXTRA_OPTIONS.map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => setExtra(m)}
                  className={clsx("flex-1 rounded-sm border py-2 text-xs font-semibold", extra === m ? "border-gold bg-gold/10 text-gold-light" : "border-hair text-ivory-muted")}
                >
                  {m === 0 ? "Aucun" : `+${formatDuration(m)}`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Field label="Note (ce que le client veut)" htmlFor="de-note">
          <textarea id="de-note" className="field min-h-[70px]" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. dégradé bas, garder la longueur, soin visage…" />
        </Field>

        {appt && (
          <Field label={`Prix final (calculé : ${formatDH(price)})`} htmlFor="de-price" hint="Laisser vide pour garder le prix calculé">
            <input id="de-price" className="field" type="number" min={0} value={finalPrice} onChange={(e) => setFinalPrice(e.target.value)} />
          </Field>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        danger
        pending={pending}
        title="Supprimer ce client ?"
        message={`${appt?.customerName} sera retiré de la journée. Pour garder une trace, utilisez plutôt « Annulé ».`}
        confirmLabel="Supprimer"
        onConfirm={() =>
          start(async () => {
            const r = await deleteDayEntryAction(appt!.id);
            toast(r.ok ? "success" : "error", r.ok ? "Client supprimé" : r.message);
            setConfirmDelete(false);
            if (r.ok) onSaved();
          })
        }
      />
    </Dialog>
  );
}

function BlockDialog({ date, barberId, slots, windowEnd, onClose, onDone }: { date: string; barberId: string; slots: string[]; windowEnd: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"day" | "range">("range");
  const ends = [...slots.slice(1), windowEnd];
  const [from, setFrom] = useState(slots[0]!);
  const [to, setTo] = useState(ends[1] ?? windowEnd);
  const [reason, setReason] = useState("");
  const [conflicts, setConflicts] = useState<{ id: string; customerName: string; startAt: string; services: string }[] | null>(null);

  const submit = (confirmCancellations: boolean) =>
    start(async () => {
      const r = await addBlockAction({
        barberId,
        kind: mode === "day" ? "day_off" : "time_block",
        startDate: date,
        endDate: date,
        startTime: mode === "range" ? formatTime(from) : undefined,
        endTime: mode === "range" ? formatTime(to) : undefined,
        reason: reason || undefined,
        confirmCancellations,
      });
      if (!r.ok && r.code === "CONFLICTS") return setConflicts((r.data as { affected: NonNullable<typeof conflicts> }).affected);
      toast(r.ok ? "success" : "error", r.ok ? (r.data.cancelled.length ? `Bloqué — ${r.data.cancelled.length} client(s) annulé(s)` : "Bloqué") : r.message);
      if (r.ok) onDone();
    });

  return (
    <Dialog
      open
      onClose={onClose}
      title="Je ne suis pas disponible"
      footer={
        conflicts ? (
          <button className="btn btn-sm border border-bad/60 bg-bad/15 text-ivory hover:bg-bad/25" disabled={pending} onClick={() => submit(true)}>
            Bloquer et annuler {conflicts.length} client(s)
          </button>
        ) : (
          <button className="btn-gold btn-sm" disabled={pending || (mode === "range" && to <= from)} onClick={() => submit(false)}>
            <Ban className="h-4 w-4" /> Bloquer
          </button>
        )
      }
    >
      {conflicts ? (
        <div>
          <p className="flex gap-2 text-sm text-ivory-muted">
            <AlertTriangle className="h-4 w-4 shrink-0 text-bad" /> Ces clients ont déjà réservé sur cette période. Ils seront annulés (pensez à les prévenir par WhatsApp).
          </p>
          <ul className="mt-4 divide-y divide-hair rounded border border-hair text-sm">
            {conflicts.map((c) => (
              <li key={c.id} className="px-3 py-2">
                <span className="text-ivory">{c.customerName}</span>
                <span className="block text-xs text-ivory-muted">
                  {formatTime(c.startAt)} · {c.services}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="flex gap-1 rounded border border-hair p-1">
            {(["range", "day"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={clsx("flex-1 rounded-sm px-3 py-2 text-xs font-semibold", mode === m ? "bg-gold/15 text-gold-light" : "text-ivory-muted")}>
                {m === "range" ? "Quelques heures" : "Toute la journée"}
              </button>
            ))}
          </div>
          {mode === "range" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="De" htmlFor="bk-from">
                <select id="bk-from" className="field" value={from} onChange={(e) => setFrom(e.target.value)}>
                  {slots.map((s) => (
                    <option key={s} value={s}>
                      {formatTime(s)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="À" htmlFor="bk-to">
                <select id="bk-to" className="field" value={to} onChange={(e) => setTo(e.target.value)}>
                  {ends.map((s) => (
                    <option key={s} value={s} disabled={s <= from}>
                      {formatTime(s)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}
          <Field label="Motif (facultatif)" htmlFor="bk-reason">
            <input id="bk-reason" className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Rendez-vous, imprévu…" />
          </Field>
        </div>
      )}
    </Dialog>
  );
}
