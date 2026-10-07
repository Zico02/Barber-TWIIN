"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRepo } from "@/lib/repo";
import { getSession } from "@/lib/auth/session";
import { assertCan, assertStaff, can } from "@/lib/domain/permissions";
import { portfolioSchema, serviceSchema } from "@/lib/domain/validation";
import { DomainError } from "@/lib/domain/errors";
import type { GalleryCategory } from "@/lib/domain/types";
import { safe } from "./_util";

const id = z.string().min(1).max(64);

// ── Services & prices (owner) ──
export async function saveServiceAction(input: z.input<typeof serviceSchema>) {
  return safe(async () => {
    const session = await getSession();
    assertCan(session, "services:manage");
    const data = serviceSchema.parse(input);
    const repo = getRepo();
    const { barberIds, ...service } = data;
    const saved = await repo.upsertService(service, barberIds);
    await repo.addAudit({ actorId: session.userId, actorName: session.name, action: data.id ? "service_updated" : "service_created", entity: "service", entityId: saved.id, details: { price: data.price, duration: data.durationMinutes } });
    revalidatePath("/", "layout");
    return saved;
  }, "Service enregistré");
}

// ── Customers ──
async function assertCustomerAccess(customerId: string) {
  const session = await getSession();
  assertStaff(session);
  if (can(session, "customers:all")) return session;
  // A barber may only touch customers who booked with them.
  const appts = await getRepo().listAppointments({ customerId });
  if (!appts.some((a) => a.barberId === session.barberId)) throw new DomainError("FORBIDDEN");
  return session;
}

export async function updateCustomerAction(input: { customerId: string; notes?: string; email?: string; name?: string }) {
  return safe(async () => {
    const data = z
      .object({ customerId: id, notes: z.string().max(1000).optional(), email: z.string().email().optional().or(z.literal("")), name: z.string().min(2).max(80).optional() })
      .parse(input);
    await assertCustomerAccess(data.customerId);
    await getRepo().updateCustomer(data.customerId, { notes: data.notes, email: data.email || null, name: data.name });
    revalidatePath("/dashboard/clients");
    return true;
  }, "Fiche client mise à jour");
}

export async function archiveCustomerAction(input: { customerId: string; archived: boolean }) {
  return safe(async () => {
    const session = await getSession();
    assertCan(session, "customers:all");
    await getRepo().updateCustomer(id.parse(input.customerId), { archived: input.archived });
    revalidatePath("/dashboard/clients");
    return true;
  }, input.archived ? "Client archivé" : "Client restauré");
}

export async function anonymizeCustomerAction(customerId: string) {
  return safe(async () => {
    const session = await getSession();
    assertCan(session, "customers:delete");
    await getRepo().anonymizeCustomer(id.parse(customerId));
    await getRepo().addAudit({ actorId: session.userId, actorName: session.name, action: "customer_anonymized", entity: "customer", entityId: customerId });
    revalidatePath("/dashboard/clients");
    return true;
  }, "Client anonymisé");
}

export async function deleteCustomerAction(input: { customerId: string; confirm: string }) {
  return safe(async () => {
    const session = await getSession();
    assertCan(session, "customers:delete");
    if (input.confirm !== "SUPPRIMER") throw new DomainError("INVALID_INPUT", "Tapez SUPPRIMER pour confirmer.");
    await getRepo().deleteCustomer(id.parse(input.customerId));
    await getRepo().addAudit({ actorId: session.userId, actorName: session.name, action: "customer_deleted", entity: "customer", entityId: input.customerId });
    revalidatePath("/dashboard/clients");
    return true;
  }, "Client supprimé (historique conservé de façon anonyme)");
}

// ── Portfolio (admin or the barber himself) ──
const MAX_IMAGE = 5 * 1024 * 1024;

export async function savePortfolioAction(form: FormData) {
  return safe(async () => {
    const session = await getSession();
    assertStaff(session);
    const data = portfolioSchema.parse({
      id: form.get("id") || undefined,
      barberId: session.role === "barber" ? session.barberId : form.get("barberId"),
      category: form.get("category"),
      title: form.get("title"),
      description: form.get("description") ?? "",
      instagramUrl: form.get("instagramUrl") ?? "",
    });
    if (!can(session, "portfolio:all") && data.barberId !== session.barberId) throw new DomainError("FORBIDDEN");
    const repo = getRepo();
    if (data.id) {
      const existing = (await repo.listPortfolio()).find((p) => p.id === data.id);
      if (!existing) throw new DomainError("NOT_FOUND");
      if (!can(session, "portfolio:all") && existing.barberId !== session.barberId) throw new DomainError("FORBIDDEN");
    }
    let imageUrl: string | null = null;
    const file = form.get("image");
    if (file instanceof File && file.size > 0) {
      if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type)) throw new DomainError("INVALID_INPUT", "Format d'image non supporté (JPG, PNG, WebP).");
      if (file.size > MAX_IMAGE) throw new DomainError("INVALID_INPUT", "Image trop lourde (5 Mo max).");
      imageUrl = await repo.uploadImage(file, data.barberId);
    }
    const saved = await repo.upsertPortfolio({
      id: data.id,
      barberId: data.barberId,
      category: data.category as GalleryCategory,
      title: data.title,
      description: data.description,
      instagramUrl: data.instagramUrl ?? null,
      imageUrl,
      art: imageUrl ? null : undefined,
    });
    revalidatePath("/realisations");
    revalidatePath("/dashboard/portfolio");
    return saved;
  }, "Réalisation enregistrée");
}

export async function deletePortfolioAction(portfolioId: string) {
  return safe(async () => {
    const session = await getSession();
    assertStaff(session);
    const repo = getRepo();
    const existing = (await repo.listPortfolio()).find((p) => p.id === portfolioId);
    if (!existing) throw new DomainError("NOT_FOUND");
    if (!can(session, "portfolio:all") && existing.barberId !== session.barberId) throw new DomainError("FORBIDDEN");
    await repo.deletePortfolio(portfolioId);
    revalidatePath("/realisations");
    revalidatePath("/dashboard/portfolio");
    return true;
  }, "Réalisation supprimée");
}

// ── Reviews moderation (owner) ──
export async function moderateReviewAction(input: { reviewId: string; status?: "approved" | "rejected" | "pending"; featured?: boolean }) {
  return safe(async () => {
    const session = await getSession();
    assertCan(session, "reviews:moderate");
    const data = z
      .object({ reviewId: id, status: z.enum(["approved", "rejected", "pending"]).optional(), featured: z.boolean().optional() })
      .parse(input);
    await getRepo().updateReview(data.reviewId, { status: data.status, featured: data.featured });
    revalidatePath("/", "layout");
    return true;
  }, "Avis mis à jour");
}
