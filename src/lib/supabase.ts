import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Service-role client. Bypasses RLS, so this must only ever be called from
 * route handlers — never from a component that could render on the client.
 */
export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. See SETUP.md.");
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export type Attendee = {
  id: string;
  idnum: string;
  name: string;
  email: string;
  registered_at: string | null;
  food_collected_at: string | null;
  qr_sent_at: string | null;
  created_at: string;
};
