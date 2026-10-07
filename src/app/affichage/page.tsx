import type { Metadata } from "next";
import { getPublicQueue } from "@/lib/server/publicQueue";
import { ShopDisplay } from "@/components/queue/ShopDisplay";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Écran salon", robots: { index: false } };

/** Full-screen shop display for a TV or tablet. */
export default async function DisplayPage() {
  const queue = await getPublicQueue().catch(() => null);
  return <ShopDisplay initial={queue} />;
}
