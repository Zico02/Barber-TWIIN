"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import clsx from "clsx";
import { setLanguageAction } from "@/actions/auth";
import { useI18n } from "@/lib/i18n/client";
import type { Lang } from "@/lib/i18n";

const LABELS: Record<Lang, string> = { fr: "FR", en: "EN", ar: "ع" };

export function LanguageSwitcher() {
  const { lang } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className={clsx("flex items-center rounded border border-hair p-0.5", pending && "opacity-60")} role="group" aria-label="Langue">
      {(Object.keys(LABELS) as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() =>
            start(async () => {
              await setLanguageAction(l);
              router.refresh();
            })
          }
          aria-pressed={lang === l}
          className={clsx(
            "min-w-8 rounded-sm px-2 py-1 text-[11px] font-semibold tracking-wider transition",
            lang === l ? "bg-gold/15 text-gold-light" : "text-ivory-dim hover:text-ivory",
          )}
        >
          {LABELS[l]}
        </button>
      ))}
    </div>
  );
}
