"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, Clock } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";

/** Sticky bottom Book Now bar on mobile (hidden inside the booking flow itself). */
export function MobileBookBar() {
  const { t } = useI18n();
  const path = usePathname();
  if (path.startsWith("/reservation")) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-hair bg-ink/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md sm:hidden">
      <div className="flex gap-2">
        <Link href="/file-attente" className="btn-outline btn-sm flex-none px-4" aria-label={t.nav.queue}>
          <Clock className="h-4 w-4" />
        </Link>
        <Link href="/reservation" className="btn-gold flex-1">
          <CalendarCheck className="h-4 w-4" />
          {t.common.bookNow}
        </Link>
      </div>
    </div>
  );
}
