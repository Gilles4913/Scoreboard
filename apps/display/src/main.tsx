import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import Scoreboard, { ScoreboardContext } from "./components/Scoreboard";

function getEnv(name: string): string {
  const v = (import.meta as any).env?.[name];
  return typeof v === "string" ? v : "";
}

const EDGE_CONTEXT_URL = getEnv("VITE_EDGE_CONTEXT_URL");
const TV_WS_RELAY_URL = getEnv("VITE_TV_WS_RELAY_URL");
const SUPABASE_ANON_KEY = getEnv("VITE_SUPABASE_ANON_KEY");

function getSearchParam(name: string) {
  try {
    const u = new URL(window.location.href);
    return u.searchParams.get(name) || "";
  } catch {
    return "";
  }
}

function toWsUrl(httpLike: string) {
  if (!httpLike) return "";
  return httpLike.replace(/^https:/, "wss:").replace(/^http:/, "ws:");
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
  const matchId = getSearchParam("matchId");

  const [ctx, setCtx] = useState<ScoreboardContext | null>(null);
  const [err, setErr] = useState("");

  const wsRef = useRef<WebSocket | null>(null);

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

      const base = EDGE_CONTEXT_URL.replace(/\/$/, "");
      const url = new URL(base);

      if (token) url.searchParams.set("token", token);
      if (matchId) url.searchParams.set("matchId", matchId);

      try {
        const headers: Record<string, string> = {};

        if (SUPABASE_ANON_KEY) {
          headers.apikey = SUPABASE_ANON_KEY;
          headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
        }

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

        setCtx({
          theme: "dark",
          dual_language: true,
          lang_primary: "FR",
          lang_secondary: "EN",
          show_lower_third: true,
          show_logos: true,
          sponsor_rotate_s: 10,
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
  }, [token, matchId]);

  useEffect(() => {
    if (!TV_WS_RELAY_URL) return;
    if (!token && !matchId) return;

    const wsUrlBase = toWsUrl(TV_WS_RELAY_URL);
    if (!wsUrlBase) return;

    const url = new URL(wsUrlBase);
    if (token) url.searchParams.set("token", token);
    if (matchId) url.searchParams.set("matchId", matchId);

    try {
      const ws = new WebSocket(url.toString());
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          const patch = msg?.patch || msg;

          setCtx((prev) => {
            if (!prev) return prev;
            return mergeContext(prev, patch);
          });
        } catch {
          // ignore malformed payload
        }
      };

      ws.onerror = () => {
        // silencieux pour la démo
      };

      return () => {
        ws.close();
      };
    } catch {
      // ignore
    }
  }, [token, matchId]);

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
