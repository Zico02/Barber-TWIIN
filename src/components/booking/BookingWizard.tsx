"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Check, ChevronLeft, ArrowRight, Clock, ImagePlus, X, CalendarPlus, Users } from "lucide-react";
import type { Barber, Service } from "@/lib/domain/types";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n";
import { formatDH, formatServicePrice, barbersForServices, serviceDuration } from "@/lib/domain/pricing";
import { addMinutes, formatDateLong, formatDuration, formatTime } from "@/lib/domain/time";
import { normalizePhone, whatsappLink } from "@/lib/domain/phone";
import { createBookingAction } from "@/actions/booking";
import { useToast } from "@/components/ui/Toast";
import { Field, Spinner } from "@/components/ui";
import { ServiceIcon } from "@/components/brand/ServiceIcon";
import { BarberPortrait } from "@/components/site/cards";
import { Ornament } from "@/components/brand/Logo";
import { DateStrip, SlotGrid, type PickedSlot } from "./SlotPicker";
import { QrTicket } from "./QrTicket";

type Step = 0 | 1 | 2 | 3 | 4;
const ANY = "any";

interface Props {
  services: Service[];
  barbers: Barber[];
  workingDays: Record<string, number[]>;
  today: string;
  maxDaysAhead: number;
  freeUntilHours: number;
  initial: { serviceIds: string[]; barberId: string | null; date: string | null };
}

type Success = Extract<Awaited<ReturnType<typeof createBookingAction>>, { ok: true }>["data"];

