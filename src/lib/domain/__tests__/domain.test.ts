import { test } from "node:test";
import assert from "node:assert/strict";
import { generateSlots, checkRange, getWorkingWindow, type SlotContext } from "../slots";
import { pickNext, orderQueue, bumpToMoveLower } from "../queue";
import { estimateWaits } from "../waiting";
import { zonedToUtc, formatTime } from "../time";
import { normalizePhone } from "../phone";
import { canTransition } from "../status";
import { resolveBarberScope } from "../permissions";
import type { Appointment, AvailabilityRule, Barber, Session } from "../types";

const DATE = "2026-10-06"; // a Tuesday
const rules: AvailabilityRule[] = [
  { id: "r", barberId: "b1", weekday: 2, start: "10:00", end: "20:00", breaks: [{ start: "13:00", end: "14:00" }] },
];
const at = (hm: string) => zonedToUtc(DATE, hm);

const ctx = (over: Partial<SlotContext> = {}): SlotContext => ({
  date: DATE,
  rules,
  exceptions: [],
  blocks: [],
  busy: [],
  durationMinutes: 80, // haircut 30 + beard 20 + facial 30
  stepMinutes: 15,
  minLeadMinutes: 0,
  now: zonedToUtc("2026-10-01", "09:00"),
  ...over,
});

test("timezone: Casablanca wall clock round-trips", () => {
  assert.equal(formatTime(at("10:30")), "10:30");
});

test("multi-service duration blocks the COMPLETE period", () => {
  // Existing booking 12:00–12:30: an 80-min booking at 11:00 would overlap → must be refused.
  const busy = [{ start: at("12:00"), end: at("12:30") }];
  assert.deepEqual(checkRange(ctx({ busy }), at("11:00")), { ok: false, reason: "booked" });
  assert.deepEqual(checkRange(ctx({ busy }), at("10:45")), { ok: false, reason: "booked" });
});

test("slot at 10:00 for 80 min is fine before a 12:00 booking", () => {
  const busy = [{ start: at("12:00"), end: at("12:30") }];
  // 10:00 + 80 = 11:20 → no overlap
  assert.deepEqual(checkRange(ctx({ busy, durationMinutes: 80 }), at("10:00")), { ok: true });
});

test("breaks, closing time and blocked periods are respected", () => {
  assert.equal(checkRange(ctx(), at("12:00")).ok, false); // runs into 13:00 break
  assert.equal(checkRange(ctx(), at("19:00")).ok, false); // ends after 20:00
  const blocks = [{ id: "x", barberId: "b1", kind: "time_block" as const, startAt: at("15:00").toISOString(), endAt: at("16:00").toISOString() }];
  assert.equal(checkRange(ctx({ blocks }), at("14:30")).ok, false);
  assert.equal(checkRange(ctx({ blocks }), at("16:00")).ok, true);
});

test("generateSlots returns step-aligned slots, none overlapping busy time", () => {
  const busy = [{ start: at("16:00"), end: at("17:00") }];
  const slots = generateSlots(ctx({ busy, durationMinutes: 30 })).filter((s) => s.available);
  assert.ok(slots.length > 10);
  for (const s of slots) {
    const st = new Date(s.start);
    const en = new Date(s.end);
    assert.ok(!(st < busy[0].end && busy[0].start < en), `slot ${formatTime(st)} overlaps`);
  }
});

test("exceptions override weekly hours; no rule = closed", () => {
  assert.equal(getWorkingWindow("2026-10-05", rules, []), null); // Monday
  const w = getWorkingWindow("2026-10-05", rules, [{ id: "e", barberId: "b1", date: "2026-10-05", start: "12:00", end: "16:00" }]);
  assert.equal(formatTime(w!.start), "12:00");
});

