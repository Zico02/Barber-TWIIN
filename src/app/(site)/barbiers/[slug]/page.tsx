import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck, Instagram, ArrowLeft } from "lucide-react";
import { getRepo } from "@/lib/repo";
import { getT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n";
import { formatDH, formatServicePrice, serviceDuration } from "@/lib/domain/pricing";
import { formatDuration } from "@/lib/domain/time";
import { BarberContact, BarberPortrait, ReviewCard } from "@/components/site/cards";
import { GalleryGrid } from "@/components/site/GalleryGrid";
import { Stars, SectionHeading } from "@/components/ui";
import { ServiceIcon } from "@/components/brand/ServiceIcon";
import { TikTokIcon } from "@/components/brand/SocialIcons";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const barber = await getRepo().getBarberBySlug((await params).slug);
  return barber ? { title: `${barber.name} — ${barber.title}`, description: barber.bio } : {};
}

export default async function BarberProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const repo = getRepo();
  const barber = await repo.getBarberBySlug(slug);
  if (!barber) notFound();
  const [{ t }, services, rules, portfolio, reviews] = await Promise.all([
    getT(),
    repo.listServices(),
    repo.listAvailability(barber.id),
    repo.listPortfolio({ barberId: barber.id }),
    repo.listReviews({ status: "approved", barberId: barber.id }),
  ]);
  const offered = services.filter((s) => barber.serviceIds.includes(s.id));
  const workDays = [1, 2, 3, 4, 5, 6, 0].filter((d) => rules.some((r) => r.weekday === d));

  return (
    <>
      <section className="marble border-b border-hair px-4 pb-16 pt-28 sm:px-6 md:pt-36">
        <div className="container-x">
          <Link href="/barbiers" className="btn-ghost btn-sm mb-6 -ms-3">
            <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" /> {t.barbers.title}
          </Link>
          <div className="grid items-center gap-10 md:grid-cols-[minmax(0,420px)_1fr]">
            <BarberPortrait barber={barber} className="aspect-[4/5] w-full max-w-md rounded-md border border-line" />
            <div className="animate-rise">
              <p className="eyebrow">{barber.title}</p>
              <h1 className="mt-3 font-serif text-5xl font-medium sm:text-7xl">{barber.name}</h1>
              {(barber.reviewCount > 0 || barber.experienceYears > 0) && (
                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-ivory-muted">
                  {barber.reviewCount > 0 && (
                    <span className="flex items-center gap-2 text-gold-light">
                      <Stars value={barber.rating} /> {barber.rating.toFixed(1)} · {fmt(t.barbers.reviews, { n: barber.reviewCount })}
                    </span>
                  )}
                  {barber.experienceYears > 0 && <span>{fmt(t.barbers.experience, { n: barber.experienceYears })}</span>}
                </div>
              )}
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-ivory-muted">{barber.bio}</p>
              <div className="mt-6">
                <p className="label">{t.barbers.specialties}</p>
                <ul className="flex flex-wrap gap-2">
                  {barber.specialties.map((s) => (
                    <li key={s} className="rounded-sm border border-line px-3 py-1 text-sm text-gold-light">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-6">
                <p className="label">{t.barbers.workingDays}</p>
                <p className="text-sm text-ivory">{workDays.map((d) => t.daysShort[d]).join(" · ")}</p>
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={`/reservation?barber=${barber.id}`} className="btn-gold px-8">
                  <CalendarCheck className="h-4 w-4" /> {fmt(t.barbers.bookWith, { name: barber.name })}
                </Link>
                <BarberContact barber={barber} />
                {barber.socials.instagram && (
                  <a href={barber.socials.instagram} target="_blank" rel="noopener noreferrer" className="btn-outline" aria-label="Instagram">
                    <Instagram className="h-4 w-4" />
                  </a>
                )}
                {barber.socials.tiktok && (
                  <a href={barber.socials.tiktok} target="_blank" rel="noopener noreferrer" className="btn-outline" aria-label="TikTok">
                    <TikTokIcon className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-x">
          <SectionHeading title={t.barbers.servicesOffered} />
          <ul className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-2">
            {offered.map((s) => (
              <li key={s.id}>
                <Link href={`/reservation?barber=${barber.id}&service=${s.id}`} className="card card-hover flex items-center gap-4 p-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-gold">
                    <ServiceIcon name={s.icon} className="h-5 w-5" />
                  </span>
                  <span className="flex-1">
                    <span className="block font-serif text-xl">{s.name}</span>
                    <span className="text-xs text-ivory-muted">{formatDuration(serviceDuration(s, barber))}</span>
                  </span>
                  <span className="font-serif text-2xl text-gold-metal">{formatServicePrice(s, t.common.from)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {portfolio.length > 0 && (
        <section className="section border-t border-hair">
          <div className="container-x">
            <SectionHeading title={t.barbers.portfolio} />
            <GalleryGrid items={portfolio} barbers={{ [barber.id]: barber.name }} filters={false} />
          </div>
        </section>
      )}

      {reviews.length > 0 && (
        <section className="section border-t border-hair">
          <div className="container-x grid gap-5 md:grid-cols-3">
            {reviews.slice(0, 3).map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
