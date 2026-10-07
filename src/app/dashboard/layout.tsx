import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { isDemoMode } from "@/lib/repo";
import { can } from "@/lib/domain/permissions";
import { Sidebar } from "@/components/dashboard/Sidebar";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Espace pro", robots: { index: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [session, { t }] = await Promise.all([requireStaff(), getT()]);
  const perms = {
    services: can(session, "services:manage"),
    reviews: can(session, "reviews:moderate"),
    notifications: can(session, "notifications:view"),
    customers: true,
  };
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <Sidebar name={session.name} role={session.role} perms={perms} />
      <div className="min-w-0">
        {isDemoMode() && <div className="border-b border-gold/20 bg-gold/[0.06] px-4 py-2 text-center text-xs text-gold-light">{t.dash.demoBanner}</div>}
        <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</div>
      </div>
    </div>
  );
}
