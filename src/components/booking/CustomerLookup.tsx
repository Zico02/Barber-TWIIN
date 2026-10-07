"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Search, CalendarClock, XCircle, Phone, Star } from "lucide-react";
import {
  cancelBookingAction,
  lookupBookingAction,
  rescheduleBookingAction,
  submitReviewAction,
  updateBookingNoteAction,
} from "@/actions/booking";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { Field, Spinner, StatusBadge } from "@/components/ui";
import { whatsappLink } from "@/lib/domain/phone";
import { zonedParts } from "@/lib/domain/time";
import { Summary } from "./BookingWizard";
import { DateStrip, SlotGrid, type PickedSlot } from "./SlotPicker";
import { QrTicket } from "./QrTicket";

type Found = Extract<Awaited<ReturnType<typeof lookupBookingAction>>, { ok: true }>["data"];

export function CustomerLookup({ initialRef, today, shopPhone, shopWhatsapp }: { initialRef: string; today: string; shopPhone: string; shopWhatsapp: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const [reference, setReference] = useState(initialRef);
  const [phone, setPhone] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [reschedule, setReschedule] = useState(false);

  const creds = { reference: reference.trim().toUpperCase(), phone };
  const apply = (res: Awaited<ReturnType<typeof lookupBookingAction>>, successMsg?: string) => {
    if (res.ok) {
      setFound(res.data);
      setError(null);
      if (successMsg) toast("success", successMsg);
    } else {
      setError(res.message);
      toast("error", res.message);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => apply(await lookupBookingAction(creds)));
        }}
        className="card grid gap-4 p-6 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        <Field label={t.common.reference} htmlFor="lk-ref">
          <input id="lk-ref" className="field font-display uppercase tracking-widest" placeholder="BT-7K4Q2" value={reference} onChange={(e) => setReference(e.target.value)} required />
        </Field>
        <Field label={t.common.phone} htmlFor="lk-phone">
          <input id="lk-phone" className="field" type="tel" inputMode="tel" placeholder="06 12 34 56 78" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </Field>
        <button className="btn-gold h-[42px]" disabled={pending}>
          {pending ? <Spinner className="border-ink/30 border-t-ink" /> : <Search className="h-4 w-4" />} {t.lookup.find}
        </button>
      </form>
      {error && !found && <p className="mt-4 text-center text-sm text-bad">{error}</p>}

      {found && (
        <div className="card mt-8 animate-rise p-6 sm:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-ivory-muted">{t.common.reference}</p>
              <p className="font-display text-2xl tracking-[0.15em] text-gold-light">{found.appointment.reference}</p>
            </div>
            <StatusBadge status={found.appointment.status} label={t.status[found.appointment.status]} />
          </div>
          {found.appointment.startAt && (
            <Summary
              barber={found.barberName ?? "—"}
              services={found.appointment.services.map((s) => ({ name: s.name, price: s.price, duration: s.durationMinutes }))}
              start={found.appointment.startAt}
              duration={found.appointment.durationMinutes}
              price={found.appointment.finalPrice ?? found.appointment.totalPrice}
            />
          )}
          {found.appointment.startAt && found.barberName && ["pending", "confirmed", "late"].includes(found.appointment.status) && (
            <div className="mt-6">
              <QrTicket reference={found.appointment.reference} startAt={found.appointment.startAt} barberName={found.barberName} />
            </div>
          )}
          {found.appointment.status === "cancelled" && found.appointment.lateCancellation && <p className="mt-3 text-sm text-bad">{t.lookup.lateNotice}</p>}

          {!["completed", "cancelled", "no_show"].includes(found.appointment.status) && (
            <NoteEditor initial={found.appointment.note ?? ""} onSave={(note) => start(async () => apply(await updateBookingNoteAction({ ...creds, note }), t.lookup.noteSaved))} pending={pending} />
          )}

          <div className="mt-6 flex flex-wrap gap-2 border-t border-hair pt-6">
            {found.canReschedule && (
              <button className="btn-outline btn-sm" onClick={() => setReschedule(true)}>
                <CalendarClock className="h-4 w-4" /> {t.lookup.rescheduleBtn}
              </button>
            )}
            {found.canCancel && (
              <button className="btn btn-sm border border-bad/50 text-ivory hover:bg-bad/15" onClick={() => setConfirmCancel(true)}>
                <XCircle className="h-4 w-4" /> {t.lookup.cancelBtn}
              </button>
            )}
            <a href={`tel:${shopPhone}`} className="btn-ghost btn-sm">
              <Phone className="h-4 w-4" /> {t.common.call}
            </a>
            <a href={whatsappLink(shopWhatsapp, `Bonjour, à propos de ma réservation ${found.appointment.reference}`)} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">
              {t.lookup.contactShop}
            </a>
          </div>
          {found.canCancel && <p className="mt-3 text-xs text-ivory-dim">{fmt(t.booking.policy, { h: found.freeUntilHours })}</p>}

          {found.canReview && <ReviewForm creds={creds} />}
        </div>
      )}

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        danger
        pending={pending}
        title={t.lookup.cancelBtn}
        message={t.lookup.cancelConfirm}
        confirmLabel={t.lookup.cancelBtn}
        onConfirm={() =>
          start(async () => {
            apply(await cancelBookingAction(creds), t.lookup.cancelled);
            setConfirmCancel(false);
          })
        }
      />

      {found && found.appointment.barberId && (
        <RescheduleDialog
          open={reschedule}
          onClose={() => setReschedule(false)}
          today={today}
          barberId={found.appointment.barberId}
          serviceIds={found.serviceIds}
          appointmentId={found.appointment.id}
          initialDate={found.appointment.startAt ? zonedParts(new Date(found.appointment.startAt)).date : today}
          onConfirm={(slot) =>
            start(async () => {
              const res = await rescheduleBookingAction({ ...creds, startAt: slot.start });
              apply(res, t.lookup.rescheduled);
              if (res.ok) setReschedule(false);
            })
          }
          pending={pending}
        />
      )}
    </div>
  );
}

