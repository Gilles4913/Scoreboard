import React, { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import LoginPage from "./pages/LoginPage";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY!;

const ADMIN_URL = (import.meta.env.VITE_ADMIN_URL || "").replace(/\/$/, "");
const OPERATOR_URL = (import.meta.env.VITE_OPERATOR_URL || "").replace(/\/$/, "");
const DISPLAY_URL = (import.meta.env.VITE_DISPLAY_URL || "").replace(/\/$/, "");

type Profile = { role?: string | null };

function hardRedirect(baseUrl: string, pathWithQuery = "/") {
  if (!baseUrl) return;
  const p = pathWithQuery.startsWith("/") ? pathWithQuery : `/${pathWithQuery}`;
  window.location.assign(`${baseUrl}${p}`);
}

function HomeRedirector({ supabase }: { supabase: ReturnType<typeof createClient> }) {
  const nav = useNavigate();
  const [msg, setMsg] = useState("Vérification de session...");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        nav("/login", { replace: true });
        return;
      }

      const userId = data.session.user.id;

      setMsg("Chargement du profil...");
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single<Profile>();

      if (error) {
        setMsg(`Erreur profil: ${error.message}`);
        return;
      }

      const role = profile?.role ?? "";

      // super_admin -> Admin Console
      if (role === "super_admin") {
        if (!ADMIN_URL) {
          setMsg("ADMIN_URL non configurée (VITE_ADMIN_URL).");
          return;
        }
        hardRedirect(ADMIN_URL, "/");
        return;
      }

      // org_admin/operator/viewer -> Operator
      if (role === "org_admin" || role === "admin" || role === "operator" || role === "viewer") {
        if (!OPERATOR_URL) {
          setMsg("OPERATOR_URL non configurée (VITE_OPERATOR_URL).");
          return;
        }
        hardRedirect(OPERATOR_URL, "/");
        return;
      }

      setMsg("Aucun rôle connu. Vérifie profiles.role.");
    })();
  }, [nav, supabase]);

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b0d10", color: "#e5e7eb", fontFamily: "Inter, system-ui" }}>
      <div style={{ maxWidth: 560, padding: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Scoreboard</h1>
        <p style={{ opacity: 0.8 }}>{msg}</p>
      </div>
    </div>
  );
}

function DisplayRedirector() {
  const loc = useLocation();
  const pathWithQuery = `${loc.pathname}${loc.search}${loc.hash}`;

  // /display?... -> app Display dédiée
  if (!DISPLAY_URL) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b0d10", color: "#e5e7eb", fontFamily: "Inter, system-ui" }}>
        <div style={{ maxWidth: 560, padding: 24 }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>Display</h1>
          <p style={{ opacity: 0.8 }}>VITE_DISPLAY_URL non configurée.</p>
        </div>
      </div>
    );
  }

  hardRedirect(DISPLAY_URL, pathWithQuery);
  return null;
}

export default function App() {
  const supabase = useMemo(() => createClient(SUPABASE_URL, SUPABASE_ANON), []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRedirector supabase={supabase} />} />
        <Route path="/login" element={<LoginPage supabase={supabase} />} />
        <Route path="/display" element={<DisplayRedirector />} />
      </Routes>
    </BrowserRouter>
  );
}
