/**
 * The single source of truth for what a valid event QR code looks like.
 * Change ID_PATTERN alone if IDs ever become alphanumeric, e.g.
 *   const ID_PATTERN = "[A-Za-z0-9._-]+";
 */
const ID_PATTERN = "\\d+";

export const QR_SCHEME = "sus";
export const QR_REGEX = new RegExp(`^${QR_SCHEME}:\\/\\/(${ID_PATTERN})$`);

export function buildQrPayload(idnum: string): string {
  return `${QR_SCHEME}://${idnum}`;
}

export type ParsedCode =
  | { ok: true; idnum: string }
  | { ok: false; raw: string };

export function parseQrCode(raw: unknown): ParsedCode {
  if (typeof raw !== "string") return { ok: false, raw: "" };
  const value = raw.trim();
  const match = QR_REGEX.exec(value);
  if (!match) return { ok: false, raw: value };
  return { ok: true, idnum: match[1] };
}

export type ScanMode = "registration" | "food";

export const SCAN_MODES: ScanMode[] = ["registration", "food"];

export function isScanMode(value: unknown): value is ScanMode {
  return value === "registration" || value === "food";
}

/** Which attendees column each mode redeems. */
export const MODE_COLUMN: Record<ScanMode, "registered_at" | "food_collected_at"> = {
  registration: "registered_at",
  food: "food_collected_at",
};

export type ScanResultKind =
  | "success"
  | "already_used"
  | "not_found"
  | "invalid_format";

export type ScanResponse = {
  result: ScanResultKind;
  mode: ScanMode;
  idnum: string | null;
  attendee: { name: string; email: string } | null;
  /** When the code was previously redeemed, for already_used. */
  usedAt: string | null;
};
