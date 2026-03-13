import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import Scoreboard, { ScoreboardContext } from "./components/Scoreboard";

function getEnv(name: string): string {
  const v = (import.meta as any).env?.[name];
  return typeof v === "string" ? v : "";
}

const EDGE_CONTEXT_URL = getEnv("VITE_EDGE_CONTEXT_URL");
const SUPABASE_URL = getEnv("VITE_SUPABASE_URL");
const SUPABASE_ANON_KEY = getEnv("VITE_SUPABASE_ANON_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function getSearchParam(name: string) {
  try {
    const u = new URL(window.location.href);
    return u.searchParams.get(name) || "";
  } catch {
    return "";
  }
}

function mergeContext(
  prev: ScoreboardContext,
  patch: Partial<ScoreboardContext>,
): ScoreboardContext {
  return {
    ...prev,
    ...patch,
    home: { ...(prev.home || {}), ...(patch.home || {}) },
    away: { ...(prev.away || {}), ...(patch.away || {}) },
    sponsors:
      Array.isArray(patch.sponsors) && patch.sponsors.length > 0
        ? patch.sponsors
        : prev.sponsors ?? [],
  };
}

function buildContextFromResponse(json: any): ScoreboardContext {
  const match = json?.match || {};
  const org = json?.org || {};
  const displaySettings = json?.display_settings || {};
  const sportSettings = json?.sport_settings || {};

  return {
    theme: displaySettings.theme ?? "dark",
    dual_language: displaySettings.dual_language ?? false,
    lang_primary: displaySettings.lang_primary ?? "FR",
    lang_secondary: displaySettings.lang_secondary ?? "EN",
    show_lower_third: displaySettings.show_lower_third ?? true,
    show_logos: displaySettings.show_logos ?? true,
    sponsor_rotate_s: displaySettings.sponsor_rotate_s ?? 10,
    show_score: displaySettings.show_score ?? true,
    show_clock: displaySettings.show_clock ?? true,
    show_period: displaySettings.show_period ?? true,
    show_status: displaySettings.show_status ?? true,
    show_sponsors: displaySettings.show_sponsors ?? true,
    layout_mode: displaySettings.layout_mode ?? "stadium",

    show_team_fouls: sportSettings.show_team_fouls ?? false,
    show_player_fouls: sportSettings.show_player_fouls ?? false,
    show_timeouts: sportSettings.show_timeouts ?? false,
    show_bonus: sportSettings.show_bonus ?? false,
    show_sets: sportSettings.show_sets ?? false,
    show_cards: sportSettings.show_cards ?? false,
    show_shot_clock: sportSettings.show_shot_clock ?? false,

    sponsors: Array.isArray(json.sponsors) ? json.sponsors : [],

    match_id: match.id,
    match_name: match.name ?? "",
    status: match.status ?? "scheduled",
    sport: org.sport ?? sportSettings.sport ?? "football",
    venue: org.name ?? "",

    home_name: match.home_name ?? match.home?.name ?? "Domicile",
    away_name: match.away_name ?? match.away?.name ?? "Extérieur",
    home_score: match.home_score ?? 0,
    away_score: match.away_score ?? 0,
    clock_ms: match.clock_ms ?? 0,
    clock_running: match.clock_running ?? false,
    period_label: match.period_label ?? "",

    home_team_fouls: match.home_team_fouls ?? 0,
    away_team_fouls: match.away_team_fouls ?? 0,
    home_timeouts: match.home_timeouts ?? 0,
    away_timeouts: match.away_timeouts ?? 0,
    home_bonus: match.home_bonus ?? false,
    away_bonus: match.away_bonus ?? false,
    shot_clock_s: match.shot_clock_s ?? 0,
    possession_arrow: match.possession_arrow ?? null,

    home_sets_won: match.home_sets_won ?? 0,
    away_sets_won: match.away_sets_won ?? 0,

    home_yellow_cards: match.home_yellow_cards ?? 0,
    away_yellow_cards: match.away_yellow_cards ?? 0,
    home_red_cards: match.home_red_cards ?? 0,
    away_red_cards: match.away_red_cards ?? 0,

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

    home: match.home || {},
    away: match.away || {},
  } as any;
}

