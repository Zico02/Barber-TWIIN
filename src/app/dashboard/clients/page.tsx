import { requireStaff } from "@/lib/auth/session";
import { getRepo } from "@/lib/repo";
import { can, resolveBarberScope } from "@/lib/domain/permissions";
import { amountOf } from "@/lib/domain/analytics";
import { DashHeader } from "@/components/dashboard/common";
import { CustomersTable, type CustomerRow } from "@/components/dashboard/CustomersTable";
import { getT } from "@/lib/i18n/server";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const session = await requireStaff();
  const sp = await searchParams;
  const repo = getRepo();
  const scope = resolveBarberScope(session, null);
  const [{ t }, appts, barbers] = await Promise.all([getT(), repo.listAppointments({ barberId: scope }), repo.listBarbers()]);
  // Barbers only see customers who booked with them.
  const mine = scope === "all" ? appts : appts.filter((a) => a.barberId === scope);
  const ids = scope === "all" ? undefined : [...new Set(mine.map((a) => a.customerId))];
  const customers = await repo.listCustomers({ ids, includeArchived: sp.archived === "1" });
  const barberName = Object.fromEntries(barbers.map((b) => [b.id, b.name]));

  const rows: CustomerRow[] = customers
    .filter((c) => !c.anonymized || sp.archived === "1")
    .map((c) => {
      const list = mine.filter((a) => a.customerId === c.id).sort((x, y) => (y.startAt ?? y.createdAt).localeCompare(x.startAt ?? x.createdAt));
      const done = list.filter((a) => a.status === "completed");
      const svc = new Map<string, number>();
      const brb = new Map<string, number>();
      for (const a of done) {
        a.services.forEach((s) => svc.set(s.name, (svc.get(s.name) ?? 0) + 1));
        if (a.barberId) brb.set(a.barberId, (brb.get(a.barberId) ?? 0) + 1);
      }
      const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      const prefBarber = c.preferredBarberId ?? top(brb);
      return {
        customer: c,
        visits: done.length,
        spending: done.reduce((s, a) => s + amountOf(a), 0),
        lastVisit: done[0]?.startAt ?? done[0]?.completedAt ?? null,
        cancellations: list.filter((a) => a.status === "cancelled").length,
        lateCancellations: list.filter((a) => a.lateCancellation).length,
        noShows: list.filter((a) => a.status === "no_show").length,
        preferredBarber: prefBarber ? barberName[prefBarber] ?? null : null,
        preferredServices: [...svc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([n]) => n),
        history: list.slice(0, 30).map((a) => ({
          id: a.id,
          date: a.startAt ?? a.arrivedAt ?? a.createdAt,
          status: a.status,
          services: a.services.map((s) => s.name).join(" + "),
          barber: a.barberId ? barberName[a.barberId] ?? "" : "",
          amount: amountOf(a),
          note: a.note ?? null,
        })),
      };
    })
    .sort((a, b) => (b.lastVisit ?? "").localeCompare(a.lastVisit ?? ""));

  return (
    <>
      <DashHeader title={t.dash.customers} subtitle={session.role === "barber" ? "Vos clients uniquement" : `${rows.length} client(s)`} />
      <CustomersTable
        rows={rows}
        canArchive={can(session, "customers:all")}
        canDelete={can(session, "customers:delete")}
        showSpending={can(session, "revenue:view") || session.role === "barber"}
        showArchived={sp.archived === "1"}
      />
    </>
  );
}
