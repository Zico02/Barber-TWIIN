import Image from "next/image";
import Link from "next/link";
import { Quote, CalendarCheck, Sparkles, Scissors, CalendarDays, Clock4, Instagram, Facebook } from "lucide-react";
import { getRepo, isDemoMode } from "@/lib/repo";
import { getT } from "@/lib/i18n/server";
import { todayInTz } from "@/lib/domain/time";
import { getPublicQueue } from "@/lib/server/publicQueue";
import { SectionHeading } from "@/components/ui";
import { Ornament } from "@/components/brand/Logo";
import { SnipScissors } from "@/components/brand/SnipScissors";
import { ServiceCard, ReviewCard } from "@/components/site/cards";
import { GalleryGrid } from "@/components/site/GalleryGrid";
import { QuickBooking } from "@/components/home/QuickBooking";
import { BarberLineup } from "@/components/home/BarberLineup";
import { LiveWaitPreview } from "@/components/queue/PublicQueue";
import { HoursList, MapEmbed, ContactActions, ContactList } from "@/components/site/ShopInfo";
import { TikTokIcon, WhatsAppIcon } from "@/components/brand/SocialIcons";
import { whatsappLink } from "@/lib/domain/phone";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const repo = getRepo();
  const [{ t }, shop, services, barbers, portfolio, reviews, queue] = await Promise.all([
    getT(),
    repo.getShop(),
    repo.listServices(),
    repo.listBarbers(),
    repo.listPortfolio(),
    repo.listReviews({ status: "approved" }),
    getPublicQueue().catch(() => null),
  ]);
  const barberNames = Object.fromEntries(barbers.map((b) => [b.id, b.name]));
  const h0 = shop.hours.find((h) => h.open);
  const hoursLabel = h0 ? `${h0.open!.replace(":00", "h")} – ${h0.close!.replace(":00", "h")}` : "—";
  const howIcons = [Sparkles, Scissors, CalendarDays, Clock4];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BarberShop",
    name: shop.name,
    image: "/images/logo.webp",
    telephone: shop.phone,
    email: shop.email,
    address: { "@type": "PostalAddress", streetAddress: shop.address, addressLocality: shop.city, addressCountry: "MA" },
    geo: { "@type": "GeoCoordinates", latitude: shop.lat, longitude: shop.lng },
    priceRange: "10 DH – 250 DH",
    sameAs: Object.values(shop.socials).filter(Boolean),
    openingHoursSpecification: shop.hours
      .filter((h) => h.open)
      .map((h) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][h.day], opens: h.open, closes: h.close })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── Hero ── */}
      <section className="marble relative flex min-h-[100svh] items-center overflow-hidden px-4 pb-16 pt-28 sm:px-6">
        <div className="container-x relative z-10 text-center">
          <div className="relative mx-auto max-w-5xl">
            {/* Gold tools: the scissors snip and the clipper buzzes on load, then both bounce gently.
                Wrapper = position · middle = bounce · inner = snip / buzz (each owns its transform). */}
            <span aria-hidden className="pointer-events-none absolute start-0 top-1/2 -translate-y-1/2">
              <span className="block animate-bounceSoftL">
                <SnipScissors className="h-auto w-14 -rotate-12 drop-shadow-[0_10px_25px_rgba(201,154,53,0.35)] sm:w-24 lg:w-32" />
              </span>
            </span>
            <span aria-hidden className="pointer-events-none absolute end-0 top-1/2 -translate-y-1/2">
              <span className="block animate-bounceSoftR">
                <Image
                  src="/images/clipper.webp"
                  alt=""
                  width={640}
                  height={481}
                  priority
                  className="w-20 animate-buzz drop-shadow-[0_10px_25px_rgba(201,154,53,0.35)] sm:w-32 lg:w-44"
                />
              </span>
            </span>
            <div className="animate-rise px-12 sm:px-24 lg:px-36">
              <Image
                src="/images/logo-transparent.webp"
                alt="Barber TWIIN"
                width={1566}
                height={453}
                priority
                sizes="(min-width: 1024px) 720px, 70vw"
                className="mx-auto h-auto w-full max-w-[720px]"
              />
            </div>
          </div>
          <p className="eyebrow mt-2 animate-rise [animation-delay:120ms]">{t.hero.eyebrow}</p>
          {/* Symmetric tagline: Cut (top left) · Confidence (top right) · "• Style •" centred below */}
          <h1 aria-label={[t.hero.title1, t.hero.title2, t.hero.title3].join(" · ")} className="mx-auto mt-6 flex max-w-4xl animate-rise flex-col items-center gap-1 font-display text-3xl font-medium uppercase leading-none tracking-[0.12em] [animation-delay:200ms] sm:gap-2 sm:text-5xl lg:text-6xl">
            <span className="flex items-baseline justify-center gap-6 sm:gap-10 lg:gap-14">
              <span>{t.hero.title1}</span>
              <span>{t.hero.title3}</span>
            </span>
            <span className="flex items-baseline justify-center gap-4 sm:gap-6">
              <span aria-hidden className="text-gold">•</span>
              <span className="text-gold-metal">{t.hero.title2}</span>
              <span aria-hidden className="text-gold">•</span>
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl animate-rise text-base leading-relaxed text-ivory-muted [animation-delay:280ms] sm:text-lg">{t.hero.text}</p>
          <div className="mt-9 flex animate-rise flex-col items-center justify-center gap-3 [animation-delay:360ms] sm:flex-row">
            <Link href="/reservation" className="btn-gold w-full px-8 py-4 sm:w-auto">
              <CalendarCheck className="h-4 w-4" /> {t.common.bookAppointment}
            </Link>
            <Link href="/realisations" className="btn-outline w-full px-8 py-4 sm:w-auto">
              {t.common.discoverWork}
            </Link>
          </div>
          <dl className="mx-auto mt-14 grid max-w-2xl animate-rise grid-cols-3 divide-x divide-hair border-y border-hair py-5 [animation-delay:440ms] rtl:divide-x-reverse">
            <div>
              <dt className="text-[10px] uppercase tracking-[0.2em] text-ivory-dim sm:text-xs">{t.hero.statBarbers}</dt>
              <dd className="mt-1 font-serif text-3xl text-gold-metal">{barbers.length}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-[0.2em] text-ivory-dim sm:text-xs">{t.hero.statRating}</dt>
              <dd className="mt-1 font-serif text-3xl text-gold-metal">{hoursLabel}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-[0.2em] text-ivory-dim sm:text-xs">{t.hero.statWait}</dt>
              <dd className="mt-1 font-serif text-3xl text-gold-metal">{queue?.shopWaitMinutes != null ? `~${queue.shopWaitMinutes} min` : t.common.closed}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* ── Quick booking ── */}
      <section className="relative z-20 -mt-10 px-4 sm:px-6">
        <div className="container-x">
          <QuickBooking services={services} barbers={barbers} today={todayInTz(shop.timezone)} />
        </div>
      </section>

      {/* ── Services ── */}
      <section className="section">
        <div className="container-x">
          <SectionHeading eyebrow={t.home.servicesEyebrow} title={t.home.servicesTitle} text={t.home.servicesText} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((s) => (
              <ServiceCard key={s.id} service={s} t={t} />
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link href="/services" className="btn-outline">
              {t.common.viewAll}
            </Link>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="section marble marble-soft border-y border-hair">
        <div className="container-x">
          <SectionHeading eyebrow={t.home.howEyebrow} title={t.home.howTitle} />
          <ol className="grid gap-6 md:grid-cols-4">
            {t.home.how.map((step, i) => {
              const Icon = howIcons[i]!;
              return (
                <li key={step.title} className="relative text-center">
                  <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-line bg-ink text-gold">
                    <Icon className="h-6 w-6" strokeWidth={1.3} />
                  </span>
                  <span className="mt-4 block font-display text-xs tracking-[0.3em] text-gold">0{i + 1}</span>
                  <h3 className="mt-2 font-serif text-2xl">{step.title}</h3>
                  <p className="mx-auto mt-2 max-w-xs text-sm text-ivory-muted">{step.text}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* ── Barbers ── */}
      <section className="section">
        <div className="container-x">
          <SectionHeading eyebrow={t.home.barbersEyebrow} title={t.home.barbersTitle} text={t.home.barbersText} />
          <BarberLineup barbers={barbers} centreSlug="nasro" leftSlug="reda" rightSlug="ziko" />
        </div>
      </section>

      {/* ── Gallery preview ── */}
      <section className="section border-t border-hair">
        <div className="container-x">
          <SectionHeading eyebrow={t.home.galleryEyebrow} title={t.home.galleryTitle} text={t.home.galleryText} />
          <GalleryGrid items={portfolio} barbers={barberNames} filters={false} limit={8} />
          <div className="mt-10 text-center">
            <Link href="/realisations" className="btn-outline">
              {t.common.discoverWork}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Live wait ── */}
      <section className="section marble marble-soft border-y border-hair">
        <div className="container-x grid items-center gap-10 lg:grid-cols-[1fr_1.4fr]">
          <SectionHeading eyebrow={t.home.liveEyebrow} title={t.home.liveTitle} text={t.home.liveText} align="start" className="mb-0" />
          <LiveWaitPreview initial={queue} />
        </div>
      </section>

      {/* ── Shop info & location ── */}
      <section className="section border-t border-hair" id="contact">
        <div className="container-x">
          <SectionHeading eyebrow={t.home.infoEyebrow} title={t.home.infoTitle} />
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr_1.4fr]">
            <div className="card p-6">
              <h3 className="font-serif text-2xl">{t.home.hoursTitle}</h3>
              <div className="mt-4">
                <HoursList shop={shop} t={t} />
              </div>
            </div>
            <div className="card flex flex-col p-6">
              <h3 className="font-serif text-2xl">{t.nav.contact}</h3>
              <div className="mt-5 flex-1">
                <ContactList shop={shop} />
              </div>
              <div className="mt-6">
                <ContactActions shop={shop} t={t} />
              </div>
            </div>
            <MapEmbed shop={shop} className="min-h-[360px]" />
          </div>
          <div className="mt-10 flex flex-col items-center gap-4">
            <p className="eyebrow">{t.home.followUs}</p>
            <div className="flex gap-3">
              {[
                { href: shop.socials.instagram, icon: <Instagram className="h-5 w-5" />, label: "Instagram" },
                { href: shop.socials.tiktok, icon: <TikTokIcon className="h-5 w-5" />, label: "TikTok" },
                { href: shop.socials.facebook, icon: <Facebook className="h-5 w-5" />, label: "Facebook" },
                { href: whatsappLink(shop.whatsapp), icon: <WhatsAppIcon className="h-5 w-5" />, label: "WhatsApp" },
              ].map((s) =>
                s.href ? (
                  <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="flex h-12 w-12 items-center justify-center rounded-full border border-line text-gold transition hover:bg-gold/10 hover:text-gold-light">
                    {s.icon}
                  </a>
                ) : (
                  // Link not configured yet (shop.socials) — same look, not clickable.
                  <span key={s.label} title={`${s.label} — bientôt`} aria-label={s.label} className="flex h-12 w-12 items-center justify-center rounded-full border border-line text-gold">
                    {s.icon}
                  </span>
                ),
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Reviews (real, approved reviews only) ── */}
      <section className="section border-t border-hair">
        <div className="container-x">
          <SectionHeading eyebrow={t.home.reviewsEyebrow} title={t.home.reviewsTitle} />
          {reviews.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {reviews.slice(0, 4).map((r) => (
                <ReviewCard key={r.id} review={r} barberName={barberNames[r.barberId]} />
              ))}
            </div>
          ) : null}
          {reviews.length > 0 && isDemoMode() && (
            <p className="mt-6 text-center text-xs text-ivory-dim">Avis d&apos;exemple (mode démo) — remplacés par les vrais avis clients une fois le site en ligne.</p>
          )}
          {reviews.length === 0 && (
            <div className="card mx-auto flex max-w-2xl flex-col items-center px-6 py-12 text-center">
              <Quote className="h-10 w-10 text-gold/40" />
              <p className="mt-4 font-serif text-2xl text-ivory">{t.home.reviewsEmpty}</p>
              <p className="mt-2 max-w-md text-sm text-ivory-muted">{t.home.reviewsHint}</p>
              <Link href="/ma-reservation" className="btn-outline mt-6">
                {t.home.reviewsCta}
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="marble px-4 py-24 text-center sm:px-6 md:py-32">
        <div className="container-x">
          <Ornament diamond={false} />
          <h2 className="mx-auto mt-8 max-w-3xl font-serif text-4xl font-medium sm:text-6xl">{t.home.ctaTitle}</h2>
          <p className="mx-auto mt-5 max-w-lg text-ivory-muted">{t.home.ctaText}</p>
          <Link href="/reservation" className="btn-gold mt-10 px-10 py-4">
            <CalendarCheck className="h-4 w-4" /> {t.common.bookNow}
          </Link>
        </div>
      </section>
    </>
  );
}
