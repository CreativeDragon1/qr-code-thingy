import { NextResponse } from "next/server";

/**
 * These endpoints are all password-protected staff endpoints, so the real
 * message is more useful to the person debugging a deployment than a generic
 * one — missing env vars are the most common first-run failure.
 */
export function serverFailure(err: unknown): NextResponse {
  console.error(err);
  const message = err instanceof Error ? err.message : "Unexpected server error.";
  return NextResponse.json({ error: message }, { status: 500 });
}
