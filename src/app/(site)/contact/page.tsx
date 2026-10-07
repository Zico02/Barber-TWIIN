import type { Metadata } from "next";
import { getRepo } from "@/lib/repo";
import { getT } from "@/lib/i18n/server";
import { PageHero } from "@/components/site/PageHero";
import { HoursList, MapEmbed, ContactActions, ContactList, directionsUrl } from "@/components/site/ShopInfo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.contact.title, description: t.contact.subtitle };
}

export default async function ContactPage() {
  const [{ t }, shop] = await Promise.all([getT(), getRepo().getShop()]);
  return (
    <>
      <PageHero eyebrow={t.contact.eyebrow} title={t.contact.title} text={t.contact.subtitle}>
        <div className="mt-8 flex justify-center">
          <ContactActions shop={shop} t={t} />
        </div>
      </PageHero>
      <section className="section">
        <div className="container-x grid gap-6 lg:grid-cols-[1fr_1.5fr]">
          <div className="space-y-6">
            <div className="card p-6">
              <h2 className="font-serif text-2xl">{t.nav.contact}</h2>
              <div className="mt-5">
                <ContactList shop={shop} />
              </div>
            </div>
            <div className="card p-6">
              <h2 className="font-serif text-2xl">{t.home.hoursTitle}</h2>
              <div className="mt-4">
                <HoursList shop={shop} t={t} />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <MapEmbed shop={shop} className="min-h-[480px] flex-1" />
            <a href={directionsUrl(shop)} target="_blank" rel="noopener noreferrer" className="btn-outline">
              {t.contact.openMaps}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
