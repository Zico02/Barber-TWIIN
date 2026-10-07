"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import {
  BellRing, Phone, Play, CheckCheck, UserCheck, Hourglass, XCircle, UserX, ArrowDownToLine, Pencil, MessageSquare, Plus, Timer, StickyNote, RefreshCw,
} from "lucide-react";
import type { Appointment, AppointmentStatus, NotificationTemplate, Service } from "@/lib/domain/types";
import type { BarberLive, EntryEstimate } from "@/lib/domain/waiting";
import { BOARD_COLUMNS, canTransition } from "@/lib/domain/status";
import { formatTime, formatDuration } from "@/lib/domain/time";
import { formatDH, formatServicePrice } from "@/lib/domain/pricing";
import { whatsappLink, formatPhone } from "@/lib/domain/phone";
import { addWalkInAction, callNextAction, changeStatusAction, editAppointmentAction, moveLowerAction, prepareMessageAction, setDelayAction } from "@/actions/queue";
import { useI18n } from "@/lib/i18n/client";
import { useToast } from "@/components/ui/Toast";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import { Field, StatusBadge } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import { WhatsAppIcon } from "@/components/brand/SocialIcons";

type BarberLite = { id: string; name: string; delayMinutes: number; serviceIds: string[] };

const COLUMN_TITLES: Record<string, string> = {
  upcoming: "À venir",
  arrived: "Arrivés",
  waiting: "En attente",
  called: "Appelés",
  in_progress: "En cours",
  completed: "Terminés",
  no_show: "Absents / annulés",
};

