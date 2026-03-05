import React, { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import LoginPage from "./pages/LoginPage";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const ADMIN_URL = (import.meta.env.VITE_ADMIN_URL || "").replace(/\/$/, "");
const OPERATOR_URL = (import.meta.env.VITE_OPERATOR_URL || "").replace(/\/$/, "");
const DISPLAY_URL = (import.meta.env.VITE_DISPLAY_URL || "").replace(/\/$/, "");

type OrgStatus = "active" | "suspended" | "archived";

type OrgRow = {
  id: string;
  slug: string;
  name?: string | null;
  status?: OrgStatus | null;
  org_sport?: string | null; // selon ton schéma
  sport?: string | null;     // fallback possible
};

type MemberRow = {
  role: string;
  orgs: OrgRow | null;
};

function hardRedirect(baseUrl: string, pathWithQuery = "/") {
  if (!baseUrl) return;
  const p = pathWithQuery.startsWith("/") ? pathWithQuery : `/${pathWithQuery}`;
  window.location.assign(`${baseUrl}${p}`);
}

function getThemeFromStorage(): "dark" | "light" {
  const v = (localStorage.getItem("scoreDisplay.theme") || "").toLowerCase();
  return v === "light" ? "light" : "dark";
}

function applyTheme(t: "dark" | "light") {
  document.documentElement.dataset.theme = t;
  localStorage.setItem("scoreDisplay.theme", t);
}

function ThemeToggle() {
  const [t, setT] = useState<"dark" | "light">(getThemeFromStorage());

  useEffect(() => applyTheme(t), [t]);

  return (
    <button
      onClick={() => setT((x) => (x === "dark" ? "light" : "dark"))}
      style={{
        border: "1px solid var(--border)",
        background: "var(--panel)",
        color: "var(--text)",
        padding: "8px 10px",
        borderRadius: 10,
        cursor: "pointer",
        fontSize: 12,
      }}
      title="Basculer thème"
    >
      {t === "dark" ? "🌙 Sombre" : "☀️ Clair"}
    </button>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        color: "var(--text)",
        fontFamily: "Inter, system-ui, Arial",
      }}
    >
      <style>{`
        :root{
          --bg:#0b0d10; --panel:rgba(255,255,255,.03); --text:#e5e7eb; --muted:#9ca3af; --border:#1b2230; --primary:#60a5fa;
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
          font-family: inherit;
        }
      `}</style>

      {children}
    </div>
  );
}

