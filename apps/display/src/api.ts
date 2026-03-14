// apps/display/src/api.ts
export type Json = Record<string, any>;

export type SportProfile = {
  id: string;
  org_id: string;
  sport: string;
  default_display_template_id?: string | null;
  // Common display blocks
  show_score: boolean;
  show_clock: boolean;
  show_period: boolean;
  show_status: boolean;
  show_logos: boolean;
  show_sponsors: boolean;
  show_lower_third: boolean;
  // Live overlays
  show_live_overlays: boolean;
  overlay_position: "top" | "bottom";
  overlay_duration_ms: number;
  // LED readability
  density_mode: "low" | "medium" | "high";
  score_scale: number;
  clock_scale: number;
  team_name_mode: "full" | "short" | "code";
  use_short_team_names: boolean;
  show_separator_score: boolean;
  // Sport-specific flags
  show_team_fouls: boolean;
  show_player_fouls: boolean;
  show_timeouts: boolean;
  show_bonus: boolean;
  show_shot_clock: boolean;
  show_possession_arrow: boolean;
  show_cards: boolean;
  show_substitutions: boolean;
  show_sin_bin: boolean;
  show_rugby_score_breakdown: boolean;
  show_rugby_tries: boolean;
  show_rugby_conversions: boolean;
  show_rugby_penalties: boolean;
  show_rugby_drop_goals: boolean;
  show_added_time: boolean;
  show_penalty_shootout: boolean;
  show_match_phase: boolean;
  show_two_min_suspensions: boolean;
  show_disqualifications: boolean;
  show_warnings: boolean;
  show_sets: boolean;
  show_set_points: boolean;
  show_service: boolean;
  show_current_set: boolean;
  show_tiebreak: boolean;
  // Resolved template
  resolved_template_id?: string | null;
  resolved_template_code?: string | null;
  config_json?: Json;
};

export type DisplayContext = {
  match: {
    id: string;
    name: string;
    status: string;
    scheduled_at: string | null;
  };
  org: {
    id: string;
    slug: string;
    name: string;
    sport: string;
  };
  home: {
    team: { id?: string; name: string; short_name?: string | null; logo?: string | null; colors?: Json | null } | null;
    display: Json;
  };
  away: {
    team: { id?: string; name: string; short_name?: string | null; logo?: string | null; colors?: Json | null } | null;
    display: Json;
  };
  sport_profile?: SportProfile | null;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const EDGE_CONTEXT_URL = (import.meta.env.VITE_EDGE_CONTEXT_URL as string) || "";

function requireEnv() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
  }
  if (!EDGE_CONTEXT_URL) {
    throw new Error("Missing VITE_EDGE_CONTEXT_URL");
  }
}

export async function fetchDisplayContext(params: {
  teamSlug?: string;
  teamId?: string;
  matchId?: string;
}): Promise<DisplayContext> {
  requireEnv();

  const url = new URL(EDGE_CONTEXT_URL.replace(/\/$/, ""));
  if (params.teamSlug) url.searchParams.set("teamSlug", params.teamSlug);
  if (params.teamId) url.searchParams.set("teamId", params.teamId);
  if (params.matchId) url.searchParams.set("matchId", params.matchId);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`get-display-context failed: ${res.status} ${text}`.trim());
  }

  return (await res.json()) as DisplayContext;
}
