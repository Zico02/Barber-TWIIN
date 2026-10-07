"use client";
import { useEffect, useRef } from "react";
import clsx from "clsx";
import { X } from "lucide-react";

/** Accessible modal built on <dialog> (focus trap, Esc to close, backdrop). */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={clsx(
        "m-auto w-[calc(100%-2rem)] rounded-md border border-line bg-ink-2 p-0 text-ivory shadow-gold backdrop:bg-black/75 backdrop:backdrop-blur-sm",
        size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-3xl" : "max-w-lg",
      )}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between border-b border-hair px-5 py-4">
            <h2 className="font-serif text-xl">{title}</h2>
            <button onClick={onClose} className="text-ivory-dim hover:text-gold-light" aria-label="Fermer">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-5">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-hair px-5 py-4">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirmer",
  danger,
  pending,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  pending?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button className="btn-ghost btn-sm" onClick={onClose}>
            Annuler
          </button>
          <button
            className={clsx("btn-sm", danger ? "btn border border-bad/60 bg-bad/15 text-ivory hover:bg-bad/25" : "btn-gold")}
            onClick={onConfirm}
            disabled={pending}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-ivory-muted">{message}</div>
      {children}
    </Dialog>
  );
}
