import type { Metadata } from "next";
import { getRepo } from "@/lib/repo";
import { getT } from "@/lib/i18n/server";
import { todayInTz, addDays } from "@/lib/domain/time";
import { PageHero } from "@/components/site/PageHero";
import { BookingWizard } from "@/components/booking/BookingWizard";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.booking.title, description: t.booking.subtitle };
}

export default async function ReservationPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const repo = getRepo();
  const [{ t }, shop, services, barbers, rules, exceptions] = await Promise.all([
    getT(),
    repo.getShop(),
    repo.listServices(),
    repo.listBarbers(),
    repo.listAvailability(),
    repo.listExceptions(),
  ]);
  const today = todayInTz(shop.timezone);
  const workingDays: Record<string, number[]> = {};
  for (const b of barbers) {
    workingDays[b.id] = [...new Set(rules.filter((r) => r.barberId === b.id).map((r) => r.weekday))];
    // Exceptional openings make that weekday selectable too.
    for (const e of exceptions.filter((x) => x.barberId === b.id && x.date >= today)) workingDays[b.id]!.push(new Date(`${e.date}T12:00:00Z`).getUTCDay());
  }
  const validService = sp.service && services.some((s) => s.id === sp.service) ? [sp.service] : [];
  const validBarber = sp.barber && barbers.some((b) => b.id === sp.barber) ? sp.barber : null;
  const maxDate = addDays(today, shop.settings.maxDaysAhead);
  const validDate = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date >= today && sp.date <= maxDate ? sp.date : null;

  return (
    <>
      <PageHero eyebrow={t.booking.eyebrow} title={t.booking.title} text={t.booking.subtitle} />
      <section className="px-4 py-12 sm:px-6 md:py-16">
        <div className="container-x">
          <BookingWizard
            services={services}
            barbers={barbers}
            workingDays={workingDays}
            today={today}
            maxDaysAhead={shop.settings.maxDaysAhead}
            freeUntilHours={shop.settings.cancellation.freeUntilHours}
            initial={{ serviceIds: validService, barberId: validBarber ?? (validService.length && sp.date ? "any" : null), date: validDate }}
          />
        </div>
      </section>
    </>
  );
}
