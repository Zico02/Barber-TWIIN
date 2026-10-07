import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { getRepo } from "@/lib/repo";
import { can } from "@/lib/domain/permissions";
import { DashHeader } from "@/components/dashboard/common";
import { ReviewsModeration } from "@/components/dashboard/ReviewsModeration";
import { getT } from "@/lib/i18n/server";

export default async function ReviewsAdminPage() {
  const session = await requireStaff();
  if (!can(session, "reviews:moderate")) redirect("/dashboard");
  const repo = getRepo();
  const [{ t }, reviews, barbers] = await Promise.all([getT(), repo.listReviews(), repo.listBarbers()]);
  return (
    <>
      <DashHeader title={t.dash.reviews} subtitle="Les avis ne sont publiés qu'après votre validation. Les avis « mis en avant » apparaissent sur l'accueil." />
      <ReviewsModeration reviews={reviews} barbers={Object.fromEntries(barbers.map((b) => [b.id, b.name]))} />
    </>
  );
}
