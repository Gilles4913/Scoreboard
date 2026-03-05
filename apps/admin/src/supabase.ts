import { createClient } from "@supabase/supabase-js";

function getEnv(name: string): string {
  const v = (import.meta as any).env?.[name];
  return typeof v === "string" ? v : "";
}

const SUPABASE_URL = getEnv("VITE_SUPABASE_URL");
const SUPABASE_ANON_KEY = getEnv("VITE_SUPABASE_ANON_KEY");

if (!SUPABASE_URL) {
  throw new Error("VITE_SUPABASE_URL is missing in Vercel environment variables");
}

if (!SUPABASE_ANON_KEY) {
  throw new Error("VITE_SUPABASE_ANON_KEY is missing in Vercel environment variables");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