function StatusPill({ status }: { status: OrgStatus }) {
  const color =
    status === "active" ? "var(--ok)" : status === "suspended" ? "var(--warn)" : "var(--muted)";
  const label = status === "active" ? "Active" : status === "suspended" ? "Suspendue" : "Archivée";
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

function OrgPicker({
  supabase,
  userId,
  isSuperAdmin,
}: {
  supabase: SupabaseClient;
  userId: string;
  isSuperAdmin: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [rows, setRows] = useState<OrgRow[]>([]);

  // filtres
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "all" | "active+archived">("active");
  const [sportFilter, setSportFilter] = useState<string>("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);

      // memberships + org details
     const { data, error } = await supabase
  .from("org_members")
  .select(`
    role,
    orgs (
      id,
      slug,
      name,
      status,
      sport
    )
  `)
  .eq("user_id", user.id);

      if (error) {
        setErr(error.message);
        setLoading(false);
        return;
      }

      const members = (data || []) as unknown as MemberRow[];
      const orgs = members
        .map((m) => m.orgs)
        .filter(Boolean)
        .map((o) => ({
          id: o!.id,
          slug: o!.slug,
          name: o!.name ?? null,
          status: (o!.status ?? "active") as OrgStatus,
          org_sport: o!.org_sport ?? null,
          sport: o!.sport ?? null,
        }));

      setRows(orgs);
      setLoading(false);
    })();
  }, [supabase, userId]);

  const sports = useMemo(() => {
    const set = new Set<string>();
    for (const o of rows) {
      const s = (o.sport || o.sport || "").trim();
      if (s) set.add(s);
    }
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return rows
      .filter((o) => {
        const status = (o.status ?? "active") as OrgStatus;

        if (statusFilter === "active" && status !== "active") return false;
        if (statusFilter === "active+archived" && !(status === "active" || status === "archived")) return false;

        if (sportFilter !== "all") {
          const s = (o.org_sport || o.sport || "").trim();
          if (s !== sportFilter) return false;
        }

        if (!qq) return true;
        const hay = `${o.slug} ${o.name || ""}`.toLowerCase();
        return hay.includes(qq);
      })
      .sort((a, b) => {
        // actives d’abord
        const sa = a.status ?? "active";
        const sb = b.status ?? "active";
        if (sa !== sb) return sa === "active" ? -1 : 1;
        return a.slug.localeCompare(b.slug);
      });
  }, [rows, q, statusFilter, sportFilter]);

  // Si 1 seule org active => redirect auto Operator (par défaut)
  useEffect(() => {
    if (loading) return;
    if (!OPERATOR_URL) return;

    const actives = rows.filter((o) => (o.status ?? "active") === "active");
    if (actives.length === 1 && !isSuperAdmin) {
      hardRedirect(OPERATOR_URL, `/?org=${encodeURIComponent(actives[0].slug)}`);
    }
  }, [loading, rows, isSuperAdmin]);

  if (loading) {
    return (
      <Shell>
        <div style={{ padding: 32, maxWidth: 900, margin: "0 auto" }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>scoreDisplay</h1>
          <p style={{ color: "var(--muted)" }}>Chargement des organisations…</p>
        </div>
      </Shell>
    );
  }

  if (err) {
    return (
      <Shell>
        <div style={{ padding: 32, maxWidth: 900, margin: "0 auto" }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>scoreDisplay</h1>
          <p style={{ color: "var(--danger)" }}>Erreur : {err}</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ padding: 32, maxWidth: 980, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24 }}>scoreDisplay</h1>
            <p style={{ marginTop: 8, color: "var(--muted)" }}>
              Choisis une organisation (Operator par défaut). {isSuperAdmin ? "Mode Super Admin activé." : ""}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <ThemeToggle />
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.reload();
              }}
              style={{
                border: "1px solid var(--border)",
                background: "var(--panel)",
                color: "var(--text)",
                padding: "8px 10px",
                borderRadius: 10,
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Se déconnecter
            </button>
          </div>
        </div>

        <div style={{ marginTop: 18, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <input
            placeholder="Rechercher (slug / nom)…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ minWidth: 260 }}
          />

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
            <option value="active">Actives uniquement</option>
            <option value="active+archived">Actives + Archivées</option>
            <option value="all">Toutes (incl. suspendues)</option>
          </select>

          <select value={sportFilter} onChange={(e) => setSportFilter(e.target.value)}>
            <option value="all">Tous sports</option>
            {sports.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {isSuperAdmin && (
            <button
              onClick={() => {
                if (!ADMIN_URL) return;
                hardRedirect(ADMIN_URL, "/");
              }}
              style={{
                marginLeft: "auto",
                border: "1px solid var(--border)",
                background: "var(--panel)",
                color: "var(--text)",
                padding: "10px 12px",
                borderRadius: 12,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              Aller à l’Admin Console
            </button>
          )}
        </div>

        <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 14, background: "var(--panel)" }}>
              Aucune organisation ne correspond aux filtres.
            </div>
          ) : (
            filtered.map((o) => {
              const status = (o.status ?? "active") as OrgStatus;
              const sport = (o.org_sport || o.sport || "").trim();

              return (
                <div
                  key={o.id}
                  style={{
                    padding: 16,
                    border: "1px solid var(--border)",
                    borderRadius: 14,
                    background: "var(--panel)",
                    display: "flex",
                    gap: 14,
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ minWidth: 280 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 800, fontSize: 16 }}>{o.name || o.slug}</div>
                      <StatusPill status={status} />
                      {sport ? (
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>
                          Sport : <b style={{ color: "var(--text)" }}>{sport}</b>
                        </span>
                      ) : null}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>slug: {o.slug}</div>
                  </div>

                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <button
                      onClick={() => {
                        if (!OPERATOR_URL) return;
                        hardRedirect(OPERATOR_URL, `/?org=${encodeURIComponent(o.slug)}`);
                      }}
                      style={{
                        border: "1px solid var(--border)",
                        background: "var(--panel)",
                        color: "var(--text)",
                        padding: "10px 12px",
                        borderRadius: 12,
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: 800,
                      }}
                    >
                      Ouvrir Operator →
                    </button>

                    {status === "suspended" && (
                      <span style={{ fontSize: 12, color: "var(--warn)", fontWeight: 700 }}>
                        Suspendue : accès bloqué côté Operator/DB
                      </span>
                    )}

                    {status === "archived" && (
                      <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>
                        Archivée : lecture seule
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={{ marginTop: 18, fontSize: 12, color: "var(--muted)" }}>
          Display :{" "}
          {DISPLAY_URL ? (
            <a href={`${DISPLAY_URL}/`} target="_blank" rel="noreferrer">
              ouvrir
            </a>
          ) : (
            <span>VITE_DISPLAY_URL non configurée</span>
          )}
        </div>
      </div>
    </Shell>
  );
}

function HomeRouter({ supabase }: { supabase: SupabaseClient }) {
  const nav = useNavigate();
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session) {
        nav("/login", { replace: true });
        return;
      }

      const userId = session.user.id;

      // On calcule isSuperAdmin via membership master
      const { data: memberships, error } = await supabase
        .from("org_members")
        .select("role, orgs(slug)")
        .eq("user_id", userId);

      if (error) {
        setErr(error.message);
        setBusy(false);
        return;
      }

      const isSuperAdmin = (memberships || []).some(
        (m: any) => m?.orgs?.slug === "master" && m?.role === "super_admin"
      );

      // Rendu OrgPicker (gère l’auto-redirect si 1 org active)
      setBusy(false);

      // On monte le composant via state local (simple)
      (window as any).__SCOREDISPLAY__ = { userId, isSuperAdmin };
    })();
  }, [nav, supabase]);

  if (busy) {
    return (
      <Shell>
        <div style={{ padding: 32, maxWidth: 900, margin: "0 auto" }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>scoreDisplay</h1>
          <p style={{ color: "var(--muted)" }}>Vérification de session…</p>
        </div>
      </Shell>
    );
  }

  if (err) {
    return (
      <Shell>
        <div style={{ padding: 32, maxWidth: 900, margin: "0 auto" }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>scoreDisplay</h1>
          <p style={{ color: "var(--danger)" }}>Erreur : {err}</p>
        </div>
      </Shell>
    );
  }

  const ctx = (window as any).__SCOREDISPLAY__ as { userId: string; isSuperAdmin: boolean } | undefined;
  if (!ctx) {
    return (
      <Shell>
        <div style={{ padding: 32, maxWidth: 900, margin: "0 auto" }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>scoreDisplay</h1>
          <p style={{ color: "var(--muted)" }}>Contexte indisponible.</p>
        </div>
      </Shell>
    );
  }

  return <OrgPicker supabase={supabase} userId={ctx.userId} isSuperAdmin={ctx.isSuperAdmin} />;
}

function DisplayRedirector() {
  const url = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (!DISPLAY_URL) {
    return (
      <Shell>
        <div style={{ padding: 32, maxWidth: 900, margin: "0 auto" }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>Display</h1>
          <p style={{ color: "var(--muted)" }}>VITE_DISPLAY_URL non configurée.</p>
        </div>
      </Shell>
    );
  }
  hardRedirect(DISPLAY_URL, url);
  return null;
}

export default function App() {
  const supabase = useMemo(() => {
    if (!SUPABASE_URL) throw new Error("VITE_SUPABASE_URL is required");
    if (!SUPABASE_ANON) throw new Error("VITE_SUPABASE_ANON_KEY is required");
    return createClient(SUPABASE_URL, SUPABASE_ANON);
  }, []);

  // default theme
  useEffect(() => {
    applyTheme(getThemeFromStorage());
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRouter supabase={supabase} />} />
        <Route path="/login" element={<LoginPage supabase={supabase} />} />
        <Route path="/display" element={<DisplayRedirector />} />
      </Routes>
    </BrowserRouter>
  );
}
