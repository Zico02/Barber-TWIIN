import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { getPublicQueue } from "@/lib/server/publicQueue";
import { PageHero } from "@/components/site/PageHero";
import { PublicQueue } from "@/components/queue/PublicQueue";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.queue.title, description: t.queue.subtitle };
}

export default async function QueuePage() {
  const [{ t }, queue] = await Promise.all([getT(), getPublicQueue().catch(() => null)]);
  return (
    <>
      <PageHero eyebrow={t.queue.eyebrow} title={t.queue.title} text={t.queue.subtitle} />
      <section className="section">
        <div className="container-x">
          <PublicQueue initial={queue} />
        </div>
      </section>
    </>
  );
}
