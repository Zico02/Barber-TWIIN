import { requireStaff } from "@/lib/auth/session";
import { getRepo } from "@/lib/repo";
import { resolveBarberScope } from "@/lib/domain/permissions";
import { dayBounds, todayInTz } from "@/lib/domain/time";
import { getWorkingWindow } from "@/lib/domain/slots";
import { BarberTabs } from "@/components/dashboard/common";
import { DayView } from "@/components/dashboard/DayView";

export default async function MyDayPage({ searchParams }: { searchParams: Promise<{ date?: string; barber?: string }> }) {
  const session = await requireStaff();
  const sp = await searchParams;
  const repo = getRepo();
  const [shop, barbers, services] = await Promise.all([repo.getShop(), repo.listBarbers(), repo.listServices()]);
  const requested = sp.barber && sp.barber !== "all" ? sp.barber : (barbers[0]?.id ?? null);
  const scope = resolveBarberScope(session, session.role === "barber" ? null : requested);
  const barberId = scope === "all" ? barbers[0]!.id : scope;
  const barber = barbers.find((b) => b.id === barberId)!;
  const today = todayInTz(shop.timezone);
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const { start, end } = dayBounds(date, shop.timezone);

  const [rules, exceptions, blocks, appts] = await Promise.all([
    repo.listAvailability(barberId),
    repo.listExceptions(barberId),
    repo.listBlocks({ barberId, from: start, to: end }),
    repo.listAppointments({ barberId, from: start, to: end }),
  ]);
  const w = getWorkingWindow(date, rules, exceptions, shop.timezone);
  const window = w
    ? {
        start: w.start.toISOString(),
        end: w.end.toISOString(),
        breaks: w.breaks.map((b) => ({ start: b.start.toISOString(), end: b.end.toISOString(), label: b.label ?? "Pause" })),
      }
    : null;

  return (
    <>
      {session.role !== "barber" && (
        <div className="mb-6">
          <BarberTabs barbers={barbers} current={barberId} base={`/dashboard/journee?date=${date}`} allowAll={false} />
        </div>
      )}
      <DayView
        key={`${barberId}-${date}`}
        date={date}
        today={today}
        barber={{ id: barber.id, name: barber.name }}
        isOwnDay={session.role === "barber"}
        window={window}
        blocks={blocks}
        // Clients without a fixed time (walk-ins in the queue) are listed separately.
        appointments={appts.filter((a) => a.barberId === barberId || (a.barberId === null && a.status !== "completed"))}
        services={services}
        barberQuery={session.role === "barber" ? "" : `&barber=${barberId}`}
      />
    </>
  );
}
