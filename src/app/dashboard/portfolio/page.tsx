import { requireStaff } from "@/lib/auth/session";
import { getRepo } from "@/lib/repo";
import { can } from "@/lib/domain/permissions";
import { DashHeader } from "@/components/dashboard/common";
import { PortfolioManager } from "@/components/dashboard/PortfolioManager";
import { getT } from "@/lib/i18n/server";

export default async function PortfolioAdminPage() {
  const session = await requireStaff();
  const repo = getRepo();
  const all = can(session, "portfolio:all");
  // Barbers see their own work; staff not linked to a barber (reception) see everything, read-only.
  const ownOnly = !all && !!session.barberId;
  const [{ t }, items, barbers] = await Promise.all([getT(), repo.listPortfolio(ownOnly ? { barberId: session.barberId! } : undefined), repo.listBarbers()]);
  return (
    <>
      <DashHeader title={t.dash.portfolio} subtitle="Ajoutez vos vraies réalisations : elles apparaissent dans la galerie et sur votre profil." />
      <PortfolioManager
        items={items}
        barbers={(ownOnly ? barbers.filter((b) => b.id === session.barberId) : barbers).map((b) => ({ id: b.id, name: b.name }))}
        canEdit={all || session.role === "barber"}
      />
    </>
  );
}
