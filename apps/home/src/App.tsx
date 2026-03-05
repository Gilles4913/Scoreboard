import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

/**
 * Home = Hub
 * - Login
 * - Liste des organisations accessibles (via org_members)
 * - Choix org -> redirection Operator (par défaut), avec session propagée dans l'URL
 * - ?forceLogin=1 pour forcer l’écran login même si session persistée
 */

type OrgRole = "super_admin" | "org_admin" | "operator" | "viewer" | string;

type OrgRow = {
  id: string;
  slug: string;
  name: string | null;
  status: string | null; // active | suspended | archived ... (selon ta DB)
  sport: string | null;  // football | basket | ...
};

type OrgMembershipRow = {
  role: OrgRole;
  orgs: OrgRow | null; // join
};

function getEnv(name: string) {
  const v = (import.meta as any).env?.[name];
  return typeof v === "string" ? v : "";
}

const ADMIN_URL = getEnv("VITE_ADMIN_URL").replace(/\/$/, "");
const OPERATOR_URL = getEnv("VITE_OPERATOR_URL").replace(/\/$/, "");
const DISPLAY_URL = getEnv("VITE_DISPLAY_URL").replace(/\/$/, ""); // optionnel ici

const LS_ACTIVE_ORG_KEY = "scoreDisplay.activeOrgSlug";
const LS_THEME_KEY = "scoreDisplay.theme"; // light|dark

function isTruthy(s: string) {
  return !!s && s.trim().length > 0;
}

function parseBoolParam(v: string | null) {
  if (!v) return false;
  return v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "yes";
}

function sanitizeReturnTo(url: string) {
  // On limite volontairement : soit vide, soit URL https (évite open redirect)
  try {
    const u = new URL(url);
    if (u.protocol === "https:" || u.protocol === "http:") return u.toString();
  } catch {}
  return "";
}

/**
 * Propage la session Supabase vers une autre app
 * URL cible: `${baseUrl}${path}#access_token=...&refresh_token=...`
 */
async function redirectWithSession(baseUrl: string, path: string) {
  if (!isTruthy(baseUrl)) {
    alert("URL cible manquante (VITE_OPERATOR_URL / VITE_ADMIN_URL).");
    return;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    // pas de session => retour login
    window.location.href = `${window.location.origin}/?forceLogin=1`;
    return;
  }

  const access_token = data.session.access_token;
  const refresh_token = data.session.refresh_token;

  // IMPORTANT: on met les tokens dans le hash (pas envoyés au serveur)
  const hash = `#access_token=${encodeURIComponent(access_token)}&refresh_token=${encodeURIComponent(refresh_token)}`;

  const url = `${baseUrl}${path}${hash}`;
  window.location.href = url;
}

function prettySport(sport: string | null) {
  if (!sport) return "—";
  const m: Record<string, string> = {
    football: "Football",
    basket: "Basket",
    basketball: "Basket",
    volleyball: "Volley",
    volley: "Volley",
    handball: "Handball",
    rugby: "Rugby",
  };
  return m[sport] || sport;
}

function statusLabel(status: string | null) {
  const s = (status || "active").toLowerCase();
  if (s === "archived") return "Archivée";
  if (s === "suspended") return "Suspendue";
  return "Active";
}

function statusDot(status: string | null) {
  const s = (status || "active").toLowerCase();
  if (s === "archived") return "⚪";
  if (s === "suspended") return "🟠";
  return "🟢";
}

