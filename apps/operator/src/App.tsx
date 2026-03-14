import React, { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "./supabase";
import TeamsPage from "./pages/TeamsPage";
import TeamMatchesPage from "./pages/TeamMatchesPage";
import ControlPage from "./pages/ControlPage";
import DisplaySettingsPage from "./pages/DisplaySettingsPage";
import NewMatchPage from "./pages/NewMatchPage";
import PlayersPage from "./pages/PlayersPage";
import TeamBrandingPage from "./pages/TeamBrandingPage";
import EditMatchRosterPage from "./pages/EditMatchRosterPage";
import MobileControlPage from "./pages/MobileControlPage";

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

function redirectToLogin(returnTo?: string) {
  const rt = encodeURIComponent(returnTo || window.location.href);
  window.location.href = `${HOME_URL.replace(/\/$/, "")}/?forceLogin=1&returnTo=${rt}`;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "ok" | "redirect">("loading");

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      if (data.session?.user) {
        setStatus("ok");
      } else {
        setStatus("redirect");
        redirectToLogin(window.location.href);
      }
    });
    return () => { alive = false; };
  }, []);

  if (status === "loading") return <div style={{ padding: 24, color: "#fff" }}>Vérification de la session…</div>;
  if (status === "redirect") return null;
  return <>{children}</>;
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
      if (orgParam) {
        localStorage.setItem(LS_ACTIVE_ORG_KEY, orgParam);
      }

      const { data } = await supabase.auth.getSession();
      if (!alive) return;

      const ok = !!data.session?.user;
      setHasSession(ok);
      setReady(true);

      if (!ok) {
        redirectToLogin(window.location.origin + "/");
        return;
      }

      const activeOrg = (localStorage.getItem(LS_ACTIVE_ORG_KEY) || "").trim();
      if (!activeOrg) {
        redirectToLogin(window.location.origin + "/");
        return;
      }

      nav("/teams", { replace: true });
    }

    run();
    return () => { alive = false; };
  }, [nav, orgParam]);

  if (!ready) return <div style={{ padding: 24 }}>Chargement…</div>;
  if (!hasSession) return null;

  return <div style={{ padding: 24 }}>Redirection…</div>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/teams" element={<RequireAuth><TeamsPage /></RequireAuth>} />
      <Route path="/teams/:teamId/matches" element={<RequireAuth><TeamMatchesPage /></RequireAuth>} />
      <Route path="/teams/:teamId/matches/new" element={<RequireAuth><NewMatchPage /></RequireAuth>} />
      <Route path="/matches/:matchId/control" element={<RequireAuth><ControlPage /></RequireAuth>} />
      <Route path="/display-settings" element={<RequireAuth><DisplaySettingsPage /></RequireAuth>} />
      <Route path="/matches" element={<Navigate to="/teams" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
      <Route path="/teams/:teamId/players" element={<RequireAuth><PlayersPage /></RequireAuth>} />
      <Route path="/teams/:teamId/branding" element={<RequireAuth><TeamBrandingPage /></RequireAuth>} />
      <Route path="/matches/:matchId/roster" element={<RequireAuth><EditMatchRosterPage /></RequireAuth>} />
      <Route path="/matches/:matchId/mobile" element={<RequireAuth><MobileControlPage /></RequireAuth>} />
    </Routes>
  );
}