export function BookingWizard({ services, barbers, workingDays, today, maxDaysAhead, freeUntilHours, initial }: Props) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [pending, start] = useTransition();

  const [serviceIds, setServiceIds] = useState<string[]>(initial.serviceIds);
  const [barberId, setBarberId] = useState<string | null>(initial.barberId);
  const [date, setDate] = useState<string>(initial.date ?? today);
  const [slot, setSlot] = useState<PickedSlot | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [inspiration, setInspiration] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [done, setDone] = useState<Success | null>(null);

  const initialStep: Step = initial.serviceIds.length ? (initial.barberId ? 2 : 1) : 0;
  const [step, setStep] = useState<Step>(initialStep);

  const eligible = useMemo(() => barbersForServices(barbers, serviceIds), [barbers, serviceIds]);
  const effectiveBarber = slot ? barbers.find((b) => b.id === slot.barberId) : barbers.find((b) => b.id === barberId) ?? null;
  const chosen = services.filter((s) => serviceIds.includes(s.id));
  const totalPrice = chosen.reduce((s, x) => s + x.price, 0);
  const totalDuration = chosen.reduce((s, x) => s + serviceDuration(x, effectiveBarber), 0);
  const barberNames = Object.fromEntries(barbers.map((b) => [b.id, b.name]));
  const slotBarbers = barberId === ANY || !barberId ? eligible.map((b) => b.id) : [barberId];

  const isOff = (d: string) => {
    const wd = new Date(`${d}T12:00:00Z`).getUTCDay();
    return !slotBarbers.some((id) => workingDays[id]?.includes(wd));
  };

  const toggleService = (id: string) => {
    setServiceIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
    setSlot(null);
  };

  const validateInfo = () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = "Nom trop court";
    if (!normalizePhone(phone)) e.phone = t.booking.invalidPhone;
    if (email && !/^\S+@\S+\.\S+$/.test(email)) e.email = "E-mail invalide";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const canNext: Record<Step, boolean> = {
    0: serviceIds.length > 0,
    1: !!barberId && (barberId === ANY ? eligible.length > 0 : eligible.some((b) => b.id === barberId)),
    2: !!slot,
    3: true,
    4: true,
  };

  const next = () => {
    if (step === 3 && !validateInfo()) return;
    if (canNext[step]) setStep((s) => Math.min(4, s + 1) as Step);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const back = () => setStep((s) => Math.max(0, s - 1) as Step);

  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(f.type)) return toast("error", "Format d'image non supporté (JPG, PNG, WebP).");
    if (f.size > 1.5 * 1024 * 1024) return toast("error", t.booking.inspirationHint);
    const reader = new FileReader();
    reader.onload = () => setInspiration(String(reader.result));
    reader.readAsDataURL(f);
  };

  const confirm = () =>
    start(async () => {
      if (!slot) return;
      const res = await createBookingAction({
        barberId: slot.barberId,
        serviceIds,
        startAt: slot.start,
        name,
        phone,
        email,
        note,
        inspirationUrl: inspiration ?? undefined,
        website: honeypot,
      });
      if (res.ok) {
        setDone(res.data);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        toast("error", res.code === "SLOT_TAKEN" ? t.booking.slotTaken : res.message);
        if (res.code === "SLOT_TAKEN" || res.code === "BARBER_UNAVAILABLE") {
          setSlot(null);
          setRefreshKey((k) => k + 1);
          setStep(2);
        }
      }
    });

  if (done) return <BookingSuccess data={done} />;

  const steps = t.booking.steps;
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div>
        {/* Progress */}
        <ol className="mb-8 flex items-center gap-1 overflow-x-auto pb-1" aria-label="Étapes">
          {steps.map((label, i) => (
            <li key={label} className="flex flex-1 items-center gap-1">
              <button
                onClick={() => i < step && setStep(i as Step)}
                disabled={i > step}
                className={clsx("flex min-w-0 items-center gap-2 text-xs", i <= step ? "text-gold-light" : "text-ivory-dim")}
                aria-current={i === step ? "step" : undefined}
              >
                <span
                  className={clsx(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                    i < step ? "border-gold bg-gold text-ink" : i === step ? "border-gold text-gold-light" : "border-hair",
                  )}
                >
                  {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className="hidden truncate xl:inline">{label}</span>
              </button>
              {i < steps.length - 1 && <span className={clsx("h-px flex-1", i < step ? "bg-gold/70" : "bg-hair")} />}
            </li>
          ))}
        </ol>

        <div className="card min-h-[420px] p-5 sm:p-8">
          {step === 0 && (
            <StepWrap title={t.booking.chooseServices}>
              <ul className="grid gap-3 sm:grid-cols-2">
                {services.map((s) => {
                  const on = serviceIds.includes(s.id);
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => toggleService(s.id)}
                        aria-pressed={on}
                        className={clsx("flex w-full items-center gap-4 rounded border p-4 text-start transition", on ? "border-gold bg-gold/[0.07]" : "border-hair hover:border-line")}
                      >
                        <span className={clsx("flex h-10 w-10 shrink-0 items-center justify-center rounded-full border", on ? "border-gold bg-gold text-ink" : "border-line text-gold")}>
                          {on ? <Check className="h-5 w-5" /> : <ServiceIcon name={s.icon} className="h-5 w-5" />}
                        </span>
                        <span className="flex-1">
                          <span className="block font-serif text-xl leading-tight">{s.name}</span>
                          <span className="text-xs text-ivory-muted">{formatDuration(s.durationMinutes)}</span>
                        </span>
                        <span className="font-serif text-xl text-gold-metal">{formatServicePrice(s, t.common.from)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </StepWrap>
          )}

          {step === 1 && (
            <StepWrap title={t.booking.chooseBarber} hint={t.booking.barberFilterNote}>
              {eligible.length === 0 ? (
                <p className="rounded border border-bad/40 bg-bad-bg p-4 text-sm text-ivory">{t.booking.noBarber}</p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  <li>
                    <button
                      onClick={() => { setBarberId(ANY); setSlot(null); }}
                      aria-pressed={barberId === ANY}
                      className={clsx("flex h-full w-full items-center gap-4 rounded border p-4 text-start transition", barberId === ANY ? "border-gold bg-gold/[0.07]" : "border-hair hover:border-line")}
                    >
                      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-line text-gold">
                        <Users className="h-6 w-6" />
                      </span>
                      <span>
                        <span className="block font-serif text-xl">{t.common.anyBarber}</span>
                        <span className="text-xs text-ivory-muted">Le premier barbier disponible</span>
                      </span>
                    </button>
                  </li>
                  {eligible.map((b) => (
                    <li key={b.id}>
                      <button
                        onClick={() => { setBarberId(b.id); setSlot(null); }}
                        aria-pressed={barberId === b.id}
                        className={clsx("flex h-full w-full items-center gap-4 rounded border p-4 text-start transition", barberId === b.id ? "border-gold bg-gold/[0.07]" : "border-hair hover:border-line")}
                      >
                        <BarberPortrait barber={b} rounded className="h-16 w-16 shrink-0" />
                        <span>
                          <span className="block font-serif text-xl">{b.name}</span>
                          <span className="text-xs text-ivory-muted">{b.specialties.slice(0, 2).join(" · ")}</span>
                          <span className="mt-1 block text-xs text-gold">★ {b.rating.toFixed(1)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </StepWrap>
          )}

          {step === 2 && (
            <StepWrap title={t.booking.chooseDate}>
              <DateStrip today={today} days={Math.min(21, maxDaysAhead + 1)} value={date} onChange={(d) => { setDate(d); setSlot(null); }} isOff={isOff} />
              <p className="mt-6 font-serif text-2xl first-letter:uppercase text-gold-light">
                {new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`))}
              </p>
            </StepWrap>
          )}

          {step === 2 && (
            <StepWrap title={t.booking.chooseTime} hint={`${formatDuration(totalDuration)} · ${new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`))}`}>
              <SlotGrid barberIds={slotBarbers} date={date} serviceIds={serviceIds} value={slot?.start ?? null} onPick={setSlot} refreshKey={refreshKey} barberNames={barberNames} />
              {slot && slotBarbers.length > 1 && (
                <p className="mt-4 text-sm text-ivory-muted">
                  {t.common.barber} : <span className="text-gold-light">{barberNames[slot.barberId]}</span>
                </p>
              )}
            </StepWrap>
          )}

          {step === 3 && (
            <StepWrap title={t.booking.yourInfo}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label={t.common.name} error={errors.name} htmlFor="bk-name">
                    <input id="bk-name" className="field" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.booking.namePlaceholder} />
                  </Field>
                </div>
                <Field label={t.common.phone} error={errors.phone} htmlFor="bk-phone" hint="06 / 07 / +212…">
                  <input id="bk-phone" className="field" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t.booking.phonePlaceholder} />
                </Field>
                <Field label={`${t.common.email} (${t.common.optional})`} error={errors.email} htmlFor="bk-email">
                  <input id="bk-email" className="field" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </Field>
                {/* Honeypot (bots fill it, humans never see it) */}
                <input tabIndex={-1} autoComplete="off" className="hidden" aria-hidden value={honeypot} onChange={(e) => setHoneypot(e.target.value)} name="website" />
              </div>
            </StepWrap>
          )}

          {step === 3 && (
            <StepWrap title={t.booking.noteTitle}>
              <div className="mb-3 flex flex-wrap gap-2">
                {t.booking.noteExamples.map((ex) => (
                  <button key={ex} onClick={() => setNote((n) => (n ? `${n}, ${ex}` : ex))} className="rounded-sm border border-hair px-3 py-1.5 text-xs text-ivory-muted hover:border-gold hover:text-gold-light">
                    + {ex}
                  </button>
                ))}
              </div>
              <textarea className="field min-h-[120px]" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.booking.notePlaceholder} />
              <p className="mt-1 text-end text-xs text-ivory-dim">{note.length}/500</p>
              <div className="mt-5">
                <p className="label">{t.booking.inspiration}</p>
                {inspiration ? (
                  <div className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={inspiration} alt="Inspiration" className="h-32 w-32 rounded border border-line object-cover" />
                    <button onClick={() => setInspiration(null)} className="absolute -end-2 -top-2 rounded-full border border-line bg-ink p-1 text-ivory-muted hover:text-bad" aria-label="Retirer">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-center gap-3 rounded border border-dashed border-line px-4 py-4 text-sm text-ivory-muted hover:border-gold hover:text-gold-light">
                    <ImagePlus className="h-5 w-5 text-gold" />
                    <span>{t.booking.inspirationHint}</span>
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
                  </label>
                )}
              </div>
            </StepWrap>
          )}

          {step === 4 && slot && (
            <StepWrap title={t.booking.review}>
              <Summary
                barber={barberNames[slot.barberId]!}
                services={chosen.map((s) => ({ name: s.name, price: s.price, duration: serviceDuration(s, effectiveBarber) }))}
                start={slot.start}
                duration={totalDuration}
                price={totalPrice}
                note={note}
                customer={`${name} · ${phone}`}
              />
              <p className="mt-4 text-xs text-ivory-dim">{fmt(t.booking.policy, { h: freeUntilHours })}</p>
            </StepWrap>
          )}

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between gap-3 border-t border-hair pt-6">
            <button onClick={back} disabled={step === 0} className="btn-ghost">
              <ChevronLeft className="h-4 w-4 rtl:-scale-x-100" /> {t.common.back}
            </button>
            {step < 4 ? (
              <button onClick={next} disabled={!canNext[step]} className="btn-gold px-8">
                {t.common.next} <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
              </button>
            ) : (
              <button onClick={confirm} disabled={pending || !slot} className="btn-gold px-8">
                {pending ? <Spinner className="border-ink/30 border-t-ink" /> : <Check className="h-4 w-4" />}
                {pending ? t.booking.confirming : t.booking.confirmBtn}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Live summary */}
      <aside className="lg:sticky lg:top-28 lg:self-start">
        <div className="card p-6">
          <p className="eyebrow">{t.booking.review}</p>
          <ul className="mt-4 space-y-2 text-sm">
            {chosen.length === 0 && <li className="text-ivory-dim">—</li>}
            {chosen.map((s) => (
              <li key={s.id} className="flex justify-between gap-3">
                <span>{s.name}</span>
                <span className="text-ivory-muted">{formatServicePrice(s, t.common.from)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-5 space-y-2 border-t border-hair pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-ivory-muted">{t.common.barber}</dt>
              <dd>{slot ? barberNames[slot.barberId] : barberId === ANY ? t.common.anyBarber : barberId ? barberNames[barberId] : "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ivory-muted">{t.common.date}</dt>
              <dd className="first-letter:uppercase">{slot ? `${formatDateLong(slot.start, locale)} · ${formatTime(slot.start)}` : "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="flex items-center gap-1.5 text-ivory-muted">
                <Clock className="h-3.5 w-3.5" /> {t.booking.totalDuration}
              </dt>
              <dd>{totalDuration ? formatDuration(totalDuration) : "—"}</dd>
            </div>
          </dl>
          <div className="mt-5 flex items-baseline justify-between border-t border-hair pt-4">
            <span className="text-xs uppercase tracking-[0.2em] text-ivory-muted">{t.booking.totalPrice}</span>
            <span className="font-serif text-4xl text-gold-metal">
              {chosen.some((x) => x.priceFrom) && <span className="me-1 text-base text-ivory-muted">{t.common.from}</span>}
              {formatDH(totalPrice)}
            </span>
          </div>
        </div>
      </aside>
    </div>
  );
}

function StepWrap({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="animate-rise [&:not(:first-child)]:mt-10 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-hair [&:not(:first-child)]:pt-8">
      <h2 className="font-serif text-3xl">{title}</h2>
      {hint && <p className="mt-1 text-sm first-letter:uppercase text-ivory-muted">{hint}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

export function Summary({
  barber,
  services,
  start,
  duration,
  price,
  note,
  customer,
}: {
  barber: string;
  services: { name: string; price: number; duration: number }[];
  start: string;
  duration: number;
  price: number;
  note?: string | null;
  customer?: string;
}) {
  const { t, locale } = useI18n();
  const rows: [string, React.ReactNode][] = [
    [t.common.barber, barber],
    [t.common.services, services.map((s) => `${s.name} (${s.duration} min)`).join(", ")],
    [t.common.date, <span key="d" className="first-letter:uppercase">{formatDateLong(start, locale)}</span>],
    [t.booking.start, formatTime(start)],
    [t.booking.end, formatTime(addMinutes(new Date(start), duration))],
    [t.booking.totalDuration, formatDuration(duration)],
  ];
  if (customer) rows.push([t.booking.yourInfo, customer]);
  if (note) rows.push([t.common.note, note]);
  return (
    <dl className="divide-y divide-hair rounded border border-hair">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[130px_1fr] gap-3 px-4 py-3 text-sm sm:grid-cols-[170px_1fr]">
          <dt className="text-ivory-muted">{k}</dt>
          <dd className="text-ivory">{v}</dd>
        </div>
      ))}
      <div className="flex items-baseline justify-between bg-gold/[0.05] px-4 py-4">
        <dt className="text-xs uppercase tracking-[0.2em] text-gold">{t.booking.totalPrice}</dt>
        <dd className="font-serif text-3xl text-gold-metal">{formatDH(price)}</dd>
      </div>
    </dl>
  );
}

function icsFor(data: Success) {
  const stamp = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Barber TWIIN//FR",
    "BEGIN:VEVENT",
    `UID:${data.reference}@barbertwiin`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(data.startAt)}`,
    `DTEND:${stamp(data.endAt)}`,
    `SUMMARY:Barber TWIIN — ${data.barberName}`,
    `DESCRIPTION:${data.services.map((s) => s.name).join(", ")} · Réf. ${data.reference}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function BookingSuccess({ data }: { data: Success }) {
  const { t, locale } = useI18n();
  const ics = `data:text/calendar;charset=utf-8,${encodeURIComponent(icsFor(data))}`;
  return (
    <div className="mx-auto max-w-2xl animate-rise text-center">
      <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-gold bg-gold/10 text-gold-light shadow-gold">
        <Check className="h-9 w-9" />
      </span>
      <h2 className="mt-6 font-serif text-4xl sm:text-5xl">{t.booking.confirmed}</h2>
      <p className="mx-auto mt-4 max-w-lg text-ivory-muted">
        {fmt(t.booking.confirmedText, {
          name: data.customerName.split(" ")[0]!,
          barber: data.barberName,
          date: formatDateLong(data.startAt, locale),
          time: formatTime(data.startAt),
        })}
      </p>
      <div className="mx-auto mt-8 max-w-xs">
        <QrTicket reference={data.reference} startAt={data.startAt} barberName={data.barberName} />
      </div>
      <p className="mx-auto mt-4 max-w-md text-xs text-ivory-dim">{t.booking.keepRef}</p>
      <Ornament className="my-8" />
      <div className="text-start">
        <Summary
          barber={data.barberName}
          services={data.services.map((s) => ({ name: s.name, price: s.price, duration: s.durationMinutes }))}
          start={data.startAt}
          duration={data.durationMinutes}
          price={data.totalPrice}
        />
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <a href={ics} download={`barber-twiin-${data.reference}.ics`} className="btn-outline">
          <CalendarPlus className="h-4 w-4" /> Ajouter au calendrier
        </a>
        <a href={whatsappLink(data.shopWhatsapp, data.message)} target="_blank" rel="noopener noreferrer" className="btn-outline">
          {t.booking.whatsappMe}
        </a>
        <Link href={`/ma-reservation?ref=${data.reference}`} className="btn-gold">
          {t.booking.manage}
        </Link>
      </div>
    </div>
  );
}
