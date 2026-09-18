import { readFile } from "node:fs/promises";
import path from "node:path";
import ejs from "ejs";
import nodemailer, { type Transporter } from "nodemailer";
import QRCode from "qrcode";
import { buildQrPayload } from "./qr";
import { buildGoogleCalendarUrl, buildIcs } from "./ics";

export const QR_CID = "qrcode";
export const LOGO_CID = "logo";

const TEMPLATE_PATH = path.join(process.cwd(), "emails", "ticket.ejs");
const LOGO_PATH = path.join(process.cwd(), "public", "logo.png");

type ProviderPreset = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
};

/**
 * Resend's SMTP relay (smtp.resend.com) requires a verified domain to
 * authenticate at all — their own docs list it as a hard prerequisite, and in
 * practice an unverified account gets a flat "535 Authentication credentials
 * invalid" even with a correct API key. Their HTTP API has no such
 * requirement: the onboarding@resend.dev test sender works over API with zero
 * domain setup. So Resend is sent over their API (sendViaResendApi below),
 * never over SMTP. Brevo verifies a single sender address instead of a whole
 * domain, so its SMTP relay has no equivalent restriction and stays as-is.
 */
function resolvePreset(): ProviderPreset {
  const provider = (process.env.EMAIL_PROVIDER ?? "resend").toLowerCase();

  if (provider === "brevo") {
    const user = process.env.EMAIL_SMTP_USER;
    if (!user) {
      throw new Error(
        "EMAIL_PROVIDER=brevo requires EMAIL_SMTP_USER (the SMTP login Brevo shows you, e.g. 8xxxxx@smtp-brevo.com).",
      );
    }
    return { host: "smtp-relay.brevo.com", port: 587, secure: false, user };
  }

  if (provider === "smtp") {
    const host = process.env.EMAIL_SMTP_HOST;
    const user = process.env.EMAIL_SMTP_USER;
    if (!host || !user) {
      throw new Error("EMAIL_PROVIDER=smtp requires EMAIL_SMTP_HOST and EMAIL_SMTP_USER.");
    }
    const port = Number(process.env.EMAIL_SMTP_PORT ?? 587);
    return { host, port, secure: port === 465, user };
  }

  throw new Error(`Unknown EMAIL_PROVIDER "${provider}". Use resend, brevo or smtp.`);
}

let transporter: Transporter | null = null;

function getTransport(): Transporter {
  if (transporter) return transporter;

  const apiKey = process.env.EMAIL_API_KEY;
  if (!apiKey) throw new Error("EMAIL_API_KEY is not set. See SETUP.md.");

  const preset = resolvePreset();
  transporter = nodemailer.createTransport({
    host: preset.host,
    port: preset.port,
    secure: preset.secure,
    auth: { user: preset.user, pass: apiKey },
  });
  return transporter;
}

function fromAddress(): string {
  const address = process.env.EMAIL_FROM;
  if (!address) throw new Error("EMAIL_FROM is not set. See SETUP.md.");
  const name = process.env.EMAIL_FROM_NAME;
  return name ? `"${name}" <${address}>` : address;
}

type Attachment = { filename: string; content: Buffer; cid?: string; contentType: string };

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments: Attachment[];
};

async function sendViaResendApi(args: SendArgs): Promise<void> {
  const apiKey = process.env.EMAIL_API_KEY;
  if (!apiKey) throw new Error("EMAIL_API_KEY is not set. See SETUP.md.");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
      attachments: args.attachments.map((a) => ({
        filename: a.filename,
        content: a.content.toString("base64"),
        content_type: a.contentType,
        content_id: a.cid,
      })),
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const reason = body?.message || `HTTP ${res.status}`;
    throw new Error(`Resend API rejected the send: ${reason}`);
  }
}

async function sendViaSmtp(args: SendArgs): Promise<void> {
  await getTransport().sendMail({
    from: fromAddress(),
    to: args.to,
    subject: args.subject,
    html: args.html,
    text: args.text,
    attachments: args.attachments,
  });
}

/** Cached across warm invocations. `undefined` = not looked up, `null` = absent. */
let logoBuffer: Buffer | null | undefined;

async function loadLogo(): Promise<Buffer | null> {
  if (logoBuffer !== undefined) return logoBuffer;
  try {
    logoBuffer = await readFile(LOGO_PATH);
  } catch {
    // Ticket without a logo still works; a ticket that fails to send does not.
    console.warn("No public/logo.png found — sending the ticket without a logo.");
    logoBuffer = null;
  }
  return logoBuffer;
}

export type TicketRecipient = {
  idnum: string;
  name: string;
  email: string;
};

export async function sendTicketEmail(attendee: TicketRecipient): Promise<void> {
  const payload = buildQrPayload(attendee.idnum);

  // Generated in memory. Vercel functions have no persistent local disk, so
  // this PNG must never be written to a file.
  const qrPng = await QRCode.toBuffer(payload, {
    type: "png",
    errorCorrectionLevel: "M",
    width: 640,
    margin: 2,
    color: { dark: "#123638", light: "#FFFFFF" },
  });

  const logo = await loadLogo();

  const eventName = process.env.EVENT_NAME || "Sustainability Sphere";
  const eventLocation = process.env.EVENT_LOCATION || "";

  // Calendar invite is opt-in: EVENT_START_ISO must be a real datetime (e.g.
  // "2026-10-04T09:00:00+08:00"), unlike EVENT_DATE which is free-text for
  // display only and may not be parseable.
  const eventStartIso = process.env.EVENT_START_ISO || "";
  const calendarEvent = eventStartIso
    ? {
        uid: `${attendee.idnum}@sustainability-sphere`,
        title: eventName,
        description: `Your ticket ID is ${attendee.idnum}.`,
        location: eventLocation || undefined,
        startIso: eventStartIso,
        endIso: process.env.EVENT_END_ISO || undefined,
      }
    : null;

  const html = await ejs.renderFile(TEMPLATE_PATH, {
    name: attendee.name,
    email: attendee.email,
    idnum: attendee.idnum,
    eventName,
    eventDate: process.env.EVENT_DATE || "",
    eventLocation,
    qrCid: QR_CID,
    logoCid: LOGO_CID,
    hasLogo: logo !== null,
    googleCalendarUrl: calendarEvent ? buildGoogleCalendarUrl(calendarEvent) : null,
    hasCalendarInvite: calendarEvent !== null,
  });

  const attachments: Attachment[] = [
    {
      filename: `ticket-${attendee.idnum}.png`,
      content: qrPng,
      cid: QR_CID,
      contentType: "image/png",
    },
  ];

  if (logo) {
    attachments.push({
      filename: "logo.png",
      content: logo,
      cid: LOGO_CID,
      contentType: "image/png",
    });
  }

  if (calendarEvent) {
    attachments.push({
      filename: "event.ics",
      content: Buffer.from(buildIcs(calendarEvent), "utf-8"),
      contentType: "text/calendar; method=PUBLISH; charset=UTF-8",
    });
  }

  const args: SendArgs = {
    to: attendee.email,
    subject: `Your ${eventName} ticket — ${attendee.name}`,
    html,
    text:
      `Hi ${attendee.name},\n\n` +
      `This is your ticket for ${eventName}.\n` +
      `Your ID is ${attendee.idnum}.\n\n` +
      `The QR code is in the HTML version of this email — open it on your ` +
      `phone and show it at the door.\n`,
    attachments,
  };

  const provider = (process.env.EMAIL_PROVIDER ?? "resend").toLowerCase();
  if (provider === "resend") {
    await sendViaResendApi(args);
  } else {
    await sendViaSmtp(args);
  }
}
