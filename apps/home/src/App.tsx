import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

type OrgStatus = "active" | "suspended" | "archived" | string;

type Org = {
  id: string;
  slug: string;
  name: string | null;
  status: OrgStatus | null;
  sport: string | null;
};

type OrgMemberRow = {
  role: string | null;
  orgs: Org | null;
};

function getEnv(name: string) {
  const v = (import.meta as any).env?.[name];
  return typeof v === "string" ? v : "";
}

const ADMIN_URL = getEnv("VITE_ADMIN_URL");
const OPERATOR_URL = getEnv("VITE_OPERATOR_URL");
const DISPLAY_URL = getEnv("VITE_DISPLAY_URL");

function isAbsoluteUrl(u: string) {
  return /^https?:\/\//i.test(u);
}

function safeRedirect(baseUrl: string, path: string) {
  if (!baseUrl || !isAbsoluteUrl(baseUrl)) return;
  const u = new URL(baseUrl);
  // keep any existing path, but ensure slash joining
  const joined = new URL(path.replace(/^\//, ""), u.toString() + (u.pathname.endsWith("/") ? "" : "/"));
  window.location.href = joined.toString();
}

function normalizeStatus(s: OrgStatus | null | undefined) {
  const v = (s || "active").toString().toLowerCase();
  if (v === "archived" || v === "suspended" || v === "active") return v;
  return "active";
}

export default function App() {
  const [booting, setBooting] = useState(true);

  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [orgs, setOrgs] = useState<Array<{ org: Org; role: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  // login form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const forceLogin = useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("forceLogin") === "1";
  }, []);

  async function loadSessionAndMaybeRedirect() {
    setError(null);

    if (forceLogin) {
      await supabase.auth.signOut();
    }

    const { data, error } = await supabase.auth.getSession();
    if (error) {
      setSessionEmail(null);
      setBooting(false);
      return;
    }

    const user = data.session?.user || null;
    setSessionEmail(user?.email ?? null);

    setBooting(false);

    if (user) {
      await loadOrganizations(user.id);
    }
  }

  async function loadOrganizations(userId: string) {
    setLoadingOrgs(true);
    setError(null);

    const { data, error } = await supabase
      .from("org_members")
      .select(
        `
        role,
        orgs (
          id,
          slug,
          name,
          status,
          sport
        )
      `
      )
      .eq("user_id", userId);

    if (error) {
      setError(error.message);
      setOrgs([]);
      setLoadingOrgs(false);
      return;
    }

    const rows = ((data || []) as OrgMemberRow[])
      .filter((r) => r.orgs)
      .map((r) => ({
        role: (r.role || "operator").toLowerCase(),
        org: r.orgs as Org,
      }))
      // par défaut: ne montrer que les orgs actives
      .filter((x) => normalizeStatus(x.org.status) === "active" || x.org.slug === "master");

    setOrgs(rows);
    setLoadingOrgs(false);

    // Auto route:
    // - si super_admin (rôle super_admin sur MASTER) => admin
    // - sinon => operator (org par défaut)
    const isSuperAdmin = rows.some((x) => x.role === "super_admin" && x.org.slug === "master");
    if (isSuperAdmin) {
      safeRedirect(ADMIN_URL, "/");
      return;
    }

    // org par défaut: la première (active)
    if (rows.length > 0) {
      const orgId = rows[0].org.id;
      safeRedirect(OPERATOR_URL, `/org/${orgId}`);
      return;
    }

    // Sinon rester sur écran "aucune org"
  }

  async function loginWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoggingIn(true);
    setError(null);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoggingIn(false);
      return;
    }

    const user = data.user;
    setSessionEmail(user?.email ?? null);

    if (user?.id) {
      await loadOrganizations(user.id);
    }

    setLoggingIn(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    setSessionEmail(null);
    setOrgs([]);
    // revenir login
    window.location.href = window.location.origin + "/";
  }

  useEffect(() => {
    loadSessionAndMaybeRedirect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (booting) {
    return (
      <div style={pageStyle()}>
        <h1 style={h1Style()}>scoreDisplay</h1>
        <div style={cardStyle()}>
          <div>Initialisation…</div>
        </div>
      </div>
    );
  }

  // Pas connecté => login
  if (!sessionEmail) {
    return (
      <div style={pageStyle()}>
        <h1 style={h1Style()}>scoreDisplay</h1>

        <div style={cardStyle()}>
          <h2 style={{ margin: 0, marginBottom: 10 }}>Connexion</h2>

          {error ? <div style={errStyle()}>{error}</div> : null}

          <form onSubmit={loginWithPassword} style={{ display: "grid", gap: 10 }}>
            <input
              style={inputStyle()}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoComplete="email"
            />
            <input
              style={inputStyle()}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mot de passe"
              type="password"
              autoComplete="current-password"
            />
            <button style={btnStyle()} disabled={loggingIn || !email || !password}>
              {loggingIn ? "Connexion…" : "Se connecter"}
            </button>
          </form>

          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>
            Astuce : pour forcer cet écran, ouvre <code>?forceLogin=1</code>
          </div>
        </div>
      </div>
    );
  }

  // Connecté => loading orgs
  return (
    <div style={pageStyle()}>
      <h1 style={h1Style()}>scoreDisplay</h1>

      <div style={cardStyle()}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div style={{ fontWeight: 800 }}>{sessionEmail}</div>
          <button style={btnGhostStyle()} onClick={logout}>
            Déconnexion
          </button>
        </div>

        {error ? <div style={errStyle()}>{error}</div> : null}

        {loadingOrgs ? (
          <div style={{ marginTop: 14 }}>Chargement des organisations…</div>
        ) : orgs.length === 0 ? (
          <div style={{ marginTop: 14 }}>
            Aucune organisation active liée à ce compte.
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
              (Si tu es super_admin, vérifie que tu es bien membre de <code>master</code> avec le rôle <code>super_admin</code>)
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 14 }}>
            Redirection…
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
              Admin: <code>{ADMIN_URL || "NON CONFIG"}</code>
              <br />
              Operator: <code>{OPERATOR_URL || "NON CONFIG"}</code>
              <br />
              Display: <code>{DISPLAY_URL || "NON CONFIG"}</code>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* Minimal styles */
function pageStyle(): React.CSSProperties {
  return {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "#0b0d12",
    color: "#e5e7eb",
    padding: 18,
    fontFamily: "system-ui",
  };
}
function h1Style(): React.CSSProperties {
  return { position: "fixed", top: 18, left: 18, margin: 0, fontSize: 16, opacity: 0.85, fontWeight: 900 };
}
function cardStyle(): React.CSSProperties {
  return {
    width: "min(520px, 92vw)",
    background: "#0f141b",
    border: "1px solid #1f2a3a",
    borderRadius: 16,
    padding: 16,
    boxShadow: "0 20px 60px rgba(0,0,0,.5)",
  };
}
function inputStyle(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #1f2a3a",
    background: "#0b0d12",
    color: "#e5e7eb",
    outline: "none",
  };
}
function btnStyle(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #1f2a3a",
    background: "rgba(59,130,246,.16)",
    color: "#e5e7eb",
    cursor: "pointer",
    fontWeight: 900,
  };
}
function btnGhostStyle(): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid #1f2a3a",
    background: "transparent",
    color: "#e5e7eb",
    cursor: "pointer",
    fontWeight: 900,
  };
}
function errStyle(): React.CSSProperties {
  return {
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    background: "rgba(239,68,68,.12)",
    border: "1px solid #1f2a3a",
  };
}
