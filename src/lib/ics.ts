/**
 * Minimal RFC 5545 (iCalendar) builder — just enough for a single VEVENT
 * attached to a ticket email. No recurrence, no timezone components; times
 * are converted to UTC, which every calendar client accepts.
 */

function toUtcStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: "${iso}"`);
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

/** Escapes text per RFC 5545 §3.3.11 — comma, semicolon, backslash, newline. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/\n/g, "\\n");
}

export type IcsEvent = {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  startIso: string;
  /** Defaults to 3 hours after startIso when omitted. */
  endIso?: string;
};

export function buildIcs(event: IcsEvent): string {
  const start = toUtcStamp(event.startIso);
  const end = event.endIso
    ? toUtcStamp(event.endIso)
    : toUtcStamp(new Date(new Date(event.startIso).getTime() + 3 * 60 * 60 * 1000).toISOString());

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sustainability Sphere//Ticket//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${toUtcStamp(new Date().toISOString())}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeText(event.title)}`,
  ];

  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);

  lines.push("END:VEVENT", "END:VCALENDAR");

  // iCalendar requires CRLF line endings.
  return lines.join("\r\n") + "\r\n";
}

/**
 * A Google Calendar "quick add" link — no auth, no certificates, just a URL.
 * Covers the case (mainly Gmail on Android/web) where the attached .ics file
 * isn't offered as an "Add to calendar" action inline.
 */
export function buildGoogleCalendarUrl(event: IcsEvent): string {
  const start = toUtcStamp(event.startIso);
  const end = event.endIso
    ? toUtcStamp(event.endIso)
    : toUtcStamp(new Date(new Date(event.startIso).getTime() + 3 * 60 * 60 * 1000).toISOString());

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${start}/${end}`,
  });
  if (event.description) params.set("details", event.description);
  if (event.location) params.set("location", event.location);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
