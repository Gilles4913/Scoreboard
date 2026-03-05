import React, { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import MatchPage from "./pages/MatchPage";
import { supabase } from "./supabase";

const HOME_URL = ((import.meta as any).env?.VITE_HOME_URL as string | undefined)?.replace(/\/$/, "") || "";
const LS_ACTIVE_ORG_KEY = "scoreDisplay.activeOrgSlug";

function getOrgFromQuery(search: string) {
  const sp = new URLSearchParams(search);
  return (sp.get("org") || "").trim();
}

function AppInner() {
  const nav = useNavigate();
  const loc = useLocation();

  const [booting, setBooting] = useState(true);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  const orgFromQuery = useMemo(() => getOrgFromQuery(loc.search), [loc.search]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setBooting(true);

      // 1) Si org=... dans l’URL => on le stocke et on nettoie l’URL
      if (orgFromQuery) {
        localStorage.setItem(LS_ACTIVE_ORG_KEY, orgFromQuery);

        const sp = new URLSearchParams(loc.search);
        sp.delete("org");
        const newSearch = sp.toString();
        const newUrl = loc.pathname + (newSearch ? `?${newSearch}` : "");
        window.history.replaceState({}, document.title, newUrl);
      }

      // 2) Vérifie session supabase
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;

      if (cancelled) return;

      if (!user) {
        // pas de login dans Operator => on renvoie vers Home
        const back = encodeURIComponent(window.location.href);
        if (HOME_URL) window.location.href = `${HOME_URL}/?forceLogin=1&returnTo=${back}`;
        setSessionEmail(null);
        setBooting(false);
        return;
      }

      setSessionEmail(user.email || null);

      // 3) Si pas d'org active en storage => retour Home (picker)
      const activeOrg = (localStorage.getItem(LS_ACTIVE_ORG_KEY) || "").trim();
      if (!activeOrg) {
        const back = encodeURIComponent(window.location.href);
        if (HOME_URL) window.location.href = `${HOME_URL}/?returnTo=${back}`;
        setBooting(false);
        return;
      }

      // 4) Route par défaut vers /matches
      if (loc.pathname === "/") {
        nav("/matches", { replace: true });
      }

      setBooting(false);
    }

    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgFromQuery, loc.pathname]);

  if (booting) {
    return <div style={{ padding: 24 }}>Chargement…</div>;
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <div style={{ padding: 14, borderBottom: "1px solid #ffffff22", display: "flex", gap: 10, justifyContent: "space-between" }}>
        <div style={{ fontWeight: 900 }}>scoreDisplay • Operator</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ opacity: 0.8, fontSize: 12 }}>{sessionEmail || "—"}</span>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              // retour Home login
              if (HOME_URL) window.location.href = `${HOME_URL}/?forceLogin=1`;
              else window.location.href = "/"; // fallback
            }}
          >
            Logout
          </button>
        </div>
      </div>

      <Routes>
        <Route path="/" element={<Navigate to="/matches" replace />} />
        <Route path="/matches" element={<MatchPage />} />
        <Route path="*" element={<Navigate to="/matches" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}
