"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Plus, Pencil } from "lucide-react";
import type { Service, ServiceCategory } from "@/lib/domain/types";
import { saveServiceAction } from "@/actions/admin";
import { formatDH } from "@/lib/domain/pricing";
import { formatDuration } from "@/lib/domain/time";
import { useToast } from "@/components/ui/Toast";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui";
import { ServiceIcon } from "@/components/brand/ServiceIcon";

const CATS: Record<ServiceCategory, string> = { cut: "Coupe", beard: "Barbe", combo: "Formule", care: "Soin visage", kids: "Enfant", styling: "Coiffage", treatment: "Soin capillaire / couleur" };
const ICONS = ["scissors", "fade", "beard", "crown", "sparkles", "razor", "child", "comb", "brush", "bottle", "bowl", "iron", "highlight"];
type B = { id: string; name: string; serviceIds: string[] };

export function ServicesManager({ services, barbers }: { services: Service[]; barbers: B[] }) {
  const [editing, setEditing] = useState<Service | "new" | null>(null);
  return (
    <>
      <div className="mb-4 flex justify-end">
        <button className="btn-gold btn-sm" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" /> Nouveau service
        </button>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-hair text-[11px] uppercase tracking-[0.14em] text-ivory-muted">
              <th className="px-4 py-3 text-start font-medium">Service</th>
              <th className="px-4 py-3 text-start font-medium">Prix</th>
              <th className="px-4 py-3 text-start font-medium">Durée</th>
              <th className="px-4 py-3 text-start font-medium">Barbiers</th>
              <th className="px-4 py-3 text-start font-medium">Statut</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-hair">
            {services.map((s) => (
              <tr key={s.id} className={clsx(!s.active && "opacity-50")}>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-3">
                    <ServiceIcon name={s.icon} className="h-5 w-5 text-gold" />
                    <span>
                      <span className="block text-ivory">{s.name}</span>
                      <span className="text-xs text-ivory-dim">{CATS[s.category]}</span>
                    </span>
                  </span>
                </td>
                <td className="px-4 py-3 font-serif text-lg text-gold-light">{s.priceFrom && <span className="me-1 text-xs text-ivory-dim">dès</span>}{formatDH(s.price)}</td>
                <td className="px-4 py-3">{formatDuration(s.durationMinutes)}</td>
                <td className="px-4 py-3 text-xs text-ivory-muted">{barbers.filter((b) => b.serviceIds.includes(s.id)).map((b) => b.name).join(", ") || "—"}</td>
                <td className="px-4 py-3 text-xs">{s.active ? <span className="text-ok">Actif</span> : <span className="text-ivory-dim">Inactif</span>}</td>
                <td className="px-4 py-3 text-end">
                  <button className="btn-ghost btn-sm" onClick={() => setEditing(s)} aria-label={`Modifier ${s.name}`}>
                    <Pencil className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <ServiceDialog service={editing === "new" ? null : editing} barbers={barbers} onClose={() => setEditing(null)} />}
    </>
  );
}

function ServiceDialog({ service, barbers, onClose }: { service: Service | null; barbers: B[]; onClose: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState({
    name: service?.name ?? "",
    description: service?.description ?? "",
    price: service?.price ?? 50,
    priceFrom: service?.priceFrom ?? false,
    durationMinutes: service?.durationMinutes ?? 30,
    category: service?.category ?? ("cut" as ServiceCategory),
    icon: service?.icon ?? "scissors",
    active: service?.active ?? true,
    barberIds: service ? barbers.filter((b) => b.serviceIds.includes(service.id)).map((b) => b.id) : barbers.map((b) => b.id),
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Dialog
      open
      onClose={onClose}
      title={service ? `Modifier — ${service.name}` : "Nouveau service"}
      footer={
        <button
          className="btn-gold btn-sm"
          disabled={pending || f.name.length < 2}
          onClick={() =>
            start(async () => {
              const r = await saveServiceAction({ ...f, id: service?.id });
              toast(r.ok ? "success" : "error", r.ok ? "Service enregistré" : r.message);
              if (r.ok) {
                router.refresh();
                onClose();
              }
            })
          }
        >
          Enregistrer
        </button>
      }
    >
      <div className="grid gap-4">
        <Field label="Nom" htmlFor="sv-name">
          <input id="sv-name" className="field" value={f.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Description" htmlFor="sv-desc">
          <textarea id="sv-desc" className="field" maxLength={300} value={f.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Prix (DH)" htmlFor="sv-price">
            <input id="sv-price" type="number" min={0} className="field" value={f.price} onChange={(e) => set("price", Number(e.target.value))} />
          </Field>
          <Field label="Durée (min)" htmlFor="sv-dur">
            <input id="sv-dur" type="number" min={5} step={5} className="field" value={f.durationMinutes} onChange={(e) => set("durationMinutes", Number(e.target.value))} />
          </Field>
          <Field label="Catégorie" htmlFor="sv-cat">
            <select id="sv-cat" className="field" value={f.category} onChange={(e) => set("category", e.target.value as ServiceCategory)}>
              {Object.entries(CATS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div>
          <p className="label">Icône</p>
          <div className="flex flex-wrap gap-2">
            {ICONS.map((i) => (
              <button key={i} type="button" onClick={() => set("icon", i)} className={clsx("rounded border p-2", f.icon === i ? "border-gold text-gold-light" : "border-hair text-ivory-muted")} aria-label={i}>
                <ServiceIcon name={i} className="h-5 w-5" />
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="label">Barbiers proposant ce service</p>
          <div className="flex flex-wrap gap-2">
            {barbers.map((b) => {
              const on = f.barberIds.includes(b.id);
              return (
                <button key={b.id} type="button" onClick={() => set("barberIds", on ? f.barberIds.filter((x) => x !== b.id) : [...f.barberIds, b.id])} className={clsx("rounded-sm border px-3 py-1.5 text-xs", on ? "border-gold bg-gold/10 text-gold-light" : "border-hair text-ivory-muted")}>
                  {b.name}
                </button>
              );
            })}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.priceFrom} onChange={(e) => set("priceFrom", e.target.checked)} className="accent-[#C99A35]" /> Prix « à partir de » (selon la longueur)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} className="accent-[#C99A35]" /> Service actif (visible et réservable)
        </label>
      </div>
    </Dialog>
  );
}
