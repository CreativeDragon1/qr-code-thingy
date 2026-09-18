import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { serverFailure } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = requireAuth(req);
  if (denied) return denied;

  try {
    return await listAttendees(req);
  } catch (err) {
    return serverFailure(err);
  }
}

async function listAttendees(req: Request) {
  const sb = supabaseAdmin();
  const search = new URL(req.url).searchParams.get("q")?.trim() ?? "";

  let query = sb
    .from("attendees")
    .select("idnum, name, email, registered_at, food_collected_at, qr_sent_at")
    .order("name", { ascending: true })
    .limit(500);

  if (search) {
    const safe = search.replace(/[%,()]/g, "");
    query = query.or(`name.ilike.%${safe}%,email.ilike.%${safe}%,idnum.ilike.%${safe}%`);
  }

  const [{ data, error }, total, registered, fed, unsent] = await Promise.all([
    query,
    sb.from("attendees").select("idnum", { count: "exact", head: true }),
    sb
      .from("attendees")
      .select("idnum", { count: "exact", head: true })
      .not("registered_at", "is", null),
    sb
      .from("attendees")
      .select("idnum", { count: "exact", head: true })
      .not("food_collected_at", "is", null),
    sb
      .from("attendees")
      .select("idnum", { count: "exact", head: true })
      .is("qr_sent_at", null)
      .not("email", "is", null),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    attendees: data ?? [],
    stats: {
      total: total.count ?? 0,
      registered: registered.count ?? 0,
      fed: fed.count ?? 0,
      unsent: unsent.count ?? 0,
    },
  });
}
