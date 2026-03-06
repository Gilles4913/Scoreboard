import React, { useEffect, useMemo, useState } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import MatchPage from "./pages/MatchPage";
import { supabase } from "./supabase";

const LS_ACTIVE_ORG_KEY = "scoreDisplay.activeOrgSlug";

function getEnv(name: string): string {
  const v = (import.meta as any).env?.[name];
  return typeof v === "string" ? v : "";
}

function useQuery() {
  const loc = useLocation();
  return useMemo(() => new URLSearchParams(loc.search), [loc.search]);
}

function Landing() {
  const nav = useNavigate();
  const q = useQuery();
  const [email, setEmail] = useState<string>("");

  const homeUrl = getEnv("VITE_HOME_URL"); // optionnel (tu peux le mettre dans Vercel)
  const orgParam = (q.get("org") || "").trim();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user?.email || ""));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setEmail(s?.user?.email || ""));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (orgParam) {
      localStorage.setItem(LS_ACTIVE_ORG_KEY, orgParam);
      nav("/matches", { replace: true });
    }
  }, [orgParam, nav]);

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>scoreDisplay — Operator</h1>
      {email ? <div style={{ opacity: 0.75, fontSize: 12 }}>connecté : {email}</div> : null}

      <div style={{ marginTop: 16, padding: 12, border: "1px solid #3333", borderRadius: 12 }}>
        <b>Aucune organisation sélectionnée.</b>
        <div style={{ marginTop: 8, fontSize: 13 }}>
          Ouvre Operator depuis <b>Home</b> (bouton “Ouvrir” sur une organisation).
        </div>
        {homeUrl ? (
          <div style={{ marginTop: 10 }}>
            <a href={homeUrl}>← Retour Home</a>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* arrive depuis Home avec ?org=slug */}
      <Route path="/" element={<Landing />} />

      {/* page principale */}
      <Route path="/matches" element={<MatchPage />} />

      {/* tout le reste -> / */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
