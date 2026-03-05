import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

type OrgStatus = "active" | "suspended" | "archived" | string;

type OrgRow = {
  id: string;
  slug: string;
  name: string | null;
  status: OrgStatus | null;
  sport: string | null;
};

type MemberJoinRow = {
  role: string | null;
  orgs: OrgRow | null;
};

function getEnv(name: string) {
  const v = (import.meta as any).env?.[name];
  return typeof v === "string" ? v : "";
}

const ADMIN_URL = (getEnv("VITE_ADMIN_URL") || "").replace(/\/$/, "");
const OPERATOR_URL = (getEnv("VITE_OPERATOR_URL") || "").replace(/\/$/, "");
const DISPLAY_URL = (getEnv("VITE_DISPLAY_URL") || "").replace(/\/$/, "");

function hardRedirect(baseUrl: string, pathWithQuery = "/") {
  if (!baseUrl) return;
  const p = pathWithQuery.startsWith("/") ? pathWithQuery : `/${pathWithQuery}`;
  window.location.assign(`${baseUrl}${p}`);
}

function redirectWithSession(baseUrl: string, session: { access_token: string; refresh_token: string }, path = "/") {
  if (!baseUrl) return;
  const hash = `#access_token=${encodeURIComponent(session.access_token)}&refresh_token=${encodeURIComponent(
    session.refresh_token
  )}&token_type=bearer`;
  const p = path.startsWith("/") ? path : `/${path}`;
  window.location.assign(`${baseUrl}${p}${hash}`);
}

function getThemeFromStorage(): "dark" | "light" {
  const v = (localStorage.getItem("scoreDisplay.theme") || "").toLowerCase();
  return v === "light" ? "light" : "dark";
}
function applyTheme(t: "dark" | "light") {
  document.documentElement.dataset.theme = t;
  localStorage.setItem("scoreDisplay.theme", t);
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "Inter, system-ui, Arial" }}>
      <style>{`
        :root{
          --bg:#0b0d10; --panel:rgba(255,255,255,.04); --text:#e5e7eb; --muted:#9ca3af; --border:#1b2230; --primary:#60a5fa;
          --danger:#ef4444; --warn:#f59e0b; --ok:#22c55e;
        }
        :root[data-theme="light"]{
          --bg:#f6f7fb; --panel:#ffffff; --text:#0f172a; --muted:#475569; --border:#e2e8f0; --primary:#2563eb;
          --danger:#dc2626; --warn:#d97706; --ok:#16a34a;
        }
        a{ color: var(--primary); }
        input, select{
          border: 1px solid var(--border);
          background: var(--panel);
          color: var(--text);
          padding: 10px 12px;
          border-radius: 10px;
          outline: none;
        }
        button{
          border: 1px solid var(--border);
          background: var(--panel);
          color: var(--text);
          padding: 10px 12px;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 800;
        }
        button:disabled{ opacity:.5; cursor:not-allowed; }
      `}</style>
      {children}
    </div>
  );
}

function ThemeToggle() {
  const [t, setT] = useState<"dark" | "light">(getThemeFromStorage());
  useEffect(() => applyTheme(t), [t]);
  return (
    <button onClick={() => setT((x) => (x === "dark" ? "light" : "dark"))} title="Basculer thème" style={{ fontSize: 12 }}>
      {t === "dark" ? "🌙 Sombre" : "☀️ Clair"}
    </button>
  );
}

function StatusPill({ status }: { status: OrgStatus }) {
  const s = (status || "active").toString().toLowerCase();
  const color = s === "active" ? "var(--ok)" : s === "suspended" ? "var(--warn)" : "var(--muted)";
  const label = s === "active" ? "Active" : s === "suspended" ? "Suspendue" : "Archivée";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        border: `1px solid var(--border)`,
        background: "var(--panel)",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 999, background: color, display: "inline-block" }} />
      {label}
    </span>
  );
}

