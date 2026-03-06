import { createClient } from "@supabase/supabase-js";

function getEnv(name: string): string {
  const v = (import.meta as any).env?.[name];
  return typeof v === "string" ? v : "";
}

const supabaseUrl = getEnv("VITE_SUPABASE_URL");
const supabaseAnonKey = getEnv("VITE_SUPABASE_ANON_KEY");

if (!supabaseUrl) console.error("[operator] Missing env: VITE_SUPABASE_URL");
if (!supabaseAnonKey) console.error("[operator] Missing env: VITE_SUPABASE_ANON_KEY");

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
