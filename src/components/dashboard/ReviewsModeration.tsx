"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, X, Sparkles } from "lucide-react";
import type { Review, ReviewStatus } from "@/lib/domain/types";
import { moderateReviewAction } from "@/actions/admin";
import { formatDateShort } from "@/lib/domain/time";
import { useI18n } from "@/lib/i18n/client";
import { useToast } from "@/components/ui/Toast";
import { EmptyState, Stars } from "@/components/ui";

const TABS: { id: ReviewStatus; label: string }[] = [
  { id: "pending", label: "À valider" },
  { id: "approved", label: "Publiés" },
  { id: "rejected", label: "Refusés" },
];

export function ReviewsModeration({ reviews, barbers }: { reviews: Review[]; barbers: Record<string, string> }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [tab, setTab] = useState<ReviewStatus>("pending");
  const [pending, start] = useTransition();
  const list = reviews.filter((r) => r.status === tab);
  const act = (reviewId: string, patch: { status?: ReviewStatus; featured?: boolean }) =>
    start(async () => {
      const r = await moderateReviewAction({ reviewId, ...patch });
      toast(r.ok ? "success" : "error", r.ok ? "Avis mis à jour" : r.message);
      router.refresh();
    });

  return (
    <div>
      <div className="mb-6 flex gap-1 rounded border border-hair p-1">
        {TABS.map((x) => (
          <button key={x.id} onClick={() => setTab(x.id)} className={clsx("flex-1 rounded-sm px-3 py-2 text-xs font-semibold", tab === x.id ? "bg-gold/15 text-gold-light" : "text-ivory-muted")}>
            {x.label} ({reviews.filter((r) => r.status === x.id).length})
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <EmptyState title="Aucun avis ici" />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {list.map((r) => (
            <li key={r.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ivory">{r.authorName}</p>
                  <p className="text-xs text-ivory-dim">
                    {barbers[r.barberId]} · {formatDateShort(r.createdAt)}
                  </p>
                </div>
                <Stars value={r.ratings.overall} />
              </div>
              <p className="mt-3 font-serif text-lg leading-snug">“{r.comment}”</p>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-ivory-muted sm:grid-cols-3">
                {(Object.keys(r.ratings) as (keyof Review["ratings"])[]).map((k) => (
                  <div key={k} className="flex justify-between">
                    <dt>{t.lookup.axes[k]}</dt>
                    <dd className="text-gold-light">{r.ratings[k]}/5</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-hair pt-4">
                {r.status !== "approved" && (
                  <button className="btn-gold btn-sm" disabled={pending} onClick={() => act(r.id, { status: "approved" })}>
                    <Check className="h-4 w-4" /> Publier
                  </button>
                )}
                {r.status !== "rejected" && (
                  <button className="btn-ghost btn-sm hover:text-bad" disabled={pending} onClick={() => act(r.id, { status: "rejected", featured: false })}>
                    <X className="h-4 w-4" /> Refuser
                  </button>
                )}
                {r.status === "approved" && (
                  <button className={clsx("btn-sm", r.featured ? "btn-outline text-gold-light" : "btn-ghost")} disabled={pending} onClick={() => act(r.id, { featured: !r.featured })}>
                    <Sparkles className="h-4 w-4" /> {r.featured ? "Mis en avant" : "Mettre en avant"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
