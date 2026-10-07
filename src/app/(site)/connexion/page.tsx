import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/domain/permissions";
import { isDemoMode } from "@/lib/repo";
import { DEMO_USERS } from "@/lib/repo/seed";
import { Logo, Ornament } from "@/components/brand/Logo";
import { LoginForm, DemoLogin } from "@/components/auth/LoginForms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Connexion", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ t }, session, sp] = await Promise.all([getT(), getSession(), searchParams]);
  if (session && can(session, "dashboard:access")) redirect("/dashboard");
  const demo = isDemoMode();
  return (
    <section className="marble flex min-h-[100svh] items-center justify-center px-4 py-28">
      <div className="card w-full max-w-md animate-rise p-8">
        <div className="text-center">
          <Logo size="md" />
          <h1 className="mt-6 font-serif text-3xl">{t.login.title}</h1>
          <p className="mt-2 text-sm text-ivory-muted">{t.login.subtitle}</p>
        </div>
        <Ornament className="my-6" />
        {demo ? (
          <DemoLogin users={DEMO_USERS.map((u) => ({ id: u.userId, label: u.label, role: u.role }))} next={sp.next} title={t.login.demoTitle} text={t.login.demoText} />
        ) : (
          <LoginForm next={sp.next} />
        )}
        <p className="mt-8 border-t border-hair pt-6 text-center text-xs text-ivory-muted">
          {t.login.customerHint}{" "}
          <Link href="/ma-reservation" className="text-gold hover:text-gold-light">
            {t.nav.lookup}
          </Link>
        </p>
      </div>
    </section>
  );
}
