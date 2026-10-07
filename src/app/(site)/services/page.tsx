import type { Metadata } from "next";
import Link from "next/link";
import { Clock } from "lucide-react";
import { getRepo } from "@/lib/repo";
import { getT } from "@/lib/i18n/server";
import { formatDH, formatServicePrice } from "@/lib/domain/pricing";
import { formatDuration } from "@/lib/domain/time";
import type { ServiceCategory } from "@/lib/domain/types";
import { PageHero } from "@/components/site/PageHero";
import { ServiceIcon } from "@/components/brand/ServiceIcon";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.services.title, description: t.services.subtitle };
}

const ORDER: ServiceCategory[] = ["cut", "combo", "kids", "beard", "styling", "care", "treatment"];

export default async function ServicesPage() {
  const [{ t }, services] = await Promise.all([getT(), getRepo().listServices()]);
  const groups = ORDER.map((c) => ({ c, items: services.filter((s) => s.category === c) })).filter((g) => g.items.length);
  return (
    <>
      <PageHero eyebrow={t.services.eyebrow} title={t.services.title} text={t.services.subtitle} />
      <section className="section">
        <div className="container-x mx-auto max-w-4xl space-y-14">
          {groups.map(({ c, items }) => (
            <div key={c}>
              <h2 className="eyebrow mb-6 text-sm">{t.services.cats[c]}</h2>
              <ul className="divide-y divide-hair border-y border-hair">
                {items.map((s) => (
                  <li key={s.id} className="group flex flex-col gap-4 py-6 sm:flex-row sm:items-center">
                    <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line text-gold sm:flex">
                      <ServiceIcon name={s.icon} />
                    </span>
                    <div className="flex-1">
                      <div className="flex items-baseline gap-3">
                        <h3 className="font-serif text-2xl">{s.name}</h3>
                        <span className="hidden flex-1 border-b border-dotted border-gold/30 sm:block" />
                        <span className="font-serif text-2xl text-gold-metal">{formatServicePrice(s, t.common.from)}</span>
                      </div>
                      <p className="mt-1 text-sm text-ivory-muted">{s.description}</p>
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-ivory-dim">
                        <Clock className="h-3.5 w-3.5 text-gold" /> {formatDuration(s.durationMinutes)}
                      </p>
                    </div>
                    <Link href={`/reservation?service=${s.id}`} className="btn-outline btn-sm self-start sm:self-center">
                      {t.services.bookThis}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="text-center">
            <Link href="/reservation" className="btn-gold px-10">
              {t.common.bookNow}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
