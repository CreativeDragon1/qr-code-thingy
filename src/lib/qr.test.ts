import assert from "node:assert/strict";
import { test } from "node:test";
import { MODE_COLUMN, buildQrPayload, isScanMode, parseQrCode } from "./qr.ts";

test("accepts a well-formed code and extracts the id", () => {
  assert.deepEqual(parseQrCode("sus://10423"), { ok: true, idnum: "10423" });
});

test("tolerates surrounding whitespace from the decoder", () => {
  assert.deepEqual(parseQrCode("  sus://10423\n"), { ok: true, idnum: "10423" });
});

test("rejects anything that is not an event code", () => {
  const bad = [
    "https://example.com",
    "sus://",
    "sus://abc", // alphanumeric — widen ID_PATTERN in qr.ts if this changes
    "sus://10423extra",
    "SUS://10423", // scheme is case-sensitive
    "sus:/10423",
    "10423",
    "",
    "sus://10423\nsus://10424", // no multiline smuggling
    null,
    undefined,
    42,
  ];
  for (const value of bad) {
    assert.equal(parseQrCode(value).ok, false, `should reject ${JSON.stringify(value)}`);
  }
});

test("payload builder round-trips through the parser", () => {
  const parsed = parseQrCode(buildQrPayload("99021"));
  assert.deepEqual(parsed, { ok: true, idnum: "99021" });
});

test("each mode redeems its own column", () => {
  assert.equal(MODE_COLUMN.registration, "registered_at");
  assert.equal(MODE_COLUMN.food, "food_collected_at");
});

test("mode guard refuses unknown modes", () => {
  assert.equal(isScanMode("registration"), true);
  assert.equal(isScanMode("food"), true);
  assert.equal(isScanMode("drinks"), false);
  assert.equal(isScanMode(undefined), false);
});
