import clsx from "clsx";
import { Star } from "lucide-react";
import type { AppointmentStatus } from "@/lib/domain/types";
import { Ornament } from "@/components/brand/Logo";

export function SectionHeading({
  eyebrow,
  title,
  text,
  align = "center",
  as: Tag = "h2",
  className,
}: {
  eyebrow?: string;
  title: string;
  text?: string;
  align?: "center" | "start";
  as?: "h1" | "h2";
  className?: string;
}) {
  return (
    <div className={clsx("mb-12 max-w-2xl", align === "center" ? "mx-auto text-center" : "", className)}>
      {eyebrow && <p className="eyebrow mb-4">{eyebrow}</p>}
      <Tag className={clsx("font-serif font-medium leading-[1.05]", Tag === "h1" ? "text-4xl sm:text-6xl" : "text-3xl sm:text-5xl")}>{title}</Tag>
      {align === "center" && <Ornament className="mt-6" />}
      {text && <p className="mt-6 text-base leading-relaxed text-ivory-muted sm:text-lg">{text}</p>}
    </div>
  );
}

const STATUS_STYLE: Record<AppointmentStatus, string> = {
  pending: "border-ivory-dim/40 text-ivory-muted",
  confirmed: "border-gold/50 text-gold-light",
  late: "border-warn/60 text-warn bg-warn-bg",
  arrived: "border-gold-light/70 text-gold-pale bg-gold/10",
  waiting: "border-gold/40 text-gold bg-gold/5",
  called: "border-gold-light text-ink bg-gold-light",
  in_progress: "border-gold text-ink bg-gradient-to-b from-gold-light to-gold",
  completed: "border-ok/50 text-ok bg-ok-bg",
  cancelled: "border-bad/40 text-bad bg-bad-bg",
  no_show: "border-bad/60 text-bad bg-bad-bg",
};

export function StatusBadge({ status, label, className }: { status: AppointmentStatus; label: string; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider", STATUS_STYLE[status], className)}>
      {status === "in_progress" && <span className="h-1.5 w-1.5 animate-pulseGold rounded-full bg-ink" />}
      {label}
    </span>
  );
}

export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={clsx("inline-flex gap-0.5", className)} aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={clsx("h-3.5 w-3.5", i <= Math.round(value) ? "fill-gold text-gold" : "text-ivory-dim")} />
      ))}
    </span>
  );
}

export function EmptyState({ title, text, icon, action }: { title: string; text?: string; icon?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-hair px-6 py-12 text-center">
      {icon && <div className="mb-4 text-gold/70">{icon}</div>}
      <p className="font-serif text-xl text-ivory">{title}</p>
      {text && <p className="mt-2 max-w-sm text-sm text-ivory-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={clsx("inline-block h-4 w-4 animate-spin rounded-full border-2 border-gold/30 border-t-gold", className)} aria-hidden />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded bg-white/[0.04]", className)} />;
}

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: string; error?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? <p className="mt-1.5 text-xs text-bad" role="alert">{error}</p> : hint ? <p className="mt-1.5 text-xs text-ivory-dim">{hint}</p> : null}
    </div>
  );
}
