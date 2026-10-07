"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Phone, Archive, EyeOff, Trash2, ArchiveRestore } from "lucide-react";
import type { AppointmentStatus, Customer } from "@/lib/domain/types";
import { formatPhone, whatsappLink } from "@/lib/domain/phone";
import { formatDH } from "@/lib/domain/pricing";
import { formatDateShort } from "@/lib/domain/time";
import { anonymizeCustomerAction, archiveCustomerAction, deleteCustomerAction, updateCustomerAction } from "@/actions/admin";
import { useI18n } from "@/lib/i18n/client";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { EmptyState, StatusBadge } from "@/components/ui";
import { WhatsAppIcon } from "@/components/brand/SocialIcons";

export interface CustomerRow {
  customer: Customer;
  visits: number;
  spending: number;
  lastVisit: string | null;
  cancellations: number;
  lateCancellations: number;
  noShows: number;
  preferredBarber: string | null;
  preferredServices: string[];
  history: { id: string; date: string; status: AppointmentStatus; services: string; barber: string; amount: number; note: string | null }[];
}

export function CustomersTable({ rows, canArchive, canDelete, showSpending, showArchived }: { rows: CustomerRow[]; canArchive: boolean; canDelete: boolean; showSpending: boolean; showArchived: boolean }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<CustomerRow | null>(null);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? rows.filter((r) => r.customer.name.toLowerCase().includes(s) || r.customer.phone.replace(/\D/g, "").includes(s.replace(/\D/g, "") || "§")) : rows;
  }, [rows, q]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ivory-dim" />
          <input className="field ps-9" placeholder="Nom ou téléphone…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher un client" />
        </div>
        {canArchive && (
          <Link href={showArchived ? "/dashboard/clients" : "/dashboard/clients?archived=1"} className="btn-ghost btn-sm">
            {showArchived ? "Masquer les archivés" : "Voir les archivés"}
          </Link>
        )}
      </div>
      {filtered.length === 0 ? (
        <EmptyState title="Aucun client" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-hair text-start text-[11px] uppercase tracking-[0.14em] text-ivory-muted">
                <th className="px-4 py-3 text-start font-medium">Client</th>
                <th className="px-4 py-3 text-start font-medium">Visites</th>
                {showSpending && <th className="px-4 py-3 text-start font-medium">Dépenses</th>}
                <th className="px-4 py-3 text-start font-medium">Dernière visite</th>
                <th className="px-4 py-3 text-start font-medium">Barbier préféré</th>
                <th className="px-4 py-3 text-start font-medium">Annul. / Absences</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hair">
              {filtered.map((r) => (
                <tr key={r.customer.id} className="cursor-pointer hover:bg-white/[0.02]" onClick={() => setOpen(r)}>
                  <td className="px-4 py-3">
                    <span className="block text-ivory">{r.customer.name}</span>
                    <span className="text-xs text-ivory-dim">{r.customer.phone ? formatPhone(r.customer.phone) : "—"}</span>
                    {r.customer.archived && <span className="ms-2 text-[10px] uppercase text-bad">archivé</span>}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{r.visits}</td>
                  {showSpending && <td className="px-4 py-3 tabular-nums">{formatDH(r.spending)}</td>}
                  <td className="px-4 py-3 text-ivory-muted">{r.lastVisit ? formatDateShort(r.lastVisit) : "—"}</td>
                  <td className="px-4 py-3 text-ivory-muted">{r.preferredBarber ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums">
                    <span className={r.cancellations ? "text-ivory" : "text-ivory-dim"}>{r.cancellations}</span>
                    {" / "}
                    <span className={r.noShows ? "text-bad" : "text-ivory-dim"}>{r.noShows}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && <CustomerDialog row={open} onClose={() => setOpen(null)} canArchive={canArchive} canDelete={canDelete} showSpending={showSpending} />}
    </div>
  );
}

function CustomerDialog({ row, onClose, canArchive, canDelete, showSpending }: { row: CustomerRow; onClose: () => void; canArchive: boolean; canDelete: boolean; showSpending: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [notes, setNotes] = useState(row.customer.notes ?? "");
  const [confirm, setConfirm] = useState<"anonymize" | "delete" | null>(null);
  const [typed, setTyped] = useState("");
  const c = row.customer;
  const done = (r: { ok: boolean; message?: string }) => {
    toast(r.ok ? "success" : "error", r.message ?? (r.ok ? "OK" : t.common.error));
    if (r.ok) {
      router.refresh();
      onClose();
    }
  };

  return (
    <Dialog open onClose={onClose} title={c.name} size="lg">
      <div className="grid gap-6 md:grid-cols-[1fr_1.3fr]">
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["Visites", row.visits],
              ...(showSpending ? [["Dépenses", formatDH(row.spending)]] : []),
              ["Annulations", `${row.cancellations}${row.lateCancellations ? ` (${row.lateCancellations} tardives)` : ""}`],
              ["Absences", row.noShows],
              ["Barbier préféré", row.preferredBarber ?? "—"],
              ["Services préférés", row.preferredServices.join(", ") || "—"],
            ].map(([k, v]) => (
              <div key={String(k)} className="rounded border border-hair p-3">
                <dt className="text-[10px] uppercase tracking-[0.14em] text-ivory-dim">{k}</dt>
                <dd className="mt-1 text-ivory">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="text-sm text-ivory-muted">
            {c.phone && <p>{formatPhone(c.phone)}</p>}
            {c.email && <p>{c.email}</p>}
          </div>
          {c.phone && (
            <div className="flex gap-2">
              <a href={`tel:${c.phone}`} className="btn-outline btn-sm">
                <Phone className="h-4 w-4" /> Appeler
              </a>
              <a href={whatsappLink(c.phone)} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">
                <WhatsAppIcon className="h-4 w-4" /> WhatsApp
              </a>
            </div>
          )}
          <div>
            <label className="label" htmlFor="cu-notes">
              Notes internes
            </label>
            <textarea id="cu-notes" className="field min-h-[90px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Allergies, préférences…" />
            <button className="btn-gold btn-sm mt-2" disabled={pending || notes === (c.notes ?? "")} onClick={() => start(async () => done(await updateCustomerAction({ customerId: c.id, notes })))}>
              {t.common.save}
            </button>
          </div>
          {(canArchive || canDelete) && (
            <div className="flex flex-wrap gap-2 border-t border-hair pt-4">
              {canArchive && (
                <button className="btn-ghost btn-sm" disabled={pending} onClick={() => start(async () => done(await archiveCustomerAction({ customerId: c.id, archived: !c.archived })))}>
                  {c.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />} {c.archived ? "Restaurer" : "Archiver"}
                </button>
              )}
              {canDelete && !c.anonymized && (
                <>
                  <button className="btn-ghost btn-sm" onClick={() => setConfirm("anonymize")}>
                    <EyeOff className="h-4 w-4" /> Anonymiser
                  </button>
                  <button className="btn-ghost btn-sm hover:text-bad" onClick={() => setConfirm("delete")}>
                    <Trash2 className="h-4 w-4" /> Supprimer
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        <div>
          <p className="label">Historique</p>
          <ul className="max-h-[420px] divide-y divide-hair overflow-y-auto rounded border border-hair">
            {row.history.length === 0 && <li className="p-4 text-sm text-ivory-dim">Aucune visite.</li>}
            {row.history.map((h) => (
              <li key={h.id} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ivory">{formatDateShort(h.date)}</span>
                  <StatusBadge status={h.status} label={t.status[h.status]} />
                </div>
                <p className="text-xs text-ivory-muted">
                  {h.services} · {h.barber}
                  {showSpending ? ` · ${formatDH(h.amount)}` : ""}
                </p>
                {h.note && <p className="mt-1 text-xs italic text-ivory-dim">« {h.note} »</p>}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ConfirmDialog
        open={confirm === "anonymize"}
        onClose={() => setConfirm(null)}
        danger
        pending={pending}
        title="Anonymiser ce client ?"
        message="Nom, téléphone, e-mail et notes seront effacés définitivement. L'historique des visites est conservé de façon anonyme pour les statistiques."
        confirmLabel="Anonymiser"
        onConfirm={() => start(async () => done(await anonymizeCustomerAction(c.id)))}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onClose={() => setConfirm(null)}
        danger
        pending={pending || typed !== "SUPPRIMER"}
        title="Supprimer ce client ?"
        message="Action irréversible. Les rendez-vous passés restent dans les statistiques, sans données personnelles. Tapez SUPPRIMER pour confirmer."
        confirmLabel="Supprimer"
        onConfirm={() => start(async () => done(await deleteCustomerAction({ customerId: c.id, confirm: typed })))}
      >
        <input className="field mt-4" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="SUPPRIMER" aria-label="Confirmation" />
      </ConfirmDialog>
    </Dialog>
  );
}
