"use client";
import { useEffect, useState } from "react";
import type { PublicQueueDTO } from "@/lib/server/publicQueue";

/** Polls the anonymized public queue. Pauses while the tab is hidden. */
export function useLiveQueue(initial: PublicQueueDTO | null, intervalMs = 15_000) {
  const [data, setData] = useState<PublicQueueDTO | null>(initial);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (document.hidden) return;
      try {
        const r = await fetch("/api/queue", { cache: "no-store" });
        if (!r.ok) throw new Error();
        const json = (await r.json()) as PublicQueueDTO;
        if (alive) {
          setData(json);
          setError(false);
        }
      } catch {
        if (alive) setError(true);
      }
    };
    if (!initial) load();
    const id = setInterval(load, intervalMs);
    document.addEventListener("visibilitychange", load);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", load);
    };
  }, [initial, intervalMs]);
  return { data, error };
}
