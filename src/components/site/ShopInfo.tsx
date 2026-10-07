import { MapPin, Navigation, Phone, Mail, Instagram, Facebook } from "lucide-react";
import type { Shop } from "@/lib/domain/types";
import type { Dict } from "@/lib/i18n";
import { formatPhone, whatsappLink } from "@/lib/domain/phone";
import { zonedParts } from "@/lib/domain/time";
import { TikTokIcon, WhatsAppIcon } from "@/components/brand/SocialIcons";

export function HoursList({ shop, t }: { shop: Shop; t: Dict }) {
  const today = zonedParts(new Date(), shop.timezone).weekday;
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <ul className="divide-y divide-hair/70">
      {order.map((d) => {
        const h = shop.hours.find((x) => x.day === d);
        const isToday = d === today;
        return (
          <li key={d} className={`flex items-center justify-between py-2.5 text-sm ${isToday ? "text-gold-light" : "text-ivory-muted"}`}>
            <span className="flex items-center gap-2">
              {isToday && <span className="h-1.5 w-1.5 rounded-full bg-gold" />}
              {t.days[d]}
            </span>
            <span className="tabular-nums">{h?.open ? `${h.open} – ${h.close}` : t.common.closed}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function MapEmbed({ shop, className }: { shop: Shop; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-md border border-line ${className ?? ""}`}>
      <iframe
        title={`Google Maps — ${shop.name}`}
        src={`https://www.google.com/maps?q=${shop.lat},${shop.lng}&z=17&output=embed`}
        className="h-full min-h-[320px] w-full grayscale-[85%] invert-[92%] hue-rotate-180 contrast-[0.9]"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-gold/20" />
    </div>
  );
}

export function directionsUrl(shop: Shop) {
  return `https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lng}`;
}

export function ContactActions({ shop, t }: { shop: Shop; t: Dict }) {
  return (
    <div className="flex flex-wrap gap-2">
      <a href={`tel:${shop.phone}`} className="btn-gold btn-sm">
        <Phone className="h-4 w-4" /> {t.common.call}
      </a>
      <a href={whatsappLink(shop.whatsapp)} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">
        <WhatsAppIcon className="h-4 w-4" /> {t.common.whatsapp}
      </a>
      <a href={directionsUrl(shop)} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">
        <Navigation className="h-4 w-4" /> {t.common.directions}
      </a>
    </div>
  );
}

export function ContactList({ shop }: { shop: Shop }) {
  const rows = [
    { icon: <MapPin className="h-4 w-4" />, label: `${shop.address}, ${shop.city}`, href: directionsUrl(shop) },
    { icon: <Phone className="h-4 w-4" />, label: formatPhone(shop.phone), href: `tel:${shop.phone}` },
    { icon: <WhatsAppIcon className="h-4 w-4" />, label: formatPhone(shop.whatsapp), href: whatsappLink(shop.whatsapp) },
    { icon: <Mail className="h-4 w-4" />, label: shop.email, href: `mailto:${shop.email}` },
    { icon: <Instagram className="h-4 w-4" />, label: "Instagram", href: shop.socials.instagram },
    { icon: <TikTokIcon className="h-4 w-4" />, label: "TikTok", href: shop.socials.tiktok },
    { icon: <Facebook className="h-4 w-4" />, label: "Facebook", href: shop.socials.facebook },
  ].filter((r) => r.label && r.href && !r.href.endsWith(":"));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.href}>
          <a href={r.href} target={r.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="group flex items-center gap-3 text-sm text-ivory-muted hover:text-gold-light">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-hair text-gold group-hover:border-gold">{r.icon}</span>
            {r.label}
          </a>
        </li>
      ))}
    </ul>
  );
}