export default function App() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const v = (localStorage.getItem(LS_THEME_KEY) || "").toLowerCase();
    return v === "light" ? "light" : "dark";
  });

  const [booting, setBooting] = useState(true);
  const [forcingLogin, setForcingLogin] = useState(false);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [orgs, setOrgs] = useState<Array<{ role: OrgRole; org: OrgRow }>>([]);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "all" | "archived" | "suspended">("active");
  const [sportFilter, setSportFilter] = useState<string>("all");

  const bg = theme === "dark" ? "#0b0f14" : "#f4f6f8";
  const fg = theme === "dark" ? "#e8edf2" : "#0d1620";
  const card = theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
  const border = theme === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)";

  useEffect(() => {
    document.documentElement.style.background = bg;
    document.body.style.background = bg;
    document.body.style.color = fg;
  }, [bg, fg]);

  useEffect(() => {
    localStorage.setItem(LS_THEME_KEY, theme);
  }, [theme]);

  const forceLogin = useMemo(() => {
    const sp = new URLSearchParams(window.location.search);
    return parseBoolParam(sp.get("forceLogin"));
  }, []);

  const returnTo = useMemo(() => {
    const sp = new URLSearchParams(window.location.search);
    return sanitizeReturnTo(sp.get("returnTo") || "");
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setBooting(true);
      setErr("");

      // Écoute auth
      const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
        if (cancelled) return;
        setUserEmail(session?.user?.email || null);
      });

      // session au boot
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (cancelled) return;

      // force login même si session existe
      if (forceLogin) {
        setForcingLogin(true);
        await supabase.auth.signOut();
        setForcingLogin(false);
        setUserEmail(null);
        setIsSuperAdmin(false);
        setOrgs([]);
        setBooting(false);
        return;
      }

      if (!session?.user) {
        setUserEmail(null);
        setIsSuperAdmin(false);
        setOrgs([]);
        setBooting(false);
        return;
      }

      setUserEmail(session.user.email || null);

      // check super_admin via RPC (si tu l’as) sinon via org_members role sur master
      // Ici on tente RPC is_super_admin si elle existe.
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc("is_super_admin");
        if (!rpcErr) setIsSuperAdmin(!!rpcData);
      } catch {
        // ignore
      }

      // charge orgs
      await loadOrgs();

      // si on vient d’un returnTo (ex: admin demande login via home)
      if (returnTo) {
        window.location.href = returnTo;
        return;
      }

      setBooting(false);

      sub?.subscription?.unsubscribe?.();
    }

    async function loadOrgs() {
      setLoadingOrgs(true);
      setErr("");

      // IMPORTANT: ne pas sélectionner org_sport (colonne inexistante)
      const { data, error } = await supabase
        .from("org_members")
        .select("role, orgs(id,slug,name,status,sport)")
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        setErr(error.message);
        setOrgs([]);
        setLoadingOrgs(false);
        return;
      }

      const rows = (data || []) as unknown as OrgMembershipRow[];
      const cleaned = rows
        .map((r) => ({ role: r.role, org: r.orgs }))
        .filter((x): x is { role: OrgRole; org: OrgRow } => !!x.org)
        .map((x) => ({ role: x.role, org: x.org }));

      setOrgs(cleaned);
      setLoadingOrgs(false);
    }

    init();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return orgs.filter(({ org }) => {
      const st = (org.status || "active").toLowerCase();

      if (statusFilter === "active" && (st === "archived" || st === "suspended")) return false;
      if (statusFilter === "archived" && st !== "archived") return false;
      if (statusFilter === "suspended" && st !== "suspended") return false;

      if (sportFilter !== "all") {
        const sp = (org.sport || "").toLowerCase();
        if (sp !== sportFilter) return false;
      }

      if (!qq) return true;

      const name = (org.name || "").toLowerCase();
      const slug = (org.slug || "").toLowerCase();
      return name.includes(qq) || slug.includes(qq);
    });
  }, [orgs, q, statusFilter, sportFilter]);

  async function doLogin(email: string, password: string) {
    setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setErr(error.message);
      return;
    }
    // rechargement orgs
    setBooting(true);
    window.location.href = window.location.origin; // nettoie query params
  }

  async function logout() {
    await supabase.auth.signOut();
    localStorage.removeItem(LS_ACTIVE_ORG_KEY);
    window.location.href = `${window.location.origin}/?forceLogin=1`;
  }

  async function openOrgAsOperator(orgSlug: string) {
    console.log("[HOME] click Ouvrir org:", orgSlug);
    localStorage.setItem(LS_ACTIVE_ORG_KEY, orgSlug);

    // path côté operator
    const path = `/?org=${encodeURIComponent(orgSlug)}`;
    await redirectWithSession(OPERATOR_URL, path);
  }

  async function openAdminConsole() {
    console.log("[HOME] open admin console");
    await redirectWithSession(ADMIN_URL, `/`);
  }

  // -------- UI --------

  if (booting) {
    return <div style={{ padding: 24, fontFamily: "system-ui" }}>Chargement…</div>;
  }

  // Pas connecté => login
  if (!userEmail) {
    return (
      <div style={{ padding: 24, maxWidth: 520, fontFamily: "system-ui" }}>
        <h1 style={{ margin: 0, fontWeight: 900 }}>scoreDisplay</h1>
        <div style={{ opacity: 0.8, marginTop: 6 }}>Connexion</div>

        <div style={{ marginTop: 18, border: `1px solid ${border}`, background: card, borderRadius: 12, padding: 16 }}>
          <LoginForm onLogin={doLogin} loading={forcingLogin} />
          {err ? <div style={{ color: "crimson", marginTop: 12 }}>{err}</div> : null}
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
            Astuce : forcer l’écran login → <code>?forceLogin=1</code>
          </div>
        </div>
      </div>
    );
  }

  // Connecté => org picker
  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 1100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontWeight: 900 }}>scoreDisplay</h1>
          <div style={{ opacity: 0.8, marginTop: 6 }}>connecté : {userEmail}</div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: `1px solid ${border}`,
              background: card,
              color: fg,
              cursor: "pointer",
            }}
          >
            {theme === "dark" ? "☀️ Clair" : "🌙 Sombre"}
          </button>

          {isSuperAdmin && isTruthy(ADMIN_URL) ? (
            <button
              onClick={openAdminConsole}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: `1px solid ${border}`,
                background: card,
                color: fg,
                cursor: "pointer",
              }}
            >
              🛠️ Admin
            </button>
          ) : null}

          <button
            onClick={logout}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: `1px solid ${border}`,
              background: card,
              color: fg,
              cursor: "pointer",
            }}
          >
            Se déconnecter
          </button>
        </div>
      </div>

      <div style={{ marginTop: 18, border: `1px solid ${border}`, background: card, borderRadius: 14, padding: 14 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Recherche org (slug / nom)…"
            style={{
              flex: "1 1 260px",
              minWidth: 220,
              padding: "10px 12px",
              borderRadius: 10,
              border: `1px solid ${border}`,
              background: theme === "dark" ? "#0e141c" : "#fff",
              color: fg,
              outline: "none",
            }}
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: `1px solid ${border}`,
              background: theme === "dark" ? "#0e141c" : "#fff",
              color: fg,
            }}
          >
            <option value="active">Actives</option>
            <option value="all">Toutes</option>
            <option value="suspended">Suspendues</option>
            <option value="archived">Archivées</option>
          </select>

          <select
            value={sportFilter}
            onChange={(e) => setSportFilter(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: `1px solid ${border}`,
              background: theme === "dark" ? "#0e141c" : "#fff",
              color: fg,
            }}
          >
            <option value="all">Tous sports</option>
            <option value="football">Football</option>
            <option value="basket">Basket</option>
            <option value="handball">Handball</option>
            <option value="rugby">Rugby</option>
            <option value="volleyball">Volley</option>
          </select>

          <div style={{ marginLeft: "auto", opacity: 0.75, fontSize: 12 }}>
            {loadingOrgs ? "Chargement…" : `${filtered.length} org(s)`}
          </div>
        </div>

        {err ? <div style={{ color: "crimson", marginTop: 12 }}>{err}</div> : null}

        <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
          {filtered.map(({ role, org }) => {
            const st = (org.status || "active").toLowerCase();
            const isReadOnly = st === "archived" || st === "suspended";

            return (
              <div
                key={org.id}
                style={{
                  border: `1px solid ${border}`,
                  borderRadius: 14,
                  padding: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  background: theme === "dark" ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.6)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {org.name || org.slug}
                  </div>
                  <div style={{ opacity: 0.75, fontSize: 12, marginTop: 3 }}>
                    {org.slug} • {statusDot(org.status)} {statusLabel(org.status)} • {prettySport(org.sport)} • rôle: {role}
                    {isReadOnly ? " • read-only" : ""}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => openOrgAsOperator(org.slug)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 10,
                      border: `1px solid ${border}`,
                      background: theme === "dark" ? "#182230" : "#ffffff",
                      color: fg,
                      cursor: "pointer",
                      pointerEvents: "auto",
                    }}
                    title="Ouvrir l’interface Operator sur cette organisation"
                  >
                    Ouvrir
                  </button>

                  {isTruthy(DISPLAY_URL) ? (
                    <a
                      href={DISPLAY_URL}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 12, opacity: 0.8 }}
                      title="Ouvrir l’app Display (le match se choisit via token/matchId)"
                    >
                      Display
                    </a>
                  ) : null}
                </div>
              </div>
            );
          })}

          {!loadingOrgs && filtered.length === 0 ? (
            <div style={{ opacity: 0.7, padding: 8 }}>Aucune organisation.</div>
          ) : null}
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
        Astuce : forcer l’écran login → <code>?forceLogin=1</code>
      </div>
    </div>
  );
}

function LoginForm(props: { onLogin: (email: string, password: string) => void; loading: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        props.onLogin(email.trim(), password);
      }}
    >
      <label style={{ display: "block", fontSize: 12, opacity: 0.8 }}>Email</label>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email"
        style={{ width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 10, border: "1px solid #9996" }}
        autoComplete="email"
      />

      <label style={{ display: "block", fontSize: 12, opacity: 0.8, marginTop: 12 }}>Mot de passe</label>
      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="password"
        type="password"
        style={{ width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 10, border: "1px solid #9996" }}
        autoComplete="current-password"
      />

      <button
        type="submit"
        disabled={props.loading}
        style={{
          marginTop: 14,
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid #9996",
          cursor: "pointer",
          fontWeight: 800,
        }}
      >
        Se connecter
      </button>
    </form>
  );
}
