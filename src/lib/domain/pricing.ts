import type { AppointmentServiceLine, Barber, Service } from "./types";

export function formatDH(amount: number) {
  return `${new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 0 }).format(amount)} DH`;
}

/** Duration of a service for a given barber (per-barber override if any). */
export function serviceDuration(service: Service, barber?: Barber | null) {
  return barber?.durationOverrides?.[service.id] ?? service.durationMinutes;
}

export function buildServiceLines(services: Service[], barber?: Barber | null): AppointmentServiceLine[] {
  return services.map((s) => ({
    serviceId: s.id,
    name: s.name,
    price: s.price,
    durationMinutes: serviceDuration(s, barber),
  }));
}

export function totals(lines: Pick<AppointmentServiceLine, "price" | "durationMinutes">[]) {
  return lines.reduce(
    (acc, l) => ({ price: acc.price + l.price, duration: acc.duration + l.durationMinutes }),
    { price: 0, duration: 0 },
  );
}

/** Barbers who provide every one of the selected services. */
export function barbersForServices(barbers: Barber[], serviceIds: string[]) {
  return barbers.filter((b) => b.active && serviceIds.every((id) => b.serviceIds.includes(id)));
}

/** "30 DH" or "dès 100 DH" for services whose price depends on hair length. */
export function formatServicePrice(s: Pick<Service, "price" | "priceFrom">, fromLabel = "dès") {
  return s.priceFrom ? `${fromLabel} ${formatDH(s.price)}` : formatDH(s.price);
}
