"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import type { Barber, Service } from "@/lib/domain/types";
import { useI18n } from "@/lib/i18n/client";
import { formatDH, formatServicePrice, barbersForServices } from "@/lib/domain/pricing";
import { addDays } from "@/lib/domain/time";

export function QuickBooking({ services, barbers, today }: { services: Service[]; barbers: Barber[]; today: string }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [service, setService] = useState(services[0]?.id ?? "");
  const [barber, setBarber] = useState("");
  const [date, setDate] = useState(today);
  const eligible = barbersForServices(barbers, service ? [service] : []);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const q = new URLSearchParams({ service, date });
        if (barber) q.set("barber", barber);
        router.push(`/reservation?${q}`);
      }}
      className="card grid gap-4 p-5 shadow-gold sm:p-6 lg:grid-cols-[1.3fr_1fr_1fr_auto] lg:items-end"
      aria-label={t.home.quickTitle}
    >
      <div>
        <label className="label" htmlFor="qb-service">
          {t.common.services}
        </label>
        <select id="qb-service" className="field" value={service} onChange={(e) => { setService(e.target.value); setBarber(""); }}>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {formatServicePrice(s, t.common.from)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="qb-barber">
          {t.common.barber}
        </label>
        <select id="qb-barber" className="field" value={barber} onChange={(e) => setBarber(e.target.value)}>
          <option value="">{t.common.anyBarber}</option>
          {eligible.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="qb-date">
          {t.common.date}
        </label>
        <select id="qb-date" className="field" value={date} onChange={(e) => setDate(e.target.value)}>
          {days.map((d, i) => (
            <option key={d} value={d}>
              {i === 0 ? t.common.today : i === 1 ? t.common.tomorrow : new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`))}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="btn-gold h-[42px]">
        {t.home.quickCta} <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
      </button>
    </form>
  );
}
