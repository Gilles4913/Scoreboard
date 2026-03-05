// apps/operator/src/App.tsx
import React, { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import MatchPage from "./pages/MatchPage";

const LS_ACTIVE_ORG_KEY = "scoreDisplay.activeOrgSlug";

// IMPORTANT: Home est le seul org picker
const HOME_URL = (import.meta as any).env?.VITE_HOME_URL || "https://scoreboard-home.vercel.app";

function Landing() {
  const nav = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // si on arrive avec ?org=... depuis Home (optionnel), on le persiste et on continue
    const q = new URLSearchParams(location.search);
    const orgFromQuery = (q.get("org") || "").trim();
    if (orgFromQuery) {
      localStorage.setItem(LS_ACTIVE_ORG_KEY, orgFromQuery);
      nav("/matches", { replace: true });
      return;
    }

    // sinon, on exige l’org persistée (définie par Home)
    const stored = (localStorage.getItem(LS_ACTIVE_ORG_KEY) || "").trim();
    if (!stored) {
      // redirige vers Home (login + choix org)
      const next = encodeURIComponent(window.location.origin + "/matches");
      window.location.href = `${HOME_URL.replace(/\/$/, "")}/?forceLogin=1&next=${next}`;
      return;
    }

    nav("/matches", { replace: true });
  }, [location.search, nav]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/matches" element={<MatchPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
