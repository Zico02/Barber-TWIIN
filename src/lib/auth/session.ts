import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Session } from "@/lib/domain/types";
import { can } from "@/lib/domain/permissions";
import { isSupabaseConfigured, supabaseServer } from "@/lib/supabase/server";
import { DEMO_USERS } from "@/lib/repo/seed";

export const DEMO_COOKIE = "bt_demo";

function secret() {
  return process.env.DEMO_SESSION_SECRET || "barber-twiin-local-demo-secret";
}
function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}
export function encodeDemoSession(userId: string) {
  return `${userId}.${sign(userId)}`;
}
function decodeDemoSession(raw: string | undefined): string | null {
  if (!raw) return null;
  const i = raw.lastIndexOf(".");
  if (i < 0) return null;
  const id = raw.slice(0, i);
  const a = Buffer.from(raw.slice(i + 1));
  const b = Buffer.from(sign(id));
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}

/** Current session (cached per request). */
export const getSession = cache(async (): Promise<Session | null> => {
  if (!isSupabaseConfigured()) {
    const id = decodeDemoSession((await cookies()).get(DEMO_COOKIE)?.value);
    const u = DEMO_USERS.find((x) => x.userId === id);
    if (!u) return null;
    const { password: _p, label: _l, ...session } = u;
    return session;
  }
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: p } = await supabase
    .from("profiles")
    .select("role, full_name, barber_id, customer_id, can_view_revenue")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!p) return null;
  return {
    userId: data.user.id,
    email: data.user.email,
    name: p.full_name ?? data.user.email ?? "",
    role: p.role,
    barberId: p.barber_id,
    customerId: p.customer_id,
    canViewRevenue: p.role === "owner" || p.can_view_revenue,
  };
});

/** For dashboard pages: redirects to login when not authorised. */
export async function requireStaff(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/connexion?next=/dashboard");
  if (!can(s, "dashboard:access")) redirect("/ma-reservation");
  return s;
}
