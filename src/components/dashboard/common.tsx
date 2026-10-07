import Link from "next/link";
import clsx from "clsx";

export function DashHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-hair pb-6">
      <div>
        <h1 className="font-serif text-3xl font-medium sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ivory-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Kpi({ label, value, hint, accent }: { label: string; value: React.ReactNode; hint?: string; accent?: boolean }) {
  return (
    <div className={clsx("card p-5", accent && "border-gold/40")}>
      <p className="text-[11px] uppercase tracking-[0.18em] text-ivory-muted">{label}</p>
      <p className={clsx("mt-2 font-serif text-4xl tabular-nums", accent ? "text-gold-metal" : "text-ivory")}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ivory-dim">{hint}</p>}
    </div>
  );
}

export function Panel({ title, children, className, action }: { title: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <section className={clsx("card p-5 sm:p-6", className)}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="font-serif text-xl">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Barber selector for owner / receptionist (barbers never see it). */
export function BarberTabs({ barbers, current, base, allowAll = true }: { barbers: { id: string; name: string }[]; current: string; base: string; allowAll?: boolean }) {
  const items = [...(allowAll ? [{ id: "all", name: "Tous" }] : []), ...barbers];
  return (
    <div className="flex flex-wrap gap-1 rounded border border-hair p-1">
      {items.map((b) => (
        <Link
          key={b.id}
          href={`${base}${base.includes("?") ? "&" : "?"}barber=${b.id}`}
          className={clsx("rounded-sm px-3 py-1.5 text-xs font-semibold tracking-wide", current === b.id ? "bg-gold/15 text-gold-light" : "text-ivory-muted hover:text-ivory")}
        >
          {b.name}
        </Link>
      ))}
    </div>
  );
}