function buildPatchFromMatchRow(row: any): Partial<ScoreboardContext> {
  if (!row || typeof row !== "object") return {};

  return {
    match_id: row.id,
    match_name: row.name ?? undefined,
    status: row.status ?? undefined,
    home_name: row.home_name ?? undefined,
    away_name: row.away_name ?? undefined,
    home_score: row.home_score ?? undefined,
    away_score: row.away_score ?? undefined,
    clock_ms: row.clock_ms ?? undefined,
    clock_running: row.clock_running ?? undefined,
    period_label: row.period_label ?? undefined,

    home_team_fouls: row.home_team_fouls ?? undefined,
    away_team_fouls: row.away_team_fouls ?? undefined,
    home_timeouts: row.home_timeouts ?? undefined,
    away_timeouts: row.away_timeouts ?? undefined,
    home_bonus: row.home_bonus ?? undefined,
    away_bonus: row.away_bonus ?? undefined,
    shot_clock_s: row.shot_clock_s ?? undefined,
    possession_arrow: row.possession_arrow ?? undefined,

    home_sets_won: row.home_sets_won ?? undefined,
    away_sets_won: row.away_sets_won ?? undefined,

    home_yellow_cards: row.home_yellow_cards ?? undefined,
    away_yellow_cards: row.away_yellow_cards ?? undefined,
    home_red_cards: row.home_red_cards ?? undefined,
    away_red_cards: row.away_red_cards ?? undefined,

    rugby_home_tries: row.rugby_home_tries ?? undefined,
    rugby_away_tries: row.rugby_away_tries ?? undefined,
    rugby_home_conversions: row.rugby_home_conversions ?? undefined,
    rugby_away_conversions: row.rugby_away_conversions ?? undefined,
    rugby_home_penalties: row.rugby_home_penalties ?? undefined,
    rugby_away_penalties: row.rugby_away_penalties ?? undefined,
    rugby_home_drop_goals: row.rugby_home_drop_goals ?? undefined,
    rugby_away_drop_goals: row.rugby_away_drop_goals ?? undefined,
    rugby_home_sin_bin_active: row.rugby_home_sin_bin_active ?? undefined,
    rugby_away_sin_bin_active: row.rugby_away_sin_bin_active ?? undefined,

    handball_home_2min_active: row.handball_home_2min_active ?? undefined,
    handball_away_2min_active: row.handball_away_2min_active ?? undefined,
    handball_home_warnings: row.handball_home_warnings ?? undefined,
    handball_away_warnings: row.handball_away_warnings ?? undefined,
    handball_home_disqualifications: row.handball_home_disqualifications ?? undefined,
    handball_away_disqualifications: row.handball_away_disqualifications ?? undefined,

    volleyball_home_set_points: row.volleyball_home_set_points ?? undefined,
    volleyball_away_set_points: row.volleyball_away_set_points ?? undefined,
    volleyball_home_serving: row.volleyball_home_serving ?? undefined,
    volleyball_away_serving: row.volleyball_away_serving ?? undefined,
    volleyball_current_set: row.volleyball_current_set ?? undefined,
    volleyball_is_tiebreak: row.volleyball_is_tiebreak ?? undefined,

    football_home_penalty_shootout: row.football_home_penalty_shootout ?? undefined,
    football_away_penalty_shootout: row.football_away_penalty_shootout ?? undefined,
    football_added_time_first_half: row.football_added_time_first_half ?? undefined,
    football_added_time_second_half: row.football_added_time_second_half ?? undefined,
    football_added_time_extra_1: row.football_added_time_extra_1 ?? undefined,
    football_added_time_extra_2: row.football_added_time_extra_2 ?? undefined,
  };
}

