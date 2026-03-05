import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

type OrgMemberRow = {
  role: string;
  orgs: {
    id: string;
    slug: string;
    name: string;
    status: string | null;
    sport?: string | null; // selon DB
    org_sport?: string | null; // selon DB historique
  } | null;
};

type OrgView = {
  id: string;
  slug: string;
  name: string;
  status: string | null;
  sport: string | null;
  role: string;
  stats?: {
    scheduledMatches: number;
    publicDisplays: number;
  };
};

type ThemeMode = "dark" | "light";

const LS_THEME_KEY = "scoreDisplay.theme";
const LS_FORCE_LOGIN_HINT = "scoreDisplay.forceLoginHint"; // juste pour UX

function getEnv(name: string) {
  const v = (import.meta as any).env?.[name];
  return typeof v === "string" ? v : "";
}

const SUPABASE_URL = getEnv("VITE_SUPABASE_URL");
const SUPABASE_ANON_KEY = getEnv("VITE_SUPABASE_ANON_KEY");

const OPERATOR_URL = getEnv("VITE_OPERATOR_URL"); // https://scoreboard-operator.vercel.app/
const ADMIN_URL = getEnv("VITE_ADMIN_URL"); // https://scoreboard-admin-swart.vercel.app/
const DISPLAY_URL = getEnv("VITE_DISPLAY_URL"); // https://scoreboard-display-pi.vercel.app/ (optionnel ici)

function isForceLogin() {
  try {
    const u = new URL(window.location.href);
    return u.searchParams.get("forceLogin") === "1";
  } catch {
    return false;
  }
}

function normalizeSport(o: { sport?: string | null; sport?: string | null }) {
  return (o.sport || o.org_sport || null) as string | null;
}

function prettyStatus(s: string | null) {
  if (!s) return "active";
  return s;
}

function statusColor(s: string | null) {
  const v = (s || "active").toLowerCase();
  if (v === "active") return "#2ecc71";
  if (v === "suspended") return "#f39c12";
  if (v === "archived") return "#95a5a6";
  return "#3498db";
}

function safeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

/**
 * ⚠️ Session transfer cross-domain:
 * - Home récupère access_token/refresh_token
 * - Ouvre Operator/Admin avec tokens dans le hash (#) pour éviter logs serveur
 * - Operator/Admin doivent lire le hash, faire supabase.auth.setSession(), puis nettoyer l’URL.
 */
