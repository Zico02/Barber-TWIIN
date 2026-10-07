import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { getRepo } from "@/lib/repo";
import { can } from "@/lib/domain/permissions";
import { renderTemplate, TEMPLATE_KEYS } from "@/lib/domain/notifications";
import { formatDateShort, formatTime } from "@/lib/domain/time";
import { DashHeader, Panel } from "@/components/dashboard/common";
import { EmptyState } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

const TEMPLATE_LABEL: Record<string, string> = {
  booking_confirmation: "Confirmation de réservation",
  appointment_reminder: "Rappel de rendez-vous",
  appointment_modified: "Modification",
  cancellation: "Annulation",
  barber_delay: "Retard du barbier",
  barber_ready: "Barbier prêt",
  review_request: "Demande d'avis",
};

export default async function NotificationsPage() {
  const session = await requireStaff();
  if (!can(session, "notifications:view")) redirect("/dashboard");
  const repo = getRepo();
  const [{ t }, outbox, audit] = await Promise.all([getT(), repo.listNotifications(60), can(session, "settings:manage") ? repo.listAudit(60) : Promise.resolve([])]);
  const sample = { name: "Youssef", barber: "Adam", date: "vendredi 9 octobre", time: "17:00", reference: "BT-7K4Q2", shop: "Barber TWIIN", delay: "15 min", link: "barbertwiin.ma/reservation" };

  return (
    <>
      <DashHeader title={t.dash.notifications} subtitle="Boîte d'envoi (e-mail / WhatsApp / SMS) et modèles de messages. Les fournisseurs se branchent dans src/lib/domain/notifications.ts." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Boîte d'envoi">
          {outbox.length === 0 ? (
            <EmptyState title="Aucun message pour l'instant" text="Les confirmations, rappels et annulations apparaîtront ici." />
          ) : (
            <ul className="max-h-[560px] divide-y divide-hair overflow-y-auto">
              {outbox.map((n) => (
                <li key={n.id} className="py-3 text-sm">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="uppercase tracking-wider text-gold">
                      {n.channel} · {TEMPLATE_LABEL[n.template]}
                    </span>
                    <span className="text-ivory-dim">
                      {formatDateShort(n.createdAt)} {formatTime(n.createdAt)} · {n.status === "manual" ? "envoi manuel" : n.status === "queued" ? "en file" : n.status}
                    </span>
                  </div>
                  <p className="mt-1 text-ivory-muted">{n.body}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Modèles (FR)">
          <ul className="space-y-3">
            {TEMPLATE_KEYS.map((k) => (
              <li key={k} className="rounded border border-hair p-3">
                <p className="text-xs uppercase tracking-wider text-gold">{TEMPLATE_LABEL[k]}</p>
                <p className="mt-1 text-sm text-ivory-muted">{renderTemplate(k, sample)}</p>
              </li>
            ))}
          </ul>
        </Panel>
        {audit.length > 0 && (
          <Panel title="Journal d'activité" className="xl:col-span-2">
            <ul className="divide-y divide-hair text-sm">
              {audit.map((a) => (
                <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>
                    <span className="text-ivory">{a.actorName}</span> <span className="text-ivory-muted">— {a.action}</span>
                  </span>
                  <span className="text-xs text-ivory-dim">
                    {formatDateShort(a.createdAt)} {formatTime(a.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </>
  );
}
