"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plus, Pencil, Trash2, Upload } from "lucide-react";
import type { PortfolioImage } from "@/lib/domain/types";
import { GALLERY_CATEGORIES } from "@/lib/domain/types";
import { deletePortfolioAction, savePortfolioAction } from "@/actions/admin";
import { useI18n } from "@/lib/i18n/client";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { EmptyState, Field } from "@/components/ui";
import { MarbleTile } from "@/components/brand/MarbleTile";

export function PortfolioManager({ items, barbers, canEdit }: { items: PortfolioImage[]; barbers: { id: string; name: string }[]; canEdit: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [editing, setEditing] = useState<PortfolioImage | "new" | null>(null);
  const [deleting, setDeleting] = useState<PortfolioImage | null>(null);
  const [pending, start] = useTransition();
  const name = (id: string) => barbers.find((b) => b.id === id)?.name ?? "";

  return (
    <>
      {canEdit && (
        <div className="mb-4 flex justify-end">
          <button className="btn-gold btn-sm" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" /> Ajouter une réalisation
          </button>
        </div>
      )}
      {items.length === 0 ? (
        <EmptyState title="Aucune réalisation" text="Ajoutez vos premières photos." />
      ) : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {items.map((p) => (
            <li key={p.id} className="card overflow-hidden">
              <div className="relative aspect-square">
                {p.imageUrl ? (
                  <Image src={p.imageUrl} alt={p.title} fill className="object-cover" sizes="25vw" unoptimized={p.imageUrl.startsWith("data:")} />
                ) : (
                  <MarbleTile seed={p.id} monogram={t.gallery.cats[p.category][0]!} caption="Photo à ajouter" className="absolute inset-0" />
                )}
              </div>
              <div className="p-3">
                <p className="truncate text-sm text-ivory">{p.title}</p>
                <p className="text-xs text-ivory-dim">
                  {t.gallery.cats[p.category]} · {name(p.barberId)}
                </p>
                {canEdit && (
                  <div className="mt-2 flex gap-1">
                    <button className="btn-ghost btn-sm px-2" onClick={() => setEditing(p)} aria-label="Modifier">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button className="btn-ghost btn-sm px-2 hover:text-bad" onClick={() => setDeleting(p)} aria-label="Supprimer">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && <PortfolioDialog item={editing === "new" ? null : editing} barbers={barbers} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        danger
        pending={pending}
        title="Supprimer cette réalisation ?"
        message={deleting?.title ?? ""}
        confirmLabel="Supprimer"
        onConfirm={() =>
          start(async () => {
            const r = await deletePortfolioAction(deleting!.id);
            toast(r.ok ? "success" : "error", r.ok ? "Réalisation supprimée" : r.message);
            setDeleting(null);
            router.refresh();
          })
        }
      />
    </>
  );
}

function PortfolioDialog({ item, barbers, onClose }: { item: PortfolioImage | null; barbers: { id: string; name: string }[]; onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState<string | null>(item?.imageUrl ?? null);
  return (
    <Dialog open onClose={onClose} title={item ? "Modifier la réalisation" : "Nouvelle réalisation"}>
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          if (item) fd.set("id", item.id);
          start(async () => {
            const r = await savePortfolioAction(fd);
            toast(r.ok ? "success" : "error", r.ok ? "Réalisation enregistrée" : r.message);
            if (r.ok) {
              router.refresh();
              onClose();
            }
          });
        }}
      >
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded border border-dashed border-line p-4 text-sm text-ivory-muted hover:border-gold">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-40 w-full rounded object-cover" />
          ) : (
            <Upload className="h-6 w-6 text-gold" />
          )}
          <span>JPG, PNG ou WebP · 5 Mo max.</span>
          <input
            type="file"
            name="image"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setPreview(URL.createObjectURL(f));
            }}
          />
        </label>
        <Field label="Titre" htmlFor="pf-title">
          <input id="pf-title" name="title" className="field" defaultValue={item?.title} required minLength={2} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Catégorie" htmlFor="pf-cat">
            <select id="pf-cat" name="category" className="field" defaultValue={item?.category ?? "fade"}>
              {GALLERY_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t.gallery.cats[c]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Barbier" htmlFor="pf-barber">
            <select id="pf-barber" name="barberId" className="field" defaultValue={item?.barberId ?? barbers[0]?.id}>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Description" htmlFor="pf-desc">
          <textarea id="pf-desc" name="description" className="field" defaultValue={item?.description} maxLength={300} />
        </Field>
        <Field label="Lien Instagram (facultatif)" htmlFor="pf-ig">
          <input id="pf-ig" name="instagramUrl" type="url" className="field" defaultValue={item?.instagramUrl ?? ""} placeholder="https://instagram.com/p/…" />
        </Field>
        <button className="btn-gold" disabled={pending}>
          Enregistrer
        </button>
      </form>
    </Dialog>
  );
}
