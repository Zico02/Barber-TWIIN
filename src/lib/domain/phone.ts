/**
 * Moroccan phone numbers. Accepts 06XXXXXXXX, 07XXXXXXXX, 05XXXXXXXX,
 * +2126XXXXXXXX, 002126XXXXXXXX (spaces, dots and dashes ignored).
 * International numbers (+33…, +34…) are accepted too.
 */
export function normalizePhone(input: string): string | null {
  const raw = input.replace(/[\s.\-()]/g, "");
  const ma = raw.match(/^(?:\+212|00212|212|0)([5-7]\d{8})$/);
  if (ma) return `+212${ma[1]}`;
  const intl = raw.match(/^(?:\+|00)([1-9]\d{7,14})$/);
  if (intl) return `+${intl[1]}`;
  return null;
}

export function isValidPhone(input: string) {
  return normalizePhone(input) !== null;
}

/** "+212612345678" → "06 12 34 56 78" */
export function formatPhone(e164: string) {
  const m = e164.match(/^\+212(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/);
  return m ? `0${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]}` : e164;
}

export function telLink(e164: string) {
  return `tel:${e164}`;
}

export function whatsappLink(e164: string, text?: string) {
  const digits = e164.replace(/\D/g, "");
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** "+212612345678" → "06 •• •• •• 78" — for screens where privacy matters. */
export function maskPhone(e164: string) {
  const digits = formatPhone(e164).replace(/\D/g, "");
  return `${digits.slice(0, 2)} •• •• •• ${digits.slice(-2)}`;
}
