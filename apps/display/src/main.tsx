import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { createClient, RealtimeChannel } from "@supabase/supabase-js";
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

function mergeContext(prev: ScoreboardContext, patch: Partial<ScoreboardContext>): ScoreboardContext {
  return {
    ...prev,
    ...patch,
    home: { ...(prev.home || {}), ...(patch.home || {}) },
    away: { ...(prev.away || {}), ...(patch.away || {}) },
  };
}

function App() {
  const token = getSearchParam("token");
  const matchIdFromUrl = getSearchParam("matchId");
  const teamSlug = getSearchParam("teamSlug");
  const teamId = getSearchParam("teamId");

  const [ctx, setCtx] = useState<ScoreboardContext | null>(null);
  const [resolvedMatchId, setResolvedMatchId] = useState("");
  const [err, setErr] = useState("");

  const channelRef = useRef<RealtimeChannel | null>(null);

  const [localTick, setLocalTick] = useState(0);
  const lastBaseClockRef = useRef<number | null>(null);
  const lastBaseTsRef = useRef<number>(Date.now());

  useEffect(() => {
    const t = setInterval(() => setLocalTick((v) => v + 1), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!ctx) return;
    if (typeof ctx.clock_ms === "number") {
      lastBaseClockRef.current = ctx.clock_ms;
      lastBaseTsRef.current = Date.now();
    }
  }, [ctx?.clock_ms]);

  const computedContext = useMemo(() => {
    if (!ctx) return null;

    if (!ctx.clock_running || typeof lastBaseClockRef.current !== "number") {
      return ctx;
    }

    const elapsed = Date.now() - lastBaseTsRef.current;
    const clock_ms = Math.max(0, lastBaseClockRef.current - elapsed);

    return {
      ...ctx,
      clock_ms,
    };
  }, [ctx, localTick]);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialContext() {
      setErr("");

      if (!EDGE_CONTEXT_URL) {
        setErr("VITE_EDGE_CONTEXT_URL manquante.");
        return;
      }

      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        setErr("VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY manquante.");
        return;
      }

      const base = EDGE_CONTEXT_URL.replace(/\/$/, "");
      const url = new URL(base);

      if (token) url.searchParams.set("token", token);
      if (matchIdFromUrl) url.searchParams.set("matchId", matchIdFromUrl);
      if (teamSlug) url.searchParams.set("teamSlug", teamSlug);
      if (teamId) url.searchParams.set("teamId", teamId);

      try {
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

        const json = await res.json();
        if (cancelled) return;

        const match = json?.match || {};
        const org = json?.org || {};
        const settings = json?.display_settings || {};

        setResolvedMatchId(match?.id || matchIdFromUrl || "");

        setCtx({
          theme: settings.theme ?? "dark",
          dual_language: settings.dual_language ?? false,
          lang_primary: settings.lang_primary ?? "FR",
          lang_secondary: settings.lang_secondary ?? "EN",
          show_lower_third: settings.show_lower_third ?? true,
          show_logos: settings.show_logos ?? true,
          sponsor_rotate_s: settings.sponsor_rotate_s ?? 10,

          show_score: settings.show_score ?? true,
          show_clock: settings.show_clock ?? true,
          show_period: settings.show_period ?? true,
          show_status: settings.show_status ?? true,
          show_sponsors: settings.show_sponsors ?? true,
          layout_mode: settings.layout_mode ?? "stadium",

          match_id: match.id,
          match_name: match.name ?? "",
          status: match.status ?? "scheduled",
          scheduled_at: match.scheduled_at ?? null,
          sport: org.sport ?? "football",
          venue: org.name ?? "",
          home_name: match.home_name ?? "Domicile",
          away_name: match.away_name ?? "Extérieur",
          home_score: match.home_score ?? 0,
          away_score: match.away_score ?? 0,
          clock_ms: 0,
          clock_running: false,
          period_label: "",
          ...json,
        });
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
  }, [token, matchIdFromUrl, teamSlug, teamId]);

  useEffect(() => {
    if (!resolvedMatchId) return;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;

    const topic = `match:${resolvedMatchId}`;
    const channel = supabase.channel(topic);

    channelRef.current = channel;

    channel
      .on("broadcast", { event: "*" }, (message) => {
        const patch = message?.payload?.patch || message?.payload || message;
        if (!patch || typeof patch !== "object") return;

        setCtx((prev) => {
          if (!prev) return prev;
          return mergeContext(prev, patch);
        });
      })
      .subscribe((status) => {
        console.log("[display] realtime status:", status, topic);
      });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
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
        <div style={{ marginTop: 12, color: "crimson" }}>Erreur: {err}</div>
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

  return <Scoreboard context={computedContext} />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
