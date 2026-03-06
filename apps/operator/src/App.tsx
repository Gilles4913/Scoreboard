import React, { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "./supabase";
import MatchPage from "./pages/MatchPage";

const LS_ACTIVE_ORG_KEY = "scoreDisplay.activeOrgSlug";

function getEnv(name: string): string {
  const v = (import.meta as any).env?.[name];
  return typeof v === "string" ? v : "";
}

const HOME_URL = getEnv("VITE_HOME_URL") || "https://scoreboard-home.vercel.app";

function useQuery() {
  const loc = useLocation();
  return useMemo(() => new URLSearchParams(loc.search), [loc.search]);
}

function Landing() {
  const nav = useNavigate();
  const q = useQuery();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  const orgParam = (q.get("org") || "").trim();

  useEffect(() => {
    let alive = true;

    async function run() {
      // si ?org= présent, on le persiste
      if (orgParam) {
        localStorage.setItem(LS_ACTIVE_ORG_KEY, orgParam);
      }

      const { data } = await supabase.auth.getSession();
      if (!alive) return;

      const ok = !!data.session?.user;
      setHasSession(ok);
      setReady(true);

      if (!ok) {
        const returnTo = encodeURIComponent(window.location.origin + "/");
        window.location.href = `${HOME_URL.replace(/\/$/, "")}/?forceLogin=1&returnTo=${returnTo}`;
        return;
      }

      const activeOrg = (localStorage.getItem(LS_ACTIVE_ORG_KEY) || "").trim();
      if (!activeOrg) {
        const returnTo = encodeURIComponent(window.location.origin + "/");
        window.location.href = `${HOME_URL.replace(/\/$/, "")}/?forceLogin=1&returnTo=${returnTo}`;
        return;
      }

      nav("/matches", { replace: true });
    }

    run();
    return () => {
      alive = false;
    };
  }, [nav, orgParam]);

  if (!ready) return <div style={{ padding: 24 }}>Chargement…</div>;
  if (!hasSession) return null;

  return <div style={{ padding: 24 }}>Redirection…</div>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/matches" element={<MatchPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
