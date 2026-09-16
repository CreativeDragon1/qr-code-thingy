import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { serverFailure } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase";
import { ticketPath } from "@/lib/ticketLink";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Staff-only: mints the signed link for one attendee's public ticket page.
 * The signing secret never reaches the browser — only the finished path does.
 */
export async function POST(req: Request) {
  const denied = requireAuth(req);
  if (denied) return denied;

  try {
    const { idnum } = ((await req.json().catch(() => ({}))) ?? {}) as { idnum?: unknown };
    if (typeof idnum !== "string" || !idnum) {
      return NextResponse.json({ error: "idnum is required." }, { status: 400 });
    }

    const { data: attendee, error } = await supabaseAdmin()
      .from("attendees")
      .select("idnum")
      .eq("idnum", idnum)
      .maybeSingle();

    if (error) return serverFailure(error);
    if (!attendee) {
      return NextResponse.json({ error: `No attendee with ID ${idnum}.` }, { status: 404 });
    }

    return NextResponse.json({ path: ticketPath(idnum) });
  } catch (err) {
    return serverFailure(err);
  }
}
