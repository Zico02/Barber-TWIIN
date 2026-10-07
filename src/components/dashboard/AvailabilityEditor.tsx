"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Plus, Trash2, Save, Ban, CalendarPlus, AlertTriangle } from "lucide-react";
import type { AvailabilityException, AvailabilityRule, BlockKind, BlockedPeriod, BreakPeriod } from "@/lib/domain/types";
import { addBlockAction, addExceptionAction, deleteBlockAction, deleteExceptionAction, saveWeeklyAvailabilityAction } from "@/actions/availability";
import { useI18n } from "@/lib/i18n/client";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui";
import { Panel } from "./common";
import { formatTime, zonedParts } from "@/lib/domain/time";
import { WhatsAppIcon } from "@/components/brand/SocialIcons";

type Day = { weekday: number; on: boolean; start: string; end: string; breaks: BreakPeriod[] };
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const KIND_LABEL: Record<BlockKind, string> = {
  day_off: "Jour de repos",
  time_block: "Plage bloquée",
  vacation: "Vacances",
  closure: "Fermeture exceptionnelle",
  break: "Pause",
};

export function AvailabilityEditor({
  barberId,
  rules,
  exceptions,
  blocks,
  today,
  canShopClosure,
}: {
  barberId: string;
  rules: AvailabilityRule[];
  exceptions: AvailabilityException[];
  blocks: BlockedPeriod[];
  today: string;
  canShopClosure: boolean;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [days, setDays] = useState<Day[]>(
    ORDER.map((wd) => {
      const r = rules.find((x) => x.weekday === wd);
      return { weekday: wd, on: !!r, start: r?.start ?? "10:00", end: r?.end ?? "20:00", breaks: r?.breaks ?? [] };
    }),
  );
  const update = (wd: number, patch: Partial<Day>) => setDays((d) => d.map((x) => (x.weekday === wd ? { ...x, ...patch } : x)));

  const saveWeek = () =>
    start(async () => {
      const r = await saveWeeklyAvailabilityAction({
        barberId,
        days: days.filter((d) => d.on).map(({ weekday, start, end, breaks }) => ({ weekday, start, end, breaks })),
      });
      toast(r.ok ? "success" : "error", r.ok ? "Horaires enregistrés" : r.message);
      if (r.ok) router.refresh();
    });

  // ── Block form ──
  const [kind, setKind] = useState<BlockKind>("time_block");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [startTime, setStartTime] = useState("13:00");
  const [endTime, setEndTime] = useState("14:00");
  const [reason, setReason] = useState("");
  const [shopWide, setShopWide] = useState(false);
  const [conflicts, setConflicts] = useState<{ id: string; customerName: string; startAt: string; services: string }[] | null>(null);
  const [notices, setNotices] = useState<{ customerName: string; url: string | null }[]>([]);
  const ranged = kind === "time_block" || kind === "break";

  const submitBlock = (confirmCancellations: boolean) =>
    start(async () => {
      const r = await addBlockAction({
        barberId: shopWide ? null : barberId,
        kind: shopWide ? "closure" : kind,
        startDate,
        endDate: ranged ? startDate : endDate,
        startTime: ranged ? startTime : undefined,
        endTime: ranged ? endTime : undefined,
        reason: reason || undefined,
        confirmCancellations,
      });
      if (!r.ok && r.code === "CONFLICTS") {
        setConflicts((r.data as { affected: typeof conflicts }).affected);
        return;
      }
      setConflicts(null);
      toast(r.ok ? "success" : "error", r.ok ? (r.data.cancelled.length ? `Période bloquée — ${r.data.cancelled.length} RDV annulé(s)` : "Période bloquée") : r.message);
      if (r.ok) {
        setNotices(r.data.cancelled);
        setReason("");
        router.refresh();
      }
    });

  // ── Exceptions ──
  const [exDate, setExDate] = useState(today);
  const [exStart, setExStart] = useState("10:00");
  const [exEnd, setExEnd] = useState("16:00");
  const [exNote, setExNote] = useState("");

  const fmtRange = (b: BlockedPeriod) => {
    const s = zonedParts(new Date(b.startAt));
    const e = zonedParts(new Date(new Date(b.endAt).getTime() - 1));
    const d = (x: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${x}T12:00:00Z`));
    if (b.kind === "time_block" || b.kind === "break") return `${d(s.date)} · ${formatTime(b.startAt)} – ${formatTime(b.endAt)}`;
    return s.date === e.date ? d(s.date) : `${d(s.date)} → ${d(e.date)}`;
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <Panel
        title="Semaine type"
        action={
          <button className="btn-gold btn-sm" onClick={saveWeek} disabled={pending}>
            <Save className="h-4 w-4" /> {t.common.save}
          </button>
        }
      >
        <ul className="divide-y divide-hair">
          {days.map((d) => (
            <li key={d.weekday} className="py-4">
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex w-32 items-center gap-2 text-sm">
                  <input type="checkbox" checked={d.on} onChange={(e) => update(d.weekday, { on: e.target.checked })} className="h-4 w-4 accent-[#C99A35]" />
                  <span className={d.on ? "text-ivory" : "text-ivory-dim"}>{t.days[d.weekday]}</span>
                </label>
                {d.on ? (
                  <>
                    <input type="time" className="field w-auto py-1.5" value={d.start} onChange={(e) => update(d.weekday, { start: e.target.value })} aria-label="Début" />
                    <span className="text-ivory-dim">→</span>
                    <input type="time" className="field w-auto py-1.5" value={d.end} onChange={(e) => update(d.weekday, { end: e.target.value })} aria-label="Fin" />
                    <button className="btn-ghost btn-sm" onClick={() => update(d.weekday, { breaks: [...d.breaks, { start: "13:00", end: "14:00", label: "Déjeuner" }] })}>
                      <Plus className="h-3.5 w-3.5" /> Pause
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-ivory-dim">Repos</span>
                )}
              </div>
              {d.on && d.breaks.length > 0 && (
                <ul className="mt-3 space-y-2 ps-32">
                  {d.breaks.map((b, i) => (
                    <li key={i} className="flex flex-wrap items-center gap-2 text-xs">
                      <select className="field w-auto py-1 text-xs" value={b.label ?? "Pause"} onChange={(e) => update(d.weekday, { breaks: d.breaks.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}>
                        {["Déjeuner", "Prière", "Prière & déjeuner", "Pause"].map((l) => (
                          <option key={l}>{l}</option>
                        ))}
                      </select>
                      <input type="time" className="field w-auto py-1 text-xs" value={b.start} onChange={(e) => update(d.weekday, { breaks: d.breaks.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)) })} />
                      <span className="text-ivory-dim">→</span>
                      <input type="time" className="field w-auto py-1 text-xs" value={b.end} onChange={(e) => update(d.weekday, { breaks: d.breaks.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)) })} />
                      <button className="text-ivory-dim hover:text-bad" onClick={() => update(d.weekday, { breaks: d.breaks.filter((_, j) => j !== i) })} aria-label="Supprimer la pause">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      <div className="space-y-6">
        <Panel title="Bloquer du temps">
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-1">
              {(["time_block", "day_off", "vacation", "break"] as BlockKind[]).map((k) => (
                <button key={k} onClick={() => setKind(k)} className={clsx("rounded-sm border px-2.5 py-1.5 text-xs", kind === k && !shopWide ? "border-gold bg-gold/10 text-gold-light" : "border-hair text-ivory-muted")}>
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={ranged ? "Date" : "Du"} htmlFor="bl-sd">
                <input id="bl-sd" type="date" min={today} className="field" value={startDate} onChange={(e) => { setStartDate(e.target.value); if (e.target.value > endDate) setEndDate(e.target.value); }} />
              </Field>
              {ranged ? (
                <div className="grid grid-cols-2 gap-2">
                  <Field label="De" htmlFor="bl-st">
                    <input id="bl-st" type="time" className="field px-2" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                  </Field>
                  <Field label="À" htmlFor="bl-et">
                    <input id="bl-et" type="time" className="field px-2" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                  </Field>
                </div>
              ) : (
                <Field label="Au" htmlFor="bl-ed">
                  <input id="bl-ed" type="date" min={startDate} className="field" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </Field>
              )}
            </div>
            <Field label="Motif (facultatif)" htmlFor="bl-r">
              <input id="bl-r" className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Rendez-vous médical, formation…" />
            </Field>
            {canShopClosure && (
              <label className="flex items-center gap-2 text-xs text-ivory-muted">
                <input type="checkbox" checked={shopWide} onChange={(e) => setShopWide(e.target.checked)} className="accent-[#C99A35]" /> Fermeture de tout le salon
              </label>
            )}
            <button className="btn-outline" disabled={pending} onClick={() => submitBlock(false)}>
              <Ban className="h-4 w-4" /> Bloquer
            </button>
          </div>
          {notices.length > 0 && (
            <div className="mt-4 rounded border border-gold/30 bg-gold/[0.05] p-3 text-xs">
              <p className="mb-2 text-gold-light">Prévenir les clients annulés :</p>
              <ul className="space-y-1">
                {notices.map((n) => (
                  <li key={n.customerName} className="flex items-center justify-between">
                    {n.customerName}
                    {n.url && (
                      <a href={n.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-gold hover:text-gold-light">
                        <WhatsAppIcon className="h-3.5 w-3.5" /> Envoyer
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>

        <Panel title="Périodes bloquées à venir">
          {blocks.length === 0 ? (
            <p className="text-sm text-ivory-dim">Aucune.</p>
          ) : (
            <ul className="divide-y divide-hair">
              {blocks.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span>
                    <span className="block text-ivory">{fmtRange(b)}</span>
                    <span className="text-xs text-ivory-muted">
                      {KIND_LABEL[b.kind]}
                      {b.barberId === null ? " · tout le salon" : ""}
                      {b.reason ? ` · ${b.reason}` : ""}
                    </span>
                  </span>
                  <button
                    className="text-ivory-dim hover:text-bad"
                    aria-label="Débloquer"
                    onClick={() =>
                      start(async () => {
                        const r = await deleteBlockAction(b.id);
                        toast(r.ok ? "success" : "error", r.ok ? "Période débloquée" : r.message);
                        router.refresh();
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Disponibilité exceptionnelle">
          <div className="grid grid-cols-[1fr_auto_auto] items-end gap-2">
            <Field label="Date" htmlFor="ex-d">
              <input id="ex-d" type="date" min={today} className="field" value={exDate} onChange={(e) => setExDate(e.target.value)} />
            </Field>
            <Field label="De" htmlFor="ex-s">
              <input id="ex-s" type="time" className="field px-2" value={exStart} onChange={(e) => setExStart(e.target.value)} />
            </Field>
            <Field label="À" htmlFor="ex-e">
              <input id="ex-e" type="time" className="field px-2" value={exEnd} onChange={(e) => setExEnd(e.target.value)} />
            </Field>
          </div>
          <input className="field mt-2" placeholder="Note (ex. ouverture veille de l'Aïd)" value={exNote} onChange={(e) => setExNote(e.target.value)} />
          <button
            className="btn-outline mt-3 w-full"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await addExceptionAction({ barberId, date: exDate, start: exStart, end: exEnd, note: exNote || undefined });
                toast(r.ok ? "success" : "error", r.ok ? "Disponibilité ajoutée" : r.message);
                router.refresh();
              })
            }
          >
            <CalendarPlus className="h-4 w-4" /> Ajouter
          </button>
          {exceptions.length > 0 && (
            <ul className="mt-4 divide-y divide-hair text-sm">
              {exceptions.map((e) => (
                <li key={e.id} className="flex items-center justify-between py-2">
                  <span>
                    {e.date} · {e.start} – {e.end}
                    {e.note && <span className="block text-xs text-ivory-dim">{e.note}</span>}
                  </span>
                  <button
                    className="text-ivory-dim hover:text-bad"
                    aria-label="Supprimer"
                    onClick={() =>
                      start(async () => {
                        const r = await deleteExceptionAction({ id: e.id, barberId });
                        toast(r.ok ? "success" : "error", r.ok ? "Exception supprimée" : r.message);
                        router.refresh();
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <ConfirmDialog
        open={!!conflicts}
        onClose={() => setConflicts(null)}
        danger
        pending={pending}
        title="Réservations concernées"
        confirmLabel={`Bloquer et annuler ${conflicts?.length ?? 0} RDV`}
        message={
          <span className="flex gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-bad" /> Cette période contient des rendez-vous confirmés. Ils seront annulés et les créneaux libérés.
          </span>
        }
        onConfirm={() => submitBlock(true)}
      >
        <ul className="mt-4 divide-y divide-hair rounded border border-hair text-sm">
          {conflicts?.map((c) => (
            <li key={c.id} className="px-3 py-2">
              <span className="text-ivory">{c.customerName}</span>
              <span className="block text-xs text-ivory-muted">
                {new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Casablanca" }).format(new Date(c.startAt))} · {formatTime(c.startAt)} · {c.services}
              </span>
            </li>
          ))}
        </ul>
      </ConfirmDialog>
    </div>
  );
}
