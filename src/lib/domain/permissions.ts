import type { Appointment, Role, Session } from "./types";
import { DomainError } from "./errors";

export type Permission =
  | "dashboard:access"
  | "queue:manage"
  | "appointments:all"
  | "availability:all"
  | "customers:all"
  | "customers:delete"
  | "services:manage"
  | "portfolio:all"
  | "reviews:moderate"
  | "revenue:view"
  | "settings:manage"
  | "notifications:view";

const MATRIX: Record<Role, Permission[]> = {
  owner: [
    "dashboard:access",
    "queue:manage",
    "appointments:all",
    "availability:all",
    "customers:all",
    "customers:delete",
    "services:manage",
    "portfolio:all",
    "reviews:moderate",
    "revenue:view",
    "settings:manage",
    "notifications:view",
  ],
  receptionist: [
    "dashboard:access",
    "queue:manage",
    "appointments:all",
    "availability:all",
    "customers:all",
    "notifications:view",
  ],
  barber: ["dashboard:access", "queue:manage"],
  customer: [],
};

export function can(session: Session | null, perm: Permission): boolean {
  if (!session) return false;
  if (perm === "revenue:view" && session.role === "receptionist") return session.canViewRevenue;
  return MATRIX[session.role].includes(perm);
}

export function assertCan(session: Session | null, perm: Permission): asserts session is Session {
  if (!session) throw new DomainError("UNAUTHENTICATED");
  if (!can(session, perm)) throw new DomainError("FORBIDDEN");
}

export function assertStaff(session: Session | null): asserts session is Session {
  assertCan(session, "dashboard:access");
}

/**
 * Resolves which barber's data a session may see.
 * - owner / receptionist: the requested barber, or "all".
 * - barber: ALWAYS their own id; asking for someone else is forbidden.
 */
export function resolveBarberScope(session: Session, requested?: string | null): string | "all" {
  if (session.role === "barber") {
    if (!session.barberId) throw new DomainError("FORBIDDEN");
    if (requested && requested !== "all" && requested !== session.barberId) throw new DomainError("FORBIDDEN");
    return session.barberId;
  }
  if (session.role === "owner" || session.role === "receptionist") return requested || "all";
  throw new DomainError("FORBIDDEN");
}

/** Can this staff member act on this appointment? */
export function assertCanActOn(session: Session, appt: Appointment) {
  if (can(session, "appointments:all")) return;
  if (session.role === "barber" && (appt.barberId === session.barberId || appt.barberId === null)) return;
  throw new DomainError("FORBIDDEN");
}

export function assertCanManageBarber(session: Session, barberId: string) {
  if (can(session, "availability:all")) return;
  if (session.role === "barber" && session.barberId === barberId) return;
  throw new DomainError("FORBIDDEN");
}
