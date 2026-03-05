import { supabase } from "./supabase";

function getEnv(name: string) {
  const v = (import.meta as any).env?.[name];
  return typeof v === "string" ? v : "";
}

const TV_BROADCAST_URL = getEnv("VITE_TV_BROADCAST_URL");

export type BroadcastPatch = {
  match?: Partial<{
    home_score: number;
    away_score: number;
    clock_ms: number;
    status: string;
    period_label: string;
    name: string;
    venue: string;
  }>;
  display?: Partial<{
    stadium_mode: boolean;
    lower_third: boolean;
    dual_language: boolean;
    lang_primary: "fr" | "en";
    lang_secondary: "fr" | "en";
    sponsors: Array<{ name: string; logoUrl?: string }>;
  }>;
};

export async function sendTvBroadcast(matchId: string, patch: BroadcastPatch) {
  if (!TV_BROADCAST_URL) throw new Error("VITE_TV_BROADCAST_URL manquante");

  const { data } = await supabase.auth.getSession();
  const jwt = data.session?.access_token;
  if (!jwt) throw new Error("Pas de session Supabase (JWT) — reconnecte-toi");

  const res = await fetch(TV_BROADCAST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      match_id: matchId,
      patch,
      ts: Date.now(),
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`tv-broadcast HTTP ${res.status} ${txt}`);
  }
}
