import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client. Use only on the server, and only for trusted operations
// like /api/demo/reset. Falls back to the anon key if service role isn't set
// (sufficient because the hackathon RLS policies are open).
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
