"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, XCircle, Phone, Ban, MessageSquare } from "lucide-react";
import type { Appointment, BlockedPeriod } from "@/lib/domain/types";
import { formatTime, formatDuration, zonedParts } from "@/lib/domain/time";
import { formatDH } from "@/lib/domain/pricing";
import { changeStatusAction, prepareMessageAction, rescheduleStaffAction } from "@/actions/queue";
import { useI18n } from "@/lib/i18n/client";
import { useToast } from "@/components/ui/Toast";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import { EmptyState, StatusBadge } from "@/components/ui";
import { DateStrip, SlotGrid, type PickedSlot } from "@/components/booking/SlotPicker";

export function AgendaDay({
  date,
  today,
  barbers,
  appointments,
  blocks,
}: {
  date: string;
  today: string;
  barbers: { id: string; name: string }[];
  appointments: Appointment[];
  blocks: BlockedPeriod[];
}) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [moving, setMoving] = useState<Appointment | null>(null);
  const [cancelling, setCancelling] = useState<Appointment | null>(null);

  return (
    <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
      {barbers.map((b) => {
        const list = appointments.filter((a) => a.barberId === b.id).sort((x, y) => x.startAt!.localeCompare(y.startAt!));
        const myBlocks = blocks.filter((x) => x.barberId === b.id || x.barberId === null);
        const active = list.filter((a) => !["cancelled", "no_show"].includes(a.status));
        return (
          <section key={b.id} className="card overflow-hidden">
            <header className="flex items-center justify-between border-b border-hair px-5 py-4">
              <h2 className="font-serif text-2xl">{b.name}</h2>
              <span className="text-xs text-ivory-muted">
                {active.length} RDV · {formatDuration(active.reduce((s, a) => s + a.durationMinutes, 0))}
              </span>
            </header>
            {myBlocks.length > 0 && (
              <ul className="border-b border-hair bg-bad-bg/40 px-5 py-2 text-xs text-ivory-muted">
                {myBlocks.map((x) => (
                  <li key={x.id} className="flex items-center gap-2 py-1">
                    <Ban className="h-3.5 w-3.5 text-bad" />
                    {zonedParts(new Date(x.startAt)).date === date ? formatTime(x.startAt) : "…"} – {zonedParts(new Date(x.endAt)).date === date ? formatTime(x.endAt) : "…"} · {x.reason ?? x.kind}
                  </li>
                ))}
              </ul>
            )}
            {list.length === 0 ? (
              <div className="p-5">
                <EmptyState title="Aucun rendez-vous" />
              </div>
            ) : (
              <ul className="divide-y divide-hair">
                {list.map((a) => (
                  <li key={a.id} className={`grid grid-cols-[64px_1fr] gap-3 px-5 py-4 ${["cancelled", "no_show"].includes(a.status) ? "opacity-50" : ""}`}>
                    <div>
                      <p className="font-display text-lg text-gold-light">{formatTime(a.startAt!)}</p>
                      <p className="text-[11px] text-ivory-dim">{formatTime(a.endAt!)}</p>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-ivory">{a.customerName}</p>
                        <StatusBadge status={a.status} label={t.status[a.status]} />
                      </div>
                      <p className="text-xs text-ivory-muted">
                        {a.services.map((s) => s.name).join(" + ")} · {formatDH(a.finalPrice ?? a.totalPrice)} · {a.reference}
                      </p>
                      {a.note && <p className="mt-1 text-xs italic text-ivory-dim">« {a.note} »</p>}
                      {a.lateCancellation && <p className="mt-1 text-xs text-bad">Annulation tardive</p>}
                      {["pending", "confirmed"].includes(a.status) && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          <button className="btn-ghost btn-sm px-2 py-1 text-[11px]" onClick={() => setMoving(a)}>
                            <CalendarClock className="h-3.5 w-3.5" /> Déplacer
                          </button>
                          <button className="btn-ghost btn-sm px-2 py-1 text-[11px] hover:text-bad" onClick={() => setCancelling(a)}>
                            <XCircle className="h-3.5 w-3.5" /> Annuler
                          </button>
                          {a.customerPhone && (
                            <>
                              <a href={`tel:${a.customerPhone}`} className="btn-ghost btn-sm px-2 py-1 text-[11px]">
                                <Phone className="h-3.5 w-3.5" /> Appeler
                              </a>
                              <button
                                className="btn-ghost btn-sm px-2 py-1 text-[11px]"
                                onClick={() =>
                                  start(async () => {
                                    const r = await prepareMessageAction({ appointmentId: a.id, template: "appointment_reminder", channel: "whatsapp" });
                                    if (r.ok) window.open(r.data.url, "_blank", "noopener");
                                    else toast("error", r.message);
                                  })
                                }
                              >
                                <MessageSquare className="h-3.5 w-3.5" /> Rappel
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      {moving && <MoveDialog appt={moving} today={today} initialDate={date} onClose={() => setMoving(null)} onDone={() => { setMoving(null); router.refresh(); }} />}
      <ConfirmDialog
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        danger
        pending={pending}
        title="Annuler le rendez-vous"
        message={cancelling ? `${cancelling.customerName} — ${formatTime(cancelling.startAt!)}. Le créneau redeviendra disponible.` : ""}
        confirmLabel="Annuler le RDV"
        onConfirm={() =>
          start(async () => {
            const r = await changeStatusAction({ appointmentId: cancelling!.id, status: "cancelled", reason: "Annulée par le salon" });
            toast(r.ok ? "success" : "error", r.ok ? "Rendez-vous annulé — créneau libéré" : r.message);
            setCancelling(null);
            router.refresh();
          })
        }
      />
    </div>
  );
}

function MoveDialog({ appt, today, initialDate, onClose, onDone }: { appt: Appointment; today: string; initialDate: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [date, setDate] = useState(initialDate < today ? today : initialDate);
  const [slot, setSlot] = useState<PickedSlot | null>(null);
  const [pending, start] = useTransition();
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Déplacer — ${appt.customerName}`}
      size="lg"
      footer={
        <button
          className="btn-gold btn-sm"
          disabled={!slot || pending}
          onClick={() =>
            start(async () => {
              const r = await rescheduleStaffAction({ appointmentId: appt.id, startAt: slot!.start });
              toast(r.ok ? "success" : "error", r.ok ? "Rendez-vous déplacé" : r.message);
              if (r.ok) onDone();
            })
          }
        >
          Confirmer
        </button>
      }
    >
      <DateStrip today={today} value={date} onChange={(d) => { setDate(d); setSlot(null); }} />
      <div className="mt-5">
        <SlotGrid barberIds={[appt.barberId!]} date={date} serviceIds={appt.services.map((s) => s.serviceId)} value={slot?.start ?? null} onPick={setSlot} excludeAppointmentId={appt.id} />
      </div>
    </Dialog>
  );
}
