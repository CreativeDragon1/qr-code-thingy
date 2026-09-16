import { readFile } from "node:fs/promises";
import path from "node:path";
import ejs from "ejs";
import nodemailer, { type Transporter } from "nodemailer";
import QRCode from "qrcode";
import { buildQrPayload } from "./qr";

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
 * Both supported free-tier providers expose a plain SMTP relay, so swapping
 * between them is an env-var change rather than a code change. Set
 * EMAIL_PROVIDER=smtp to point at anything else.
 */
function resolvePreset(): ProviderPreset {
  const provider = (process.env.EMAIL_PROVIDER ?? "resend").toLowerCase();

  if (provider === "resend") {
    return { host: "smtp.resend.com", port: 465, secure: true, user: "resend" };
  }

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

  const html = await ejs.renderFile(TEMPLATE_PATH, {
    name: attendee.name,
    email: attendee.email,
    idnum: attendee.idnum,
    eventName,
    eventDate: process.env.EVENT_DATE || "",
    eventLocation: process.env.EVENT_LOCATION || "",
    qrCid: QR_CID,
    logoCid: LOGO_CID,
    hasLogo: logo !== null,
  });

  const attachments: {
    filename: string;
    content: Buffer;
    cid: string;
    contentType: string;
  }[] = [
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

  await getTransport().sendMail({
    from: fromAddress(),
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
  });
}
