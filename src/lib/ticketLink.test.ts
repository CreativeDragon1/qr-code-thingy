import assert from "node:assert/strict";
import { before, test } from "node:test";

before(() => {
  process.env.TICKET_LINK_SECRET = "test-secret-do-not-use-in-prod";
});

const { signTicketToken, verifyTicketToken, ticketPath } = await import("./ticketLink.ts");

test("a token verifies against the id it was signed for", () => {
  const token = signTicketToken("10423");
  assert.equal(verifyTicketToken("10423", token), true);
});

test("a token does not verify against a different id", () => {
  const token = signTicketToken("10423");
  assert.equal(verifyTicketToken("10424", token), false);
});

test("garbage tokens are rejected without throwing", () => {
  assert.equal(verifyTicketToken("10423", ""), false);
  assert.equal(verifyTicketToken("10423", "not-a-real-token"), false);
  assert.equal(verifyTicketToken("10423", "a".repeat(24)), false);
});

test("ticketPath embeds the id and a matching token", () => {
  const path = ticketPath("10423");
  assert.match(path, /^\/ticket\/10423\/[0-9a-f]{24}$/);
});
