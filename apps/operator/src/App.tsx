// apps/operator/src/App.tsx
import React, { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import MatchPage from "./pages/MatchPage";
import SelectOrgPage from "./pages/SelectOrgPage";

const LS_ACTIVE_ORG_KEY = "scoreDisplay.activeOrgSlug";

function Landing() {
  const nav = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const orgSlug = (q.get("org") || "").trim();

    // 1) Arrivée depuis Home : /?org=demo-football
    if (orgSlug) {
      localStorage.setItem(LS_ACTIVE_ORG_KEY, orgSlug);
      nav("/matches", { replace: true });
      return;
    }

    // 2) Si org déjà persistée => /matches
    const stored = (localStorage.getItem(LS_ACTIVE_ORG_KEY) || "").trim();
    if (stored) {
      nav("/matches", { replace: true });
      return;
    }

    // 3) Sinon => choix org
    nav("/select-org", { replace: true });
  }, [location.search, nav]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/select-org" element={<SelectOrgPage />} />
        <Route path="/matches" element={<MatchPage />} />
        {/* fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