function App() {
  const matchIdFromUrl = getSearchParam("matchId");
  const teamSlug = getSearchParam("teamSlug");
  const teamId = getSearchParam("teamId");

  const isStableTeamMode = !!teamSlug || !!teamId;

  const [ctx, setCtx] = useState<ScoreboardContext | null>(null);
  const [resolvedMatchId, setResolvedMatchId] = useState("");
  const [err, setErr] = useState("");

  const [localTick, setLocalTick] = useState(0);

  const lastBaseClockRef = useRef<number>(0);
  const lastBaseTsRef = useRef<number>(Date.now());
  const lastRunningRef = useRef<boolean>(false);
  const lastMatchIdRef = useRef<string>("");
  const lastSeqRef = useRef<number>(0);

  useEffect(() => {
    const t = window.setInterval(() => setLocalTick((v) => v + 1), 250);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!ctx) return;

    const nextClockMs = typeof ctx.clock_ms === "number" ? ctx.clock_ms : 0;
    const nextRunning = !!ctx.clock_running;
    const nextMatchId = String(ctx.match_id ?? "");

    const runningChanged = nextRunning !== lastRunningRef.current;
    const matchChanged = nextMatchId !== lastMatchIdRef.current;
    const clockChanged = nextClockMs !== lastBaseClockRef.current;

    if (runningChanged || matchChanged || clockChanged) {
      lastBaseClockRef.current = nextClockMs;
      lastBaseTsRef.current = Date.now();
      lastRunningRef.current = nextRunning;
      lastMatchIdRef.current = nextMatchId;
    }
  }, [ctx?.clock_ms, ctx?.clock_running, ctx?.match_id]);

  const computedContext = useMemo(() => {
    if (!ctx) return null;

    if (!ctx.clock_running) return ctx;

    const elapsed = Date.now() - lastBaseTsRef.current;
    const baseClockMs =
      typeof lastBaseClockRef.current === "number" ? lastBaseClockRef.current : 0;
    const computedClockMs = Math.max(0, baseClockMs - elapsed);

    if (computedClockMs <= 0) {
      return {
        ...ctx,
        clock_ms: 0,
        clock_running: false,
      };
    }

    return {
      ...ctx,
      clock_ms: computedClockMs,
    };
  }, [ctx, localTick]);

  async function fetchContextDirect(): Promise<any> {
    let resolvedTeamId = teamId;
    let orgId = "";
    let orgName = "";
    let orgSport = "football";

    if (teamSlug) {
      const { data: teamRow } = await supabase
        .from("teams")
        .select("id, org_id, name, slug")
        .eq("slug", teamSlug)
        .maybeSingle();
      if (teamRow) {
        resolvedTeamId = teamRow.id;
        orgId = teamRow.org_id;
      }
    } else if (teamId) {
      const { data: teamRow } = await supabase
        .from("teams")
        .select("id, org_id, name, slug")
        .eq("id", teamId)
        .maybeSingle();
      if (teamRow) orgId = teamRow.org_id;
    }

    if (orgId) {
      const { data: orgRow } = await supabase
        .from("orgs")
        .select("id, name, sport")
        .eq("id", orgId)
        .maybeSingle();
      if (orgRow) {
        orgName = orgRow.name ?? "";
        orgSport = orgRow.sport ?? "football";
      }
    }

    let match: any = null;
    if (matchIdFromUrl) {
      const { data } = await supabase
        .from("matches")
        .select("*")
        .eq("id", matchIdFromUrl)
        .maybeSingle();
      match = data;
    } else if (orgId) {
      const { data } = await supabase
        .from("matches")
        .select("*")
        .eq("org_id", orgId)
        .in("status", ["live", "paused"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      match = data;
    }

    let displaySettings: any = {};
    let sportSettings: any = {};
    if (orgId) {
      const [dsResult, ssResult] = await Promise.all([
        supabase.from("org_display_settings").select("*").eq("org_id", orgId).maybeSingle(),
        supabase.from("org_sport_settings").select("*").eq("org_id", orgId).maybeSingle(),
      ]);
      displaySettings = dsResult.data ?? {};
      sportSettings = ssResult.data ?? {};
    }

    return {
      match: match ?? {},
      org: { id: orgId, name: orgName, sport: orgSport },
      display_settings: displaySettings,
      sport_settings: sportSettings,
      sponsors: [],
    };
  }

  async function fetchContext() {
    if (!EDGE_CONTEXT_URL) {
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error("VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY manquante.");
      }
      return fetchContextDirect();
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY manquante.");
    }

    const base = EDGE_CONTEXT_URL.replace(/\/$/, "");
    const url = new URL(base);

    if (teamSlug) url.searchParams.set("teamSlug", teamSlug);
    if (teamId) url.searchParams.set("teamId", teamId);
    if (matchIdFromUrl) url.searchParams.set("matchId", matchIdFromUrl);

    const headers: Record<string, string> = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    };

    const res = await fetch(url.toString(), {
      method: "GET",
      headers,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${text}`.trim());
    }

    return res.json();
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialContext() {
      setErr("");

      if (!isStableTeamMode && !matchIdFromUrl) {
        setErr(
          "URL publique invalide. Utilise une URL stable d'équipe du type ?teamSlug=...",
        );
        return;
      }

      try {
        const json = await fetchContext();
        if (cancelled) return;

        const nextCtx = buildContextFromResponse(json);
        const nextMatchId = json?.match?.id || matchIdFromUrl || "";

        setResolvedMatchId(nextMatchId);
        setCtx(nextCtx);
      } catch (e: any) {
        if (!cancelled) {
          setErr(e?.message || "Impossible de charger le contexte display.");
        }
      }
    }

    loadInitialContext();

    return () => {
      cancelled = true;
    };
  }, [matchIdFromUrl, teamSlug, teamId, isStableTeamMode]);

  useEffect(() => {
    if (!isStableTeamMode) return;

    const interval = window.setInterval(async () => {
      try {
        const json = await fetchContext();
        const nextMatchId = json?.match?.id || "";
        const nextCtx = buildContextFromResponse(json);

        if (nextMatchId && nextMatchId !== resolvedMatchId) {
          setResolvedMatchId(nextMatchId);
        }

        setCtx((prev) => {
          if (!prev) return nextCtx;

          if (prev.match_id && nextCtx.match_id && prev.match_id !== nextCtx.match_id) {
            return nextCtx;
          }

          return mergeContext(prev, nextCtx);
        });
      } catch (e) {
        console.error("[display] stable team refresh failed", e);
      }
    }, 3000);

    return () => window.clearInterval(interval);
  }, [isStableTeamMode, resolvedMatchId, matchIdFromUrl, teamSlug, teamId]);

  function applyLivePatch(patch: any) {
    if (!patch || typeof patch !== "object") return;

    const seq = Number(patch?.live_seq || 0);
    if (seq > 0) {
      if (seq < lastSeqRef.current) return;
      lastSeqRef.current = seq;
    }

    setCtx((prev) => {
      if (!prev) return prev;
      return mergeContext(prev, patch);
    });
  }

  useEffect(() => {
    if (!resolvedMatchId) return;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;

    const topic = `match:${resolvedMatchId}`;
    const channel = supabase.channel(topic);

    channel
      .on("broadcast", { event: "*" }, (message) => {
        const patch = message?.payload?.patch || message?.payload || message;
        applyLivePatch(patch);
      })
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
          filter: `id=eq.${resolvedMatchId}`,
        },
        (payload: any) => {
          const patch = buildPatchFromMatchRow(payload?.new);
          if (!patch || Object.keys(patch).length === 0) return;
          applyLivePatch(patch);
        },
      )
      .subscribe((status) => {
        console.log("[display] realtime status:", status, topic);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [resolvedMatchId]);

  if (err) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0b0f14",
          color: "#e7eefc",
          padding: 24,
          fontFamily: "system-ui",
        }}
      >
        <h1 style={{ marginTop: 0 }}>scoreDisplay — Display</h1>
        <div style={{ marginTop: 12, color: "crimson" }}>{err}</div>
      </div>
    );
  }

  if (!computedContext) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0b0f14",
          color: "#e7eefc",
          padding: 24,
          fontFamily: "system-ui",
        }}
      >
        Chargement display...
      </div>
    );
  }

  return <Scoreboard context={computedContext} />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
