export type DomainErrorCode =
  | "SLOT_TAKEN"
  | "BARBER_UNAVAILABLE"
  | "OUTSIDE_HOURS"
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "UNAUTHENTICATED"
  | "INVALID_TRANSITION"
  | "BARBER_BUSY"
  | "QUEUE_EMPTY"
  | "CONFLICTS"
  | "TOO_LATE";

export class DomainError extends Error {
  constructor(
    public code: DomainErrorCode,
    message?: string,
    public data?: unknown,
  ) {
    super(message ?? code);
    this.name = "DomainError";
  }
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; code: DomainErrorCode | "UNKNOWN"; message: string; data?: unknown };
