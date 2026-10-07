import type { NotificationChannel, NotificationTemplate } from "./types";

export type Lang = "fr" | "en" | "ar";

export interface TemplateVars {
  name?: string;
  barber?: string;
  date?: string;
  time?: string;
  reference?: string;
  delay?: string;
  shop?: string;
  link?: string;
}

const T: Record<NotificationTemplate, Record<Lang, string>> = {
  booking_confirmation: {
    fr: "Bonjour {name}, votre rendez-vous avec {barber} est confirmé pour {date} à {time}. Merci d'arriver cinq minutes en avance. Réf. {reference} — {shop}",
    en: "Hello {name}, your appointment with {barber} is confirmed for {date} at {time}. Please arrive five minutes early. Ref. {reference} — {shop}",
    ar: "مرحبا {name}، تم تأكيد موعدك مع {barber} يوم {date} على الساعة {time}. المرجو الحضور قبل خمس دقائق. المرجع {reference} — {shop}",
  },
  appointment_reminder: {
    fr: "Rappel : {name}, votre rendez-vous chez {shop} avec {barber} est prévu {date} à {time}. Réf. {reference}",
    en: "Reminder: {name}, your appointment at {shop} with {barber} is on {date} at {time}. Ref. {reference}",
    ar: "تذكير: {name}، موعدك في {shop} مع {barber} يوم {date} على الساعة {time}. المرجع {reference}",
  },
  appointment_modified: {
    fr: "{name}, votre rendez-vous a été modifié : {barber}, {date} à {time}. Réf. {reference}",
    en: "{name}, your appointment has been changed: {barber}, {date} at {time}. Ref. {reference}",
    ar: "{name}، تم تعديل موعدك: {barber}، {date} على الساعة {time}. المرجع {reference}",
  },
  cancellation: {
    fr: "{name}, votre rendez-vous du {date} à {time} avec {barber} a été annulé. Réservez à nouveau quand vous le souhaitez : {link}",
    en: "{name}, your appointment on {date} at {time} with {barber} has been cancelled. Book again anytime: {link}",
    ar: "{name}، تم إلغاء موعدك يوم {date} على الساعة {time} مع {barber}. يمكنك الحجز من جديد: {link}",
  },
  barber_delay: {
    fr: "{name}, {barber} a environ {delay} de retard. Nous sommes désolés pour l'attente. — {shop}",
    en: "{name}, {barber} is running about {delay} late. Sorry for the wait. — {shop}",
    ar: "{name}، {barber} متأخر بحوالي {delay}. نعتذر عن الانتظار. — {shop}",
  },
  barber_ready: {
    fr: "{name}, {barber} est prêt à vous recevoir. Merci de vous présenter au fauteuil. — {shop}",
    en: "{name}, {barber} is ready for you. Please come to the chair. — {shop}",
    ar: "{name}، {barber} جاهز لاستقبالك. المرجو التوجه إلى الكرسي. — {shop}",
  },
  review_request: {
    fr: "Merci {name} pour votre visite chez {shop} ! Votre avis nous aide beaucoup : {link}",
    en: "Thank you {name} for visiting {shop}! Your feedback means a lot: {link}",
    ar: "شكرا {name} على زيارتك لـ {shop}! رأيك يهمنا: {link}",
  },
};

export function renderTemplate(key: NotificationTemplate, vars: TemplateVars, lang: Lang = "fr") {
  return T[key][lang].replace(/\{(\w+)\}/g, (_, k: keyof TemplateVars) => vars[k] ?? "");
}

export const TEMPLATE_KEYS = Object.keys(T) as NotificationTemplate[];

/**
 * Provider abstraction. Email / WhatsApp Business / SMS providers plug in here
 * (Resend, Twilio, Meta Cloud API…). Until one is configured, messages are stored
 * in the `notifications` outbox and staff send them manually via wa.me / tel links.
 */
export interface NotificationProvider {
  channel: NotificationChannel;
  send(to: string, body: string): Promise<{ ok: boolean; providerId?: string; error?: string }>;
}

export function configuredProviders(): NotificationProvider[] {
  // Intentionally empty in the initial release — see README "Notifications".
  return [];
}
