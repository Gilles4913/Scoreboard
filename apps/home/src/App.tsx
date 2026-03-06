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

type OrgMemberRow = {
  role: string | null;
  orgs: OrgRow | null;
};

type SessionTokens = {
  access_token: string;
  refresh_token: string;
};

const LS_THEME_KEY = "scoreDisplay.theme";

function getEnv(name: string) {
  const v = (import.meta as any).env?.[name];
  return typeof v === "string" ? v : "";
}

const ADMIN_URL = getEnv("VITE_ADMIN_URL");
const OPERATOR_URL = getEnv("VITE_OPERATOR_URL");
const DISPLAY_URL = getEnv("VITE_DISPLAY_URL");

function safeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

function getThemeFromStorage(): "dark" | "light" {
  const t = (localStorage.getItem(LS_THEME_KEY) || "dark").toLowerCase();
  return t === "light" ? "light" : "dark";
}

function applyTheme(theme: "dark" | "light") {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(LS_THEME_KEY, theme);
}

function prettySport(s: string | null) {
  const v = (s || "").toLowerCase();
  if (v === "football") return "football";
  if (v === "basket") return "basket";
  if (v === "handball") return "handball";
  if (v === "rugby") return "rugby";
  if (v === "volleyball") return "volleyball";
  return v || "—";
}

function prettyStatus(s: string | null) {
  const v = (s || "active").toLowerCase();
  if (v === "active") return "Active";
  if (v === "suspended") return "Suspendue";
  if (v === "archived") return "Archivée";
  return v;
}

function statusDot(s: string | null) {
  const v = (s || "active").toLowerCase();
  if (v === "active") return "🟢";
  if (v === "suspended") return "🟠";
  if (v === "archived") return "⚫";
  return "⚪";
}

function buildHashSession(tokens: SessionTokens) {
  return new URLSearchParams({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_type: "bearer",
  }).toString();
}

async function redirectWithSession(baseUrl: string, path: string) {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session) {
    window.location.href = `${window.location.origin}/?forceLogin=1`;
    return;
  }

  const tokens: SessionTokens = {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  };

  const hash = buildHashSession(tokens);
  const url = `${safeBaseUrl(baseUrl)}${path}#${hash}`;
  window.location.href = url;
}

async function checkSuperAdmin(userId: string) {
  const tryArgs = [{ p_uid: userId }, { p_user: userId }, { user_id: userId }];

  for (const args of tryArgs) {
    try {
      const { data, error } = await supabase.rpc("is_super_admin", args);
      if (!error) return !!data;
    } catch {
      // continue
    }
  }

  return false;
}

