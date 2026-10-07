// Timezone-safe helpers. All instants are stored in UTC; wall-clock times are
// interpreted in the shop timezone (Africa/Casablanca by default).

export const SHOP_TZ = "Africa/Casablanca";

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    fmtCache.set(tz, f);
  }
  return f;
}

const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function rawParts(d: Date, tz: string) {
  const p: Record<string, string> = {};
  for (const x of partsFormatter(tz).formatToParts(d)) p[x.type] = x.value;
  if (p.hour === "24") p.hour = "00";
  return p;
}

export interface ZonedParts {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  minutes: number; // minutes since local midnight
  weekday: number;
}

export function zonedParts(d: Date, tz = SHOP_TZ): ZonedParts {
  const p = rawParts(d, tz);
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
    minutes: Number(p.hour) * 60 + Number(p.minute),
    weekday: WD[p.weekday] ?? 0,
  };
}

function offsetMs(d: Date, tz: string) {
  const p = rawParts(d, tz);
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );
  return asUtc - Math.floor(d.getTime() / 1000) * 1000;
}

/** Convert a wall-clock date + time in `tz` to a UTC Date. */
export function zonedToUtc(date: string, time: string, tz = SHOP_TZ): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off1 = offsetMs(new Date(guess), tz);
  let t = guess - off1;
  const off2 = offsetMs(new Date(t), tz);
  if (off2 !== off1) t = guess - off2;
  return new Date(t);
}

export function todayInTz(tz = SHOP_TZ, now = new Date()) {
  return zonedParts(now, tz).date;
}

export function addDays(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function weekdayOf(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Start/end instants of a local calendar day. */
export function dayBounds(date: string, tz = SHOP_TZ) {
  return { start: zonedToUtc(date, "00:00", tz), end: zonedToUtc(addDays(date, 1), "00:00", tz) };
}

export function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function addMinutes(d: Date, min: number) {
  return new Date(d.getTime() + min * 60_000);
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

export function minutesBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 60_000);
}

export function formatTime(iso: string | Date, tz = SHOP_TZ) {
  return zonedParts(typeof iso === "string" ? new Date(iso) : iso, tz).time;
}

export function formatDateLong(iso: string | Date, locale = "fr-FR", tz = SHOP_TZ) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat(locale, {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

export function formatDateShort(iso: string | Date, locale = "fr-FR", tz = SHOP_TZ) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat(locale, { timeZone: tz, day: "2-digit", month: "short" }).format(d);
}

export function formatDuration(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}