export function QueueBoard(props: {
  appointments: Appointment[];
  estimates: Record<string, EntryEstimate>;
  barberLive: Record<string, BarberLive>;
  barbers: BarberLite[];
  services: Service[];
  scope: string;
  isBarber: boolean;
  canSeePrices: boolean;
  openWalkIn: boolean;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [items, setItems] = useState(props.appointments);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [walkIn, setWalkIn] = useState(props.openWalkIn);
  const [assign, setAssign] = useState<{ appt: Appointment; status: AppointmentStatus } | null>(null);
  const [confirm, setConfirm] = useState<{ appt: Appointment; status: AppointmentStatus } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }));
  const barberName = (id: string | null) => props.barbers.find((b) => b.id === id)?.name ?? t.common.anyBarber;

  useEffect(() => setItems(props.appointments), [props.appointments]);

  // Live updates: Supabase Realtime when configured, plus a polling fallback.
  useEffect(() => {
    const id = setInterval(() => !document.hidden && router.refresh(), 20_000);
    const sb = supabaseBrowser();
    const channel = sb
      ?.channel("queue-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "walk_in_queue" }, () => router.refresh())
      .subscribe();
    return () => {
      clearInterval(id);
      if (channel) sb?.removeChannel(channel);
    };
  }, [router]);

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, okMsg?: string) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        if (okMsg || res.message) toast("success", res.message ?? okMsg!);
        router.refresh();
      } else {
        toast("error", res.message ?? t.common.error);
        setItems(props.appointments);
      }
    });

  const setStatus = (appt: Appointment, status: AppointmentStatus, barberId?: string) => {
    if (!canTransition(appt.status, status)) return toast("error", "Ce changement de statut n'est pas autorisé.");
    if (!appt.barberId && ["called", "in_progress"].includes(status) && !barberId) {
      if (props.isBarber) barberId = undefined; // server assigns the barber himself
      else if (props.scope !== "all") barberId = props.scope;
      else return setAssign({ appt, status });
    }
    setItems((list) => list.map((a) => (a.id === appt.id ? { ...a, status } : a))); // optimistic
    run(() => changeStatusAction({ appointmentId: appt.id, status, barberId }));
  };

  const onDragEnd = (e: DragEndEvent) => {
    const appt = items.find((a) => a.id === e.active.id);
    const col = BOARD_COLUMNS.find((c) => c.id === e.over?.id);
    if (!appt || !col || col.statuses.includes(appt.status)) return;
    if (col.drop === "no_show" || col.drop === "completed") setConfirm({ appt, status: col.drop });
    else setStatus(appt, col.drop);
  };

  const callNext = (barberId: string) =>
    start(async () => {
      const res = await callNextAction({ barberId });
      if (!res.ok) return toast("error", res.message);
      const a = res.data.appointment;
      toast("success", `${a.queue?.ticketCode ?? formatTime(a.startAt ?? a.createdAt)} — ${a.customerName} est appelé${res.data.skipped ? ` (${res.data.skipped} client(s) dont le service dépasserait le prochain RDV ont été passés)` : ""}`);
      router.refresh();
    });

  const callable = props.isBarber ? props.barbers.filter((b) => b.id === props.scope) : props.scope === "all" ? props.barbers : props.barbers.filter((b) => b.id === props.scope);

  return (
    <div>
      {/* Action bar */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {callable.map((b) => {
          const live = props.barberLive[b.id];
          return (
            <button key={b.id} className="btn-gold" disabled={pending || live?.status === "off"} onClick={() => callNext(b.id)}>
              <BellRing className="h-4 w-4" /> Appeler le suivant{callable.length > 1 ? ` · ${b.name}` : ""}
            </button>
          );
        })}
        <button className="btn-outline" onClick={() => setWalkIn(true)}>
          <Plus className="h-4 w-4" /> Client sans RDV
        </button>
        {props.scope !== "all" && <DelayControl barber={props.barbers.find((b) => b.id === props.scope)!} isBarber={props.isBarber} />}
        <button className="btn-ghost btn-sm ms-auto" onClick={() => router.refresh()} aria-label="Actualiser">
          <RefreshCw className={clsx("h-4 w-4", pending && "animate-spin")} />
        </button>
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
          {BOARD_COLUMNS.map((col) => {
            const list = items
              .filter((a) => col.statuses.includes(a.status))
              .sort((x, y) => {
                const ex = props.estimates[x.id]?.waitMinutes;
                const ey = props.estimates[y.id]?.waitMinutes;
                if (ex !== undefined && ey !== undefined) return ex - ey;
                return +new Date(x.startAt ?? x.arrivedAt ?? x.createdAt) - +new Date(y.startAt ?? y.arrivedAt ?? y.createdAt);
              });
            return (
              <Column key={col.id} id={col.id} title={COLUMN_TITLES[col.id]!} count={list.length}>
                {list.map((a) => (
                  <Card
                    key={a.id}
                    appt={a}
                    estimate={props.estimates[a.id]}
                    barberName={barberName(a.barberId)}
                    showBarber={props.scope === "all"}
                    onStatus={(s) => (s === "no_show" || s === "cancelled" ? setConfirm({ appt: a, status: s }) : setStatus(a, s))}
                    onLower={() => run(() => moveLowerAction(a.id), "Client déplacé plus bas dans la file")}
                    onEdit={() => setEditing(a)}
                    onMessage={(template) =>
                      start(async () => {
                        const res = await prepareMessageAction({ appointmentId: a.id, template, channel: "whatsapp" });
                        if (res.ok) window.open(res.data.url, "_blank", "noopener");
                        else toast("error", res.message);
                      })
                    }
                    statusLabel={t.status[a.status]}
                    showPrice={props.canSeePrices}
                  />
                ))}
              </Column>
            );
          })}
        </div>
      </DndContext>

      {editing && <EditDialog appt={editing} services={props.services} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); router.refresh(); }} />}
      <WalkInDialog open={walkIn} onClose={() => setWalkIn(false)} services={props.services} barbers={props.barbers} defaultBarber={props.scope === "all" ? null : props.scope} lockBarber={props.isBarber} onSaved={() => { setWalkIn(false); router.refresh(); }} />

      <Dialog open={!!assign} onClose={() => setAssign(null)} title="Quel barbier prend ce client ?" size="sm">
        <div className="grid gap-2">
          {props.barbers.map((b) => (
            <button key={b.id} className="btn-outline justify-start" onClick={() => { if (assign) setStatus(assign.appt, assign.status, b.id); setAssign(null); }}>
              {b.name}
            </button>
          ))}
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        danger={confirm?.status !== "completed"}
        title={confirm ? t.status[confirm.status] : ""}
        message={confirm ? `${confirm.appt.customerName} — ${confirm.appt.services.map((s) => s.name).join(" + ")}. Confirmer le passage en « ${t.status[confirm.status]} » ?` : ""}
        onConfirm={() => {
          if (confirm) setStatus(confirm.appt, confirm.status);
          setConfirm(null);
        }}
      />
    </div>
  );
}

