import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

type MemberRow = {
  role: string | null;
  orgs: {
    id: string;
    slug: string;
    name: string | null;
    status: string | null;
    sport: string | null; // ✅ DB = orgs.sport
  } | null;
};

type OrgView = {
  id: string;
  slug: string;
  name: string;
  status: "active" | "suspended" | "archived" | "unknown";
  sport: string;
  role: string;
};

function getEnv(name: string): string {
  const v = (import.meta as any).env?.[name];
  return typeof v === "string" ? v : "";
}

function normalizeSport(s: any): string {
  const v = String(s || "").trim().toLowerCase();
  if (!v) return "unknown";
  // on garde les slugs existants côté DB
  if (["football", "basket", "handball", "volleyball", "rugby"].includes(v)) return v;
  return v;
}

function normalizeStatus(s: any): OrgView["status"] {
  const v = String(s || "").trim().toLowerCase();
  if (v === "active" || v === "suspended" || v === "archived") return v;
  return "unknown";
}

function labelSport(s: string) {
  switch (s) {
    case "football":
      return "football";
    case "basket":
      return "basket";
    case "handball":
      return "handball";
    case "volleyball":
      return "volleyball";
    case "rugby":
      return "rugby";
    default:
      return s || "unknown";
  }
}

function statusBadge(s: OrgView["status"]) {
  if (s === "active") return { text: "Active", dot: "🟢" };
  if (s === "suspended") return { text: "Suspendue", dot: "🟠" };
  if (s === "archived") return { text: "Archivée", dot: "⚫" };
  return { text: "Inconnu", dot: "⚪" };
}