function NoteEditor({ initial, onSave, pending }: { initial: string; onSave: (n: string) => void; pending: boolean }) {
  const { t } = useI18n();
  const [note, setNote] = useState(initial);
  return (
    <div className="mt-6">
      <label className="label" htmlFor="lk-note">
        {t.common.note}
      </label>
      <textarea id="lk-note" className="field min-h-[80px]" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.booking.notePlaceholder} />
      <button className="btn-outline btn-sm mt-2" disabled={pending || note === initial} onClick={() => onSave(note)}>
        {t.lookup.updateNote}
      </button>
    </div>
  );
}

function RescheduleDialog(props: {
  open: boolean;
  onClose: () => void;
  today: string;
  barberId: string;
  serviceIds: string[];
  appointmentId: string;
  initialDate: string;
  onConfirm: (s: PickedSlot) => void;
  pending: boolean;
}) {
  const { t } = useI18n();
  const [date, setDate] = useState(props.initialDate < props.today ? props.today : props.initialDate);
  const [slot, setSlot] = useState<PickedSlot | null>(null);
  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      title={t.lookup.rescheduleBtn}
      size="lg"
      footer={
        <button className="btn-gold btn-sm" disabled={!slot || props.pending} onClick={() => slot && props.onConfirm(slot)}>
          {t.common.confirm}
        </button>
      }
    >
      <DateStrip today={props.today} value={date} onChange={(d) => { setDate(d); setSlot(null); }} />
      <div className="mt-6">
        <SlotGrid barberIds={[props.barberId]} date={date} serviceIds={props.serviceIds} value={slot?.start ?? null} onPick={setSlot} excludeAppointmentId={props.appointmentId} />
      </div>
    </Dialog>
  );
}

const AXES = ["barber", "quality", "waiting", "cleanliness", "overall"] as const;

function ReviewForm({ creds }: { creds: { reference: string; phone: string } }) {
  const { t } = useI18n();
  const toast = useToast();
  const [ratings, setRatings] = useState<Record<(typeof AXES)[number], number>>({ barber: 5, quality: 5, waiting: 5, cleanliness: 5, overall: 5 });
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  if (sent) return <p className="mt-8 rounded border border-ok/40 bg-ok-bg p-4 text-sm">{t.lookup.reviewThanks}</p>;
  return (
    <form
      className="mt-8 border-t border-hair pt-6"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await submitReviewAction({ ...creds, ratings, comment });
          if (res.ok) setSent(true);
          toast(res.ok ? "success" : "error", res.ok ? t.lookup.reviewThanks : res.message);
        });
      }}
    >
      <h3 className="font-serif text-2xl">{t.lookup.reviewTitle}</h3>
      <p className="text-sm text-ivory-muted">{t.lookup.reviewText}</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {AXES.map((axis) => (
          <div key={axis} className="flex items-center justify-between rounded border border-hair px-4 py-2.5">
            <span className="text-sm">{t.lookup.axes[axis]}</span>
            <span className="flex gap-0.5" role="radiogroup" aria-label={t.lookup.axes[axis]}>
              {[1, 2, 3, 4, 5].map((v) => (
                <button type="button" key={v} role="radio" aria-checked={ratings[axis] === v} onClick={() => setRatings((r) => ({ ...r, [axis]: v }))} aria-label={`${v}/5`}>
                  <Star className={clsx("h-5 w-5", v <= ratings[axis] ? "fill-gold text-gold" : "text-ivory-dim")} />
                </button>
              ))}
            </span>
          </div>
        ))}
      </div>
      <textarea className="field mt-4 min-h-[100px]" maxLength={600} required minLength={5} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t.lookup.reviewPlaceholder} />
      <button className="btn-gold btn-sm mt-3" disabled={pending}>
        {t.lookup.reviewSubmit}
      </button>
    </form>
  );
}

export function LookupLinks() {
  const { t } = useI18n();
  return (
    <p className="mt-8 text-center text-sm text-ivory-muted">
      <Link href="/reservation" className="text-gold hover:text-gold-light">
        {t.booking.another} →
      </Link>
    </p>
  );
}
