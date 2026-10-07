import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Cinzel, Manrope, Tajawal } from "next/font/google";
import "./globals.css";
import { getT } from "@/lib/i18n/server";
import { isRtl } from "@/lib/i18n";
import { I18nProvider } from "@/lib/i18n/client";
import { ToastProvider } from "@/components/ui/Toast";

const serif = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-serif", display: "swap" });
const display = Cinzel({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-display", display: "swap" });
const sans = Manrope({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const arabic = Tajawal({ subsets: ["arabic"], weight: ["400", "500", "700"], variable: "--font-arabic", display: "swap" });

const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    metadataBase: new URL(site),
    title: { default: t.meta.title, template: "%s · Barber TWIIN" },
    description: t.meta.description,
    openGraph: {
      type: "website",
      siteName: "Barber TWIIN",
      title: t.meta.title,
      description: t.meta.description,
      images: [{ url: "/images/logo.webp", width: 1672, height: 941, alt: "Barber TWIIN" }],
      locale: "fr_MA",
    },
    twitter: { card: "summary_large_image", title: t.meta.title, description: t.meta.description, images: ["/images/logo.webp"] },
    icons: { icon: "/icon.svg" },
  };
}

export const viewport: Viewport = { themeColor: "#050505", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { t, lang } = await getT();
  return (
    <html lang={lang} dir={isRtl(lang) ? "rtl" : "ltr"} className={`${serif.variable} ${display.variable} ${sans.variable} ${arabic.variable}`}>
      <body>
        <I18nProvider t={t} lang={lang}>
          <ToastProvider>{children}</ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
