import "server-only";
import { ZodError } from "zod";
import { DomainError, type ActionResult } from "@/lib/domain/errors";
import { firstError } from "@/lib/domain/validation";

const MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "Veuillez vous connecter.",
  FORBIDDEN: "Vous n'avez pas l'autorisation d'effectuer cette action.",
  NOT_FOUND: "Élément introuvable.",
  SLOT_TAKEN: "Ce créneau vient d'être réservé. Choisissez un autre horaire.",
  BARBER_UNAVAILABLE: "Barbier indisponible.",
  OUTSIDE_HOURS: "Hors des horaires d'ouverture.",
  INVALID_TRANSITION: "Ce changement de statut n'est pas autorisé.",
  BARBER_BUSY: "Terminez d'abord le client en cours.",
  QUEUE_EMPTY: "Personne en attente.",
};

/** Wraps a server action: validation & domain errors become a typed result, never a crash. */
export async function safe<T>(fn: () => Promise<T>, successMessage?: string): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn(), message: successMessage };
  } catch (e) {
    if (e instanceof ZodError) return { ok: false, code: "INVALID_INPUT", message: firstError(e) };
    if (e instanceof DomainError) {
      const generic = e.message === e.code;
      return { ok: false, code: e.code, message: generic ? (MESSAGES[e.code] ?? e.message) : e.message, data: e.data };
    }
    // Next.js redirect()/notFound() must propagate.
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
    console.error("[action]", e);
    return { ok: false, code: "UNKNOWN", message: "Une erreur est survenue. Veuillez réessayer." };
  }
}