// ── Queue ──
let n = 0;
const appt = (p: Partial<Appointment>): Appointment => ({
  id: `a${++n}`, reference: "BT-XXXXX", barberId: "b1", customerId: "c", customerName: "Client Test", customerPhone: "",
  services: [], startAt: null, endAt: null, durationMinutes: 30, totalPrice: 70, finalPrice: null, status: "waiting",
  source: "walk_in", lateCancellation: false, createdAt: at("09:00").toISOString(), updatedAt: at("09:00").toISOString(),
  queue: null, ...p,
});
const ticket = (a: Partial<Appointment>, arrived: Date, extra: Partial<NonNullable<Appointment["queue"]>> = {}) => {
  const x = appt({ ...a, arrivedAt: arrived.toISOString() });
  x.queue = { id: `q${x.id}`, appointmentId: x.id, ticketNumber: n, ticketCode: `B${n}`, arrivedAt: arrived.toISOString(), priority: 0, bumpMinutes: 0, waitAdjustMinutes: 0, ...extra };
  return x;
};

test("due appointment holder is called before earlier walk-ins", () => {
  const now = at("11:00");
  const walkIn = ticket({}, at("10:30"));
  const holder = ticket({ source: "online", startAt: at("11:00").toISOString(), endAt: at("11:30").toISOString(), status: "arrived" }, at("10:55"));
  const r = pickNext("b1", [walkIn, holder], now);
  assert.equal(r.next?.id, holder.id);
  assert.equal(r.reason, "due_appointment");
});

test("late appointment holder (>15 min) loses priority", () => {
  const now = at("11:30");
  const walkIn = ticket({}, at("11:10"));
  const late = ticket({ source: "online", startAt: at("11:00").toISOString(), endAt: at("11:30").toISOString(), status: "arrived" }, at("11:25"));
  assert.equal(pickNext("b1", [walkIn, late], now).next?.id, walkIn.id);
});

test("walk-in that would overrun the next booking is skipped", () => {
  const now = at("11:00");
  const long = ticket({ durationMinutes: 50 }, at("10:40"));
  const short = ticket({ durationMinutes: 20 }, at("10:50"));
  const booking = appt({ source: "online", status: "confirmed", startAt: at("11:30").toISOString(), endAt: at("12:00").toISOString() });
  const r = pickNext("b1", [long, short, booking], now);
  assert.equal(r.next?.id, short.id);
  assert.equal(r.skipped[0].appointment.id, long.id);
});

test("barber already busy cannot call next", () => {
  const busy = appt({ status: "in_progress", startedAt: at("10:50").toISOString() });
  assert.equal(pickNext("b1", [busy, ticket({}, at("10:40"))], at("11:00")).reason, "busy");
});

test("move lower places the client after the next one; arrival time untouched", () => {
  const now = at("11:00");
  const a = ticket({}, at("10:30"));
  const b = ticket({}, at("10:40"));
  const bump = bumpToMoveLower(a, orderQueue([a, b], now, "b1"))!;
  a.queue!.bumpMinutes = bump;
  const order = orderQueue([a, b], now, "b1").map((e) => e.appointment.id);
  assert.deepEqual(order, [b.id, a.id]);
  assert.equal(a.queue!.arrivedAt, at("10:30").toISOString());
});

test("waiting estimate accounts for service in progress and queue", () => {
  const now = at("11:00");
  const barber = { id: "b1", delayMinutes: 0 } as Barber;
  const current = appt({ status: "in_progress", startedAt: at("10:50").toISOString(), durationMinutes: 30 }); // 20 min left
  const w1 = ticket({ durationMinutes: 30 }, at("10:45"));
  const w2 = ticket({ durationMinutes: 30 }, at("10:55"));
  const est = estimateWaits({
    barbers: [barber],
    appointments: [current, w1, w2],
    windows: { b1: { start: at("10:00"), end: at("20:00"), breaks: [] } },
    now,
  });
  assert.equal(est.entries[w1.id].waitMinutes, 20);
  assert.equal(est.entries[w2.id].waitMinutes, 50);
  assert.equal(est.barbers.b1.status, "busy");
});

test("barber delay is added to estimates", () => {
  const now = at("11:00");
  const w = ticket({}, at("10:58"));
  const est = estimateWaits({
    barbers: [{ id: "b1", delayMinutes: 15 } as Barber],
    appointments: [w],
    windows: { b1: { start: at("10:00"), end: at("20:00"), breaks: [] } },
    now,
  });
  assert.equal(est.entries[w.id].waitMinutes, 15);
});

