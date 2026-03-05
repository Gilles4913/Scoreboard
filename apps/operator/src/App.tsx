import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { supabase } from "./supabase";
import MatchPage from "./pages/MatchPage";

const LS_ACTIVE_ORG_KEY = "scoreDisplay.activeOrgSlug";

function getEnv(name: string) {
  const v = (import.meta as any).env?.[name];
  return typeof v === "string" ? v : "";
}

const HOME_URL = getEnv("VITE_HOME_URL") || "https://scoreboard-home.vercel.app";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const loc = useLocation();

  useEffect(() => {
    let mounted = true;

    async function run() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      setHasSession(!!data.session);
      setReady(true);

      // écoute les changements
      supabase.auth.onAuthStateChange((_event, session) => {
        setHasSession(!!session);
      });
    }

    run();
    return () => {
      mounted = false;
    };
  }, []);

  if (!ready) return <div style={{ padding: 24 }}>Chargement…</div>;

  if (!hasSession) {
    const returnTo = window.location.origin + loc.pathname + loc.search + loc.hash;
    window.location.href = `${HOME_URL.replace(/\/$/, "")}/?forceLogin=1&returnTo=${encodeURIComponent(returnTo)}`;
    return null;
  }

  // org obligatoire : Operator ne choisit plus l’org
  const activeOrg = (localStorage.getItem(LS_ACTIVE_ORG_KEY) || "").trim();
  if (!activeOrg) {
    const returnTo = window.location.origin + loc.pathname + loc.search + loc.hash;
    window.location.href = `${HOME_URL.replace(/\/$/, "")}/?forceLogin=1&returnTo=${encodeURIComponent(returnTo)}`;
    return null;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/matches"
          element={
            <RequireAuth>
              <MatchPage />
            </RequireAuth>
          }
        />
        <Route path="/" element={<Navigate to="/matches" replace />} />
        <Route path="*" element={<Navigate to="/matches" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
