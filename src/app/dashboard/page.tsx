import Link from "next/link";
import { redirect } from "next/navigation";
import { ListOrdered, Plus } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { getRepo } from "@/lib/repo";
import { getT } from "@/lib/i18n/server";
import { can, resolveBarberScope } from "@/lib/domain/permissions";
import { computeAnalytics } from "@/lib/domain/analytics";
import { addDays, dayBounds, formatTime, todayInTz } from "@/lib/domain/time";
import { formatDH } from "@/lib/domain/pricing";
import { getLiveQueue } from "@/lib/server/scheduling";
import { DashHeader, Kpi, Panel } from "@/components/dashboard/common";
import { BarList, ColumnChart } from "@/components/dashboard/Charts";
import { StatusBadge, EmptyState } from "@/components/ui";

export default async function DashboardHome({ searchParams }: { searchParams: Promise<{ stats?: string }> }) {
  const session = await requireStaff();
  // Barbers land directly on their day; their stats stay one click away.
  if (session.role === "barber" && !(await searchParams).stats) redirect("/dashboard/journee");
  const repo = getRepo();
  const [{ t }, shop] = await Promise.all([getT(), repo.getShop()]);
  const scope = resolveBarberScope(session, null);
  const today = todayInTz(shop.timezone);
  const from = dayBounds(addDays(today, -27), shop.timezone).start;
  const to = dayBounds(today, shop.timezone).end;
  const [allBarbers, appts, live] = await Promise.all([repo.listBarbers(), repo.listAppointments({ barberId: scope, from, to }), getLiveQueue({ publicView: false })]);
  const barbers = scope === "all" ? allBarbers : allBarbers.filter((b) => b.id === scope);
  const mine = scope === "all" ? appts : appts.filter((a) => a.barberId === scope);
  const a = computeAnalytics(mine, barbers, new Date(), shop.timezone);
  const revenue = can(session, "revenue:view") || session.role === "barber"; // barbers see their own performance
  const upcomingToday = live.appointments
    .filter((x) => (scope === "all" || x.barberId === scope) && ["pending", "confirmed"].includes(x.status) && x.startAt && new Date(x.startAt) > new Date())
    .slice(0, 6);
  const fmtDay = (d: string) => t.daysShort[new Date(`${d}T12:00:00Z`).getUTCDay()]!;

  return (
    <>
      <DashHeader
        title={session.role === "barber" ? "Mes performances" : t.dash.overview}
        subtitle={new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeZone: shop.timezone }).format(new Date())}
        actions={
          <>
            <Link href="/dashboard/file" className="btn-gold btn-sm">
              <ListOrdered className="h-4 w-4" /> {t.dash.queue}
            </Link>
            <Link href="/dashboard/file?walkin=1" className="btn-outline btn-sm">
              <Plus className="h-4 w-4" /> Sans rendez-vous
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Kpi label="RDV aujourd'hui" value={a.today.total} accent />
        <Kpi label="En attente" value={a.today.waiting} />
        <Kpi label="Sans RDV" value={a.today.walkIns} />
        <Kpi label="Terminés" value={a.today.completed} />
        <Kpi label="Annulés" value={a.today.cancelled} />
        <Kpi label="Absents" value={a.today.noShows} />
      </div>

      {revenue && (
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
          <Kpi label="Chiffre du jour" value={formatDH(a.today.revenue)} accent />
          <Kpi label="7 derniers jours" value={formatDH(a.weekRevenue)} />
          <Kpi label="Attente moyenne" value={a.avgWaitMinutes !== null ? `${a.avgWaitMinutes} min` : "—"} hint="Arrivée → début du service" />
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="Barbiers en direct" className="xl:col-span-1">
          <ul className="space-y-3">
            {barbers.map((b) => {
              const l = live.estimates.barbers[b.id];
              return (
                <li key={b.id} className="flex items-center justify-between rounded border border-hair px-4 py-3">
                  <div>
                    <p className="font-serif text-lg">{b.name}</p>
                    <p className="text-xs text-ivory-muted">
                      {l?.current ? `${l.current.customerName} · ${l.current.services.map((s) => s.name).join(" + ")}` : t.queue[l?.status ?? "off"]}
                    </p>
                  </div>
                  <div className="text-end text-xs">
                    <p className={l?.status === "free" ? "text-ok" : l?.status === "busy" ? "text-gold-light" : "text-ivory-dim"}>{t.queue[l?.status ?? "off"]}</p>
                    <p className="text-ivory-dim">{l?.queueLength ?? 0} en file</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="Prochains rendez-vous" className="xl:col-span-2" action={<Link href="/dashboard/agenda" className="text-xs text-gold hover:text-gold-light">{t.dash.agenda} →</Link>}>
          {upcomingToday.length === 0 ? (
            <EmptyState title="Aucun autre rendez-vous aujourd'hui" />
          ) : (
            <ul className="divide-y divide-hair">
              {upcomingToday.map((x) => (
                <li key={x.id} className="flex flex-wrap items-center gap-4 py-3">
                  <span className="w-14 font-display text-lg text-gold-light">{formatTime(x.startAt!)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ivory">{x.customerName}</span>
                    <span className="block truncate text-xs text-ivory-muted">
                      {x.services.map((s) => s.name).join(" + ")} · {allBarbers.find((b) => b.id === x.barberId)?.name}
                    </span>
                  </span>
                  <StatusBadge status={x.status} label={t.status[x.status]} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {revenue && (
          <Panel title="Revenus — 7 derniers jours">
            <ColumnChart label="Revenus par jour (DH)" data={a.revenueByDay.map((d) => ({ label: fmtDay(d.date), value: d.revenue }))} format="dh" />
          </Panel>
        )}
        <Panel title="Services les plus demandés (28 j)">
          <BarList data={a.topServices.map((s) => ({ label: s.name, value: s.count }))} />
        </Panel>
        <Panel title="Heures d'affluence">
          <ColumnChart label="Rendez-vous par heure" data={a.busiestHours.map((h) => ({ label: `${h.hour}h`, value: h.count }))} />
        </Panel>
        <Panel title="Jours d'affluence">
          <ColumnChart label="Rendez-vous par jour de la semaine" data={[1, 2, 3, 4, 5, 6, 0].map((d) => ({ label: t.daysShort[d]!, value: a.busiestWeekdays[d]!.count }))} />
        </Panel>
        {scope === "all" && (
          <Panel title="Rendez-vous par barbier (28 j)" className="lg:col-span-2">
            <BarList data={a.byBarber.map((b) => ({ label: b.name, value: b.count, sub: revenue ? `${b.completed} terminés · ${formatDH(b.revenue)}` : `${b.completed} terminés` }))} />
          </Panel>
        )}
      </div>
    </>
  );
}
