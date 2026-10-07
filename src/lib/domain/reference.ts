// Human-friendly booking references: BT-7K4Q2 (no 0/O/1/I to avoid confusion).
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function newReference() {
  const bytes = new Uint8Array(5);
  globalThis.crypto.getRandomValues(bytes);
  return `BT-${Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("")}`;
}

export function newId() {
  return globalThis.crypto.randomUUID();
}
