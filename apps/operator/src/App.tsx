import React, { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import MatchPage from "./pages/MatchPage";
import SelectOrgPage from "./pages/SelectOrgPage";

const LS_ACTIVE_ORG_KEY = "scoreDisplay.activeOrgSlug";

function useQuery() {
  const { search } = useLocation();
  return React.useMemo(() => new URLSearchParams(search), [search]);
}

function BootstrapRouter() {
  const nav = useNavigate();
  const q = useQuery();

  useEffect(() => {
    // 1) Si on arrive avec ?org=demo-football, on force la sélection de l'org
    const orgSlug = q.get("org");
    if (orgSlug && orgSlug.trim()) {
      localStorage.setItem(LS_ACTIVE_ORG_KEY, orgSlug.trim());
      // Nettoie l'URL et va sur /matches
      nav("/matches", { replace: true });
      return;
    }

    // 2) Si org déjà persistée, on démarre directement sur /matches
    const stored = localStorage.getItem(LS_ACTIVE_ORG_KEY);
    if (stored && stored.trim()) {
      // Ne rien faire: les routes géreront
      return;
    }
  }, [q, nav]);

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/matches" replace />} />
      <Route path="/select-org" element={<SelectOrgPage />} />
      <Route path="/matches" element={<MatchPage />} />
      {/* fallback */}
      <Route path="*" element={<Navigate to="/matches" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <BootstrapRouter />
    </BrowserRouter>
  );
}
