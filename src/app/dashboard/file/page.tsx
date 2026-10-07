import { requireStaff } from "@/lib/auth/session";
import { getRepo } from "@/lib/repo";
import { resolveBarberScope } from "@/lib/domain/permissions";
import { getLiveQueue } from "@/lib/server/scheduling";
import { DashHeader, BarberTabs } from "@/components/dashboard/common";
import { QueueBoard } from "@/components/dashboard/QueueBoard";
import { getT } from "@/lib/i18n/server";

export default async function QueuePage({ searchParams }: { searchParams: Promise<{ barber?: string; walkin?: string }> }) {
  const session = await requireStaff();
  const sp = await searchParams;
  const scope = resolveBarberScope(session, session.role === "barber" ? null : (sp.barber ?? null));
  const repo = getRepo();
  const [{ t }, live, services] = await Promise.all([getT(), getLiveQueue({ publicView: false }), repo.listServices()]);
  const visible = live.appointments.filter((a) => scope === "all" || a.barberId === scope || a.barberId === null);
  const barbers = live.barbers.map((b) => ({ id: b.id, name: b.name, delayMinutes: b.delayMinutes, serviceIds: b.serviceIds }));

  return (
    <>
      <DashHeader
        title={t.dash.queue}
        subtitle="Glissez une carte pour changer son statut. Les heures d'arrivée et de rendez-vous d'origine restent enregistrées."
        actions={session.role !== "barber" ? <BarberTabs barbers={barbers} current={scope} base="/dashboard/file" /> : undefined}
      />
      <QueueBoard
        appointments={visible}
        estimates={live.estimates.entries}
        barberLive={live.estimates.barbers}
        barbers={barbers}
        services={services}
        scope={scope}
        isBarber={session.role === "barber"}
        canSeePrices
        openWalkIn={sp.walkin === "1"}
      />
    </>
  );
}
