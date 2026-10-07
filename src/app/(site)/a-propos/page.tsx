import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getRepo } from "@/lib/repo";
import { getT } from "@/lib/i18n/server";
import { PageHero } from "@/components/site/PageHero";
import { Crown } from "@/components/brand/Logo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.about.title, description: t.about.p1 };
}

export default async function AboutPage() {
  const [{ t }, barbers] = await Promise.all([getT(), getRepo().listBarbers()]);
  return (
    <>
      <PageHero eyebrow={t.about.eyebrow} title={t.about.title} />
      <section className="section">
        <div className="container-x grid items-center gap-12 lg:grid-cols-2">
          <div className="space-y-6 text-lg leading-relaxed text-ivory-muted">
            <p className="font-serif text-3xl leading-snug text-ivory">{t.about.p1}</p>
            <p>{t.about.p2}</p>
            <div className="flex gap-10 border-t border-hair pt-6">
              <div>
                <p className="font-serif text-5xl text-gold-metal">{barbers.length}</p>
                <p className="text-xs uppercase tracking-[0.2em]">{t.hero.statBarbers}</p>
              </div>
              <div>
                <p className="font-serif text-5xl text-gold-metal">11h – 22h</p>
                <p className="text-xs uppercase tracking-[0.2em]">{t.hero.statRating}</p>
              </div>
            </div>
          </div>
          <div className="marble card flex aspect-[4/3] items-center justify-center overflow-hidden p-8">
            <Image src="/images/logo-transparent.webp" alt="Barber TWIIN" width={1566} height={453} className="h-auto w-full" />
          </div>
        </div>
      </section>
      <section className="section marble marble-soft border-y border-hair">
        <div className="container-x grid gap-6 md:grid-cols-3">
          {t.about.values.map((v) => (
            <div key={v.title} className="card p-8 text-center">
              <Crown className="mx-auto h-6 w-10" />
              <h2 className="mt-5 font-serif text-3xl">{v.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-ivory-muted">{v.text}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="section text-center">
        <Link href="/reservation" className="btn-gold px-10">
          {t.common.bookNow}
        </Link>
      </section>
    </>
  );
}
