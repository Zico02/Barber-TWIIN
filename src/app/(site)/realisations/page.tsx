import type { Metadata } from "next";
import { getRepo } from "@/lib/repo";
import { getT } from "@/lib/i18n/server";
import { PageHero } from "@/components/site/PageHero";
import { GalleryGrid } from "@/components/site/GalleryGrid";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.gallery.title, description: t.gallery.subtitle };
}

export default async function GalleryPage() {
  const repo = getRepo();
  const [{ t }, items, barbers] = await Promise.all([getT(), repo.listPortfolio(), repo.listBarbers()]);
  return (
    <>
      <PageHero eyebrow={t.gallery.eyebrow} title={t.gallery.title} text={t.gallery.subtitle} />
      <section className="section">
        <div className="container-x">
          <GalleryGrid items={items} barbers={Object.fromEntries(barbers.map((b) => [b.id, b.name]))} />
        </div>
      </section>
    </>
  );
}
