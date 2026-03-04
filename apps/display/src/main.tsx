import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import "./theme.css";
import { Scoreboard } from "./components/Scoreboard";

// --------------------
// ENV
// --------------------
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Edge function endpoint (SB2)
const EDGE_CONTEXT_URL =
  (import.meta.env.VITE_EDGE_CONTEXT_URL as string | undefined)?.trim() ||
  "https://gygjtykgvpyguhiostpx.functions.supabase.co/get-display-context";

type MatchContext = {
  id: string;
  org_id?: string;
  name?: string | null;
  status?: string | null;
  home_name?: string | null;
  away_name?: string | null;
  public_display?: boolean;
  display_token?: string | null;

  // si tu ajoutes des colonnes score/temps/etc dans DB, elles pourront arriver ici
  home_score?: number | null;
  away_score?: number | null;

  // (optionnel) sport, config display, etc.
  org_sport?: string | null;
};

type EdgePayload = {
  match: MatchContext;
};

function App() {
  const supa = useMemo<SupabaseClient>(() => createClient(SUPABASE_URL, SUPABASE_ANON_KEY), []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [match, setMatch] = useState<MatchContext | null>(null);

  const channelRef = useRef<ReturnType<SupabaseClient["channel"]> | null>(null);
  const lastRefreshRef = useRef<number>(0);

  // --------------------
  // 1) Fetch contexte via Edge Function
  // --------------------
  async function fetchContext() {
    setError("");
    const qs = new URLSearchParams(window.location.search);

    const token = qs.get("token");
    const org = qs.get("org");

    if (!token && !org) {
      throw new Error("Paramètre manquant : ?token=... ou ?org=...");
    }

    const url = new URL(EDGE_CONTEXT_URL);
    if (token) url.searchParams.set("token", token);
    else if (org) url.searchParams.set("org", org);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });

    const json = (await res.json()) as any;

    if (!res.ok) {
      throw new Error(json?.error || `Edge error (${res.status})`);
    }

    const payload = json as EdgePayload;
    if (!payload?.match?.id) {
      throw new Error("Edge response invalide: match.id manquant");
    }

    setMatch(payload.match);
    lastRefreshRef.current = Date.now();
    return payload.match;
  }

  // --------------------
  // 2) Realtime Broadcast (Operator -> Display)
  // --------------------
  async function subscribeBroadcast(nextMatch: MatchContext) {
    // ferme l’ancien channel si on change de match
    if (channelRef.current) {
      try {
        await supa.removeChannel(channelRef.current);
      } catch {}
      channelRef.current = null;
    }

    // channel namespace SB2
    // On préfère org_id si dispo, sinon match.id (fallback)
    const room =
      nextMatch.org_id ? `sb2:org:${nextMatch.org_id}` : `sb2:match:${nextMatch.id}`;

    const channel = supa.channel(room, {
      config: {
        broadcast: { self: false },
        presence: { key: "display" },
      },
    });

    channel
      .on("broadcast", { event: "match_update" }, ({ payload }) => {
        // payload attendu: { match: {...} }
        if (payload?.match?.id) setMatch(payload.match as MatchContext);
      })
      .on("broadcast", { event: "score_update" }, ({ payload }) => {
        // payload possible: { home_score, away_score, ... } -> patch
        setMatch((prev) => {
          if (!prev) return prev;
          return { ...prev, ...payload };
        });
      })
      .on("broadcast", { event: "ping" }, () => {
        // no-op, juste pour debug
      });

    const { error } = await channel.subscribe((status) => {
      // pour debug si besoin
      // console.log("realtime status:", status, "room:", room);
    });

    if (error) throw error;
    channelRef.current = channel;
  }

  // --------------------
  // 3) Boot
  // --------------------
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const ctx = await fetchContext();
        if (!alive) return;

        // subscribe broadcast
        await subscribeBroadcast(ctx);

        // sécurité: refresh context toutes les 60s (au cas où broadcast raté)
        // (sans polling agressif)
        const timer = setInterval(async () => {
          try {
            const now = Date.now();
            if (now - lastRefreshRef.current < 60_000) return;
            const m = await fetchContext();
            // resubscribe si org_id / id change
            if (m?.id && (match?.id !== m.id || match?.org_id !== m.org_id)) {
              await subscribeBroadcast(m);
            }
          } catch {
            // silencieux
          }
        }, 10_000);

        return () => clearInterval(timer);
      } catch (e: any) {
        setError(e?.message ?? "Erreur init display");
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
      if (channelRef.current) {
        supa.removeChannel(channelRef.current).catch(() => {});
        channelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --------------------
  // UI minimal
  // --------------------
  if (loading) {
    return (
      <div style={{ padding: 18, color: "#e5e7eb", fontFamily: "system-ui" }}>
        Chargement…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 18, color: "#e5e7eb", fontFamily: "system-ui" }}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>Erreur Display</div>
        <div style={{ background: "#1a0f10", border: "1px solid #3a1c1f", padding: 12, borderRadius: 12 }}>
          ❌ {error}
        </div>
        <div style={{ marginTop: 12, color: "#9aa0a6", fontSize: 12 }}>
          URL attendue : <code>?token=...</code> ou <code>?org=...</code>
          <br />
          Exemple : <code>https://scoreboard-display-pi.vercel.app/?token=XXXXX</code>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div style={{ padding: 18, color: "#e5e7eb", fontFamily: "system-ui" }}>
        Aucun match.
      </div>
    );
  }

  // ✅ Ton composant Scoreboard existant reçoit un objet match.
  // Si ton Scoreboard attend une autre shape, tu adapteras ici.
  return <Scoreboard match={match as any} />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
