import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { serverFailure } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase";
import {
  MODE_COLUMN,
  isScanMode,
  parseQrCode,
  type ScanMode,
  type ScanResponse,
  type ScanResultKind,
} from "@/lib/qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOGGED_RAW_MAX = 128;

async function log(idnum: string | null, mode: ScanMode, result: ScanResultKind) {
  const { error } = await supabaseAdmin()
    .from("scan_logs")
    .insert({ idnum, mode, result });
  // A failed audit write must never turn a good scan into a red screen for the
  // person standing at the door.
  if (error) console.error("scan_logs insert failed:", error.message);
}

export async function POST(req: Request) {
  const denied = requireAuth(req);
  if (denied) return denied;

  try {
    return await handleScan(req);
  } catch (err) {
    return serverFailure(err);
  }
}

async function handleScan(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const { code, mode } = (body ?? {}) as { code?: unknown; mode?: unknown };

  if (!isScanMode(mode)) {
    return NextResponse.json(
      { error: "mode must be 'registration' or 'food'." },
      { status: 400 },
    );
  }

  // 1. Format check. Rejected without ever touching the database.
  const parsed = parseQrCode(code);
  if (!parsed.ok) {
    await log(parsed.raw.slice(0, LOGGED_RAW_MAX) || null, mode, "invalid_format");
    return NextResponse.json<ScanResponse>({
      result: "invalid_format",
      mode,
      idnum: null,
      attendee: null,
      usedAt: null,
    });
  }

  const { idnum } = parsed;
  const column = MODE_COLUMN[mode];
  const sb = supabaseAdmin();

  // 2. Redeem. One conditional update — never read-then-write. If two scanners
  //    hit the same code at once, Postgres serialises them on the row lock and
  //    the second one re-evaluates `column is null`, matches zero rows, and
  //    falls through to the already_used branch below.
  const { data: claimed, error: claimError } = await sb
    .from("attendees")
    .update({ [column]: new Date().toISOString() })
    .eq("idnum", idnum)
    .is(column, null)
    .select("idnum, name, email, registered_at, food_collected_at")
    .maybeSingle();

  if (claimError) {
    console.error("claim update failed:", claimError.message);
    return NextResponse.json({ error: "Database error." }, { status: 500 });
  }

  if (claimed) {
    await log(idnum, mode, "success");
    return NextResponse.json<ScanResponse>({
      result: "success",
      mode,
      idnum,
      attendee: { name: claimed.name, email: claimed.email },
      usedAt: null,
    });
  }

  // 3. Zero rows updated means either the attendee does not exist, or the
  //    column was already set. One more read tells us which, and gives us the
  //    name to show on the red screen.
  const { data: existing } = await sb
    .from("attendees")
    .select("idnum, name, email, registered_at, food_collected_at")
    .eq("idnum", idnum)
    .maybeSingle();

  if (!existing) {
    await log(idnum, mode, "not_found");
    return NextResponse.json<ScanResponse>({
      result: "not_found",
      mode,
      idnum,
      attendee: null,
      usedAt: null,
    });
  }

  await log(idnum, mode, "already_used");
  return NextResponse.json<ScanResponse>({
    result: "already_used",
    mode,
    idnum,
    attendee: { name: existing.name, email: existing.email },
    usedAt: (existing[column] as string | null) ?? null,
  });
}