test("« libre dans » follows the booked end, plus the next booked client", () => {
  const barber = { id: "b1", delayMinutes: 0 } as Barber;
  const windows = { b1: { start: at("10:00"), end: at("20:00"), breaks: [] } };
  // 11:00–12:30 booking, chair timer started late at 11:47, it is 12:26 → free at 12:30.
  const shaving = appt({ status: "in_progress", source: "online", startAt: at("11:00").toISOString(), endAt: at("12:30").toISOString(), durationMinutes: 90, startedAt: at("11:47").toISOString() });
  const alone = estimateWaits({ barbers: [barber], appointments: [shaving], windows, now: at("12:26") });
  assert.equal(alone.barbers.b1.nextFreeMinutes, 4);
  // Next client booked 12:30–13:00 right after → 4 + 30 min.
  const next = appt({ status: "confirmed", source: "online", startAt: at("12:30").toISOString(), endAt: at("13:00").toISOString(), durationMinutes: 30 });
  const chained = estimateWaits({ barbers: [barber], appointments: [shaving, next], windows, now: at("12:26") });
  assert.equal(chained.barbers.b1.nextFreeMinutes, 34);
});

test("phone normalisation (Morocco)", () => {
  assert.equal(normalizePhone("06 12 34 56 78"), "+212612345678");
  assert.equal(normalizePhone("+212 7 12 34 56 78"), "+212712345678");
  assert.equal(normalizePhone("12345"), null);
});

test("status transitions", () => {
  assert.ok(canTransition("waiting", "called"));
  assert.ok(!canTransition("completed", "waiting"));
});

test("barbers can never scope to another barber", () => {
  const s: Session = { userId: "u", name: "Adam", role: "barber", barberId: "b1", customerId: null, canViewRevenue: false };
  assert.equal(resolveBarberScope(s, null), "b1");
  assert.throws(() => resolveBarberScope(s, "b2"));
});


test("30-minute grid: clients only get hh:00 / hh:30, lunch 15:00–16:00 excluded", () => {
  const shopRules: AvailabilityRule[] = [
    { id: "r2", barberId: "b1", weekday: 2, start: "11:00", end: "22:00", breaks: [{ start: "15:00", end: "16:00" }] },
  ];
  const slots = generateSlots(ctx({ rules: shopRules, durationMinutes: 30, stepMinutes: 30 })).filter((s) => s.available);
  const times = slots.map((s) => formatTime(s.start));
  assert.ok(times.every((t) => t.endsWith(":00") || t.endsWith(":30")));
  assert.equal(times[0], "11:00");
  assert.equal(times.at(-1), "21:30");
  assert.ok(!times.includes("15:00") && !times.includes("15:30"));
  assert.ok(times.includes("14:30") && times.includes("16:00"));
});

test("a booked client whose slot is now counts as in the chair (queue stays in sync)", () => {
  const now = at("11:10");
  const booked = appt({ source: "online", status: "confirmed", startAt: at("11:00").toISOString(), endAt: at("11:30").toISOString() });
  const walkIn = ticket({}, at("11:05"));
  const est = estimateWaits({
    barbers: [{ id: "b1", delayMinutes: 0 } as Barber],
    appointments: [booked, walkIn],
    windows: { b1: { start: at("10:00"), end: at("20:00"), breaks: [] } },
    now,
  });
  assert.equal(est.barbers.b1.status, "busy");
  assert.equal(est.entries[walkIn.id].waitMinutes, 20);
});

test("late clients can be completed or restored", () => {
  assert.ok(canTransition("confirmed", "late"));
  assert.ok(canTransition("late", "completed"));
  assert.ok(canTransition("completed", "confirmed"));
  // Mis-tap corrections in « Ma journée »: Terminé ⇄ Annulé ⇄ Retard
  assert.ok(canTransition("completed", "cancelled"));
  assert.ok(canTransition("completed", "late"));
  assert.ok(canTransition("cancelled", "completed"));
  assert.ok(canTransition("cancelled", "late"));
});
