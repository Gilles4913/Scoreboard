// apps/operator/src/supabase.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function getEnv(name: string): string {
  const v = (import.meta as any).env?.[name];
  return typeof v === "string" ? v : "";
}

const supabaseUrl = getEnv("VITE_SUPABASE_URL");
const supabaseAnonKey = getEnv("VITE_SUPABASE_ANON_KEY");

// Message d'erreur explicite en dev (évite page noire silencieuse)
function assertEnv() {
  if (!supabaseUrl) throw new Error("VITE_SUPABASE_URL is required.");
  if (!supabaseAnonKey) throw new Error("VITE_SUPABASE_ANON_KEY is required.");
}

assertEnv();

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
