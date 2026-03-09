import { supabase } from "./supabase";

function getEnv(name: string): string {
  const v = (import.meta as any).env?.[name];
  return typeof v === "string" ? v : "";
}

const TV_BROADCAST_URL = getEnv("VITE_TV_BROADCAST_URL");

export type TvPatch = {
  match_id?: string;
  match_name?: string | null;
  venue?: string | null;

  sport?: string;
  status?: string;

  home_name?: string | null;
  away_name?: string | null;

  home_score?: number | null;
  away_score?: number | null;

  clock_ms?: number | null;
  clock_running?: boolean | null;
  period_label?: string | null;

  sponsors?: Array<{ name: string; logo_url?: string | null }>;

  show_score?: boolean;
  show_clock?: boolean;
  show_period?: boolean;
  show_status?: boolean;
  show_lower_third?: boolean;
  show_logos?: boolean;
  show_sponsors?: boolean;
  layout_mode?: string;
};

export async function sendTvBroadcast(matchId: string, patch: TvPatch) {
  if (!TV_BROADCAST_URL) {
    throw new Error("VITE_TV_BROADCAST_URL manquante.");
  }

  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  if (!accessToken) {
    throw new Error("Pas de session Supabase active.");
  }

  const res = await fetch(TV_BROADCAST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      match_id: matchId,
      type: "patch",
      payload: patch,
      ts: Date.now(),
      seq: Date.now(),
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`tv-broadcast HTTP ${res.status} ${txt}`);
  }

  return res.json().catch(() => null);
}
