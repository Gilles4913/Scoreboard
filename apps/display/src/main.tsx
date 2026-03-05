import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";

import Scoreboard from "./components/Scoreboard";
import StadiumDisplay from "./StadiumDisplay";
import { connectTV } from "./tv";

const EDGE_CONTEXT_URL = import.meta.env.VITE_EDGE_CONTEXT_URL as string | undefined;
const WS_URL = import.meta.env.VITE_TV_WS_URL as string | undefined;

type TVEvent = { match_id: string; type: string; ts: number; seq: number; payload: any };

function App() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const mode = (params.get("mode") || "stadium").toLowerCase(); // default stadium for LED usage

  const [snapshot, setSnapshot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setErr("Token manquant (?token=...)");
      setLoading(false);
      return;
    }
    if (!EDGE_CONTEXT_URL) {
      setErr("VITE_EDGE_CONTEXT_URL manquante");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const url = new URL(EDGE_CONTEXT_URL);
        url.searchParams.set("token", token);

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(await res.text());

        const json = await res.json();
        setSnapshot(json);
      } catch (e: any) {
        setErr(e?.message || "Erreur snapshot");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  useEffect(() => {
    if (!token || !snapshot) return;
    if (!WS_URL) return;

    const tv = connectTV(WS_URL, token, (ev: TVEvent) => {
      // Stadium path: call imperative API
      const api = (window as any).__SB2_STADIUM_API__;

      switch (ev.type) {
        case "score.set":
          api?.scoreSet?.(Number(ev.payload?.home ?? 0), Number(ev.payload?.away ?? 0));
          break;
        case "timer.set":
          api?.timerSet?.(Number(ev.payload?.clock ?? 0));
          break;
        case "timer.start":
          api?.timerStart?.();
          break;
        case "timer.pause":
          api?.timerPause?.();
          break;
        case "period.set":
          api?.periodSet?.(String(ev.payload?.period ?? "P?"));
          break;
        case "moment.show":
          api?.moment?.(String(ev.payload?.title ?? "MOMENT"), ev.payload?.subtitle ? String(ev.payload.subtitle) : undefined);
          break;
        case "state.patch":
          api?.patch?.(ev.payload ?? {});
          break;
        default:
          // ignore unknown
          break;
      }
    });

    return () => tv.close();
  }, [token, snapshot]);

  if (loading) return <div style={{ padding: 18, fontFamily: "system-ui" }}>Chargement…</div>;
  if (err) return <div style={{ padding: 18, fontFamily: "system-ui", color: "crimson" }}>{err}</div>;
  if (!snapshot) return <div style={{ padding: 18, fontFamily: "system-ui" }}>Match introuvable</div>;

  if (mode === "stadium" || mode === "led") {
    return <StadiumDisplay snapshot={snapshot} />;
  }

  // fallback = ton composant actuel
  return <Scoreboard state={snapshot} />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
