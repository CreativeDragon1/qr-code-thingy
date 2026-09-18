import { notFound } from "next/navigation";
import QRCode from "qrcode";
import TicketView from "@/components/TicketView";
import { buildQrPayload } from "@/lib/qr";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Public — deliberately not behind requireAuth, same reasoning as
 * /ticket/[idnum]/[token]. This is the short-URL alternative for attendees
 * with no email to send a ticket link to: `access_code` is a random 8-char
 * string (see src/lib/accessCode.ts), not a guessable idnum, so looking a
 * ticket up by it directly is safe the same way the signed token is.
 */
export default async function AccessCodeTicketPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const { data: attendee } = await supabaseAdmin()
    .from("attendees")
    .select("idnum, name, email")
    .eq("access_code", code)
    .maybeSingle();

  if (!attendee) notFound();

  const qrDataUrl = await QRCode.toDataURL(buildQrPayload(attendee.idnum), {
    errorCorrectionLevel: "M",
    width: 640,
    margin: 2,
    color: { dark: "#123638", light: "#FFFFFF" },
  });

  return (
    <TicketView
      name={attendee.name}
      email={attendee.email ?? ""}
      idnum={attendee.idnum}
      qrDataUrl={qrDataUrl}
      eventName={process.env.EVENT_NAME || "Sustainability Sphere"}
      eventDate={process.env.EVENT_DATE || ""}
      eventLocation={process.env.EVENT_LOCATION || ""}
    />
  );
}
