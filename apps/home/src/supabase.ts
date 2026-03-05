import { createClient } from "@supabase/supabase-js";

function getEnv(name: string) {
  const v = (import.meta as any).env?.[name];
  return typeof v === "string" ? v : "";
}

const url = getEnv("VITE_SUPABASE_URL");
const anon = getEnv("VITE_SUPABASE_ANON_KEY");

if (!url) throw new Error("VITE_SUPABASE_URL manquant (Vercel env)");
if (!anon) throw new Error("VITE_SUPABASE_ANON_KEY manquant (Vercel env)");

export const supabase = createClient(url, anon);
