import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type JsonRecord = Record<string, unknown>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function normalizeStatus(value: unknown): string {
  const s = String(value ?? "").trim().toLowerCase();
  if (s === "live") return "live";
  if (s === "paused") return "paused";
  if (s === "finished") return "finished";
  if (s === "archived") return "archived";
  return "scheduled";
}

function firstNonEmptyString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function isUuidLike(value: string | null): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

const MATCH_SELECT = `
  id,
  org_id,
  team_id,
  home_team_id,
  away_team_id,
  name,
  status,
  scheduled_at,
  home_name,
  away_name,
  home_score,
  away_score,
  period_label,
  clock_ms,
  clock_running,
  clock_anchor_epoch_ms,
  clock_anchor_clock_ms,
  home_team_fouls,
  away_team_fouls,
  home_timeouts,
  away_timeouts,
  home_bonus,
  away_bonus,
  shot_clock_s,
  home_sets_won,
  away_sets_won,
  home_yellow_cards,
  away_yellow_cards,
  home_red_cards,
  away_red_cards,
  current_period_index,
  is_overtime,
  possession_arrow,
  team_fouls_period_home,
  team_fouls_period_away,
  timeouts_first_half_home,
  timeouts_first_half_away,
  timeouts_second_half_home,
  timeouts_second_half_away,
  timeouts_overtime_home,
  timeouts_overtime_away,
  last_event_seq,

  rugby_home_tries,
  rugby_away_tries,
  rugby_home_conversions,
  rugby_away_conversions,
  rugby_home_penalties,
  rugby_away_penalties,
  rugby_home_drop_goals,
  rugby_away_drop_goals,
  rugby_home_yellow_sin_bin,
  rugby_away_yellow_sin_bin,
  rugby_home_sin_bin_active,
  rugby_away_sin_bin_active,
  rugby_extra_time,
  rugby_tiebreak_mode,

  handball_home_2min,
  handball_away_2min,
  handball_home_2min_active,
  handball_away_2min_active,
  handball_home_team_timeouts,
  handball_away_team_timeouts,
  handball_home_warnings,
  handball_away_warnings,
  handball_home_disqualifications,
  handball_away_disqualifications,
  handball_extra_time,
  handball_shootout_mode,

  volleyball_home_timeouts,
  volleyball_away_timeouts,
  volleyball_home_set_points,
  volleyball_away_set_points,
  volleyball_home_serving,
  volleyball_away_serving,
  volleyball_current_set,
  volleyball_is_tiebreak,

  football_home_yellow_cards,
  football_away_yellow_cards,
  football_home_red_cards,
  football_away_red_cards,
  football_home_penalty_shootout,
  football_away_penalty_shootout,
  football_extra_time,
  football_added_time_first_half,
  football_added_time_second_half,
  football_added_time_extra_1,
  football_added_time_extra_2
`;

async function loadOrgSettings(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
) {
  // Step 1: load org first to get sport for filtering org_display_sport_profiles
  const orgRes = await supabase
    .from("orgs")
    .select("id, slug, name, sport, is_master")
    .eq("id", orgId)
    .maybeSingle();

  if (orgRes.error) throw orgRes.error;

  const orgSport = ((orgRes.data?.sport as string) || "football").toLowerCase().trim();

  // Step 2: load settings in parallel, profile filtered by sport
  const [displayRes, sportRes, profileRes] = await Promise.all([
    supabase
      .from("org_display_settings")
      .select("*")
      .eq("org_id", orgId)
      .maybeSingle(),
    supabase
      .from("org_sport_settings")
      .select("*")
      .eq("org_id", orgId)
      .maybeSingle(),
    supabase
      .from("org_display_sport_profiles")
      .select(
        `*, display_templates (
          id, code, name, layout_mode, config_json, is_active
        )`,
      )
      .eq("org_id", orgId)
      .eq("sport", orgSport)
      .maybeSingle(),
  ]);

  if (displayRes.error) throw displayRes.error;
  if (sportRes.error) throw sportRes.error;
  // profileRes errors are soft — table may not exist yet in all envs
  if (profileRes.error) {
    console.warn("[get-display-context] org_display_sport_profiles failed:", profileRes.error.message);
  }

  return {
    org: orgRes.data ?? null,
    display_settings: displayRes.data ?? {},
    sport_settings: sportRes.data ?? {},
    sport_profile: (profileRes.error ? null : profileRes.data) ?? null,
  };
}

