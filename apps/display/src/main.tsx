// apps/display/src/main.tsx
import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type { MatchState } from "@pkg/types";
import { applyTick } from "@pkg/logic";
import { applyTheme, type ThemeName } from "./themes";
import "./theme.css";

import { Scoreboard } from "./components/Scoreboard";
import { connectDisplay } from "./realtime";
import { fetchDisplayContext, type DisplayContext } from "./api";

function App() {
  const qs = useMemo(() => new URLSearchParams(window.location.search), []);
  const [theme, setTheme] = useState<ThemeName>((qs.get("theme") as ThemeName) || "neon");
  const [ui] = useState(qs.get("ui") === "1");

  const matchId = qs.get("matchId") || "";
  const token = qs.get("token") || "";

  const [ctx, setCtx] = useState<DisplayContext | null>(null);
  const [state, setState] = useState<MatchState | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>("Initialisation…");
  const [error, setError] = useState<string>("");

  const [homeName, setHomeName] = useState("HOME");
  const [awayName, setAwayName] = useState("AWAY");
  const [homeLogo, setHomeLogo] = useState<string | null>(null);
  const [awayLogo, setAwayLogo] = useState<string | null>(null);

  const [displayConnection, setDisplayConnection] = useState<{ close: () => void } | null>(null);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // 1) Charger le contexte via Edge Function (secure)
  useEffect(() => {
    (async () => {
      try {
        setError("");
        if (!matchId || !token) {
          setError('URL invalide. Requis: ?matchId=<uuid>&token=<display_token>');
          setConnectionStatus("❌ Paramètres manquants");
          return;
        }

        setConnectionStatus("Chargement du contexte (Edge Function)…");
        const data = await fetchDisplayContext({ matchId, token });
        setCtx(data);

        // Team names/logos depuis Edge payload
        const hn = data.home?.team?.short_name || data.home?.team?.name || "HOME";
        const an = data.away?.team?.short_name || data.away?.team?.name || "AWAY";
        setHomeName(hn);
        setAwayName(an);
        setHomeLogo((data.home?.team as any)?.logo ?? null);
        setAwayLogo((data.away?.team as any)?.logo ?? null);

        setConnectionStatus("Contexte chargé. Connexion Realtime…");
      } catch (e: any) {
        setError(e?.message ?? "Erreur inconnue");
        setConnectionStatus("❌ Erreur de chargement");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, token]);

  // 2) Connexion Realtime broadcast (pas de SELECT sur matches)
  useEffect(() => {
    if (!ctx) return;

    // Fermer la connexion précédente si besoin
    if (displayConnection) {
      displayConnection.close();
      setDisplayConnection(null);
    }

    const orgSlug = ctx.org.slug;
    const mid = ctx.match.id;

    setConnectionStatus(`Connexion au canal… (${orgSlug}/${mid})`);

    const conn = connectDisplay(orgSlug, mid, token, (s: MatchState, info: any) => {
      const running = s?.clock?.running;
      setConnectionStatus(`${running ? "🔴" : "⏸️"} Connecté`);
      setState(s);

      // Si l’operator envoie des noms, on les respecte
      if (info) {
        if (info.home_name) setHomeName(info.home_name);
        if (info.away_name) setAwayName(info.away_name);
      }
    });

    setDisplayConnection(conn);

    return () => {
      conn.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx]);

  // 3) Tick local pour l’horloge (affichage fluide)
  useEffect(() => {
    if (!state?.matchId) return;
    const id = setInterval(() => setState((prev) => (prev ? applyTick(prev) : prev)), 100);
    return () => clearInterval(id);
  }, [state?.matchId]);

  function toggleFullscreen() {
    const el: any = document.documentElement;
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  // UI states
  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: "#0b0b0c", color: "#eaeaea", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#111214", border: "1px solid #1b1c1f", borderRadius: 14, padding: 24, maxWidth: 720 }}>
          <div style={{ fontSize: 20, marginBottom: 8 }}>❌ Display Error</div>
          <pre style={{ whiteSpace: "pre-wrap", color: "#ff6b6b", margin: 0 }}>{error}</pre>
          <div style={{ marginTop: 12, fontSize: 12, color: "#9aa0a6" }}>
            Requis: <code>?matchId=&lt;uuid&gt;&amp;token=&lt;display_token&gt;</code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="board">
      {state ? (
        <Scoreboard
          state={state}
          homeName={homeName}
          awayName={awayName}
          homeLogo={homeLogo || undefined}
          awayLogo={awayLogo || undefined}
        />
      ) : (
        <div
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "rgba(0,0,0,0.85)",
            color: "white",
            padding: "22px 26px",
            borderRadius: 14,
            textAlign: "center",
            maxWidth: 520,
          }}
        >
          <div style={{ fontSize: 22, marginBottom: 8 }}>📺 Scoreboard Display</div>
          <div style={{ color: "#9aa0a6", marginBottom: 8 }}>{connectionStatus}</div>
          {ctx && (
            <div style={{ fontSize: 13, color: "#4ade80" }}>
              {ctx.org.name} • {ctx.org.sport}
              <br />
              {homeName} vs {awayName}
            </div>
          )}
          {!ctx && (
            <div style={{ fontSize: 12, color: "#666", marginTop: 10 }}>
              En attente du contexte Edge Function…
            </div>
          )}
        </div>
      )}

      <div className={ui ? "toolbar" : "toolbar hidden"}>
        <select value={theme} onChange={(e) => setTheme(e.target.value as ThemeName)}>
          <option value="neon">Neon</option>
          <option value="glass">Glass</option>
          <option value="classic">Classic</option>
        </select>
        <button onClick={() => toggleFullscreen()}>Plein écran (F)</button>
        <button onClick={() => window.location.reload()}>🔄 Recharger</button>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