function Column({ id, title, count, children }: { id: string; title: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section ref={setNodeRef} className={clsx("flex w-[280px] shrink-0 flex-col rounded-md border bg-ink-2/70 transition", isOver ? "border-gold bg-gold/[0.05]" : "border-hair")}>
      <header className="flex items-center justify-between border-b border-hair px-3 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-ivory-muted">{title}</h2>
        <span className="rounded-sm bg-white/[0.05] px-1.5 text-xs tabular-nums text-ivory-dim">{count}</span>
      </header>
      <div className="flex min-h-[140px] flex-1 flex-col gap-2 p-2">{children}</div>
    </section>
  );
}

function Card(props: {
  appt: Appointment;
  estimate?: EntryEstimate;
  barberName: string;
  showBarber: boolean;
  statusLabel: string;
  showPrice: boolean;
  onStatus: (s: AppointmentStatus) => void;
  onLower: () => void;
  onEdit: () => void;
  onMessage: (tpl: NotificationTemplate) => void;
}) {
  const { appt: a } = props;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: a.id });
  const [menu, setMenu] = useState(false);
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const can = (s: AppointmentStatus) => canTransition(a.status, s) && a.status !== s;
  const btn = "flex items-center gap-1 rounded-sm border border-hair px-2 py-1 text-[11px] text-ivory-muted hover:border-gold hover:text-gold-light";
  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx("rounded border bg-ink p-3 text-sm shadow-card", isDragging ? "z-50 border-gold opacity-90" : "border-hair", a.status === "in_progress" && "border-gold/60", a.status === "called" && "border-gold-light")}
    >
      <div {...listeners} {...attributes} className="cursor-grab touch-none active:cursor-grabbing">
        <div className="flex items-start justify-between gap-2">
          <span className="font-display text-base tracking-wider text-gold-light">{a.queue?.ticketCode ?? (a.startAt ? formatTime(a.startAt) : "—")}</span>
          <StatusBadge status={a.status} label={props.statusLabel} />
        </div>
        <p className="mt-1.5 font-semibold text-ivory">{a.customerName}</p>
        <p className="text-xs text-ivory-muted">
          {a.services.map((s) => s.name).join(" + ")} · {formatDuration(a.durationMinutes)}
          {props.showPrice && ` · ${formatDH(a.finalPrice ?? a.totalPrice)}`}
        </p>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ivory-dim">
          {a.startAt && <span>RDV {formatTime(a.startAt)}</span>}
          {(a.queue?.arrivedAt ?? a.arrivedAt) && <span>Arrivé {formatTime(a.queue?.arrivedAt ?? a.arrivedAt!)}</span>}
          {a.source === "walk_in" && <span className="text-gold/80">Sans RDV</span>}
          {props.showBarber && <span>{props.barberName}</span>}
          {props.estimate && ["arrived", "waiting"].includes(a.status) && (
            <span className="text-gold-light">
              ≈ {props.estimate.waitMinutes} min · #{props.estimate.position}
            </span>
          )}
          {(a.queue?.priority ?? 0) > 0 && <span className="text-gold">Prioritaire</span>}
        </div>
        {a.note && (
          <p className="mt-2 flex gap-1.5 rounded-sm bg-white/[0.03] px-2 py-1.5 text-xs text-ivory-muted">
            <StickyNote className="mt-0.5 h-3 w-3 shrink-0 text-gold" /> {a.note}
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {can("arrived") && ["pending", "confirmed", "no_show"].includes(a.status) && (
          <button className={btn} onClick={() => props.onStatus("arrived")}>
            <UserCheck className="h-3 w-3" /> Arrivé
          </button>
        )}
        {can("waiting") && a.status === "arrived" && (
          <button className={btn} onClick={() => props.onStatus("waiting")}>
            <Hourglass className="h-3 w-3" /> En attente
          </button>
        )}
        {can("called") && ["arrived", "waiting"].includes(a.status) && (
          <button className={btn} onClick={() => props.onStatus("called")}>
            <BellRing className="h-3 w-3" /> Appeler
          </button>
        )}
        {can("in_progress") && ["arrived", "waiting", "called"].includes(a.status) && (
          <button className={clsx(btn, "border-gold/50 text-gold-light")} onClick={() => props.onStatus("in_progress")}>
            <Play className="h-3 w-3" /> Démarrer
          </button>
        )}
        {can("completed") && a.status === "in_progress" && (
          <button className={clsx(btn, "border-ok/50 text-ok")} onClick={() => props.onStatus("completed")}>
            <CheckCheck className="h-3 w-3" /> Terminer
          </button>
        )}
        <button className={btn} onClick={() => setMenu((v) => !v)} aria-expanded={menu}>
          …
        </button>
      </div>

      {menu && (
        <div className="mt-2 flex flex-wrap gap-1 border-t border-hair pt-2">
          {a.customerPhone && (
            <>
              <a className={btn} href={`tel:${a.customerPhone}`} title={formatPhone(a.customerPhone)}>
                <Phone className="h-3 w-3" /> Appeler
              </a>
              <a className={btn} href={whatsappLink(a.customerPhone)} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon className="h-3 w-3" /> WhatsApp
              </a>
            </>
          )}
          {a.queue && ["arrived", "waiting"].includes(a.status) && (
            <button className={btn} onClick={props.onLower}>
              <ArrowDownToLine className="h-3 w-3" /> Descendre
            </button>
          )}
          <button className={btn} onClick={props.onEdit}>
            <Pencil className="h-3 w-3" /> Modifier
          </button>
          {can("no_show") && (
            <button className={btn} onClick={() => props.onStatus("no_show")}>
              <UserX className="h-3 w-3" /> Absent
            </button>
          )}
          {can("cancelled") && (
            <button className={clsx(btn, "hover:border-bad hover:text-bad")} onClick={() => props.onStatus("cancelled")}>
              <XCircle className="h-3 w-3" /> Annuler
            </button>
          )}
          {a.customerPhone && (
            <div className="mt-1 flex w-full flex-wrap gap-1">
              <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-ivory-dim">
                <MessageSquare className="h-3 w-3" /> Message :
              </span>
              {(
                [
                  ["booking_confirmation", "Confirmation"],
                  ["appointment_reminder", "Rappel"],
                  ["barber_ready", "Prêt"],
                  ["barber_delay", "Retard"],
                  ["cancellation", "Annulation"],
                  ["review_request", "Avis"],
                ] as [NotificationTemplate, string][]
              ).map(([tpl, label]) => (
                <button key={tpl} className={btn} onClick={() => props.onMessage(tpl)}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function DelayControl({ barber, isBarber }: { barber: BarberLite; isBarber: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [value, setValue] = useState(barber.delayMinutes);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-2 rounded border border-hair px-3 py-1.5">
      <Timer className="h-4 w-4 text-gold" />
      <label className="text-xs text-ivory-muted" htmlFor="delay">
        Retard{isBarber ? "" : ` ${barber.name}`}
      </label>
      <select id="delay" className="rounded-sm border border-hair bg-ink px-2 py-1 text-xs" value={value} onChange={(e) => setValue(Number(e.target.value))}>
        {[0, 5, 10, 15, 20, 30, 45, 60].map((m) => (
          <option key={m} value={m}>
            {m} min
          </option>
        ))}
      </select>
      <button
        className="text-xs font-semibold text-gold hover:text-gold-light disabled:opacity-40"
        disabled={pending || value === barber.delayMinutes}
        onClick={() =>
          start(async () => {
            const r = await setDelayAction({ barberId: barber.id, minutes: value });
            toast(r.ok ? "success" : "error", r.ok ? "Retard mis à jour — les estimations sont recalculées" : r.message);
            router.refresh();
          })
        }
      >
        OK
      </button>
    </div>
  );
}

function ServicePicker({ services, value, onChange }: { services: Service[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {services.map((s) => {
        const on = value.includes(s.id);
        return (
          <button
            type="button"
            key={s.id}
            onClick={() => onChange(on ? value.filter((x) => x !== s.id) : [...value, s.id])}
            className={clsx("rounded-sm border px-2.5 py-2 text-start text-xs", on ? "border-gold bg-gold/10 text-gold-light" : "border-hair text-ivory-muted")}
          >
            {s.name}
            <span className="block text-[10px] text-ivory-dim">
              {s.durationMinutes} min · {formatServicePrice(s)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function WalkInDialog(props: { open: boolean; onClose: () => void; services: Service[]; barbers: BarberLite[]; defaultBarber: string | null; lockBarber: boolean; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [barberId, setBarberId] = useState<string | null>(props.defaultBarber);
  const [note, setNote] = useState("");
  const [priority, setPriority] = useState(0);
  const [pending, start] = useTransition();
  const chosen = props.services.filter((s) => serviceIds.includes(s.id));
  const total = useMemo(() => chosen.reduce((s, x) => ({ p: s.p + x.price, d: s.d + x.durationMinutes }), { p: 0, d: 0 }), [chosen]);

  const submit = () =>
    start(async () => {
      const res = await addWalkInAction({ name, phone, serviceIds, barberId, note, priority, arrivedAt: new Date().toISOString() });
      if (!res.ok) return toast("error", res.message);
      toast("success", `Ticket ${res.data.queue?.ticketCode} créé pour ${res.data.customerName}`);
      setName(""); setPhone(""); setServiceIds([]); setNote(""); setPriority(0);
      props.onSaved();
    });

  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      title="Client sans rendez-vous"
      footer={
        <>
          <span className="me-auto self-center text-xs text-ivory-muted">
            {total.d ? `${formatDuration(total.d)} · ${formatDH(total.p)}` : ""}
          </span>
          <button className="btn-gold btn-sm" disabled={pending || !name || !serviceIds.length} onClick={submit}>
            Ajouter à la file
          </button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom" htmlFor="wi-name">
            <input id="wi-name" className="field" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label="Téléphone (facultatif)" htmlFor="wi-phone">
            <input id="wi-phone" className="field" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06…" />
          </Field>
        </div>
        <div>
          <p className="label">Services</p>
          <ServicePicker services={props.services} value={serviceIds} onChange={setServiceIds} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Barbier souhaité" htmlFor="wi-barber">
            <select id="wi-barber" className="field" disabled={props.lockBarber} value={barberId ?? ""} onChange={(e) => setBarberId(e.target.value || null)}>
              <option value="">Peu importe (premier disponible)</option>
              {props.barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priorité" htmlFor="wi-prio" hint="Enfant, personne âgée…">
            <select id="wi-prio" className="field" value={priority} onChange={(e) => setPriority(Number(e.target.value))}>
              <option value={0}>Normale</option>
              <option value={1}>Prioritaire</option>
            </select>
          </Field>
        </div>
        <Field label="Note" htmlFor="wi-note">
          <input id="wi-note" className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. dégradé bas" />
        </Field>
      </div>
    </Dialog>
  );
}

function EditDialog({ appt, services, onClose, onSaved }: { appt: Appointment; services: Service[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState(appt.note ?? "");
  const [serviceIds, setServiceIds] = useState(appt.services.map((s) => s.serviceId));
  const [finalPrice, setFinalPrice] = useState<string>(appt.finalPrice?.toString() ?? "");
  const [adjust, setAdjust] = useState(appt.queue?.waitAdjustMinutes ?? 0);
  const [priority, setPriority] = useState(appt.queue?.priority ?? 0);
  const [pending, start] = useTransition();
  const servicesChanged = serviceIds.join() !== appt.services.map((s) => s.serviceId).join();
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Modifier — ${appt.customerName}`}
      footer={
        <button
          className="btn-gold btn-sm"
          disabled={pending || !serviceIds.length}
          onClick={() =>
            start(async () => {
              const res = await editAppointmentAction({
                appointmentId: appt.id,
                note,
                serviceIds: servicesChanged ? serviceIds : undefined,
                finalPrice: finalPrice === "" ? null : Number(finalPrice),
                ...(appt.queue ? { waitAdjustMinutes: adjust, priority } : {}),
              });
              toast(res.ok ? "success" : "error", res.ok ? "Modifications enregistrées" : res.message);
              if (res.ok) onSaved();
            })
          }
        >
          Enregistrer
        </button>
      }
    >
      <div className="grid gap-4">
        <div>
          <p className="label">Services</p>
          <ServicePicker services={services} value={serviceIds} onChange={setServiceIds} />
        </div>
        <Field label="Note client" htmlFor="ed-note">
          <textarea id="ed-note" className="field min-h-[70px]" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </Field>
        <Field label={`Total final (calculé : ${formatDH(appt.totalPrice)})`} htmlFor="ed-price" hint="Laisser vide pour utiliser le total calculé">
          <input id="ed-price" className="field" type="number" min={0} value={finalPrice} onChange={(e) => setFinalPrice(e.target.value)} />
        </Field>
        {appt.queue && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ajuster l'estimation (min)" htmlFor="ed-adj">
              <input id="ed-adj" className="field" type="number" min={-120} max={240} step={5} value={adjust} onChange={(e) => setAdjust(Number(e.target.value))} />
            </Field>
            <Field label="Priorité" htmlFor="ed-prio">
              <select id="ed-prio" className="field" value={priority} onChange={(e) => setPriority(Number(e.target.value))}>
                <option value={0}>Normale</option>
                <option value={1}>Prioritaire</option>
              </select>
            </Field>
          </div>
        )}
      </div>
    </Dialog>
  );
}
