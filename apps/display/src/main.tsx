import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import Scoreboard from "./components/Scoreboard";
import "./theme.css";

type DisplayContext = {
  match: {
    id: string;
    name: string;
    status: string;
    scheduled_at: string | null;
    home_name: string;
    away_name: string;
    home_score: number;
    away_score: number;
    clock_ms: number;
    period_label?: string | null;
    sport?: string | null;
    venue?: string | null;
  };
  org: {
    id: string;
    slug: string;
    name?: string | null;
    status?: string | null;
    sport?: string | null;
  };
  display: {
    stadium_mode?: boolean;
    lower_third?: boolean;
    dual_language?: boolean;
    lang_primary?: "fr" | "en";
    lang_secondary?: "fr" | "en";
    sponsors?: Array<{ name: string; logoUrl?: string }>;
  };
};

function getEnv(name: string) {
  const v = (import.meta as any).env?.[name];
  return typeof v === "string" ? v : "";
}

const EDGE_CONTEXT_URL = getEnv("VITE_EDGE_CONTEXT_URL");
const TV_WS_RELAY_URL = getEnv("VITE_TV_WS_RELAY_URL");

function getTokenFromUrl(): string {
  const u = new URL(window.location.href);
  const q = u.searchParams.get("token");
  if (q) return q;
  // fallback hash parsing: #token=...
  const h = (u.hash || "").replace(/^#/, "");
  const hp = new URLSearchParams(h);
  return hp.get("token") || "";
}

function toWsUrl(httpUrl: string) {
  // accepts https://.../functions/v1/tv-ws-relay -> wss://...
  return httpUrl.replace(/^https:/, "wss:").replace(/^http:/, "ws:");
}

function mergeContext(prev: DisplayContext, patch: any): DisplayContext {
  // patch is expected to be { match: {...}, display: {...} }
  const next: DisplayContext = {
    ...prev,
    match: { ...prev.match, ...(patch?.match || {}) },
    display: { ...prev.display, ...(patch?.display || {}) },
  };
  // keep org stable
  return next;
}

function App() {
  const token = useMemo(() => getTokenFromUrl(), []);
  const [ctx, setCtx] = useState<DisplayContext | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      setErr(null);

      if (!EDGE_CONTEXT_URL) {
        setErr("VITE_EDGE_CONTEXT_URL manquante");
        return;
      }
      if (!token) {
        setErr("Token display manquant. Utilise ?token=DISPLAY_TOKEN");
        return;
      }

      const url = `${EDGE_CONTEXT_URL}?token=${encodeURIComponent(token)}`;
      const res = await fetch(url);
      if (!res.ok) {
        setErr(`Edge context error: HTTP ${res.status}`);
        return;
      }

      const data = (await res.json()) as DisplayContext;
      if (!mounted) return;

      setCtx(data);

      // WS Relay connect
      if (!TV_WS_RELAY_URL) return;
      const wsUrl = `${toWsUrl(TV_WS_RELAY_URL)}?token=${encodeURIComponent(token)}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // optional: ws.send(JSON.stringify({ type:"hello"}))
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          // expected: { type:"patch", patch:{...} } or { patch:{...} }
          const patch = msg.patch || msg;
          setCtx((prev) => (prev ? mergeContext(prev, patch) : prev));
        } catch {
          // ignore
        }
      };
      ws.onerror = () => {
        // silent for TV mode
      };
      ws.onclose = () => {
        // silent
      };
    }

    bootstrap();
    return () => {
      mounted = false;
      if (wsRef.current) wsRef.current.close();
    };
  }, [token]);

  if (err) {
    return (
      <div style={{ padding: 16, color: "white", fontFamily: "system-ui" }}>
        <h2>scoreDisplay — Display</h2>
        <div style={{ opacity: 0.85 }}>{err}</div>
      </div>
    );
  }

  if (!ctx) {
    return (
      <div style={{ padding: 16, color: "white", fontFamily: "system-ui" }}>
        Chargement…
      </div>
    );
  }

  return <Scoreboard context={ctx} />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
