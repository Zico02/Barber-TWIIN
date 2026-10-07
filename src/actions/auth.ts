"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured, supabaseServer } from "@/lib/supabase/server";
import { DEMO_COOKIE, encodeDemoSession } from "@/lib/auth/session";
import { DEMO_USERS } from "@/lib/repo/seed";
import { loginSchema } from "@/lib/domain/validation";
import { DomainError } from "@/lib/domain/errors";
import { LANG_COOKIE, LANGS, type Lang } from "@/lib/i18n";
import { safe } from "./_util";

function safeNext(next?: string | null) {
  // Only allow internal paths (prevents open redirects).
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export async function loginAction(input: { email: string; password: string; next?: string }) {
  const res = await safe(async () => {
    if (!isSupabaseConfigured()) throw new DomainError("FORBIDDEN", "Utilisez les profils de démonstration.");
    const { email, password } = loginSchema.parse(input);
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new DomainError("UNAUTHENTICATED", "E-mail ou mot de passe incorrect");
    return true;
  });
  if (res.ok) redirect(safeNext(input.next));
  return res;
}

export async function demoLoginAction(userId: string, next?: string) {
  if (isSupabaseConfigured()) throw new Error("Demo login disabled");
  if (!DEMO_USERS.some((u) => u.userId === userId)) throw new Error("Unknown demo user");
  (await cookies()).set(DEMO_COOKIE, encodeDemoSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  redirect(safeNext(next));
}

export async function logoutAction() {
  if (isSupabaseConfigured()) await (await supabaseServer()).auth.signOut();
  (await cookies()).delete(DEMO_COOKIE);
  redirect("/connexion");
}

export async function setLanguageAction(lang: Lang) {
  if (!LANGS.includes(lang)) return;
  (await cookies()).set(LANG_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
