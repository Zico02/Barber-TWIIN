"use client";
import { Ornament } from "@/components/brand/Logo";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="marble flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <p className="font-serif text-4xl">Une erreur est survenue</p>
      <Ornament className="my-6" />
      <p className="max-w-md text-ivory-muted">Veuillez réessayer. Si le problème persiste, contactez le salon.</p>
      <button onClick={reset} className="btn-gold mt-8">
        Réessayer
      </button>
    </main>
  );
}
