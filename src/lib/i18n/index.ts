import { fr, type Dict } from "./fr";
import { en } from "./en";
import { ar } from "./ar";
import type { Lang } from "@/lib/domain/notifications";

export type { Dict, Lang };
export const LANGS: Lang[] = ["fr", "en", "ar"];
export const DEFAULT_LANG: Lang = "fr";
export const LANG_COOKIE = "bt_lang";
export const LOCALES: Record<Lang, string> = { fr: "fr-FR", en: "en-GB", ar: "ar-MA" };

function deepMerge<T>(base: T, over: unknown): T {
  if (!over || typeof over !== "object" || Array.isArray(over)) return (over as T) ?? base;
  const out = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(over)) {
    const b = (base as Record<string, unknown>)[k];
    out[k] = b && typeof b === "object" && !Array.isArray(b) ? deepMerge(b, v) : v;
  }
  return out as T;
}

const cache: Partial<Record<Lang, Dict>> = { fr, en };
export function getDict(lang: Lang): Dict {
  return (cache[lang] ??= deepMerge(fr, ar));
}

export function isRtl(lang: Lang) {
  return lang === "ar";
}

/** "Bonjour {name}" + {name: "Adam"} → "Bonjour Adam" */
export function fmt(str: string, vars: Record<string, string | number>) {
  return str.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}
