import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import Scoreboard, { ScoreboardContext } from "./components/Scoreboard";
import LiveOverlayBanner, { LiveOverlay } from "./components/LiveOverlayBanner";

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

function mergeContext(prev: ScoreboardContext, patch: Partial<ScoreboardContext>): ScoreboardContext {
  return {
    ...prev,
    ...patch,
    home: { ...(prev.home || {}), ...(patch.home || {}) },
    away: { ...(prev.away || {}), ...(patch.away || {}) },
    sponsors:
      Array.isArray((patch as any).sponsors) && (patch as any).sponsors.length > 0
        ? (patch as any).sponsors
        : (prev as any).sponsors ?? [],
  };
}

/**
 * Merge depuis le polling HTTP stable équipe.
 * Quand le match n'a pas changé, on préserve :
 *   - clock_ms / clock_running → source autoritaire = realtime uniquement
 *   - period_label / status → évite les sauts si le realtime est plus récent
 */
function mergeContextFromStableRefresh(prev: ScoreboardContext, nextCtx: ScoreboardContext): ScoreboardContext {
  const sameMatch =
    prev.match_id &&
    nextCtx.match_id &&
    String(prev.match_id) === String(nextCtx.match_id);

  if (!sameMatch) return nextCtx;

  const {
    clock_ms: _clockMs,
    clock_running: _clockRunning,
    period_label: _periodLabel,
    status: _status,
    ...safeNext
  } = nextCtx as any;

  return mergeContext(prev, safeNext);
}