function buildSessionTransferUrl(baseUrl: string, payload: Record<string, string>) {
  const b = safeBaseUrl(baseUrl || "");
  const hash = new URLSearchParams(payload).toString();
  return `${b}/#${hash}`;
}

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const v = (localStorage.getItem(LS_THEME_KEY) || "dark") as ThemeMode;
    return v === "light" ? "light" : "dark";
  });

  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);

  const [sessionEmail, setSessionEmail] = useState<string>("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [orgsLoading, setOrgsLoading] = useState(false);
  const [orgs, setOrgs] = useState<OrgView[]>([]);
  const [error, setError] = useState<string>("");

  // login form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // filters
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "all" | "suspended" | "archived">("active");
  const [sportFilter, setSportFilter] = useState<string>("all");

  const forceLogin = useMemo(() => isForceLogin(), []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(LS_THEME_KEY, theme);
  }, [theme]);

  // Auth bootstrap
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setError("");
      setLoading(true);
      setAuthLoading(true);

      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        setError("Variables d’environnement manquantes: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY");
        setLoading(false);
        setAuthLoading(false);
        return;
      }

      // Si ?forceLogin=1, on log out proprement + on affiche la page login.
      if (forceLogin) {
        try {
          localStorage.setItem(LS_FORCE_LOGIN_HINT, "1");
          await supabase.auth.signOut();
        } catch {}
      }

      const { data } = await supabase.auth.getSession();
      if (cancelled) return;

      const sess = data.session;
      if (!sess) {
        setSessionEmail("");
        setIsSuperAdmin(false);
        setAuthLoading(false);
        setLoading(false);
        return;
      }

      setSessionEmail(sess.user.email || "");

      // check super_admin via RPC (tu as déjà is_super_admin(uuid))
      try {
        const { data: rpc, error: rpcErr } = await supabase.rpc("is_super_admin", { p_uid: sess.user.id });
        if (!cancelled) setIsSuperAdmin(!rpcErr && rpc === true);
      } catch {
        if (!cancelled) setIsSuperAdmin(false);
      }

      setAuthLoading(false);
      setLoading(false);
    }

    boot();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (!session) {
        setSessionEmail("");
        setIsSuperAdmin(false);
        setOrgs([]);
      } else {
        setSessionEmail(session.user.email || "");
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [forceLogin]);

  // Load orgs when logged in
  useEffect(() => {
    let cancelled = false;

    async function loadOrgs() {
      setError("");
      setOrgsLoading(true);

      const { data: sessData } = await supabase.auth.getSession();
      const sess = sessData.session;
      if (!sess) {
        setOrgs([]);
        setOrgsLoading(false);
        return;
      }

      // org_members -> orgs join
      const sel = "role, orgs(id,slug,name,status,sport)";
      const { data, error: e } = await supabase
        .from("org_members")
        .select(sel)
        .eq("user_id", sess.user.id);

      if (cancelled) return;

      if (e) {
        setError(e.message);
        setOrgs([]);
        setOrgsLoading(false);
        return;
      }

      const rows = (data || []) as OrgMemberRow[];
      const mapped: OrgView[] = rows
        .filter((r) => r.orgs)
        .map((r) => ({
          id: r.orgs!.id,
          slug: r.orgs!.slug,
          name: r.orgs!.name,
          status: r.orgs!.status,
          sport: normalizeSport(r.orgs!),
          role: r.role,
        }));

      setOrgs(mapped);
      setOrgsLoading(false);

      // Mini-stats (dev-friendly): on récupère des matches pour ces org_id et on calcule en client
      // (OK car peu d’orgs; si ça grossit → on fera une view/RPC agrégée)
      const orgIds = mapped.map((x) => x.id);
      if (orgIds.length === 0) return;

      const { data: matches, error: mErr } = await supabase
        .from("matches")
        .select("id, org_id, status, public_display")
        .in("org_id", orgIds);

      if (cancelled) return;
      if (mErr) return; // stats optionnelles, on ne bloque pas

      const byOrg: Record<string, { scheduledMatches: number; publicDisplays: number }> = {};
      for (const oid of orgIds) byOrg[oid] = { scheduledMatches: 0, publicDisplays: 0 };

      for (const m of (matches as any[]) || []) {
        const oid = String(m.org_id || "");
        if (!byOrg[oid]) continue;
        if ((m.status || "scheduled") === "scheduled") byOrg[oid].scheduledMatches += 1;
        if (m.public_display === true) byOrg[oid].publicDisplays += 1;
      }

      setOrgs((prev) =>
        prev.map((o) => ({
          ...o,
          stats: byOrg[o.id] || { scheduledMatches: 0, publicDisplays: 0 },
        }))
      );
    }

    if (!authLoading && sessionEmail) loadOrgs();

    return () => {
      cancelled = true;
    };
  }, [authLoading, sessionEmail]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return orgs.filter((o) => {
      const st = (o.status || "active").toLowerCase();
      const sp = (o.sport || "").toLowerCase();

      if (statusFilter !== "all" && st !== statusFilter) return false;
      if (sportFilter !== "all" && sp !== sportFilter) return false;

      if (!qq) return true;
      return (
        o.name.toLowerCase().includes(qq) ||
        o.slug.toLowerCase().includes(qq) ||
        sp.includes(qq) ||
        o.role.toLowerCase().includes(qq)
      );
    });
  }, [orgs, q, statusFilter, sportFilter]);

  const globalStats = useMemo(() => {
    const total = orgs.length;
    const active = orgs.filter((o) => (o.status || "active") === "active").length;
    const suspended = orgs.filter((o) => (o.status || "") === "suspended").length;
    const archived = orgs.filter((o) => (o.status || "") === "archived").length;

    const scheduledMatches = orgs.reduce((acc, o) => acc + (o.stats?.scheduledMatches || 0), 0);
    const publicDisplays = orgs.reduce((acc, o) => acc + (o.stats?.publicDisplays || 0), 0);

    return { total, active, suspended, archived, scheduledMatches, publicDisplays };
  }, [orgs]);

  async function doLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const em = email.trim();
    if (!em || !password) {
      setError("Email et mot de passe requis.");
      return;
    }

    const { error: err } = await supabase.auth.signInWithPassword({ email: em, password });
    if (err) {
      setError(err.message);
      return;
    }

    // recharge la page pour repartir proprement (et enlever forceLogin si présent)
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete("forceLogin");
      window.location.href = u.toString();
    } catch {
      window.location.reload();
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.reload();
  }

  function toggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  async function openOperator(orgSlug: string) {
    setError("");

    if (!OPERATOR_URL) {
      setError("VITE_OPERATOR_URL manquant dans les variables d’environnement de Home.");
      return;
    }

    const { data } = await supabase.auth.getSession();
    const sess = data.session;
    if (!sess) {
      setError("Session expirée. Reconnecte-toi.");
      return;
    }

    const url = buildSessionTransferUrl(OPERATOR_URL, {
      org: orgSlug,
      access_token: sess.access_token,
      refresh_token: sess.refresh_token,
      from: "home",
    });

    // même onglet (conseillé pour démo)
    window.location.href = url;
  }

  async function openAdmin() {
    setError("");
    if (!ADMIN_URL) {
      setError("VITE_ADMIN_URL manquant dans les variables d’environnement de Home.");
      return;
    }
    const { data } = await supabase.auth.getSession();
    const sess = data.session;
    if (!sess) {
      setError("Session expirée. Reconnecte-toi.");
      return;
    }
    const url = buildSessionTransferUrl(ADMIN_URL, {
      access_token: sess.access_token,
      refresh_token: sess.refresh_token,
      from: "home",
    });
    window.location.href = url;
  }

  const ui = useMemo(() => {
    const dark = theme === "dark";
    return {
      page: {
        minHeight: "100vh",
        background: dark ? "#0b0f14" : "#f6f7fb",
        color: dark ? "#eef2ff" : "#0b0f14",
        padding: 24,
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji",
      } as React.CSSProperties,
      card: {
        background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
        border: dark ? "1px solid rgba(255,255,255,0.10)" : "1px solid rgba(0,0,0,0.08)",
        borderRadius: 16,
        padding: 16,
        boxShadow: dark ? "0 10px 30px rgba(0,0,0,0.35)" : "0 10px 30px rgba(0,0,0,0.08)",
      } as React.CSSProperties,
      input: {
        borderRadius: 12,
        border: dark ? "1px solid rgba(255,255,255,0.18)" : "1px solid rgba(0,0,0,0.14)",
        background: dark ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.9)",
        color: dark ? "#eef2ff" : "#0b0f14",
        padding: "10px 12px",
        outline: "none",
      } as React.CSSProperties,
      btn: {
        borderRadius: 12,
        border: dark ? "1px solid rgba(255,255,255,0.18)" : "1px solid rgba(0,0,0,0.14)",
        background: dark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.9)",
        color: dark ? "#eef2ff" : "#0b0f14",
        padding: "10px 12px",
        cursor: "pointer",
        fontWeight: 700,
      } as React.CSSProperties,
      btnPrimary: {
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "#3b82f6",
        color: "white",
        padding: "10px 12px",
        cursor: "pointer",
        fontWeight: 800,
      } as React.CSSProperties,
      small: { opacity: 0.8, fontSize: 12 } as React.CSSProperties,
    };
  }, [theme]);

  // --- RENDER
  if (loading) {
    return <div style={ui.page}>Chargement…</div>;
  }

  const showLogin = !sessionEmail;

  if (showLogin) {
    return (
      <div style={ui.page}>
        <div style={{ maxWidth: 520, margin: "6vh auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <h1 style={{ margin: 0 }}>scoreDisplay</h1>
            <button style={ui.btn} onClick={toggleTheme}>
              {theme === "dark" ? "☀️ Clair" : "🌙 Sombre"}
            </button>
          </div>

          <p style={{ marginTop: 8, opacity: 0.85 }}>
            Hub d’accès — session persistée • forcer la page login : <code>?forceLogin=1</code>
          </p>

          <div style={{ ...ui.card, marginTop: 18 }}>
            <h2 style={{ marginTop: 0 }}>Connexion</h2>

            {error ? (
              <div style={{ color: "#ef4444", marginBottom: 12, fontWeight: 700 }}>Erreur: {error}</div>
            ) : null}

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

              <button style={ui.btnPrimary} type="submit">
                Se connecter
              </button>

              <div style={ui.small}>
                Si tu restes bloqué sur une redirection, ouvre :{" "}
                <code>{safeBaseUrl(window.location.origin)}/?forceLogin=1</code>
              </div>
            </form>
          </div>

          <div style={{ ...ui.card, marginTop: 12 }}>
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
    );
  }

  // logged-in view
  return (
    <div style={ui.page}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>scoreDisplay</h1>
          <div style={ui.small}>
            connecté : <b>{sessionEmail}</b>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button style={ui.btn} onClick={toggleTheme}>
            {theme === "dark" ? "☀️ Clair" : "🌙 Sombre"}
          </button>

          {isSuperAdmin ? (
            <button style={ui.btnPrimary} onClick={openAdmin} title="Ouvrir la console Super Admin">
              🛡️ Admin
            </button>
          ) : null}

          <button style={ui.btn} onClick={logout}>
            Se déconnecter
          </button>
        </div>
      </div>

      {error ? (
        <div style={{ ...ui.card, marginTop: 14, borderColor: "rgba(239,68,68,0.45)" }}>
          <div style={{ color: "#ef4444", fontWeight: 900 }}>Erreur</div>
          <div style={{ marginTop: 6 }}>{error}</div>
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginTop: 14 }}>
        <div style={ui.card}>
          <div style={ui.small}>Organisations</div>
          <div style={{ fontSize: 28, fontWeight: 900 }}>{globalStats.total}</div>
          <div style={ui.small}>
            actives {globalStats.active} • suspendues {globalStats.suspended} • archivées {globalStats.archived}
          </div>
        </div>
        <div style={ui.card}>
          <div style={ui.small}>Matchs (scheduled)</div>
          <div style={{ fontSize: 28, fontWeight: 900 }}>{globalStats.scheduledMatches}</div>
          <div style={ui.small}>préparation / à venir</div>
        </div>
        <div style={ui.card}>
          <div style={ui.small}>Displays publics</div>
          <div style={{ fontSize: 28, fontWeight: 900 }}>{globalStats.publicDisplays}</div>
          <div style={ui.small}>public_display = true</div>
        </div>
      </div>

      <div style={{ ...ui.card, marginTop: 14 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input
            style={{ ...ui.input, minWidth: 240, flex: 1 }}
            placeholder="Recherche org (slug / nom / sport / rôle)…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <select style={ui.input} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
            <option value="active">Actives</option>
            <option value="all">Tous statuts</option>
            <option value="suspended">Suspendues</option>
            <option value="archived">Archivées</option>
          </select>

          <select style={ui.input} value={sportFilter} onChange={(e) => setSportFilter(e.target.value)}>
            <option value="all">Tous sports</option>
            <option value="football">Football</option>
            <option value="basket">Basket</option>
            <option value="handball">Handball</option>
            <option value="volleyball">Volleyball</option>
            <option value="rugby">Rugby</option>
          </select>

          <div style={ui.small}>{filtered.length} org(s)</div>
        </div>
      </div>

      <h2 style={{ marginTop: 16, marginBottom: 10 }}>Organisations</h2>

      {orgsLoading ? (
        <div style={ui.card}>Chargement des organisations…</div>
      ) : filtered.length === 0 ? (
        <div style={ui.card}>Aucune organisation.</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {filtered.map((o) => {
            const st = prettyStatus(o.status);
            const sport = (o.sport || "—").toLowerCase();
            const sc = statusColor(o.status);
            const scheduled = o.stats?.scheduledMatches ?? 0;
            const pub = o.stats?.publicDisplays ?? 0;

            return (
              <div key={o.id} style={{ ...ui.card, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontSize: 18, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {o.name}
                    </div>
                    <span style={{ ...ui.small, padding: "3px 10px", borderRadius: 999, border: `1px solid ${sc}55` }}>
                      <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 999, background: sc, marginRight: 6 }} />
                      {st}
                    </span>
                    <span style={{ ...ui.small, padding: "3px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.18)" }}>
                      🏷️ {sport}
                    </span>
                    <span style={{ ...ui.small, padding: "3px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.18)" }}>
                      👤 {o.role}
                    </span>
                  </div>

                  <div style={{ ...ui.small, marginTop: 6 }}>
                    <span style={{ opacity: 0.85 }}>{o.slug}</span> •{" "}
                    <span>matchs à venir: <b>{scheduled}</b></span> •{" "}
                    <span>displays publics: <b>{pub}</b></span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button
                    style={ui.btnPrimary}
                    onClick={() => openOperator(o.slug)}
                    title="Ouvrir l’interface Operator sur cette organisation"
                  >
                    Ouvrir
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ ...ui.small, marginTop: 14 }}>
        Astuce : pour forcer l’écran login → <code>{safeBaseUrl(window.location.origin)}/?forceLogin=1</code>
      </div>
    </div>
  );
}
