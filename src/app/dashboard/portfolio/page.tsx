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
  const [{ t }, items, barbers] = await Promise.all([getT(), repo.listPortfolio(all ? undefined : { barberId: session.barberId ?? "none" }), repo.listBarbers()]);
  return (
    <>
      <DashHeader title={t.dash.portfolio} subtitle="Ajoutez vos vraies réalisations : elles apparaissent dans la galerie et sur votre profil." />
      <PortfolioManager
        items={items}
        barbers={(all ? barbers : barbers.filter((b) => b.id === session.barberId)).map((b) => ({ id: b.id, name: b.name }))}
        canEdit={all || session.role === "barber"}
      />
    </>
  );
}
