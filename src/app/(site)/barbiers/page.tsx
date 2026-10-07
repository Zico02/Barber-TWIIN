import type { Metadata } from "next";
import { getRepo } from "@/lib/repo";
import { getT } from "@/lib/i18n/server";
import { PageHero } from "@/components/site/PageHero";
import { BarberCard } from "@/components/site/cards";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.barbers.title, description: t.barbers.subtitle };
}

export default async function BarbersPage() {
  const [{ t }, barbers] = await Promise.all([getT(), getRepo().listBarbers()]);
  return (
    <>
      <PageHero eyebrow={t.barbers.eyebrow} title={t.barbers.title} text={t.barbers.subtitle} />
      <section className="section">
        <div className="container-x grid gap-6 md:grid-cols-3">
          {barbers.map((b) => (
            <BarberCard key={b.id} barber={b} t={t} />
          ))}
        </div>
      </section>
    </>
  );
}
