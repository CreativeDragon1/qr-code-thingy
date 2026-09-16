import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cheap "is this password accepted?" probe used by the gate and on page load. */
export async function GET(req: Request) {
  const denied = requireAuth(req);
  if (denied) return denied;
  return NextResponse.json({ ok: true });
}
