"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Menu, X, CalendarCheck } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { useI18n } from "@/lib/i18n/client";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function Navbar({ staff }: { staff: boolean }) {
  const { t } = useI18n();
  const path = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  const links = [
    { href: "/", label: t.nav.home },
    { href: "/barbiers", label: t.nav.barbers },
    { href: "/services", label: t.nav.services },
    { href: "/realisations", label: t.nav.gallery },
    { href: "/file-attente", label: t.nav.queue },
    { href: "/a-propos", label: t.nav.about },
    { href: "/contact", label: t.nav.contact },
  ];
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <header
      className={clsx(
        "fixed inset-x-0 top-0 z-50 transition-all duration-500",
        scrolled || open ? "border-b border-hair bg-ink/90 backdrop-blur-md" : "border-b border-transparent bg-gradient-to-b from-ink/80 to-transparent",
      )}
    >
      <nav className="container-x flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:h-20" aria-label="Navigation principale">
        <Link href="/" className="shrink-0" aria-label="Barber TWIIN — Accueil">
          <Logo size="sm" className="sm:text-2xl" />
        </Link>

        <ul className="hidden items-center gap-1 xl:flex">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className={clsx(
                  "relative whitespace-nowrap px-2.5 py-2 text-[13px] font-medium tracking-wide transition-colors",
                  active(l.href) ? "text-gold-light" : "text-ivory-muted hover:text-ivory",
                )}
              >
                {l.label}
                {active(l.href) && <span className="absolute inset-x-3 -bottom-0.5 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <div className="hidden md:block">
            <LanguageSwitcher />
          </div>
          <Link href={staff ? "/dashboard" : "/ma-reservation"} className="btn-ghost btn-sm hidden lg:inline-flex">
            {staff ? t.nav.dashboard : t.nav.lookup}
          </Link>
          <Link href="/reservation" className="btn-gold btn-sm hidden sm:inline-flex">
            <CalendarCheck className="h-4 w-4" />
            {t.common.bookNow}
          </Link>
          <button className="btn-ghost btn-sm xl:hidden" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={t.nav.menu}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="marble marble-soft h-[calc(100dvh-4rem)] overflow-y-auto border-t border-hair xl:hidden">
          <ul className="flex flex-col px-6 py-6">
            {[...links, { href: "/ma-reservation", label: t.nav.lookup }, { href: staff ? "/dashboard" : "/connexion", label: staff ? t.nav.dashboard : t.nav.login }].map((l) => (
              <li key={l.href} className="border-b border-hair/60">
                <Link href={l.href} className={clsx("block py-4 font-serif text-2xl", active(l.href) ? "text-gold-light" : "text-ivory")}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between px-6 pb-10">
            <LanguageSwitcher />
            <Link href="/reservation" className="btn-gold">
              {t.common.bookNow}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
