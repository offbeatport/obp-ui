const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const SIZE = 8;

export function nanoid(): string {
  const bytes = new Uint8Array(SIZE);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => ALPHABET[b % ALPHABET.length])
    .join("");
}