export default function App() {
  const operatorUrl = getEnv("VITE_OPERATOR_URL");
  const adminUrl = getEnv("VITE_ADMIN_URL");
  const displayUrl = getEnv("VITE_DISPLAY_URL");

  const [sessionReady, setSessionReady] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");
  const [email, setEmail] = useState("orgadmin@demo.local");
  const [password, setPassword] = useState("admin123");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [orgs, setOrgs] = useState<OrgView[]>([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "suspended" | "archived" | "all">("active");
  const [sportFilter, setSportFilter] = useState<string>("all");

  // thème ultra simple (clair/sombre)
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("scoreDisplay.theme");
    return saved === "light" ? "light" : "dark";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("scoreDisplay.theme", theme);
  }, [theme]);

  // force login
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("forceLogin") === "1") {
      supabase.auth.signOut().finally(() => {
        url.searchParams.delete("forceLogin");
        window.history.replaceState({}, "", url.toString());
        setSessionReady(true);
      });
      return;
    }
    setSessionReady(true);
  }, []);

  useEffect(() => {
    if (!sessionReady) return;

    let alive = true;

    async function init() {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user ?? null;
      if (!alive) return;
      setUserEmail(u?.email || "");
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setUserEmail(s?.user?.email || "");
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [sessionReady]);

  const isLoggedIn = !!userEmail;

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (ex: any) {
      setErr(ex?.message || "Erreur de connexion.");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  async function loadOrgs() {
    setErr("");
    setLoading(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user?.id;
      if (!uid) {
        setOrgs([]);
        setLoading(false);
        return;
      }

      // ✅ IMPORTANT : on sélectionne orgs.sport (PAS org_sport)
      const { data, error } = await supabase
        .from("org_members")
        .select("role, orgs(id, slug, name, status, sport)")
        .eq("user_id", uid);

      if (error) throw error;

      const rows = (data || []) as MemberRow[];
      const mapped: OrgView[] = rows
        .filter((r) => r.orgs && r.orgs.slug)
        .map((r) => ({
          id: r.orgs!.id,
          slug: r.orgs!.slug,
          name: (r.orgs!.name || r.orgs!.slug) as string,
          status: normalizeStatus(r.orgs!.status),
          sport: normalizeSport(r.orgs!.sport),
          role: (r.role || "member") as string,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      setOrgs(mapped);
    } catch (ex: any) {
      setOrgs([]);
      setErr(ex?.message || "Erreur lors du chargement des organisations.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isLoggedIn) loadOrgs();
    else setOrgs([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return orgs.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (sportFilter !== "all" && o.sport !== sportFilter) return false;
      if (!qq) return true;
      return (
        o.slug.toLowerCase().includes(qq) ||
        o.name.toLowerCase().includes(qq) ||
        o.role.toLowerCase().includes(qq) ||
        o.sport.toLowerCase().includes(qq)
      );
    });
  }, [orgs, q, statusFilter, sportFilter]);

  const stats = useMemo(() => {
    const active = orgs.filter((o) => o.status === "active").length;
    const suspended = orgs.filter((o) => o.status === "suspended").length;
    const archived = orgs.filter((o) => o.status === "archived").length;
    return { total: orgs.length, active, suspended, archived };
  }, [orgs]);

  function openOperator(orgSlug: string) {
    if (!operatorUrl) {
      alert("VITE_OPERATOR_URL manquant côté Home.");
      return;
    }
    const url = new URL(operatorUrl);
    url.searchParams.set("org", orgSlug);
    window.location.href = url.toString();
  }

  // style minimal (tu peux remplacer par ton CSS)
  const bg =
    theme === "dark"
      ? "radial-gradient(1200px 600px at 30% 0%, #1b2430 0%, #0b0f14 45%, #06080b 100%)"
      : "linear-gradient(180deg, #f7f8fb 0%, #eef1f6 55%, #e9edf5 100%)";

  const card =
    theme === "dark"
      ? { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#e7eefc" }
      : { background: "rgba(255,255,255,0.75)", border: "1px solid rgba(0,0,0,0.08)", color: "#0c1420" };

  const subtle = theme === "dark" ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.65)";

  return (
    <div style={{ minHeight: "100vh", padding: 24, background: bg, color: card.color as any }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: 0.2 }}>scoreDisplay</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Hub d’accès — session persistée • forcer la page login : <code>?forceLogin=1</code>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            style={{ padding: "10px 12px", borderRadius: 12 }}
          >
            {theme === "dark" ? "☀️ Clair" : "🌙 Sombre"}
          </button>

          {displayUrl ? (
            <a href={displayUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
              <button style={{ padding: "10px 12px", borderRadius: 12 }}>🖥️ Display</button>
            </a>
          ) : null}

          {isLoggedIn ? (
            <button onClick={logout} style={{ padding: "10px 12px", borderRadius: 12 }}>
              Se déconnecter
            </button>
          ) : null}
        </div>
      </div>

      {/* LOGIN */}
      {!isLoggedIn ? (
        <div style={{ marginTop: 18, maxWidth: 520, ...card, borderRadius: 16, padding: 16 }}>
          <h2 style={{ margin: 0 }}>Connexion</h2>
          <p style={{ marginTop: 8, color: subtle as any }}>
            Connecte-toi pour accéder à tes organisations, puis ouvre l’espace Operator correspondant.
          </p>

          {err ? (
            <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "rgba(220,38,38,0.12)", color: "#ff7b7b" }}>
              {err}
            </div>
          ) : null}

          <form onSubmit={login} style={{ display: "grid", gap: 10, marginTop: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.8 }}>Email</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} style={{ padding: 10, borderRadius: 12 }} />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.8 }}>Mot de passe</span>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                style={{ padding: 10, borderRadius: 12 }}
              />
            </label>

            <button disabled={loading} style={{ padding: 12, borderRadius: 12, fontWeight: 800 }}>
              {loading ? "Connexion..." : "Se connecter"}
            </button>
          </form>

          <div style={{ marginTop: 10, fontSize: 12, color: subtle as any }}>
            Astuce : si tu es coincé par une ancienne session → ouvre <code>/?forceLogin=1</code>.
          </div>
        </div>
      ) : (
        <>
          {/* HEADER CONNECTE */}
          <div style={{ marginTop: 18, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 13, color: subtle as any }}>
              connecté : <b>{userEmail}</b>
            </div>

            {adminUrl ? (
              <a href={adminUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                <button style={{ padding: "10px 12px", borderRadius: 12 }}>⚙️ Admin</button>
              </a>
            ) : null}
          </div>

          {/* STATS */}
          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div style={{ ...card, borderRadius: 16, padding: 14 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Organisations</div>
              <div style={{ fontSize: 28, fontWeight: 900 }}>{stats.total}</div>
              <div style={{ fontSize: 12, color: subtle as any }}>
                actives {stats.active} • suspendues {stats.suspended} • archivées {stats.archived}
              </div>
            </div>

            <div style={{ ...card, borderRadius: 16, padding: 14 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Mode d’emploi rapide</div>
              <div style={{ fontSize: 12, lineHeight: 1.5, color: subtle as any, marginTop: 8 }}>
                1) Choisis une organisation<br />
                2) Clique <b>Ouvrir</b> → espace <b>Operator</b><br />
                3) Dans Operator, gère les matchs et ouvre les Displays publics.
              </div>
            </div>

            <div style={{ ...card, borderRadius: 16, padding: 14 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Conseil démo</div>
              <div style={{ fontSize: 12, lineHeight: 1.5, color: subtle as any, marginTop: 8 }}>
                Prépare 1 match “scheduled” + 1 display public + lance la TV (stadium mode).
              </div>
            </div>
          </div>

          {/* FILTRES */}
          <div style={{ marginTop: 14, ...card, borderRadius: 16, padding: 12 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Recherche org (slug / nom / sport / rôle)…"
                style={{ flex: 1, minWidth: 260, padding: 12, borderRadius: 12 }}
              />

              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} style={{ padding: 12, borderRadius: 12 }}>
                <option value="active">Actives</option>
                <option value="suspended">Suspendues</option>
                <option value="archived">Archivées</option>
                <option value="all">Tous statuts</option>
              </select>

              <select value={sportFilter} onChange={(e) => setSportFilter(e.target.value)} style={{ padding: 12, borderRadius: 12 }}>
                <option value="all">Tous sports</option>
                <option value="football">Football</option>
                <option value="basket">Basket</option>
                <option value="handball">Handball</option>
                <option value="rugby">Rugby</option>
                <option value="volleyball">Volley</option>
              </select>

              <div style={{ fontSize: 12, opacity: 0.8 }}>{filtered.length} org(s)</div>
            </div>
          </div>

          {/* LISTE ORGS */}
          <div style={{ marginTop: 14 }}>
            <h2 style={{ margin: 0 }}>Organisations</h2>
            {err ? (
              <div style={{ marginTop: 10, padding: 12, borderRadius: 14, background: "rgba(220,38,38,0.12)", color: "#ff7b7b" }}>
                Erreur : {err}
              </div>
            ) : null}

            {loading ? (
              <div style={{ marginTop: 12, opacity: 0.9 }}>Chargement des organisations …</div>
            ) : filtered.length === 0 ? (
              <div style={{ marginTop: 12, ...card, borderRadius: 16, padding: 12 }}>Aucune organisation.</div>
            ) : (
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {filtered.map((o) => {
                  const sb = statusBadge(o.status);
                  return (
                    <div
                      key={o.id}
                      style={{
                        ...card,
                        borderRadius: 16,
                        padding: 14,
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "center",
                      }}
                    >
                      <div style={{ display: "grid", gap: 4 }}>
                        <div style={{ fontSize: 16, fontWeight: 900 }}>{o.name}</div>
                        <div style={{ fontSize: 12, color: subtle as any }}>
                          {o.slug} • {sb.dot} {sb.text} • ✍️ {labelSport(o.sport)} • rôle: {o.role}
                        </div>
                      </div>

                      <button onClick={() => openOperator(o.slug)} style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 800 }}>
                        Ouvrir
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ marginTop: 10, fontSize: 12, color: subtle as any }}>
              Astuce : forcer l’écran de login → <code>https://scoreboard-home.vercel.app/?forceLogin=1</code>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
