import { requireStaff } from "@/lib/auth/session";
import { getRepo } from "@/lib/repo";
import { can, resolveBarberScope } from "@/lib/domain/permissions";
import { addDays, dayBounds, todayInTz } from "@/lib/domain/time";
import { DashHeader, BarberTabs } from "@/components/dashboard/common";
import { AvailabilityEditor } from "@/components/dashboard/AvailabilityEditor";
import { getT } from "@/lib/i18n/server";

export default async function AvailabilityPage({ searchParams }: { searchParams: Promise<{ barber?: string }> }) {
  const session = await requireStaff();
  const sp = await searchParams;
  const repo = getRepo();
  const [{ t }, shop, barbers] = await Promise.all([getT(), repo.getShop(), repo.listBarbers()]);
  const requested = sp.barber && sp.barber !== "all" ? sp.barber : (barbers[0]?.id ?? null);
  const scope = resolveBarberScope(session, session.role === "barber" ? null : requested);
  const barberId = scope === "all" ? barbers[0]!.id : scope;
  const today = todayInTz(shop.timezone);
  const [rules, exceptions, blocks] = await Promise.all([
    repo.listAvailability(barberId),
    repo.listExceptions(barberId),
    repo.listBlocks({ barberId, from: dayBounds(today, shop.timezone).start, to: dayBounds(addDays(today, 365), shop.timezone).end }),
  ]);
  return (
    <>
      <DashHeader
        title={t.dash.availability}
        subtitle={`Horaires de ${barbers.find((b) => b.id === barberId)?.name}`}
        actions={session.role !== "barber" ? <BarberTabs barbers={barbers} current={barberId} base="/dashboard/disponibilites" allowAll={false} /> : undefined}
      />
      <AvailabilityEditor
        key={barberId}
        barberId={barberId}
        rules={rules}
        exceptions={exceptions.filter((e) => e.date >= today)}
        blocks={blocks}
        today={today}
        canShopClosure={can(session, "availability:all")}
      />
    </>
  );
}
