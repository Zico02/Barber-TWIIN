"use client";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Download } from "lucide-react";
import { formatDateLong, formatTime } from "@/lib/domain/time";
import { useI18n } from "@/lib/i18n/client";

const W = 640;
const H = 900;

/**
 * Branded booking ticket: QR code (opens the booking with its reference) with
 * the day and time underneath. Rendered on a canvas so the client can save it as an image.
 */
export function QrTicket({ reference, startAt, barberName }: { reference: string; startAt: string; barberName: string }) {
  const { locale } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const c = canvas.current;
      if (!c) return;
      const ctx = c.getContext("2d")!;
      const css = getComputedStyle(document.documentElement);
      const serif = css.getPropertyValue("--font-serif").trim() || "Georgia";
      const display = css.getPropertyValue("--font-display").trim() || serif;
      const sans = css.getPropertyValue("--font-sans").trim() || "sans-serif";
      await document.fonts?.ready;

      // Background + gold frame
      ctx.fillStyle = "#050505";
      ctx.fillRect(0, 0, W, H);
      const gold = ctx.createLinearGradient(0, 0, 0, H);
      gold.addColorStop(0, "#F0DCA8");
      gold.addColorStop(0.45, "#C99A35");
      gold.addColorStop(1, "#80601F");
      ctx.strokeStyle = gold;
      ctx.lineWidth = 3;
      ctx.strokeRect(18, 18, W - 36, H - 36);
      ctx.lineWidth = 1;
      ctx.strokeRect(30, 30, W - 60, H - 60);

      ctx.textAlign = "center";
      ctx.fillStyle = gold;
      ctx.font = `600 52px ${serif}`;
      ctx.fillText("Barber TWIIN", W / 2, 110);
      ctx.fillStyle = "#A7A29A";
      ctx.font = `500 16px ${display}`;
      ctx.fillText("COUPE  •  STYLE  •  CONFIANCE", W / 2, 145);

      // QR on an ivory square (dark-on-light scans best)
      const link = `${window.location.origin}/ma-reservation?ref=${reference}`;
      const qr = document.createElement("canvas");
      await QRCode.toCanvas(qr, link, { width: 340, margin: 2, errorCorrectionLevel: "M", color: { dark: "#0C0C0C", light: "#F5F1E8" } });
      ctx.drawImage(qr, (W - 340) / 2, 180);

      const day = formatDateLong(startAt, locale);
      ctx.fillStyle = "#F5F1E8";
      ctx.font = `500 34px ${serif}`;
      ctx.fillText(day.charAt(0).toUpperCase() + day.slice(1), W / 2, 590);
      ctx.fillStyle = gold;
      ctx.font = `600 96px ${serif}`;
      ctx.fillText(formatTime(startAt), W / 2, 690);
      ctx.fillStyle = "#A7A29A";
      ctx.font = `400 22px ${sans}`;
      ctx.fillText(`avec ${barberName}`, W / 2, 740);
      ctx.fillStyle = "#E4BC62";
      ctx.font = `500 26px ${display}`;
      ctx.fillText(reference, W / 2, 800);
      ctx.fillStyle = "#6E6A63";
      ctx.font = `400 15px ${sans}`;
      ctx.fillText("Présentez ce code à votre arrivée", W / 2, 840);

      if (alive) setUrl(c.toDataURL("image/png"));
    })();
    return () => {
      alive = false;
    };
  }, [reference, startAt, barberName, locale]);

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas ref={canvas} width={W} height={H} className="w-full max-w-[280px] rounded-md shadow-gold" aria-label={`QR code — ${reference}`} role="img" />
      {url && (
        <a href={url} download={`barber-twiin-${reference}.png`} className="btn-outline btn-sm">
          <Download className="h-4 w-4" /> Enregistrer le ticket
        </a>
      )}
    </div>
  );
}
