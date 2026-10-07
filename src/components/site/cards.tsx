import Link from "next/link";
import Image from "next/image";
import clsx from "clsx";
import { ArrowUpRight, Clock, Quote, Phone } from "lucide-react";
import type { Barber, Review, Service } from "@/lib/domain/types";
import type { Dict } from "@/lib/i18n";
import { fmt } from "@/lib/i18n";
import { formatServicePrice } from "@/lib/domain/pricing";
import { formatDuration } from "@/lib/domain/time";
import { whatsappLink } from "@/lib/domain/phone";
import { ServiceIcon } from "@/components/brand/ServiceIcon";
import { MarbleTile, cropFor } from "@/components/brand/MarbleTile";
import { WhatsAppIcon } from "@/components/brand/SocialIcons";
import { Stars } from "@/components/ui";

export function ServiceCard({ service, t, compact }: { service: Service; t: Dict; compact?: boolean }) {
  return (
    <article className="card card-hover group flex h-full flex-col p-6">
      <div className="flex items-start justify-between gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line text-gold transition group-hover:border-gold group-hover:text-gold-light">
          <ServiceIcon name={service.icon} />
        </span>
        <span className="text-end font-serif text-3xl text-gold-metal">{formatServicePrice(service, t.common.from)}</span>
      </div>
      <h3 className="mt-5 font-serif text-2xl">{service.name}</h3>
      {!compact && <p className="mt-2 flex-1 text-sm leading-relaxed text-ivory-muted">{service.description}</p>}
      <div className="mt-5 flex items-center justify-between border-t border-hair pt-4 text-xs">
        <span className="flex items-center gap-1.5 text-ivory-muted">
          <Clock className="h-3.5 w-3.5 text-gold" />
          {formatDuration(service.durationMinutes)}
        </span>
        <Link href={`/reservation?service=${service.id}`} className="inline-flex items-center gap-1 font-semibold uppercase tracking-wider text-gold hover:text-gold-light">
          {t.common.bookNow}
          <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
        </Link>
      </div>
    </article>
  );
}

/** Gold stage spotlight shown on hover (parent needs the `group` class). */
export function Spotlight() {
  return (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 opacity-0 mix-blend-screen transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            "conic-gradient(from 180deg at 50% -10%, transparent 0deg 154deg, rgba(255,232,180,0.28) 166deg, rgba(255,240,205,0.5) 180deg, rgba(255,232,180,0.28) 194deg, transparent 206deg 360deg)",
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: "radial-gradient(ellipse 50% 32% at 50% 20%, rgba(240,200,110,0.35), transparent 70%), radial-gradient(ellipse 50% 12% at 50% 99%, rgba(240,200,110,0.55), transparent 70%)" }}
      />
    </>
  );
}

export function BarberPortrait({ barber, className, rounded }: { barber: Barber; className?: string; rounded?: boolean }) {
  if (!barber.photoUrl) return <MarbleTile seed={barber.slug} monogram={barber.name[0]!} caption={barber.title} className={className} rounded={rounded} />;
  // Cut-out photos sit on a crop of the black marble with a warm gold glow.
  return (
    <div
      className={clsx("relative isolate overflow-hidden bg-ink-2", rounded && "rounded-full", className)}
      style={{ backgroundImage: "url(/images/marble.webp)", backgroundSize: "260%", backgroundPosition: cropFor(barber.slug) }}
    >
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_35%,rgba(201,154,53,0.22),rgba(5,5,5,0.78)_68%)]" />
      <Image
        src={barber.photoUrl}
        alt={barber.name}
        fill
        sizes="(min-width: 1024px) 33vw, 100vw"
        className={clsx(rounded ? "object-cover object-top" : "object-contain object-bottom", "transition duration-500 group-hover:brightness-110")}
      />
      {!rounded && <Spotlight />}
    </div>
  );
}

export function BarberContact({ barber, className }: { barber: Barber; className?: string }) {
  if (!barber.phone) return null;
  return (
    <div className={clsx("flex gap-2", className)}>
      <a href={`tel:${barber.phone}`} className="btn-outline btn-sm" aria-label={`Appeler ${barber.name}`}>
        <Phone className="h-4 w-4" />
      </a>
      <a href={whatsappLink(barber.phone)} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm" aria-label={`WhatsApp ${barber.name}`}>
        <WhatsAppIcon className="h-4 w-4" />
      </a>
    </div>
  );
}

export function BarberCard({ barber, t }: { barber: Barber; t: Dict }) {
  return (
    <article className="card card-hover group overflow-hidden">
      <Link href={`/barbiers/${barber.slug}`} className="block">
        <BarberPortrait barber={barber} className="aspect-[4/5] w-full transition duration-700 group-hover:scale-[1.02]" />
      </Link>
      <div className="p-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-serif text-3xl">{barber.name}</h3>
          {barber.reviewCount > 0 && (
            <span className="flex items-center gap-1.5 text-sm text-gold-light">
              <Stars value={barber.rating} />
              {barber.rating.toFixed(1)}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gold">{barber.title}</p>
        {barber.experienceYears > 0 && <p className="mt-3 text-sm text-ivory-muted">{fmt(t.barbers.experience, { n: barber.experienceYears })}</p>}
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {barber.specialties.map((s) => (
            <li key={s} className="rounded-sm border border-hair px-2 py-0.5 text-[11px] text-ivory-muted">
              {s}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex gap-2">
          <Link href={`/reservation?barber=${barber.id}`} className="btn-gold btn-sm flex-1">
            {fmt(t.barbers.bookWith, { name: barber.name })}
          </Link>
          <BarberContact barber={barber} />
        </div>
      </div>
    </article>
  );
}

export function ReviewCard({ review, barberName }: { review: Review; barberName?: string }) {
  return (
    <figure className="card relative flex h-full flex-col p-7">
      <Quote className="absolute end-6 top-6 h-8 w-8 text-gold/20" />
      <Stars value={review.ratings.overall} />
      <blockquote className="mt-4 flex-1 font-serif text-xl leading-snug text-ivory">“{review.comment}”</blockquote>
      <figcaption className="mt-6 flex items-center justify-between border-t border-hair pt-4 text-sm">
        <span className="font-semibold text-ivory">{review.authorName}</span>
        {barberName && <span className="text-xs uppercase tracking-wider text-gold">{barberName}</span>}
      </figcaption>
    </figure>
  );
}
