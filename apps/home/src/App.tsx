import React, { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { createClient, type Session } from "@supabase/supabase-js";
import LoginPage from "./pages/LoginPage";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const ADMIN_URL = (import.meta.env.VITE_ADMIN_URL || "").replace(/\/$/, "");
const OPERATOR_URL = (import.meta.env.VITE_OPERATOR_URL || "").replace(/\/$/, "");
const DISPLAY_URL = (import.meta.env.VITE_DISPLAY_URL || "").replace(/\/$/, "");

type Profile = { role?: string | null };

function hardRedirect(url: string) {
  window.location.assign(url);
}

/**
 * Passe la session à une autre app (autre domaine) via URL hash.
 * Exemple: https://xxx.vercel.app/#access_token=...&refresh_token=...
 */
function redirectWithSession(baseUrl: string, session: Session, path = "/") {
  const cleanBase = baseUrl.replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const hash = new URLSearchParams({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    token_type: session.token_type ?? "bearer",
    expires_in: String(session.expires_in ?? 3600),
  }).toString();

  hardRedirect(`${cleanBase}${cleanPath}#${hash}`);
}

function MissingEnv({ name }: { name: string }) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b0d10", color: "#e5e7eb", fontFamily: "Inter, system-ui" }}>
      <div style={{ maxWidth: 680, padding: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Scoreboard – Home</h1>
        <p style={{ opacity: 0.85 }}>Variable manquante : <code>{name}</code></p>
        <p style={{ opacity: 0.65, marginTop: 8 }}>
          Vérifie les variables d’environnement du projet Vercel <b>scoreboard-home</b>.
        </p>
      </div>
    </div>
  );
}

function HomeRedirector({ supabase }: { supabase: ReturnType<typeof createClient> }) {
  const nav = useNavigate();
  const [msg, setMsg] = useState("Vérification de session...");
  const [debug, setDebug] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session) {
        nav("/login", { replace: true });
        return;
      }

      // Debug utile en phase 1
      setDebug(`session OK user=${session.user.id}`);

      const userId = session.user.id;

      setMsg("Chargement des accès...");
      const { data: memberships, error: memErr } = await supabase
        .from("org_members")
        .select("role, orgs(slug)")
        .eq("user_id", userId);

      if (memErr) {
        setMsg(`Erreur org_members: ${memErr.message}`);
        return;
      }

      const isSuperAdmin = (memberships ?? []).some(
        (m: any) => m?.orgs?.slug === "master" && m?.role === "super_admin"
      );

      if (isSuperAdmin) {
        if (!ADMIN_URL) {
          setMsg("VITE_ADMIN_URL non configurée.");
          return;
        }
        setMsg("Redirection Admin...");
        redirectWithSession(ADMIN_URL, session, "/");
        return;
      }

      if (!OPERATOR_URL) {
        setMsg("VITE_OPERATOR_URL non configurée.");
        return;
      }

      setMsg("Redirection Operator...");
      redirectWithSession(OPERATOR_URL, session, "/");
    })();
  }, [nav, supabase]);

  async function hardLogout() {
    try {
      await supabase.auth.signOut();
    } finally {
      // Nettoyage localStorage (utile si tu as bricolé plusieurs configs)
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {}
      window.location.assign("/login");
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b0d10", color: "#e5e7eb", fontFamily: "Inter, system-ui" }}>
      <div style={{ maxWidth: 680, padding: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Scoreboard</h1>
        <p style={{ opacity: 0.85 }}>{msg}</p>

        {debug && (
          <p style={{ opacity: 0.6, fontSize: 12, marginTop: 8 }}>
            debug: <code>{debug}</code>
          </p>
        )}

        <div style={{ marginTop: 14 }}>
          <button
            onClick={hardLogout}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #2a2d33",
              background: "#14161a",
              color: "#e5e7eb",
              cursor: "pointer",
            }}
          >
            Se déconnecter (reset)
          </button>
        </div>
      </div>
    </div>
  );
}

function DisplayRedirector() {
  const loc = useLocation();
  const pathWithQuery = `${loc.pathname}${loc.search}${loc.hash}`;

  if (!DISPLAY_URL) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b0d10", color: "#e5e7eb", fontFamily: "Inter, system-ui" }}>
        <div style={{ maxWidth: 680, padding: 24 }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>Display</h1>
          <p style={{ opacity: 0.85 }}>VITE_DISPLAY_URL non configurée.</p>
        </div>
      </div>
    );
  }

  hardRedirect(`${DISPLAY_URL}${pathWithQuery.startsWith("/") ? pathWithQuery : `/${pathWithQuery}`}`);
  return null;
}

export default function App() {
  if (!SUPABASE_URL) return <MissingEnv name="VITE_SUPABASE_URL" />;
  if (!SUPABASE_ANON) return <MissingEnv name="VITE_SUPABASE_ANON_KEY" />;

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
