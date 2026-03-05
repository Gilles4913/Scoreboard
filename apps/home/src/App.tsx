import React, { useEffect, useMemo, useState } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

type OrgStatus = "active" | "suspended" | "archived" | string;

type OrgRow = {
  id: string;
  slug: string;
  name: string;
  status: OrgStatus | null;
  sport: string | null;
};

type OrgMemberRow = {
  role: string | null;
  orgs: OrgRow; // join
};

type SessionTokens = {
  access_token: string;
  refresh_token: string;
};

const LS_THEME_KEY = "scoreDisplay.theme";
const LS_ACTIVE_ORG_KEY = "scoreDisplay.activeOrgSlug";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const ADMIN_URL = import.meta.env.VITE_ADMIN_URL as string | undefined;
const OPERATOR_URL = import.meta.env.VITE_OPERATOR_URL as string | undefined;
const DISPLAY_URL = import.meta.env.VITE_DISPLAY_URL as string | undefined;

function mustEnv(name: string, v?: string) {
  if (!v) throw new Error(`${name} is required`);
  return v;
}

function safeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

function getThemeFromStorage(): "dark" | "light" {
  const t = (localStorage.getItem(LS_THEME_KEY) || "dark").toLowerCase();
  return t === "light" ? "light" : "dark";
}

function applyTheme(t: "dark" | "light") {
  document.documentElement.dataset.theme = t;
  localStorage.setItem(LS_THEME_KEY, t);
}

function redirectWithSession(baseUrl: string, tokens: SessionTokens, path: string) {
  const base = safeBaseUrl(baseUrl);
  const p = path.startsWith("/") ? path : `/${path}`;

  // handoff via hash (comme OAuth)
  const hash = new URLSearchParams({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_type: "bearer",
  }).toString();

  window.location.href = `${base}${p}#${hash}`;
}

async function isSuperAdminRPC(supabase: SupabaseClient, userId: string): Promise<boolean> {
  // On tente plusieurs signatures (p_uid / p_user) pour éviter les collisions de nom.
  const tries: Array<Record<string, any>> = [{ p_uid: userId }, { p_user: userId }, { user_id: userId }];
  for (const args of tries) {
    const { data, error } = await supabase.rpc("is_super_admin", args);
    if (!error) return Boolean(data);
  }
  return false;
}