export default function App() {
  // theme
  useEffect(() => applyTheme(getThemeFromStorage()), []);

  const forceLogin = useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("forceLogin") === "1";
  }, []);

  const [booting, setBooting] = useState(true);

  // session + login
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [sessionTokens, setSessionTokens] = useState<{ access_token: string; refresh_token: string } | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  // orgs
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [rows, setRows] = useState<Array<{ org: OrgRow; role: string }>>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "all" | "active+archived">("active");
  const [sportFilter, setSportFilter] = useState<string>("all");

  const [err, setErr] = useState<string | null>(null);

  async function loadOrganizations(userId: string) {
    setLoadingOrgs(true);
    setErr(null);

    // IMPORTANT: ne pas sélectionner org_sport (colonne absente chez toi).
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
      setErr(error.message);
      setRows([]);
      setIsSuperAdmin(false);
      setLoadingOrgs(false);
      return;
    }

    const joined = (data || []) as unknown as MemberJoinRow[];

    const normalized = joined
      .map((m) => ({ role: (m.role || "").toString(), org: m.orgs }))
      .filter((x) => !!x.org)
      .map((x) => ({ role: x.role, org: x.org! }));

    setRows(normalized);

    // super_admin = membership sur org master avec role super_admin
    const sa = normalized.some((m) => m.org.slug === "master" && m.role === "super_admin");
    setIsSuperAdmin(sa);

    setLoadingOrgs(false);

    // si pas super admin et une seule org active => redirect direct Operator
    if (!sa) {
      const actives = normalized.filter((m) => ((m.org.status || "active") + "").toLowerCase() === "active");
      if (actives.length === 1 && OPERATOR_URL && sessionTokens) {
        redirectWithSession(OPERATOR_URL, sessionTokens, `/?org=${encodeURIComponent(actives[0].org.slug)}`);
      }
    }
  }

  async function bootstrap() {
    setErr(null);

    if (forceLogin) {
      await supabase.auth.signOut();
    }

    const { data, error } = await supabase.auth.getSession();
    if (error) {
      setErr(error.message);
      setBooting(false);
      return;
    }

    const session = data.session;
    if (!session) {
      setSessionEmail(null);
      setSessionTokens(null);
      setBooting(false);
      return;
    }

    setSessionEmail(session.user.email ?? null);
    setSessionTokens({ access_token: session.access_token, refresh_token: session.refresh_token });

    await loadOrganizations(session.user.id);
    setBooting(false);
  }

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoggingIn(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoggingIn(false);
    if (error) {
      setErr(error.message);
      return;
    }

    await bootstrap();
  }

  async function onLogout() {
    setErr(null);
    await supabase.auth.signOut();
    setSessionEmail(null);
    setSessionTokens(null);
    setRows([]);
    setIsSuperAdmin(false);
  }

  const sports = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const s = (r.org.sport || "").trim();
      if (s) set.add(s);
    }
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return rows
      .filter((r) => {
        const o = r.org;
        const status = ((o.status || "active") + "").toLowerCase();

        if (statusFilter === "active" && status !== "active") return false;
        if (statusFilter === "active+archived" && !(status === "active" || status === "archived")) return false;

        if (sportFilter !== "all") {
          const s = (o.sport || "").trim();
          if (s !== sportFilter) return false;
        }

        if (!qq) return true;
        const hay = `${o.slug} ${o.name || ""}`.toLowerCase();
        return hay.includes(qq);
      })
      .sort((a, b) => a.org.slug.localeCompare(b.org.slug));
  }, [rows, q, statusFilter, sportFilter]);

  // Redirect Display (conserve query)
  function goDisplay() {
    const url = `${window.location.pathname}${window.location.search}${window.location.hash}`; // garde token/org éventuels
    if (!DISPLAY_URL) {
      setErr("VITE_DISPLAY_URL non configurée.");
      return;
    }
    hardRedirect(DISPLAY_URL, url);
  }

  function goAdmin() {
    if (!ADMIN_URL) {
      setErr("VITE_ADMIN_URL non configurée.");
      return;
    }
    if (!sessionTokens) {
      setErr("Session absente, reconnecte-toi.");
      return;
    }
    redirectWithSession(ADMIN_URL, sessionTokens, "/");
  }

  function goOperator(orgSlug?: string) {
    if (!OPERATOR_URL) {
      setErr("VITE_OPERATOR_URL non configurée.");
      return;
    }
    if (!sessionTokens) {
      setErr("Session absente, reconnecte-toi.");
      return;
    }
    const path = orgSlug ? `/?org=${encodeURIComponent(orgSlug)}` : "/";
    redirectWithSession(OPERATOR_URL, sessionTokens, path);
  }

  return (
    <Shell>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22 }}>scoreDisplay</h1>
            <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
              Hub d’accès — session persistée • forcer la page login: <code>?forceLogin=1</code>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <ThemeToggle />
            <button onClick={goDisplay} title="Ouvrir l'app Display (TV / LED)">
              📺 Display
            </button>
          </div>
        </div>

        <div style={{ marginTop: 16, border: "1px solid var(--border)", background: "var(--panel)", borderRadius: 14, padding: 16 }}>
          {booting ? (
            <div style={{ color: "var(--muted)" }}>Chargement…</div>
          ) : !sessionEmail ? (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontWeight: 900 }}>Connexion</div>
                <div style={{ color: "var(--muted)", fontSize: 12 }}>
                  {ADMIN_URL ? "Admin prêt" : "VITE_ADMIN_URL manquante"} • {OPERATOR_URL ? "Operator prêt" : "VITE_OPERATOR_URL manquante"}
                </div>
              </div>

              <form onSubmit={onLogin} style={{ display: "grid", gap: 10, marginTop: 12, maxWidth: 420 }}>
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" required />
                <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Mot de passe" required />
                <button disabled={loggingIn} type="submit">
                  {loggingIn ? "Connexion…" : "Se connecter"}
                </button>
              </form>
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 900 }}>Connecté</div>
                  <div style={{ color: "var(--muted)", fontSize: 13 }}>{sessionEmail}</div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  {isSuperAdmin && (
                    <button onClick={goAdmin} title="Admin Console">
                      🛡️ Admin
                    </button>
                  )}
                  <button onClick={() => goOperator()} title="Operator (par défaut)">
                    ⚙️ Operator
                  </button>
                  <button onClick={onLogout} title="Déconnexion">
                    Se déconnecter
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Recherche org (slug / nom)…" style={{ minWidth: 240 }} />

                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} title="Filtre statut">
                    <option value="active">Actives</option>
                    <option value="active+archived">Actives + Archivées</option>
                    <option value="all">Toutes</option>
                  </select>

                  <select value={sportFilter} onChange={(e) => setSportFilter(e.target.value)} title="Filtre sport">
                    <option value="all">Tous sports</option>
                    {sports.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>

                  <div style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 12 }}>
                    {loadingOrgs ? "Chargement des organisations…" : `${filtered.length} org(s)`}
                  </div>
                </div>

                {filtered.length === 0 ? (
                  <div style={{ color: "var(--muted)" }}>Aucune organisation trouvée.</div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {filtered.map((r) => (
                      <div
                        key={r.org.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                          gap: 10,
                          alignItems: "center",
                          padding: 12,
                          borderRadius: 12,
                          border: "1px solid var(--border)",
                          background: "var(--panel)",
                        }}
                      >
                        <div style={{ display: "grid", gap: 4 }}>
                          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                            <div style={{ fontWeight: 900 }}>{r.org.name || r.org.slug}</div>
                            <div style={{ color: "var(--muted)", fontSize: 12 }}>{r.org.slug}</div>
                            <StatusPill status={r.org.status || "active"} />
                            {r.org.sport && (
                              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                                🏷️ {r.org.sport}
                              </span>
                            )}
                          </div>
                          <div style={{ color: "var(--muted)", fontSize: 12 }}>
                            Rôle: <b>{r.role}</b>
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 10 }}>
                          <button onClick={() => goOperator(r.org.slug)} title="Ouvrir Operator sur cette org">
                            Ouvrir
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {err && (
            <div style={{ marginTop: 12, padding: 10, borderRadius: 10, border: "1px solid rgba(220,38,38,.35)", background: "rgba(220,38,38,.12)", color: "#fecaca" }}>
              {err}
            </div>
          )}
        </div>

        <div style={{ marginTop: 14, color: "var(--muted)", fontSize: 12 }}>
          Astuce : pour forcer l’écran de login → <code>https://scoreboard-home.vercel.app/?forceLogin=1</code>
        </div>
      </div>
    </Shell>
  );
}
