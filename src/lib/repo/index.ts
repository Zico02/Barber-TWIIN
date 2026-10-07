import "server-only";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { memoryRepo } from "./memory";
import { createSupabaseRepo } from "./supabase";
import type { Repo } from "./types";

export function isDemoMode() {
  return !isSupabaseConfigured();
}

/** Returns the active repository: Supabase when configured, otherwise the demo store. */
export function getRepo(): Repo {
  if (isSupabaseConfigured()) return createSupabaseRepo();
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_MODE !== "true" && process.env.NEXT_PHASE !== "phase-production-build") {
    throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY or ALLOW_DEMO_MODE=true.");
  }
  return memoryRepo;
}

export type { Repo } from "./types";