async function loadTeamDisplaySettings(
  supabase: ReturnType<typeof createClient>,
  teamId: string,
): Promise<{ layout_mode: string | null; config_json: JsonRecord } | null> {
  const { data, error } = await supabase
    .from("team_display_settings")
    .select(
      `
      template_id,
      display_templates (
        id,
        code,
        layout_mode,
        config_json,
        is_active
      )
    `,
    )
    .eq("team_id", teamId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.warn("[get-display-context] team_display_settings query failed:", error.message);
    return null;
  }

  if (!data) return null;

  const template = (data as any).display_templates;
  if (!template || template.is_active === false) return null;

  return {
    layout_mode: typeof template.layout_mode === "string" ? template.layout_mode : null,
    config_json:
      template.config_json && typeof template.config_json === "object"
        ? (template.config_json as JsonRecord)
        : {},
  };
}

async function loadTeamsForMatch(
  supabase: ReturnType<typeof createClient>,
  match: JsonRecord,
) {
  const ids = [match.home_team_id, match.away_team_id].filter(
    (v) => typeof v === "string" && v,
  ) as string[];

  if (ids.length === 0) {
    return {
      home: { name: match.home_name ?? "Domicile" },
      away: { name: match.away_name ?? "Extérieur" },
    };
  }

  const { data, error } = await supabase
    .from("teams")
    .select(
      "id, name, short_name, logo_url, primary_color, secondary_color, slug, category, code",
    )
    .in("id", ids);

  if (error) throw error;

  const byId = new Map((data ?? []).map((t: any) => [t.id, t]));

  const homeTeam = byId.get(match.home_team_id as string);
  const awayTeam = byId.get(match.away_team_id as string);

  return {
    home: {
      name: firstNonEmptyString(homeTeam?.name, match.home_name, "Domicile"),
      short_name: homeTeam?.short_name ?? null,
      logo_url: homeTeam?.logo_url ?? null,
      primary_color: homeTeam?.primary_color ?? null,
      secondary_color: homeTeam?.secondary_color ?? null,
      slug: homeTeam?.slug ?? null,
      category: homeTeam?.category ?? null,
      code: homeTeam?.code ?? null,
    },
    away: {
      name: firstNonEmptyString(awayTeam?.name, match.away_name, "Extérieur"),
      short_name: awayTeam?.short_name ?? null,
      logo_url: awayTeam?.logo_url ?? null,
      primary_color: awayTeam?.primary_color ?? null,
      secondary_color: awayTeam?.secondary_color ?? null,
      slug: awayTeam?.slug ?? null,
      category: awayTeam?.category ?? null,
      code: awayTeam?.code ?? null,
    },
  };
}

async function loadSponsors(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
) {
  const candidateTables = ["org_sponsors", "sponsors"];

  for (const table of candidateTables) {
    const res = await supabase
      .from(table)
      .select("name, logo_url, is_active, org_id")
      .eq("org_id", orgId)
      .limit(20);

    if (!res.error) {
      return (res.data ?? [])
        .filter((x: any) => x?.is_active !== false)
        .map((x: any) => ({
          name: x.name ?? "",
          logo_url: x.logo_url ?? null,
        }))
        .filter((x: any) => x.name);
    }
  }

  return [];
}

async function loadMatchPlayers(
  supabase: ReturnType<typeof createClient>,
  matchId: string,
  homeTeamId: string | null,
  awayTeamId: string | null,
) {
  const { data, error } = await supabase
    .from("match_players")
    .select(
      `
      id,
      match_id,
      team_id,
      player_id,
      shirt_number,
      fouls,
      points,
      yellow_cards,
      red_cards,
      is_selected,
      players:player_id (
        id,
        name,
        number
      )
    `,
    )
    .eq("match_id", matchId)
    .eq("is_selected", true);

  if (error) {
    return { home_players: [], away_players: [] };
  }

  const rows = (data ?? []).map((row: any) => ({
    id: row.player_id ?? row.id,
    name: row.players?.name ?? null,
    number: row.shirt_number ?? row.players?.number ?? null,
    fouls: row.fouls ?? 0,
    points: row.points ?? 0,
    yellow_cards: row.yellow_cards ?? 0,
    red_cards: row.red_cards ?? 0,
    team_id: row.team_id ?? null,
  }));

  return {
    home_players: rows.filter((r: any) => homeTeamId && r.team_id === homeTeamId),
    away_players: rows.filter((r: any) => awayTeamId && r.team_id === awayTeamId),
  };
}

