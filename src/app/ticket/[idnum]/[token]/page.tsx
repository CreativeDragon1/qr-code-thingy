import { notFound } from "next/navigation";
import QRCode from "qrcode";
import TicketView from "@/components/TicketView";
import { buildQrPayload } from "@/lib/qr";
import { supabaseAdmin } from "@/lib/supabase";
import { verifyTicketToken } from "@/lib/ticketLink";

export const dynamic = "force-dynamic";

/**
 * Public — deliberately not behind requireAuth. Staff hand this link directly
 * to an attendee (or the attendee opens it themselves), so it can't require
 * the staff password. The signed token in the URL is what stops a stranger
 * from viewing anyone else's ticket by trying nearby IDs; see ticketLink.ts.
 */
export default async function TicketPage({
  params,
}: {
  params: Promise<{ idnum: string; token: string }>;
}) {
  const { idnum, token } = await params;

  if (!verifyTicketToken(idnum, token)) notFound();

  const { data: attendee } = await supabaseAdmin()
    .from("attendees")
    .select("idnum, name, email")
    .eq("idnum", idnum)
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
      email={attendee.email}
      idnum={attendee.idnum}
      qrDataUrl={qrDataUrl}
      eventName={process.env.EVENT_NAME || "Sustainability Sphere"}
      eventDate={process.env.EVENT_DATE || ""}
      eventLocation={process.env.EVENT_LOCATION || ""}
    />
  );
}
