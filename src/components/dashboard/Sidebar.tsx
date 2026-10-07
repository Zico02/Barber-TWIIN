"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { CalendarCheck, LayoutDashboard, ListOrdered, CalendarDays, Clock3, Users, Scissors, Images, Star, Bell, ExternalLink, LogOut, Menu, X, MonitorPlay } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n";
import { logoutAction } from "@/actions/auth";
import type { Role } from "@/lib/domain/types";

const ROLE_LABEL: Record<Role, string> = { owner: "Propriétaire", barber: "Barbier", receptionist: "Réception", customer: "Client" };

export function Sidebar({ name, role, perms }: { name: string; role: Role; perms: { services: boolean; reviews: boolean; notifications: boolean; customers: boolean } }) {
  const { t } = useI18n();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const items = [
    { href: "/dashboard/journee", label: role === "barber" ? "Ma journée" : "Journées", icon: CalendarCheck },
    { href: "/dashboard/file", label: t.dash.queue, icon: ListOrdered },
    { href: "/dashboard/agenda", label: t.dash.agenda, icon: CalendarDays, show: role !== "barber" },
    { href: role === "barber" ? "/dashboard?stats=1" : "/dashboard", label: role === "barber" ? "Mes stats" : t.dash.overview, icon: LayoutDashboard },
    { href: "/dashboard/disponibilites", label: t.dash.availability, icon: Clock3 },
    { href: "/dashboard/clients", label: t.dash.customers, icon: Users, show: perms.customers },
    { href: "/dashboard/services", label: t.dash.services, icon: Scissors, show: perms.services },
    { href: "/dashboard/portfolio", label: t.dash.portfolio, icon: Images },
    { href: "/dashboard/avis", label: t.dash.reviews, icon: Star, show: perms.reviews },
    { href: "/dashboard/notifications", label: t.dash.notifications, icon: Bell, show: perms.notifications },
  ].filter((i) => i.show !== false);
  const active = (href: string) => (href.startsWith("/dashboard?") || href === "/dashboard" ? path === "/dashboard" : path.startsWith(href));

  const nav = (
    <nav className="flex h-full flex-col">
      <div className="px-6 py-6">
        <Link href="/" aria-label="Barber TWIIN">
          <Logo size="sm" />
        </Link>
        <p className="mt-6 font-serif text-lg text-ivory">{fmt(t.dash.hello, { name: name.split(" ")[0]! })}</p>
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold">{ROLE_LABEL[role]}</p>
      </div>
      <ul className="flex-1 space-y-0.5 px-3">
        {items.map((i) => (
          <li key={i.href}>
            <Link
              href={i.href}
              onClick={() => setOpen(false)}
              className={clsx(
                "flex items-center gap-3 rounded px-3 py-2.5 text-sm transition",
                active(i.href) ? "border-s-2 border-gold bg-gold/10 text-gold-light" : "text-ivory-muted hover:bg-white/[0.03] hover:text-ivory",
              )}
            >
              <i.icon className="h-4 w-4" strokeWidth={1.6} /> {i.label}
            </Link>
          </li>
        ))}
      </ul>
      <div className="space-y-1 border-t border-hair px-3 py-4">
        <Link href="/affichage" target="_blank" className="flex items-center gap-3 rounded px-3 py-2 text-sm text-ivory-muted hover:text-gold-light">
          <MonitorPlay className="h-4 w-4" /> {t.queue.display}
        </Link>
        <Link href="/" className="flex items-center gap-3 rounded px-3 py-2 text-sm text-ivory-muted hover:text-gold-light">
          <ExternalLink className="h-4 w-4" /> {t.dash.viewSite}
        </Link>
        <form action={logoutAction}>
          <button className="flex w-full items-center gap-3 rounded px-3 py-2 text-sm text-ivory-muted hover:text-bad">
            <LogOut className="h-4 w-4" /> {t.nav.logout}
          </button>
        </form>
      </div>
    </nav>
  );

  return (
    <>
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-hair bg-ink/95 px-4 py-3 backdrop-blur lg:hidden">
        <Logo size="sm" />
        <button className="btn-ghost btn-sm" onClick={() => setOpen((v) => !v)} aria-label={t.nav.menu} aria-expanded={open}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && <div className="fixed inset-0 top-[57px] z-40 overflow-y-auto bg-ink-2 lg:hidden">{nav}</div>}
      <aside className="marble marble-soft sticky top-0 hidden h-dvh border-e border-hair lg:block">{nav}</aside>
    </>
  );
}
