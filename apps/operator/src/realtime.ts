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

  show_team_fouls?: boolean;
  show_player_fouls?: boolean;
  show_timeouts?: boolean;
  show_bonus?: boolean;
  show_sets?: boolean;
  show_cards?: boolean;
  show_shot_clock?: boolean;

  home_team_fouls?: number | null;
  away_team_fouls?: number | null;
  home_timeouts?: number | null;
  away_timeouts?: number | null;
  home_bonus?: boolean | null;
  away_bonus?: boolean | null;
  shot_clock_s?: number | null;
  home_sets_won?: number | null;
  away_sets_won?: number | null;
  home_yellow_cards?: number | null;
  away_yellow_cards?: number | null;
  home_red_cards?: number | null;
  away_red_cards?: number | null;

  possession_arrow?: string | null;
  current_period_index?: number | null;
  is_overtime?: boolean | null;

  rugby_home_tries?: number | null;
  rugby_away_tries?: number | null;
  rugby_home_conversions?: number | null;
  rugby_away_conversions?: number | null;
  rugby_home_penalties?: number | null;
  rugby_away_penalties?: number | null;
  rugby_home_drop_goals?: number | null;
  rugby_away_drop_goals?: number | null;
  rugby_home_yellow_sin_bin?: number | null;
  rugby_away_yellow_sin_bin?: number | null;
  rugby_home_sin_bin_active?: number | null;
  rugby_away_sin_bin_active?: number | null;
  rugby_extra_time?: boolean | null;
  rugby_tiebreak_mode?: boolean | null;

  handball_home_2min?: number | null;
  handball_away_2min?: number | null;
  handball_home_2min_active?: number | null;
  handball_away_2min_active?: number | null;
  handball_home_team_timeouts?: number | null;
  handball_away_team_timeouts?: number | null;
  handball_home_warnings?: number | null;
  handball_away_warnings?: number | null;
  handball_home_disqualifications?: number | null;
  handball_away_disqualifications?: number | null;
  handball_extra_time?: boolean | null;
  handball_shootout_mode?: boolean | null;

  volleyball_home_timeouts?: number | null;
  volleyball_away_timeouts?: number | null;
  volleyball_home_set_points?: number | null;
  volleyball_away_set_points?: number | null;
  volleyball_home_serving?: boolean | null;
  volleyball_away_serving?: boolean | null;
  volleyball_current_set?: number | null;
  volleyball_is_tiebreak?: boolean | null;

  football_home_yellow_cards?: number | null;
  football_away_yellow_cards?: number | null;
  football_home_red_cards?: number | null;
  football_away_red_cards?: number | null;
  football_home_penalty_shootout?: number | null;
  football_away_penalty_shootout?: number | null;
  football_extra_time?: boolean | null;
  football_added_time_first_half?: number | null;
  football_added_time_second_half?: number | null;
  football_added_time_extra_1?: number | null;
  football_added_time_extra_2?: number | null;

  home?: { name: string };
  away?: { name: string };
  home_players?: any[] | null;
  away_players?: any[] | null;

  live_seq?: number;
  emitted_at?: number;

  [key: string]: any;
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

  const seq = patch.live_seq ?? Date.now();

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
      ts: patch.emitted_at ?? Date.now(),
      seq,
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`tv-broadcast HTTP ${res.status} ${txt}`);
  }

  return res.json().catch(() => null);
}
