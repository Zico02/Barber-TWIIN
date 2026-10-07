"use client";
import { createContext, useContext } from "react";
import type { Dict, Lang } from "./index";
import { LOCALES } from "./index";

const Ctx = createContext<{ t: Dict; lang: Lang } | null>(null);

export function I18nProvider({ t, lang, children }: { t: Dict; lang: Lang; children: React.ReactNode }) {
  return <Ctx.Provider value={{ t, lang }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n must be used inside I18nProvider");
  return { ...v, locale: LOCALES[v.lang] };
}
