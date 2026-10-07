import type { Dict } from "./fr";

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

// Arabic — public interface. Missing keys fall back to French.
export const ar: DeepPartial<Dict> = {
  meta: { title: "Barber TWIIN — حلاق راقٍ", description: "Barber TWIIN: اختر حلاقك، احجز موعدك عبر الإنترنت وتابع قائمة الانتظار مباشرة." },
  nav: {
    home: "الرئيسية", barbers: "حلاقونا", services: "الخدمات", gallery: "أعمالنا", booking: "الحجز", queue: "قائمة الانتظار",
    about: "من نحن", contact: "اتصل بنا", lookup: "حجزي", login: "تسجيل الدخول", dashboard: "فضاء المهنيين", logout: "تسجيل الخروج", menu: "القائمة",
  },
  common: {
    bookNow: "احجز الآن", bookAppointment: "احجز موعدا", discoverWork: "اكتشف أعمالنا", viewAll: "عرض الكل", loading: "جار التحميل…",
    back: "رجوع", next: "متابعة", confirm: "تأكيد", cancel: "إلغاء", save: "حفظ", close: "إغلاق", total: "المجموع", duration: "المدة",
    price: "الثمن", date: "التاريخ", time: "الساعة", barber: "الحلاق", services: "الخدمات", note: "ملاحظة", name: "الاسم الكامل",
    phone: "الهاتف", email: "البريد الإلكتروني", optional: "اختياري", call: "اتصال", whatsapp: "واتساب", directions: "الاتجاهات",
    today: "اليوم", tomorrow: "غدا", closed: "مغلق", approxMin: "حوالي {n} دقيقة", minutes: "د", from: "ابتداء من",
    error: "حدث خطأ، المرجو المحاولة من جديد.", anyBarber: "أي حلاق", reference: "المرجع",
  },
  status: {
    pending: "في الانتظار", confirmed: "مؤكد", late: "متأخر", arrived: "وصل", waiting: "ينتظر", called: "تم النداء", in_progress: "جار",
    completed: "منتهي", cancelled: "ملغى", no_show: "غائب",
  },
  days: ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
  daysShort: ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"],
  hero: {
    eyebrow: "حلاقة راقية", title1: "قص", title2: "أسلوب", title3: "ثقة",
    text: "اكتشف Barber TWIIN، اختر حلاقك المفضل واحجز موعدك دون انتظار غير ضروري.",
    statBarbers: "حلاقون خبراء", statRating: "كل يوم", statWait: "الانتظار الحالي",
  },
  home: {
    howTitle: "كيف تحجز", servicesTitle: "الخدمات والأسعار", barbersTitle: "حلاقونا", galleryTitle: "أعمالنا",
    liveTitle: "الانتظار في الوقت الحقيقي", reviewsTitle: "آراء الزبناء", hoursTitle: "أوقات العمل", infoTitle: "زورونا",
    ctaTitle: "حلاقتك القادمة في انتظارك.", ctaText: "احجز في أقل من دقيقتين.",
  },
  booking: {
    title: "احجز موعدك", steps: ["الخدمات", "الحلاق", "التاريخ والساعة", "معلوماتك", "التأكيد"],
    chooseServices: "اختر خدمة أو أكثر", chooseBarber: "اختر حلاقك", chooseDate: "اختر التاريخ", chooseTime: "اختر الساعة",
    noSlots: "لا توجد مواعيد متاحة في هذا اليوم.", barberUnavailable: "الحلاق غير متوفر", yourInfo: "معلوماتك",
    confirmBtn: "تأكيد الحجز", confirmed: "تم تأكيد الحجز", slotTaken: "هذا الموعد محجوز بالفعل.", invalidPhone: "رقم هاتف غير صالح",
    totalDuration: "المدة الإجمالية", totalPrice: "الثمن الإجمالي",
  },
  queue: {
    title: "قائمة الانتظار", nowServing: "يُخدم الآن", next: "التالي", estimated: "الانتظار المقدر", ticket: "تذكرة",
    free: "متاح", busy: "مشغول", break: "استراحة", off: "غائب اليوم", empty: "لا أحد في الانتظار حاليا.",
  },
  lookup: { title: "البحث عن حجزي", find: "بحث", cancelBtn: "إلغاء الموعد", rescheduleBtn: "تغيير الموعد", cancelled: "تم إلغاء الحجز", rescheduled: "تم تغيير الموعد بنجاح" },
  gallery: { title: "أعمالنا", all: "الكل" },
  barbers: { title: "حلاقونا", bookWith: "احجز مع {name}" },
  services: { title: "الخدمات والأسعار" },
  footer: { tagline: "حلاقة راقية. خدمة منظمة.\nبدون انتظار.", rights: "جميع الحقوق محفوظة." },
};