function buildContextFromResponse(json: any): ScoreboardContext {
  const match = json?.match || {};
  const org = json?.org || {};
  const displaySettings = json?.display_settings || {};
  const sportSettings = json?.sport_settings || {};
  const sp = json?.display_profile || {};
  const displayTemplate = json?.display_template || {};
  const resolved = json?.config_display_resolved || {};

  return {
    theme: resolved.theme ?? displaySettings.theme ?? "dark",
    dual_language: resolved.dual_language ?? displaySettings.dual_language ?? false,
    lang_primary: resolved.lang_primary ?? displaySettings.lang_primary ?? "FR",
    lang_secondary: resolved.lang_secondary ?? displaySettings.lang_secondary ?? "EN",
    show_lower_third: resolved.show_lower_third ?? displaySettings.show_lower_third ?? true,
    show_logos: resolved.show_logos ?? displaySettings.show_logos ?? true,
    sponsor_rotate_s: resolved.sponsor_rotate_s ?? displaySettings.sponsor_rotate_s ?? 10,
    show_score: resolved.show_score ?? displaySettings.show_score ?? true,
    show_clock: resolved.show_clock ?? displaySettings.show_clock ?? true,
    show_period: resolved.show_period ?? displaySettings.show_period ?? true,
    show_status: resolved.show_status ?? displaySettings.show_status ?? true,
    show_sponsors: resolved.show_sponsors ?? displaySettings.show_sponsors ?? true,
    layout_mode:
      resolved.layout_mode ??
      displayTemplate.layout_mode ??
      displaySettings.layout_mode ??
      "stadium",

    show_team_fouls: resolved.show_team_fouls ?? sportSettings.show_team_fouls ?? false,
    show_player_fouls: resolved.show_player_fouls ?? sportSettings.show_player_fouls ?? false,
    show_timeouts: resolved.show_timeouts ?? sportSettings.show_timeouts ?? false,
    show_bonus: resolved.show_bonus ?? sportSettings.show_bonus ?? false,
    show_sets: resolved.show_sets ?? sportSettings.show_sets ?? false,
    show_cards: resolved.show_cards ?? sportSettings.show_cards ?? false,
    show_shot_clock: resolved.show_shot_clock ?? sportSettings.show_shot_clock ?? false,

    show_live_overlays: resolved.show_live_overlays ?? displaySettings.show_live_overlays ?? sp.show_live_overlays ?? true,
    show_substitutions: resolved.show_substitutions ?? displaySettings.show_substitutions ?? sp.show_substitutions ?? false,
    show_substitution_banner: resolved.show_substitution_banner ?? displaySettings.show_substitution_banner ?? true,
    show_live_badge: resolved.show_live_badge ?? false,
    overlay_position: resolved.overlay_position ?? displaySettings.overlay_position ?? sp.overlay_position ?? "bottom",
    overlay_duration_ms: resolved.overlay_duration_ms ?? displaySettings.overlay_duration_ms ?? sp.overlay_duration_ms ?? 5000,

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

    clock_anchor_epoch: match.clock_anchor_epoch_ms ?? undefined,
    clock_anchor_ms: match.clock_anchor_clock_ms ?? undefined,
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
    clock_anchor_epoch: row.clock_anchor_epoch_ms ?? undefined,
    clock_anchor_ms: row.clock_anchor_clock_ms ?? undefined,
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

function isDebugClockEnabled() {
  try {
    const u = new URL(window.location.href);
    return u.searchParams.get('debugClock') === '1';
  } catch {
    return false;
  }
}

function App() {
  const matchIdFromUrl = getSearchParam("matchId");
  const teamSlug = getSearchParam("teamSlug");
  const teamId = getSearchParam("teamId");
  const legacyToken = getSearchParam("token");

  const isStableTeamMode = !!teamSlug || !!teamId;
  const isLegacyTokenMode = !!legacyToken && !isStableTeamMode && !matchIdFromUrl;

  const [ctx, setCtx] = useState<ScoreboardContext | null>(null);
  const [resolvedMatchId, setResolvedMatchId] = useState("");
  const [err, setErr] = useState("");

  const [localTick, setLocalTick] = useState(0);
  const [activeOverlay, setActiveOverlay] = useState<LiveOverlay | null>(null);
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastBaseClockRef = useRef<number>(0);
  const lastBaseTsRef = useRef<number>(Date.now());
  const lastRunningRef = useRef<boolean>(false);
  const lastMatchIdRef = useRef<string>("");
  const lastSeqRef = useRef<number>(0);
  const lastPatchAtRef = useRef<number>(0);
  const debugClock = isDebugClockEnabled();

  useEffect(() => {
    const t = window.setInterval(() => setLocalTick((v) => v + 1), 100);
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
      const anchorEpoch = typeof (ctx as any).clock_anchor_epoch === "number"
        ? (ctx as any).clock_anchor_epoch
        : null;
      const anchorMs = typeof (ctx as any).clock_anchor_ms === "number"
        ? (ctx as any).clock_anchor_ms
        : null;

      if (anchorEpoch !== null && anchorMs !== null) {
        lastBaseClockRef.current = anchorMs;
        lastBaseTsRef.current = anchorEpoch;
      } else {
        const receiveDelay =
          typeof (ctx as any).emitted_at === "number"
            ? Math.max(0, Date.now() - (ctx as any).emitted_at)
            : 0;
        lastBaseClockRef.current = Math.max(0, nextClockMs - receiveDelay);
        lastBaseTsRef.current = Date.now();
      }
      lastRunningRef.current = nextRunning;
      lastMatchIdRef.current = nextMatchId;
    }
  }, [ctx?.clock_ms, ctx?.clock_running, ctx?.match_id]);

  const computedContext = useMemo(() => {
    if (!ctx) return null;

    if (!ctx.clock_running) {
      return ctx;
    }

    const elapsed = Date.now() - lastBaseTsRef.current;
    const baseClockMs = typeof lastBaseClockRef.current === "number" ? lastBaseClockRef.current : 0;
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

  function applyLivePatch(rawPatch: any) {
    if (!rawPatch || typeof rawPatch !== "object") return;

    const seq = Number(rawPatch?.live_seq || 0);
    if (seq && seq < lastSeqRef.current) return;
    if (seq) lastSeqRef.current = seq;
    lastPatchAtRef.current = Date.now();

    if (rawPatch.overlay?.type === "substitution") {
      const ov = rawPatch.overlay as LiveOverlay;
      setCtx((prev) => {
        const bannerEnabled =
          (prev?.show_substitution_banner ?? true) &&
          (rawPatch.show_substitution_banner ?? prev?.show_substitution_banner ?? true);
        if (bannerEnabled !== false) {
          if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
          setActiveOverlay(ov);
          overlayTimerRef.current = setTimeout(
            () => setActiveOverlay(null),
            ov.duration_ms && ov.duration_ms > 0 ? ov.duration_ms : 5000,
          );
        }
        return prev;
      });
    }

    const { overlay: _overlay, ...patchWithoutOverlay } = rawPatch;
    setCtx((prev) => {
      if (!prev) return prev;
      return mergeContext(prev, patchWithoutOverlay);
    });
  }

  async function fetchContext() {
    if (!EDGE_CONTEXT_URL) {
      throw new Error("VITE_EDGE_CONTEXT_URL manquante.");
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
        setErr("URL publique invalide. Utilise une URL d'équipe du type ?teamSlug=...");
        return;
      }

      if (isLegacyTokenMode) {
        setErr("Le mode public par token match a été retiré. Utilise l'URL d'équipe.");
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
  }, [matchIdFromUrl, teamSlug, teamId, isStableTeamMode, isLegacyTokenMode]);

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

          return mergeContextFromStableRefresh(prev, nextCtx);
        });
      } catch (e) {
        console.error("[display] stable team refresh failed", e);
      }
    }, 3000);

    return () => window.clearInterval(interval);
  }, [isStableTeamMode, resolvedMatchId, matchIdFromUrl, teamSlug, teamId]);

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
        Chargement display…
      </div>
    );
  }

  return (
    <>
      <Scoreboard context={computedContext} activeOverlay={activeOverlay} />

      {debugClock ? (
        <div
          style={{
            position: 'fixed',
            left: 12,
            bottom: 12,
            zIndex: 9999,
            background: 'rgba(0,0,0,.82)',
            color: '#d1fae5',
            border: '1px solid rgba(255,255,255,.15)',
            borderRadius: 10,
            padding: 10,
            fontFamily: 'monospace',
            fontSize: 12,
            lineHeight: 1.45,
            minWidth: 250,
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 6 }}>DEBUG CLOCK — DISPLAY</div>
          <div>match_id: {String(computedContext.match_id ?? '')}</div>
          <div>status: {String(computedContext.status ?? '')}</div>
          <div>clock_running: {String(!!computedContext.clock_running)}</div>
          <div>clock_ms: {Math.round(Number(computedContext.clock_ms ?? 0))}</div>
          <div>anchor_ms: {Math.round(Number(lastBaseClockRef.current ?? 0))}</div>
          <div>anchor_epoch: {Math.round(Number(lastBaseTsRef.current ?? 0))}</div>
          <div>last_seq: {lastSeqRef.current}</div>
          <div>last_patch_at: {lastPatchAtRef.current || 0}</div>
          <div>now: {Date.now()}</div>
        </div>
      ) : null}
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