async function findMatchById(
  supabase: ReturnType<typeof createClient>,
  matchId: string,
) {
  const { data, error } = await supabase
    .from("matches")
    .select(MATCH_SELECT)
    .eq("id", matchId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function resolveTeam(
  supabase: ReturnType<typeof createClient>,
  teamSlug: string | null,
  teamId: string | null,
) {
  if (teamId) {
    const { data, error } = await supabase
      .from("teams")
      .select("id, org_id, slug, name, category, code")
      .eq("id", teamId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  if (teamSlug) {
    const exact = await supabase
      .from("teams")
      .select("id, org_id, slug, name, category, code")
      .eq("slug", teamSlug)
      .maybeSingle();

    if (exact.error) throw exact.error;
    if (exact.data) return exact.data;

    const insensitive = await supabase
      .from("teams")
      .select("id, org_id, slug, name, category, code")
      .ilike("slug", teamSlug)
      .maybeSingle();

    if (insensitive.error) throw insensitive.error;
    if (insensitive.data) return insensitive.data;
  }

  return null;
}

async function findBestMatchForTeam(
  supabase: ReturnType<typeof createClient>,
  teamId: string,
) {
  const byStatus = async (status: string) => {
    const { data, error } = await supabase
      .from("matches")
      .select(MATCH_SELECT)
      .or(`team_id.eq.${teamId},home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .eq("status", status)
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .limit(10);

    if (error) throw error;
    return data ?? [];
  };

  const liveMatches = await byStatus("live");
  if (liveMatches.length > 0) return liveMatches[0];

  const pausedMatches = await byStatus("paused");
  if (pausedMatches.length > 0) return pausedMatches[0];

  const scheduledMatches = await byStatus("scheduled");
  if (scheduledMatches.length > 0) return scheduledMatches[0];

  const { data: recentFinished, error: finishedError } = await supabase
    .from("matches")
    .select(MATCH_SELECT)
    .or(`team_id.eq.${teamId},home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .in("status", ["finished", "archived"])
    .order("scheduled_at", { ascending: false, nullsFirst: false })
    .limit(5);

  if (finishedError) throw finishedError;
  return recentFinished?.[0] ?? null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return json(
        {
          error:
            "Missing Supabase env. SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are required.",
        },
        500,
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const url = new URL(req.url);
    const matchId = url.searchParams.get("matchId");
    const teamSlug = url.searchParams.get("teamSlug");
    const teamId = url.searchParams.get("teamId");

    let match: any = null;
    let team: any = null;

    if (matchId && isUuidLike(matchId)) {
      match = await findMatchById(supabase, matchId);
    }

    if (!match && (teamSlug || teamId)) {
      team = await resolveTeam(supabase, teamSlug, teamId);

      if (!team) {
        return json(
          {
            error: "Team not found.",
            match: null,
            org: null,
            display_settings: {},
            sport_settings: {},
          },
          404,
        );
      }

      match = await findBestMatchForTeam(supabase, team.id);
    }

    if (!match) {
      return json(
        {
          error: "No match found for the provided team or match context.",
          match: null,
          org: null,
          display_settings: {},
          sport_settings: {},
        },
        404,
      );
    }

    const orgId = String(match.org_id ?? team?.org_id ?? "");
    if (!orgId) {
      return json({ error: "Match org_id is missing." }, 500);
    }

    const resolvedTeamId = team?.id ?? match.team_id ?? null;

    const [orgSettings, teamTemplate, teamsData, sponsors, players] = await Promise.all([
      loadOrgSettings(supabase, orgId),
      resolvedTeamId ? loadTeamDisplaySettings(supabase, resolvedTeamId) : Promise.resolve(null),
      loadTeamsForMatch(supabase, match),
      loadSponsors(supabase, orgId),
      loadMatchPlayers(
        supabase,
        String(match.id),
        typeof match.home_team_id === "string" ? match.home_team_id : null,
        typeof match.away_team_id === "string" ? match.away_team_id : null,
      ),
    ]);

    const { org, display_settings: orgDisplaySettings, sport_settings, sport_profile } = orgSettings;

    // Resolve display template:
    // 1. team_display_settings override
    // 2. org_display_sport_profiles.default_display_template_id
    // 3. fallback: display_templates WHERE is_default_system=true AND sport=org.sport
    const profileTemplate = (sport_profile as any)?.display_templates ?? null;
    const profileTemplateActive = profileTemplate && profileTemplate.is_active !== false;
    let resolvedTemplate: { id?: string; code?: string; name?: string; layout_mode: string | null; config_json: JsonRecord } | null =
      teamTemplate ?? (profileTemplateActive ? profileTemplate : null) ?? null;

    if (!resolvedTemplate) {
      const sportValue = ((org?.sport as string) || (sport_settings as any)?.sport || "football").toLowerCase().trim();
      const { data: sysTemplate, error: sysErr } = await supabase
        .from("display_templates")
        .select("id, code, name, layout_mode, config_json")
        .eq("sport", sportValue)
        .eq("is_default_system", true)
        .eq("is_active", true)
        .maybeSingle();
      if (!sysErr && sysTemplate) {
        resolvedTemplate = {
          id: sysTemplate.id,
          code: sysTemplate.code,
          name: sysTemplate.name,
          layout_mode: sysTemplate.layout_mode,
          config_json: (sysTemplate.config_json && typeof sysTemplate.config_json === "object"
            ? sysTemplate.config_json
            : {}) as JsonRecord,
        };
      }
    }

    const baseDisplayDefaults = {
      theme: "dark",
      dual_language: false,
      lang_primary: "FR",
      lang_secondary: "EN",
      show_lower_third: true,
      show_logos: true,
      sponsor_rotate_s: 10,
      show_score: true,
      show_clock: true,
      show_period: true,
      show_status: true,
      show_sponsors: true,
      show_substitution_banner: true,
      show_live_badge: false,
      layout_mode: "stadium",
    };

    // Explicit 3-level resolution for show_live_badge:
    // 1. display_templates.config_json.show_live_badge
    // 2. org_display_sport_profiles.show_live_badge
    // 3. org_display_settings.show_live_badge (default false)
    const resolvedTplConfig = ((resolvedTemplate?.config_json ?? {}) as Record<string, unknown>);
    const showLiveBadge: boolean =
      typeof resolvedTplConfig.show_live_badge === "boolean"
        ? resolvedTplConfig.show_live_badge
        : typeof (sport_profile as any)?.show_live_badge === "boolean"
        ? (sport_profile as any).show_live_badge
        : (orgDisplaySettings as any)?.show_live_badge ?? false;

    const display_settings = {
      ...baseDisplayDefaults,
      ...(orgDisplaySettings ?? {}),
      ...(resolvedTemplate?.config_json ?? {}),
      ...(resolvedTemplate?.layout_mode ? { layout_mode: resolvedTemplate.layout_mode } : {}),
      show_live_badge: showLiveBadge,
    };

    // Build clean sport_profile for payload (remove nested display_templates object)
    const { display_templates: _dt, ...sportProfileClean } = (sport_profile as any) ?? {};
    const sportProfilePayload = sport_profile
      ? {
          ...sportProfileClean,
          resolved_template_id: resolvedTemplate?.id ?? profileTemplate?.id ?? null,
          resolved_template_code: resolvedTemplate?.code ?? profileTemplate?.code ?? null,
        }
      : null;

    // Explicit display_template metadata for frontend convenience
    const displayTemplatePayload = resolvedTemplate
      ? {
          id: resolvedTemplate.id ?? null,
          code: resolvedTemplate.code ?? null,
          name: resolvedTemplate.name ?? null,
          layout_mode: resolvedTemplate.layout_mode ?? null,
        }
      : null;

    const payload = {
      org: org
        ? {
            ...org,
            sport: org.sport ?? sport_settings?.sport ?? "football",
          }
        : null,

      display_settings,
      // Alias: config_display_resolved is the merged final config (= display_settings)
      config_display_resolved: display_settings,

      display_template: displayTemplatePayload,
      resolved_display_template_id: resolvedTemplate?.id ?? null,

      // Sport profile alias
      display_profile: sportProfilePayload,

      sport_settings: {
        show_team_fouls: false,
        show_player_fouls: false,
        show_timeouts: false,
        show_bonus: false,
        show_sets: false,
        show_cards: false,
        show_shot_clock: false,
        ...(sport_settings ?? {}),
      },

      sport_profile: sportProfilePayload,

      match: {
        ...match,
        status: normalizeStatus(match.status),
        home_name: firstNonEmptyString(match.home_name, teamsData.home?.name, "Domicile"),
        away_name: firstNonEmptyString(match.away_name, teamsData.away?.name, "Extérieur"),
        home_score: match.home_score ?? 0,
        away_score: match.away_score ?? 0,
        clock_ms: match.clock_ms ?? 0,
        clock_running: match.clock_running ?? false,
        clock_anchor_epoch_ms: match.clock_anchor_epoch_ms ?? null,
        clock_anchor_clock_ms: match.clock_anchor_clock_ms ?? null,
        last_event_seq: match.last_event_seq ?? 0,
        period_label: match.period_label ?? "",
        home_team_fouls: match.home_team_fouls ?? 0,
        away_team_fouls: match.away_team_fouls ?? 0,
        home_timeouts: match.home_timeouts ?? 0,
        away_timeouts: match.away_timeouts ?? 0,
        home_bonus: match.home_bonus ?? false,
        away_bonus: match.away_bonus ?? false,
        shot_clock_s: match.shot_clock_s ?? 0,
        home_sets_won: match.home_sets_won ?? 0,
        away_sets_won: match.away_sets_won ?? 0,
        home_yellow_cards: match.home_yellow_cards ?? 0,
        away_yellow_cards: match.away_yellow_cards ?? 0,
        home_red_cards: match.home_red_cards ?? 0,
        away_red_cards: match.away_red_cards ?? 0,
        current_period_index: match.current_period_index ?? 1,
        is_overtime: match.is_overtime ?? false,
        possession_arrow: match.possession_arrow ?? null,

        rugby_home_tries: match.rugby_home_tries ?? 0,
        rugby_away_tries: match.rugby_away_tries ?? 0,
        rugby_home_conversions: match.rugby_home_conversions ?? 0,
        rugby_away_conversions: match.rugby_away_conversions ?? 0,
        rugby_home_penalties: match.rugby_home_penalties ?? 0,
        rugby_away_penalties: match.rugby_away_penalties ?? 0,
        rugby_home_drop_goals: match.rugby_home_drop_goals ?? 0,
        rugby_away_drop_goals: match.rugby_away_drop_goals ?? 0,
        rugby_home_sin_bin_active: match.rugby_home_sin_bin_active ?? 0,
        rugby_away_sin_bin_active: match.rugby_away_sin_bin_active ?? 0,

        handball_home_2min_active: match.handball_home_2min_active ?? 0,
        handball_away_2min_active: match.handball_away_2min_active ?? 0,
        handball_home_warnings: match.handball_home_warnings ?? 0,
        handball_away_warnings: match.handball_away_warnings ?? 0,
        handball_home_disqualifications: match.handball_home_disqualifications ?? 0,
        handball_away_disqualifications: match.handball_away_disqualifications ?? 0,

        volleyball_home_set_points: match.volleyball_home_set_points ?? 0,
        volleyball_away_set_points: match.volleyball_away_set_points ?? 0,
        volleyball_home_serving: match.volleyball_home_serving ?? false,
        volleyball_away_serving: match.volleyball_away_serving ?? false,
        volleyball_current_set: match.volleyball_current_set ?? 1,
        volleyball_is_tiebreak: match.volleyball_is_tiebreak ?? false,

        football_home_penalty_shootout: match.football_home_penalty_shootout ?? 0,
        football_away_penalty_shootout: match.football_away_penalty_shootout ?? 0,
        football_added_time_first_half: match.football_added_time_first_half ?? 0,
        football_added_time_second_half: match.football_added_time_second_half ?? 0,
        football_added_time_extra_1: match.football_added_time_extra_1 ?? 0,
        football_added_time_extra_2: match.football_added_time_extra_2 ?? 0,

        home: teamsData.home,
        away: teamsData.away,
      },

      team: team
        ? {
            id: team.id,
            org_id: team.org_id,
            slug: team.slug ?? null,
            name: team.name ?? null,
            category: team.category ?? null,
            code: team.code ?? null,
          }
        : null,

      sponsors,
      home_players: players.home_players,
      away_players: players.away_players,
    };

    return json(payload, 200);
  } catch (error: any) {
    console.error("[get-display-context] error", error);
    return json(
      {
        error: error?.message || "Unhandled error in get-display-context.",
      },
      500,
    );
  }
});
