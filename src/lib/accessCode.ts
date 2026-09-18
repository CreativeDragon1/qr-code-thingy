import { randomInt } from "node:crypto";

/**
 * Digits only — easiest thing to type or copy on any device, no shift key,
 * no upper/lower-case mixups. This is a convenience code for a handful of
 * named attendees handed the link directly, not a security boundary like the
 * signed /ticket/{idnum}/{token} link, so a smaller keyspace is fine here.
 */
const ALPHABET = "0123456789";

export function generateAccessCode(length = 5): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

export function accessTicketPath(code: string): string {
  return `/t/${encodeURIComponent(code)}`;
}