export default function App() {
  const [theme, setTheme] = useState<"dark" | "light">(getThemeFromStorage());

  const supabase = useMemo(() => {
    const url = mustEnv("VITE_SUPABASE_URL", SUPABASE_URL);
    const anon = mustEnv("VITE_SUPABASE_ANON_KEY", SUPABASE_ANON_KEY);
    return createClient(url, anon);
  }, []);

  const [booting, setBooting] = useState(true);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [sessionTokens, setSessionTokens] = useState<SessionTokens | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [orgRows, setOrgRows] = useState<
    Array<{ org: OrgRow; role: string | null }>
  >([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "all" | "active+archived">("active");
  const [sportFilter, setSportFilter] = useState<string>("all");

  const forceLogin = useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("forceLogin") === "1";
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setError(null);
      setBooting(true);

      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session || forceLogin) {
        if (!cancelled) {
          setSessionEmail(null);
          setSessionTokens(null);
          setIsSuperAdmin(false);
          setOrgRows([]);
          setBooting(false);
        }
        return;
      }

      const user = session.user;
      const tokens: SessionTokens = {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      };

      const sa = await isSuperAdminRPC(supabase, user.id);

      if (cancelled) return;

      setSessionEmail(user.email || user.id);
      setSessionTokens(tokens);
      setIsSuperAdmin(sa);

      await loadOrgs(sa, user.id);

      if (!cancelled) setBooting(false);
    }

    async function loadOrgs(sa: boolean, userId: string) {
      setLoadingOrgs(true);
      setError(null);

      try {
        if (sa) {
          // Super admin: liste toutes les orgs (RLS via helpers)
          const { data, error } = await supabase
            .from("orgs")
            .select("id,slug,name,status,sport")
            .order("name", { ascending: true });

          if (error) throw error;

          const rows = (data || []).map((o: any) => ({
            org: o as OrgRow,
            role: "super_admin",
          }));

          setOrgRows(rows);
        } else {
          // Utilisateur normal: via org_members join orgs(...)
          const { data, error } = await supabase
            .from("org_members")
            .select("role, orgs(id,slug,name,status,sport)")
            .eq("user_id", userId);

          if (error) throw error;

          const rows = ((data || []) as any[]).map((r) => ({
            role: r.role ?? null,
            org: r.orgs as OrgRow,
          }));

          setOrgRows(rows);
        }
      } catch (e: any) {
        setOrgRows([]);
        setError(e?.message || "Erreur chargement organisations");
      } finally {
        setLoadingOrgs(false);
      }
    }

    bootstrap();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      // si token refresh etc.
      if (!session) return;
      setSessionEmail(session.user?.email || session.user?.id || null);
      setSessionTokens({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [supabase, forceLogin]);

  const sports = useMemo(() => {
    const set = new Set<string>();
    for (const r of orgRows) {
      const s = (r.org.sport || "").trim();
      if (s) set.add(s);
    }
    return Array.from(set).sort();
  }, [orgRows]);

  const stats = useMemo(() => {
    const total = orgRows.length;
    let active = 0;
    let suspended = 0;
    let archived = 0;

    for (const r of orgRows) {
      const st = ((r.org.status || "active") + "").toLowerCase();
      if (st === "active") active++;
      else if (st === "suspended") suspended++;
      else if (st === "archived") archived++;
    }
    return { total, active, suspended, archived };
  }, [orgRows]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return orgRows
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
        const hay = `${o.slug} ${o.name || ""} ${o.sport || ""} ${r.role || ""}`.toLowerCase();
        return hay.includes(qq);
      })
      .sort((a, b) => a.org.name.localeCompare(b.org.name));
  }, [orgRows, q, statusFilter, sportFilter]);

  async function doLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoggingIn(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // reload hard: pour repartir proprement sur bootstrap()
      window.location.href = window.location.origin + "/";
    } catch (e: any) {
      setError(e?.message || "Erreur login");
    } finally {
      setLoggingIn(false);
    }
  }

  async function logout() {
    setError(null);
    await supabase.auth.signOut();
    setSessionEmail(null);
    setSessionTokens(null);
    setIsSuperAdmin(false);
    setOrgRows([]);
    // force refresh
    window.location.href = window.location.origin + "/?forceLogin=1";
  }

  function toggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  function openAdmin() {
    if (!ADMIN_URL) return setError("VITE_ADMIN_URL non configurée.");
    if (!sessionTokens) return setError("Session absente, reconnecte-toi.");
    redirectWithSession(ADMIN_URL, sessionTokens, "/");
  }

  function openOperator(orgSlug: string) {
    if (!OPERATOR_URL) return setError("VITE_OPERATOR_URL non configurée.");
    if (!sessionTokens) return setError("Session absente, reconnecte-toi.");

    localStorage.setItem(LS_ACTIVE_ORG_KEY, orgSlug);

    // On passe l'org en querystring (Operator ne doit plus picker)
    const path = `/?org=${encodeURIComponent(orgSlug)}`;
    redirectWithSession(OPERATOR_URL, sessionTokens, path);
  }

  function openDisplay() {
    const url = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (!DISPLAY_URL) return setError("VITE_DISPLAY_URL non configurée.");
    window.location.href = `${safeBaseUrl(DISPLAY_URL)}/${url.replace(/^\//, "")}`;
  }

  // --- UI states ---
  if (booting) {
    return (
      <Shell theme={theme}>
        <div style={{ maxWidth: 980, margin: "0 auto", padding: 22 }}>
          <TopBar
            theme={theme}
            toggleTheme={toggleTheme}
            isSuperAdmin={false}
            openAdmin={() => {}}
            openDisplay={openDisplay}
            sessionEmail={null}
            logout={logout}
          />
          <div style={ui.card}>Chargement…</div>
        </div>
      </Shell>
    );
  }

  // Login screen
  if (!sessionEmail || !sessionTokens) {
    return (
      <Shell theme={theme}>
        <div style={{ maxWidth: 980, margin: "0 auto", padding: 22 }}>
          <TopBar
            theme={theme}
            toggleTheme={toggleTheme}
            isSuperAdmin={false}
            openAdmin={() => {}}
            openDisplay={openDisplay}
            sessionEmail={null}
            logout={logout}
          />

          <div style={{ display: "grid", gap: 14 }}>
            <div style={ui.hero}>
              <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: -0.5 }}>scoreDisplay</div>
              <div style={{ marginTop: 6, color: "var(--muted)" }}>
                Hub d’accès (Home) — connexion unique pour accéder à <b>Operator</b>, <b>Admin</b> et <b>Display</b>.
              </div>
            </div>

            <div style={ui.grid2}>
              <div style={ui.card}>
                <h2 style={{ marginTop: 0 }}>Connexion</h2>

                {error ? <div style={ui.err}>Erreur : {error}</div> : null}

                <form onSubmit={doLogin} style={{ display: "grid", gap: 10 }}>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={ui.small}>Email</span>
                    <input style={ui.input} value={email} onChange={(e) => setEmail(e.target.value)} />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={ui.small}>Mot de passe</span>
                    <input
                      style={ui.input}
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </label>

                  <button style={ui.btnPrimary} type="submit" disabled={loggingIn}>
                    {loggingIn ? "Connexion…" : "Se connecter"}
                  </button>

                  <div style={ui.small}>
                    Astuce : pour forcer cet écran, ouvre{" "}
                    <code style={ui.code}>{safeBaseUrl(window.location.origin)}/?forceLogin=1</code>
                  </div>
                </form>
              </div>

              <div style={ui.card}>
                <h2 style={{ marginTop: 0 }}>Mode d’emploi (1 min)</h2>
                <ol style={{ margin: 0, paddingLeft: 18, color: "var(--text)" }}>
                  <li style={{ marginBottom: 8 }}>
                    Connecte-toi avec ton compte <b>org_admin</b> / <b>operator</b> / <b>super_admin</b>.
                  </li>
                  <li style={{ marginBottom: 8 }}>
                    Sélectionne une <b>organisation</b> (club / ville / structure).
                  </li>
                  <li style={{ marginBottom: 8 }}>
                    Tu arrives dans <b>Operator</b> pour gérer les matchs, le live, et les liens Display.
                  </li>
                  <li>
                    Si tu es <b>super_admin</b>, tu peux aussi ouvrir la console <b>Admin</b> (gestion orgs/membres).
                  </li>
                </ol>

                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Vérifs rapides</div>
                  <div style={ui.small}>
                    - VITE_SUPABASE_URL : {SUPABASE_URL ? "OK" : "MANQUANT"} <br />
                    - VITE_SUPABASE_ANON_KEY : {SUPABASE_ANON_KEY ? "OK" : "MANQUANT"} <br />
                    - VITE_OPERATOR_URL : {OPERATOR_URL ? "OK" : "MANQUANT"} <br />
                    - VITE_ADMIN_URL : {ADMIN_URL ? "OK" : "MANQUANT"} <br />
                    - VITE_DISPLAY_URL : {DISPLAY_URL ? "OK" : "MANQUANT"} <br />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  // Logged-in view: org picker
  return (
    <Shell theme={theme}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: 22 }}>
        <TopBar
          theme={theme}
          toggleTheme={toggleTheme}
          isSuperAdmin={isSuperAdmin}
          openAdmin={openAdmin}
          openDisplay={openDisplay}
          sessionEmail={sessionEmail}
          logout={logout}
        />

        {error ? <div style={{ ...ui.card, borderColor: "rgba(239,68,68,.5)" }}>{uiErrorBox(error)}</div> : null}

        <div style={ui.kpis}>
          <KPI title="Organisations" value={stats.total} sub={`actives ${stats.active} • suspendues ${stats.suspended} • archivées ${stats.archived}`} />
          <KPI title="Sports" value={sports.length} sub={sports.length ? sports.join(" • ") : "—"} />
          <KPI title="Rôle" value={isSuperAdmin ? "super_admin" : "membre"} sub={isSuperAdmin ? "accès global" : "accès limité à tes orgs"} />
        </div>

        <div style={ui.filters}>
          <input
            style={{ ...ui.input, flex: 1 }}
            placeholder="Recherche org (slug / nom / sport / rôle)…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <select style={ui.select} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
            <option value="active">Actives</option>
            <option value="active+archived">Actives + archivées</option>
            <option value="all">Toutes</option>
          </select>

          <select style={ui.select} value={sportFilter} onChange={(e) => setSportFilter(e.target.value)}>
            <option value="all">Tous sports</option>
            {sports.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <div style={{ color: "var(--muted)", fontSize: 12 }}>{filtered.length} org(s)</div>
        </div>

        <div style={{ marginTop: 14 }}>
          <h2 style={{ margin: "14px 0 10px" }}>Organisations</h2>

          {loadingOrgs ? (
            <div style={ui.card}>Chargement des organisations…</div>
          ) : filtered.length === 0 ? (
            <div style={ui.card}>
              Aucune organisation.
              <div style={{ marginTop: 8, color: "var(--muted)", fontSize: 12 }}>
                Si tu es super_admin, vérifie que la RLS autorise bien <code style={ui.code}>select</code> sur <code style={ui.code}>orgs</code>.
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {filtered.map((r) => {
                const o = r.org;
                const st = ((o.status || "active") + "").toLowerCase();
                const badge = st === "active" ? "Active" : st === "suspended" ? "Suspendue" : st === "archived" ? "Archivée" : st;

                return (
                  <div key={o.id} style={ui.orgCard}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: -0.3, minWidth: 0 }}>
                          {o.name}
                        </div>
                        <span style={ui.badge}>{o.slug}</span>
                        <span style={ui.badgeSoft}>{badge}</span>
                        {o.sport ? <span style={ui.badgeSoft}>🏷 {o.sport}</span> : null}
                      </div>

                      <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 12 }}>
                        Rôle : <b>{r.role || (isSuperAdmin ? "super_admin" : "member")}</b>
                        {st !== "active" ? (
                          <span style={{ marginLeft: 10 }}>
                            • org en mode {st === "archived" ? "read-only" : "restreint"}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <button
                        style={ui.btnPrimary}
                        onClick={() => openOperator(o.slug)}
                        title="Ouvrir cette organisation dans Operator"
                      >
                        Ouvrir
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: 14, color: "var(--muted)", fontSize: 12 }}>
            Astuce : si tu veux toujours voir l’écran login → <code style={ui.code}>?forceLogin=1</code>
          </div>
        </div>
      </div>
    </Shell>
  );
}

/* ---------------- UI Components ---------------- */

function uiErrorBox(msg: string) {
  return (
    <div>
      <div style={{ fontWeight: 900, color: "var(--danger)" }}>Erreur</div>
      <div style={{ marginTop: 6 }}>{msg}</div>
      <div style={{ marginTop: 8, color: "var(--muted)", fontSize: 12 }}>
        Vérifie notamment que la requête utilise bien <code style={ui.code}>sport</code> (pas org_sport).
      </div>
    </div>
  );
}

function TopBar(props: {
  theme: "dark" | "light";
  toggleTheme: () => void;
  isSuperAdmin: boolean;
  openAdmin: () => void;
  openDisplay: () => void;
  sessionEmail: string | null;
  logout: () => void;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.5 }}>scoreDisplay</div>
        {props.sessionEmail ? (
          <div style={{ color: "var(--muted)", fontSize: 13 }}>
            connecté : <b style={{ color: "var(--text)" }}>{props.sessionEmail}</b>
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button style={ui.btn} onClick={props.toggleTheme}>
          {props.theme === "dark" ? "☀️ Clair" : "🌙 Sombre"}
        </button>

        <button style={ui.btn} onClick={props.openDisplay} title="Ouvrir Display (redirige)">
          🖥 Display
        </button>

        {props.isSuperAdmin ? (
          <button style={ui.btnPrimary} onClick={props.openAdmin} title="Ouvrir la console Super Admin">
            🛡 Admin
          </button>
        ) : null}

        {props.sessionEmail ? (
          <button style={ui.btn} onClick={props.logout}>
            Se déconnecter
          </button>
        ) : null}
      </div>
    </div>
  );
}

function KPI(props: { title: string; value: any; sub?: string }) {
  return (
    <div style={ui.kpi}>
      <div style={{ color: "var(--muted)", fontSize: 12 }}>{props.title}</div>
      <div style={{ fontSize: 26, fontWeight: 950, letterSpacing: -0.6, marginTop: 4 }}>{props.value}</div>
      {props.sub ? <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>{props.sub}</div> : null}
    </div>
  );
}

function Shell(props: { theme: "dark" | "light"; children: React.ReactNode }) {
  // Variables CSS simples (pas de fichier css nécessaire)
  const isDark = props.theme === "dark";
  const bg = isDark ? "#0b0d12" : "#f6f7fb";
  const card = isDark ? "#0f141b" : "#ffffff";
  const text = isDark ? "#e5e7eb" : "#0b1220";
  const muted = isDark ? "rgba(229,231,235,.7)" : "rgba(11,18,32,.65)";
  const border = isDark ? "#1f2a3a" : "#e5e7eb";
  const danger = "#ef4444";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: bg,
        color: text,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
      }}
    >
      <style>{`
        :root { --bg:${bg}; --card:${card}; --text:${text}; --muted:${muted}; --border:${border}; --danger:${danger}; }
        code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
      `}</style>
      {props.children}
    </div>
  );
}

