"use client";
import { useMemo, useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import { Instagram } from "lucide-react";
import type { GalleryCategory, PortfolioImage } from "@/lib/domain/types";
import { GALLERY_CATEGORIES } from "@/lib/domain/types";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n";
import { MarbleTile } from "@/components/brand/MarbleTile";
import { Dialog } from "@/components/ui/Dialog";

export function GalleryGrid({
  items,
  barbers,
  filters = true,
  limit,
}: {
  items: PortfolioImage[];
  barbers: Record<string, string>;
  filters?: boolean;
  limit?: number;
}) {
  const { t, locale } = useI18n();
  const [cat, setCat] = useState<GalleryCategory | "all">("all");
  const [open, setOpen] = useState<PortfolioImage | null>(null);
  const shown = useMemo(() => {
    const list = cat === "all" ? items : items.filter((i) => i.category === cat);
    return limit ? list.slice(0, limit) : list;
  }, [items, cat, limit]);

  return (
    <div>
      {filters && (
        <div className="mb-10 flex flex-wrap justify-center gap-2" role="tablist">
          {(["all", ...GALLERY_CATEGORIES] as const).map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={cat === c}
              onClick={() => setCat(c)}
              className={clsx(
                "rounded-sm border px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition",
                cat === c ? "border-gold bg-gold/10 text-gold-light" : "border-hair text-ivory-muted hover:border-line hover:text-ivory",
              )}
            >
              {c === "all" ? t.gallery.all : t.gallery.cats[c]}
            </button>
          ))}
        </div>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {shown.map((item, i) => (
          <li key={item.id} className={clsx(i % 5 === 0 && !limit ? "lg:row-span-2" : "")}>
            <button onClick={() => setOpen(item)} className="group relative block h-full w-full overflow-hidden rounded-md border border-hair text-start">
              <div className={clsx("relative w-full", i % 5 === 0 && !limit ? "aspect-[4/5] lg:h-full lg:aspect-auto" : "aspect-[4/5]")}>
                {item.imageUrl ? (
                  <Image src={item.imageUrl} alt={item.title} fill sizes="(min-width:1024px) 25vw, 50vw" className="object-cover transition duration-700 group-hover:scale-[1.04]" unoptimized={item.imageUrl.startsWith("data:")} />
                ) : (
                  <MarbleTile seed={item.id} monogram={t.gallery.cats[item.category][0]!} caption={t.gallery.cats[item.category]} className="absolute inset-0 transition duration-700 group-hover:scale-[1.03]" />
                )}
              </div>
              <div className="absolute inset-x-0 bottom-0 translate-y-1 bg-gradient-to-t from-ink via-ink/80 to-transparent p-4 pt-12 opacity-95 transition duration-500 group-hover:translate-y-0">
                <p className="text-[10px] uppercase tracking-[0.25em] text-gold">{t.gallery.cats[item.category]}</p>
                <p className="mt-1 font-serif text-lg leading-tight text-ivory">{item.title}</p>
                <p className="mt-0.5 text-xs text-ivory-muted">{fmt(t.gallery.by, { name: barbers[item.barberId] ?? "" })}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={!!open} onClose={() => setOpen(null)} title={open?.title ?? ""} size="lg">
        {open && (
          <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
            <div className="relative aspect-[4/5] overflow-hidden rounded border border-hair">
              {open.imageUrl ? (
                <Image src={open.imageUrl} alt={open.title} fill className="object-cover" unoptimized={open.imageUrl.startsWith("data:")} />
              ) : (
                <MarbleTile seed={open.id} monogram={t.gallery.cats[open.category][0]!} caption={t.gallery.cats[open.category]} className="absolute inset-0" />
              )}
            </div>
            <div>
              <p className="eyebrow">{t.gallery.cats[open.category]}</p>
              <p className="mt-3 text-sm text-ivory-muted">{open.description}</p>
              <dl className="mt-6 space-y-2 text-sm">
                <div className="flex justify-between border-b border-hair pb-2">
                  <dt className="text-ivory-dim">{t.common.barber}</dt>
                  <dd>{barbers[open.barberId]}</dd>
                </div>
                <div className="flex justify-between border-b border-hair pb-2">
                  <dt className="text-ivory-dim">{t.common.date}</dt>
                  <dd>{new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(open.date))}</dd>
                </div>
              </dl>
              {open.instagramUrl && (
                <a href={open.instagramUrl} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm mt-6">
                  <Instagram className="h-4 w-4" /> Instagram
                </a>
              )}
              <a href={`/reservation?barber=${open.barberId}`} className="btn-gold btn-sm mt-3 w-full">
                {t.common.bookNow}
              </a>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
