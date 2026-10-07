import Link from "next/link";
import { Instagram, Facebook, Phone, MapPin, Mail } from "lucide-react";
import Image from "next/image";
import { Ornament } from "@/components/brand/Logo";
import type { Dict } from "@/lib/i18n";
import type { Shop } from "@/lib/domain/types";
import { formatPhone, whatsappLink } from "@/lib/domain/phone";
import { TikTokIcon, WhatsAppIcon } from "@/components/brand/SocialIcons";

export function Footer({ t, shop }: { t: Dict; shop: Shop }) {
  const year = new Date().getFullYear();
  return (
    <footer className="marble marble-soft border-t border-hair pb-28 pt-16 sm:pb-12">
      <div className="container-x px-4 sm:px-6">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Image src="/images/logo-footer.webp" alt="Barber TWIIN" width={640} height={185} className="h-14 w-auto sm:h-16" />
            <p className="mt-5 max-w-sm whitespace-pre-line text-sm leading-relaxed text-ivory-muted">{t.footer.tagline}</p>
            <div className="mt-6 flex gap-2">
              {[
                { href: whatsappLink(shop.whatsapp), label: "WhatsApp", icon: <WhatsAppIcon className="h-4 w-4" /> },
                { href: shop.socials.instagram, label: "Instagram", icon: <Instagram className="h-4 w-4" /> },
                { href: shop.socials.facebook, label: "Facebook", icon: <Facebook className="h-4 w-4" /> },
                { href: shop.socials.tiktok, label: "TikTok", icon: <TikTokIcon className="h-4 w-4" /> },
              ].map((s) =>
                s.href ? (
                  <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="flex h-10 w-10 items-center justify-center rounded border border-hair text-ivory-muted transition hover:border-gold hover:text-gold-light">
                    {s.icon}
                  </a>
                ) : (
                  // Link not configured yet (shop.socials) — same look, not clickable.
                  <span key={s.label} aria-label={s.label} className="flex h-10 w-10 items-center justify-center rounded border border-hair text-ivory-muted">
                    {s.icon}
                  </span>
                ),
              )}
            </div>
          </div>
          <div>
            <p className="eyebrow mb-4">{t.footer.explore}</p>
            <ul className="grid grid-cols-2 gap-x-8 gap-y-2.5 text-sm text-ivory-muted">
              {[
                ["/barbiers", t.nav.barbers],
                ["/realisations", t.nav.gallery],
                ["/services", t.nav.services],
                ["/reservation", t.nav.booking],
                ["/file-attente", t.nav.queue],
                ["/connexion", t.nav.dashboard],
                ["/ma-reservation", t.nav.lookup],
              ].map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="hover:text-gold-light">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="eyebrow mb-4">{t.footer.visit}</p>
            <ul className="space-y-3 text-sm text-ivory-muted">
              <li className="flex gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <span>
                  {shop.address}, {shop.city}
                </span>
              </li>
              <li className="flex gap-3">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <a href={`tel:${shop.phone}`} className="hover:text-gold-light">
                  {formatPhone(shop.phone)}
                </a>
              </li>
              {shop.email && <li className="flex gap-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <a href={`mailto:${shop.email}`} className="hover:text-gold-light">
                  {shop.email}
                </a>
              </li>}
            </ul>
          </div>
        </div>
        <Ornament className="mt-14" />
        <p className="mt-6 text-center text-xs text-ivory-dim">
          © {year} Barber TWIIN. {t.footer.rights}
        </p>
      </div>
    </footer>
  );
}