/* ---------------- styles ---------------- */

const ui: Record<string, React.CSSProperties> = {
  hero: {
    background: "linear-gradient(180deg, rgba(59,130,246,.12), rgba(0,0,0,0))",
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: 16,
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
  },
  card: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: 16,
    boxShadow: "0 20px 60px rgba(0,0,0,.20)",
  },
  err: {
    color: "var(--danger)",
    fontWeight: 800,
    marginBottom: 10,
  },
  input: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text)",
    outline: "none",
  },
  select: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text)",
    outline: "none",
  },
  btn: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text)",
    cursor: "pointer",
    fontWeight: 800,
  },
  btnPrimary: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(59,130,246,.35)",
    background: "rgba(59,130,246,.18)",
    color: "var(--text)",
    cursor: "pointer",
    fontWeight: 900,
  },
  small: {
    color: "var(--muted)",
    fontSize: 12,
  },
  code: {
    padding: "2px 6px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "rgba(0,0,0,.18)",
  },
  kpis: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 12,
    marginTop: 14,
  },
  kpi: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: 14,
  },
  filters: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    marginTop: 14,
    flexWrap: "wrap",
  },
  orgCard: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: 14,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  badge: {
    fontSize: 12,
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid var(--border)",
    color: "var(--muted)",
  },
  badgeSoft: {
    fontSize: 12,
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,.25)",
    color: "var(--muted)",
    background: "rgba(148,163,184,.08)",
  },
};
