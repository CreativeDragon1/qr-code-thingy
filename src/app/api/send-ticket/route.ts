import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { serverFailure } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase";
import { sendTicketEmail, type TicketRecipient } from "@/lib/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Free tiers rate-limit hard (Resend allows ~2/sec). Stay well under. */
const SEND_GAP_MS = 600;
const DEFAULT_BATCH = 10;
const MAX_BATCH = 25;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type SendOutcome = { idnum: string; ok: boolean; error?: string };

async function deliver(attendee: TicketRecipient): Promise<SendOutcome> {
  try {
    await sendTicketEmail(attendee);
    const { error } = await supabaseAdmin()
      .from("attendees")
      .update({ qr_sent_at: new Date().toISOString() })
      .eq("idnum", attendee.idnum);
    if (error) {
      // The mail is already gone. Surface this loudly: the row still looks
      // unsent, so a later batch would mail this person a second time.
      return {
        idnum: attendee.idnum,
        ok: false,
        error: `Sent, but failed to record qr_sent_at: ${error.message}`,
      };
    }
    return { idnum: attendee.idnum, ok: true };
  } catch (err) {
    return {
      idnum: attendee.idnum,
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function POST(req: Request) {
  const denied = requireAuth(req);
  if (denied) return denied;

  try {
    return await handleSend(req);
  } catch (err) {
    return serverFailure(err);
  }
}

async function handleSend(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const { idnum, batch, limit, resend } = (body ?? {}) as {
    idnum?: unknown;
    batch?: unknown;
    limit?: unknown;
    resend?: unknown;
  };

  const sb = supabaseAdmin();

  // --- Single send -------------------------------------------------------
  if (typeof idnum === "string" && idnum.length > 0) {
    const { data: attendee, error } = await sb
      .from("attendees")
      .select("idnum, name, email, qr_sent_at")
      .eq("idnum", idnum)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!attendee) {
      return NextResponse.json({ error: `No attendee with ID ${idnum}.` }, { status: 404 });
    }
    if (attendee.qr_sent_at && resend !== true) {
      return NextResponse.json(
        { error: "Ticket already sent. Pass resend: true to send it again." },
        { status: 409 },
      );
    }

    const outcome = await deliver(attendee);
    return NextResponse.json(
      {
        sent: outcome.ok ? 1 : 0,
        failed: outcome.ok ? 0 : 1,
        results: [outcome],
        // The client's fetch wrapper surfaces this top-level field on failure;
        // without it, a real send error (bad key, unverified domain, ...)
        // shows up to staff as a meaningless "Request failed (502)".
        ...(outcome.ok ? {} : { error: outcome.error }),
      },
      { status: outcome.ok ? 200 : 502 },
    );
  }

  // --- Bounded batch of everyone who has not been sent one yet -----------
  // Deliberately capped rather than "send to all": Vercel kills long-running
  // functions, so the admin page calls this repeatedly until remaining is 0.
  if (batch === true) {
    const size = Math.min(
      Math.max(Number(limit) || DEFAULT_BATCH, 1),
      MAX_BATCH,
    );

    const { data: pending, error } = await sb
      .from("attendees")
      .select("idnum, name, email")
      .is("qr_sent_at", null)
      .order("created_at", { ascending: true })
      .limit(size);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const results: SendOutcome[] = [];
    for (const [i, attendee] of (pending ?? []).entries()) {
      if (i > 0) await sleep(SEND_GAP_MS);
      results.push(await deliver(attendee));
    }

    const { count } = await sb
      .from("attendees")
      .select("idnum", { count: "exact", head: true })
      .is("qr_sent_at", null);

    return NextResponse.json({
      sent: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      remaining: count ?? 0,
      results,
    });
  }

  return NextResponse.json(
    { error: "Send one with { idnum }, or a batch with { batch: true }." },
    { status: 400 },
  );
}
