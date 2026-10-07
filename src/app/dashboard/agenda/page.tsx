import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarPlus } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { getRepo } from "@/lib/repo";
import { resolveBarberScope } from "@/lib/domain/permissions";
import { addDays, dayBounds, todayInTz } from "@/lib/domain/time";
import { DashHeader, BarberTabs } from "@/components/dashboard/common";
import { AgendaDay } from "@/components/dashboard/AgendaDay";
import { getT } from "@/lib/i18n/server";

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ date?: string; barber?: string }> }) {
  const session = await requireStaff();
  const sp = await searchParams;
  const repo = getRepo();
  const [{ t }, shop, allBarbers] = await Promise.all([getT(), repo.getShop(), repo.listBarbers()]);
  const scope = resolveBarberScope(session, session.role === "barber" ? null : (sp.barber ?? null));
  const today = todayInTz(shop.timezone);
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const { start, end } = dayBounds(date, shop.timezone);
  const [appts, blocks] = await Promise.all([repo.listAppointments({ barberId: scope, from: start, to: end }), repo.listBlocks({ barberId: scope, from: start, to: end })]);
  const barbers = scope === "all" ? allBarbers : allBarbers.filter((b) => b.id === scope);
  const q = (d: string) => `/dashboard/agenda?date=${d}${sp.barber ? `&barber=${sp.barber}` : ""}`;
  const label = new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

  return (
    <>
      <DashHeader
        title={t.dash.agenda}
        subtitle={label}
        actions={
          <>
            <Link href={q(addDays(date, -1))} className="btn-outline btn-sm" aria-label="Jour précédent">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <Link href={q(today)} className="btn-outline btn-sm">
              Aujourd&apos;hui
            </Link>
            <Link href={q(addDays(date, 1))} className="btn-outline btn-sm" aria-label="Jour suivant">
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link href="/reservation" target="_blank" className="btn-gold btn-sm">
              <CalendarPlus className="h-4 w-4" /> Nouveau RDV
            </Link>
          </>
        }
      />
      {session.role !== "barber" && (
        <div className="mb-6">
          <BarberTabs barbers={allBarbers} current={scope} base={`/dashboard/agenda?date=${date}`} />
        </div>
      )}
      <AgendaDay
        date={date}
        today={today}
        barbers={barbers.map((b) => ({ id: b.id, name: b.name }))}
        appointments={appts.filter((a) => a.startAt)}
        blocks={blocks}
      />
    </>
  );
}
