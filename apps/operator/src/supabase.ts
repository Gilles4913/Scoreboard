// apps/operator/src/supabase.ts
import { createClient } from "@supabase/supabase-js";

function env(name: string): string {
  const v = (import.meta as any).env?.[name];
  return typeof v === "string" ? v : "";
}

export const SUPABASE_URL = env("VITE_SUPABASE_URL");
export const SUPABASE_ANON_KEY = env("VITE_SUPABASE_ANON_KEY");

if (!SUPABASE_URL) console.error("Missing env VITE_SUPABASE_URL");
if (!SUPABASE_ANON_KEY) console.error("Missing env VITE_SUPABASE_ANON_KEY");

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export function readSessionTransferFromUrl(): { access_token: string; refresh_token: string } | null {
  // On supporte query (?access_token=...&refresh_token=...) ou hash (#access_token=...)
  const url = new URL(window.location.href);
  const q = url.searchParams;

  let access_token = q.get("access_token") || "";
  let refresh_token = q.get("refresh_token") || "";

  if (!access_token || !refresh_token) {
    const hash = (url.hash || "").replace(/^#/, "");
    const hp = new URLSearchParams(hash);
    access_token = access_token || hp.get("access_token") || "";
    refresh_token = refresh_token || hp.get("refresh_token") || "";
  }

  if (!access_token || !refresh_token) return null;
  return { access_token, refresh_token };
}

export async function applySessionTransferIfPresent(): Promise<boolean> {
  const t = readSessionTransferFromUrl();
  if (!t) return false;

  const { error } = await supabase.auth.setSession({
    access_token: t.access_token,
    refresh_token: t.refresh_token,
  });

  // Nettoie l’URL (important : ne pas laisser les tokens traîner)
  try {
    const clean = new URL(window.location.href);
    clean.searchParams.delete("access_token");
    clean.searchParams.delete("refresh_token");
    clean.hash = "";
    window.history.replaceState({}, "", clean.toString());
  } catch {}

  if (error) {
    console.error("applySessionTransferIfPresent error:", error);
    return false;
  }
  return true;
}
