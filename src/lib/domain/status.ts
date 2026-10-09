import type { AppointmentStatus } from "./types";

/**
 * Allowed status transitions. Used by the queue board (drag & drop) and by every
 * server action that changes a status, so the UI can never put data in an invalid state.
 */
export const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  pending: ["confirmed", "late", "arrived", "waiting", "in_progress", "completed", "cancelled", "no_show"],
  confirmed: ["pending", "late", "arrived", "waiting", "in_progress", "completed", "cancelled", "no_show"],
  late: ["confirmed", "arrived", "waiting", "in_progress", "completed", "cancelled", "no_show"],
  arrived: ["waiting", "called", "in_progress", "completed", "cancelled", "no_show"],
  waiting: ["arrived", "called", "in_progress", "completed", "cancelled", "no_show"],
  called: ["waiting", "in_progress", "completed", "no_show", "cancelled"],
  in_progress: ["completed", "called", "confirmed", "late", "cancelled", "no_show"],
  // Final states stay correctable: a mis-tap on « Terminé » / « Annulé » can be switched directly.
  completed: ["in_progress", "confirmed", "late", "cancelled", "no_show"],
  cancelled: ["confirmed", "late", "completed", "no_show"], // restoring needs the slot to still be free
  no_show: ["confirmed", "late", "arrived", "waiting", "completed", "cancelled"],
};

export function canTransition(from: AppointmentStatus, to: AppointmentStatus) {
  return from === to || TRANSITIONS[from].includes(to);
}

/** Queue-board columns in display order. */
export const BOARD_COLUMNS: { id: string; statuses: AppointmentStatus[]; drop: AppointmentStatus }[] = [
  { id: "upcoming", statuses: ["pending", "confirmed", "late"], drop: "confirmed" },
  { id: "arrived", statuses: ["arrived"], drop: "arrived" },
  { id: "waiting", statuses: ["waiting"], drop: "waiting" },
  { id: "called", statuses: ["called"], drop: "called" },
  { id: "in_progress", statuses: ["in_progress"], drop: "in_progress" },
  { id: "completed", statuses: ["completed"], drop: "completed" },
  { id: "no_show", statuses: ["no_show", "cancelled"], drop: "no_show" },
];

/** Timestamp field to set when entering a status (original times are never overwritten). */
export function timestampFor(status: AppointmentStatus) {
  switch (status) {
    case "confirmed":
      return "confirmedAt";
    case "arrived":
    case "waiting":
      return "arrivedAt";
    case "called":
      return "calledAt";
    case "in_progress":
      return "startedAt";
    case "completed":
      return "completedAt";
    case "cancelled":
      return "cancelledAt";
    default:
      return null;
  }
}
