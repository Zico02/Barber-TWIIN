import { NextResponse } from "next/server";
import { getPublicQueue } from "@/lib/server/publicQueue";

export const dynamic = "force-dynamic";

/** Public, anonymized live queue (polled by /file-attente and /affichage). */
export async function GET() {
  try {
    const data = await getPublicQueue();
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[api/queue]", e);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
