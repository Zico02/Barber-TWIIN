import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { MobileBookBar } from "@/components/layout/MobileBookBar";
import { getRepo } from "@/lib/repo";
import { getT } from "@/lib/i18n/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/domain/permissions";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [{ t }, shop, session] = await Promise.all([getT(), getRepo().getShop(), getSession()]);
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded focus:bg-gold focus:px-4 focus:py-2 focus:text-ink">
        Aller au contenu
      </a>
      <Navbar staff={can(session, "dashboard:access")} />
      <main id="main">{children}</main>
      <Footer t={t} shop={shop} />
      <MobileBookBar />
    </>
  );
}