export default function App() {
  const [theme, setTheme] = useState<"dark" | "light">(getThemeFromStorage());

  const [booting, setBooting] = useState(true);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [orgRows, setOrgRows] = useState<Array<{ org: OrgRow; role: string | null }>>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("orgadmin@demo.local");
  const [password, setPassword] = useState("admin123");
  const [loggingIn, setLoggingIn] = useState(false);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "all" | "suspended" | "archived">("active");
  const [sportFilter, setSportFilter] = useState<string>("all");

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const forceLogin = useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("forceLogin") === "1";
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setBooting(true);
      setError(null);

      if (forceLogin) {
        await supabase.auth.signOut().catch(() => {});
      }

      const { data } = await supabase.auth.getSession();
      const user = data.session?.user || null;

      if (!user) {
        if (!cancelled) {
          setSessionEmail(null);
          setIsSuperAdmin(false);
          setOrgRows([]);
          setBooting(false);
        }
        return;
      }

      const sa = await checkSuperAdmin(user.id);

      if (!cancelled) {
        setSessionEmail(user.email || "");
        setIsSuperAdmin(sa);
      }

      await loadOrgs(user.id, sa);

      if (!cancelled) setBooting(false);
    }

    async function loadOrgs(userId: string, sa: boolean) {
      setLoadingOrgs(true);
      setError(null);

      try {
        if (sa) {
          const { data, error } = await supabase
            .from("orgs")
            .select("id,slug,name,status,sport")
            .order("name", { ascending: true });

          if (error) throw error;

          const rows = ((data || []) as OrgRow[]).map((o) => ({
            org: o,
            role: "super_admin",
          }));

          setOrgRows(rows);
        } else {
          const { data, error } = await supabase
            .from("org_members")
            .select("role, orgs(id,slug,name,status,sport)")
            .eq("user_id", userId);

          if (error) throw error;

          const rows = ((data || []) as any[])
            .filter((r) => r.orgs)
            .map((r) => ({
              role: r.role || "member",
              org: r.orgs as OrgRow,
            }));

          setOrgRows(rows);
        }
      } catch (e: any) {
        setOrgRows([]);
        setError(e?.message || "Erreur lors du chargement des organisations.");
      } finally {
        setLoadingOrgs(false);
      }
    }

    bootstrap();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user?.email || null);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [forceLogin]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return orgRows
      .filter((r) => {
        const st = (r.org.status || "active").toLowerCase();
        const sp = (r.org.sport || "").toLowerCase();

        if (statusFilter !== "all" && st !== statusFilter) return false;
        if (sportFilter !== "all" && sp !== sportFilter) return false;

        if (!qq) return true;

        const hay = `${r.org.slug} ${r.org.name || ""} ${r.role || ""} ${sp}`.toLowerCase();
        return hay.includes(qq);
      })
      .sort((a, b) => (a.org.name || "").localeCompare(b.org.name || ""));
  }, [orgRows, q, statusFilter, sportFilter]);

  const stats = useMemo(() => {
    const total = orgRows.length;
    const active = orgRows.filter((r) => (r.org.status || "active") === "active").length;
    const suspended = orgRows.filter((r) => r.org.status === "suspended").length;
    const archived = orgRows.filter((r) => r.org.status === "archived").length;

    return { total, active, suspended, archived };
  }, [orgRows]);

  const sports = useMemo(() => {
    const set = new Set<string>();
    for (const r of orgRows) {
      const s = (r.org.sport || "").trim();
      if (s) set.add(s);
    }
    return Array.from(set).sort();
  }, [orgRows]);

  async function doLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoggingIn(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      window.location.href = `${window.location.origin}/`;
    } catch (e: any) {
      setError(e?.message || "Erreur de connexion.");
    } finally {
      setLoggingIn(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = `${window.location.origin}/?forceLogin=1`;
  }

  async function openOperator(org: OrgRow) {
    setError(null);

    if (!OPERATOR_URL) {
      setError("VITE_OPERATOR_URL non configurée.");
      return;
    }

    // on stocke aussi l’org localement pour sécuriser le flux
    localStorage.setItem("scoreDisplay.activeOrgId", org.id);
    localStorage.setItem("scoreDisplay.activeOrgSlug", org.slug);

    await redirectWithSession(OPERATOR_URL, `/?org=${encodeURIComponent(org.slug)}`);
  }

  async function openAdmin() {
    setError(null);

    if (!ADMIN_URL) {
      setError("VITE_ADMIN_URL non configurée.");
      return;
    }

    await redirectWithSession(ADMIN_URL, `/`);
  }

  function openDisplay() {
    if (!DISPLAY_URL) {
      setError("VITE_DISPLAY_URL non configurée.");
      return;
    }
    window.open(DISPLAY_URL, "_blank", "noopener,noreferrer");
  }

  const dark = theme === "dark";
  const colors = {
    bg: dark ? "#070b10" : "#f6f8fb",
    text: dark ? "#e8eef8" : "#0f172a",
    muted: dark ? "rgba(232,238,248,.70)" : "rgba(15,23,42,.64)",
    card: dark ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.90)",
    border: dark ? "rgba(255,255,255,.10)" : "rgba(15,23,42,.10)",
    primary: "#2563eb",
    danger: "#dc2626",
  };

  if (booting) {
    return (
      <div style={{ minHeight: "100vh", background: colors.bg, color: colors.text, padding: 24, fontFamily: "system-ui" }}>
        Chargement…
      </div>
    );
  }

  if (!sessionEmail) {
    return (
      <div style={{ minHeight: "100vh", background: colors.bg, color: colors.text, padding: 24, fontFamily: "system-ui" }}>
        <div style={{ maxWidth: 1050, margin: "0 auto" }}>
          <Header
            theme={theme}
            toggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            sessionEmail={null}
            onLogout={logout}
            onOpenDisplay={openDisplay}
            onOpenAdmin={undefined}
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
            <Card colors={colors}>
              <h2 style={{ marginTop: 0 }}>Connexion</h2>
              <p style={{ color: colors.muted, lineHeight: 1.5 }}>
                Connecte-toi pour accéder à tes organisations, puis ouvre directement l’espace Operator correspondant.
              </p>

              {error ? <ErrorBox msg={error} /> : null}

              <form onSubmit={doLogin} style={{ display: "grid", gap: 10, marginTop: 12 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: colors.muted }}>Email</span>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={inputStyle(colors)}
                  />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: colors.muted }}>Mot de passe</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={inputStyle(colors)}
                  />
                </label>

                <button type="submit" disabled={loggingIn} style={primaryButtonStyle()}>
                  {loggingIn ? "Connexion..." : "Se connecter"}
                </button>
              </form>
            </Card>

            <Card colors={colors}>
              <h2 style={{ marginTop: 0 }}>Mini mode d’emploi</h2>
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, color: colors.muted }}>
                <li><b>Organisation</b> = club, ville ou structure sportive.</li>
                <li><b>Operator</b> = gestion des matchs, score, temps, affichage public.</li>
                <li><b>Display</b> = écran TV / LED / stade.</li>
                <li><b>Admin</b> = gestion globale (super admin).</li>
              </ul>

              <div style={{ marginTop: 14, color: colors.muted, fontSize: 13 }}>
                Astuce : pour forcer la page login, ouvre{" "}
                <code style={codeStyle(colors)}>?forceLogin=1</code>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: colors.bg, color: colors.text, padding: 24, fontFamily: "system-ui" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <Header
          theme={theme}
          toggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          sessionEmail={sessionEmail}
          onLogout={logout}
          onOpenDisplay={openDisplay}
          onOpenAdmin={isSuperAdmin ? openAdmin : undefined}
        />

        {error ? (
          <div style={{ marginTop: 14 }}>
            <ErrorBox msg={error} />
          </div>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginTop: 16 }}>
          <StatCard title="Organisations" value={stats.total} sub={`actives ${stats.active} • suspendues ${stats.suspended} • archivées ${stats.archived}`} colors={colors} />
          <StatCard title="Sports" value={sports.length} sub={sports.length ? sports.join(" • ") : "—"} colors={colors} />
          <StatCard title="Rôle" value={isSuperAdmin ? "super_admin" : "membre"} sub={isSuperAdmin ? "accès global" : "accès à tes orgs"} colors={colors} />
        </div>

        <Card colors={colors} style={{ marginTop: 16 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Recherche org (slug / nom / sport / rôle)…"
              style={{ ...inputStyle(colors), flex: 1, minWidth: 240 }}
            />

            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} style={inputStyle(colors)}>
              <option value="active">Actives</option>
              <option value="suspended">Suspendues</option>
              <option value="archived">Archivées</option>
              <option value="all">Tous statuts</option>
            </select>

            <select value={sportFilter} onChange={(e) => setSportFilter(e.target.value)} style={inputStyle(colors)}>
              <option value="all">Tous sports</option>
              {sports.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <div style={{ fontSize: 12, color: colors.muted }}>{filtered.length} org(s)</div>
          </div>
        </Card>

        <div style={{ marginTop: 18 }}>
          <h2 style={{ margin: "0 0 10px" }}>Organisations</h2>

          {loadingOrgs ? (
            <Card colors={colors}>Chargement des organisations…</Card>
          ) : filtered.length === 0 ? (
            <Card colors={colors}>Aucune organisation.</Card>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {filtered.map((r) => (
                <Card key={r.org.id} colors={colors}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900 }}>{r.org.name || r.org.slug}</div>
                      <div style={{ marginTop: 4, fontSize: 13, color: colors.muted }}>
                        {r.org.slug} • {statusDot(r.org.status)} {prettyStatus(r.org.status)} • {prettySport(r.org.sport)} • rôle: {r.role || "member"}
                      </div>
                    </div>

                    <button onClick={() => openOperator(r.org)} style={primaryButtonStyle()}>
                      Ouvrir
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: 16, fontSize: 12, color: colors.muted }}>
          Astuce : pour forcer l’écran login → <code style={codeStyle(colors)}>https://scoreboard-home.vercel.app/?forceLogin=1</code>
        </div>
      </div>
    </div>
  );
}

function Header(props: {
  theme: "dark" | "light";
  toggleTheme: () => void;
  sessionEmail: string | null;
  onLogout: () => void;
  onOpenDisplay: () => void;
  onOpenAdmin?: () => void;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontSize: 34, fontWeight: 950, letterSpacing: -0.8 }}>scoreDisplay</div>
        {props.sessionEmail ? (
          <div style={{ marginTop: 4, fontSize: 13, opacity: 0.78 }}>
            connecté : <b>{props.sessionEmail}</b>
          </div>
        ) : (
          <div style={{ marginTop: 4, fontSize: 13, opacity: 0.78 }}>
            Hub d’accès — session persistée • forcer la page login : <code>?forceLogin=1</code>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={props.toggleTheme} style={buttonStyle()}>
          {props.theme === "dark" ? "☀️ Clair" : "🌙 Sombre"}
        </button>

        <button onClick={props.onOpenDisplay} style={buttonStyle()}>
          🖥️ Display
        </button>

        {props.onOpenAdmin ? (
          <button onClick={props.onOpenAdmin} style={primaryButtonStyle()}>
            🛡️ Admin
          </button>
        ) : null}

        {props.sessionEmail ? (
          <button onClick={props.onLogout} style={buttonStyle()}>
            Se déconnecter
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Card({
  children,
  colors,
  style,
}: {
  children: React.ReactNode;
  colors: { card: string; border: string };
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: 16,
        padding: 16,
        boxShadow: "0 18px 50px rgba(0,0,0,.10)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function StatCard({
  title,
  value,
  sub,
  colors,
}: {
  title: string;
  value: any;
  sub?: string;
  colors: { card: string; border: string; muted: string };
}) {
  return (
    <div
      style={{
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: 16,
        padding: 16,
        boxShadow: "0 18px 50px rgba(0,0,0,.10)",
      }}
    >
      <div style={{ fontSize: 12, color: colors.muted }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 28, fontWeight: 950, letterSpacing: -0.6 }}>{value}</div>
      {sub ? <div style={{ marginTop: 4, fontSize: 12, color: colors.muted }}>{sub}</div> : null}
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 14,
        background: "rgba(220,38,38,.12)",
        border: "1px solid rgba(220,38,38,.30)",
        color: "#ffb4b4",
      }}
    >
      <div style={{ fontWeight: 900 }}>Erreur</div>
      <div style={{ marginTop: 6 }}>{msg}</div>
    </div>
  );
}

function inputStyle(colors: { border: string; text: string }) {
  return {
    padding: "12px 14px",
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    background: "transparent",
    color: colors.text,
    outline: "none",
  } as React.CSSProperties;
}

function buttonStyle() {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.14)",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
    fontWeight: 800,
  } as React.CSSProperties;
}

function primaryButtonStyle() {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(37,99,235,.40)",
    background: "rgba(37,99,235,.18)",
    color: "inherit",
    cursor: "pointer",
    fontWeight: 900,
  } as React.CSSProperties;
}

function codeStyle(colors: { border: string }) {
  return {
    padding: "2px 6px",
    borderRadius: 8,
    border: `1px solid ${colors.border}`,
    background: "rgba(0,0,0,.12)",
  } as React.CSSProperties;
}
