import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { APP_PASSWORD_HEADER } from "./constants";

function matches(supplied: string, expected: string): boolean {
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Returns a 401 response when the caller is not authorised, or null when they are.
 *
 * With APP_PASSWORD unset the app stays open in development (so `npm run dev`
 * works with no config) but refuses every request in production, because an
 * open deployment lets anyone mark attendees present or send mail as the club.
 */
export function requireAuth(req: Request): NextResponse | null {
  const expected = process.env.APP_PASSWORD;

  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "APP_PASSWORD is not set on the server. See SETUP.md." },
        { status: 503 },
      );
    }
    return null;
  }

  const supplied = req.headers.get(APP_PASSWORD_HEADER) ?? "";
  if (!supplied || !matches(supplied, expected)) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }
  return null;
}
