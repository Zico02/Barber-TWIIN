import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { getRepo } from "@/lib/repo";
import { can } from "@/lib/domain/permissions";
import { DashHeader } from "@/components/dashboard/common";
import { ServicesManager } from "@/components/dashboard/ServicesManager";
import { getT } from "@/lib/i18n/server";

export default async function ServicesAdminPage() {
  const session = await requireStaff();
  if (!can(session, "services:manage")) redirect("/dashboard");
  const repo = getRepo();
  const [{ t }, services, barbers] = await Promise.all([getT(), repo.listServices({ includeInactive: true }), repo.listBarbers({ includeInactive: true })]);
  return (
    <>
      <DashHeader title={t.dash.services} subtitle="Les prix et durées se mettent à jour immédiatement sur le site et dans la réservation." />
      <ServicesManager services={services} barbers={barbers.map((b) => ({ id: b.id, name: b.name, serviceIds: b.serviceIds }))} />
    </>
  );
}
