import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_LENGTH = 24; // hex chars — long enough that guessing is infeasible

function secret(): string {
  const value = process.env.TICKET_LINK_SECRET;
  if (!value) {
    throw new Error(
      "TICKET_LINK_SECRET is not set. Generate one with `openssl rand -hex 32` and see SETUP.md.",
    );
  }
  return value;
}

/**
 * The public ticket page has no password — attendees open it directly. This
 * signature is what stops someone from viewing every attendee's ticket by
 * simply trying consecutive IDs: without the secret, a token can't be forged.
 */
export function signTicketToken(idnum: string): string {
  return createHmac("sha256", secret()).update(idnum).digest("hex").slice(0, TOKEN_LENGTH);
}

export function verifyTicketToken(idnum: string, token: string): boolean {
  if (!token || token.length !== TOKEN_LENGTH) return false;
  const expected = signTicketToken(idnum);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function ticketPath(idnum: string): string {
  return `/ticket/${encodeURIComponent(idnum)}/${signTicketToken(idnum)}`;
}
