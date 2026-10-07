import Link from "next/link";
import { Logo, Ornament } from "@/components/brand/Logo";

export default function NotFound() {
  return (
    <main className="marble flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <Logo size="md" />
      <p className="mt-10 font-display text-7xl text-gold-metal">404</p>
      <Ornament className="my-6" />
      <p className="font-serif text-2xl">Cette page n&apos;existe pas.</p>
      <Link href="/" className="btn-gold mt-8">
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
