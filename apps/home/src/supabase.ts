import { createClient } from "@supabase/supabase-js";

function getEnv(name: string): string {
  const v = (import.meta as any).env?.[name];
  return typeof v === "string" ? v : "";
}

const supabaseUrl = getEnv("VITE_SUPABASE_URL");
const supabaseAnonKey = getEnv("VITE_SUPABASE_ANON_KEY");

/**
 * On laisse volontairement une erreur claire en runtime
 * si les variables ne sont pas présentes côté Vercel.
 */
if (!supabaseUrl) {
  // eslint-disable-next-line no-console
  console.error("[home] Missing env: VITE_SUPABASE_URL");
}
if (!supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error("[home] Missing env: VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
