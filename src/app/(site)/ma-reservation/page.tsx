import type { Metadata } from "next";
import { getRepo } from "@/lib/repo";
import { getT } from "@/lib/i18n/server";
import { todayInTz } from "@/lib/domain/time";
import { PageHero } from "@/components/site/PageHero";
import { CustomerLookup, LookupLinks } from "@/components/booking/CustomerLookup";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.lookup.title, robots: { index: false } };
}

export default async function LookupPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const [{ t }, shop, sp] = await Promise.all([getT(), getRepo().getShop(), searchParams]);
  const ref = /^BT-[A-Z0-9]{5}$/i.test(sp.ref ?? "") ? sp.ref!.toUpperCase() : "";
  return (
    <>
      <PageHero eyebrow={t.lookup.eyebrow} title={t.lookup.title} text={t.lookup.subtitle} />
      <section className="section">
        <div className="container-x">
          <CustomerLookup initialRef={ref} today={todayInTz(shop.timezone)} shopPhone={shop.phone} shopWhatsapp={shop.whatsapp} />
          <LookupLinks />
        </div>
      </section>
    </>
  );
}
