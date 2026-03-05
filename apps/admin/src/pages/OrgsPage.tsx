import React, { useEffect, useMemo, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type OrgStatus = "active" | "suspended" | "archived";

type OrgRow = {
  id: string;
  slug: string;
  name?: string | null;
  status?: OrgStatus | null;
  org_sport?: string | null;
  sport?: string | null;
  suspended_at?: string | null;
  archived_at?: string | null;
  is_master?: boolean | null;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const OPERATOR_URL = (import.meta.env.VITE_OPERATOR_URL || "").replace(/\/$/, "");

function getSupabase(): SupabaseClient {
  if (!SUPABASE_URL) throw new Error("VITE_SUPABASE_URL is required");
  if (!SUPABASE_ANON_KEY) throw new Error("VITE_SUPABASE_ANON_KEY is required");
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function getThemeFromStorage(): "dark" | "light" {
  const v = (localStorage.getItem("scoreDisplay.theme") || "").toLowerCase();
  return v === "light" ? "light" : "dark";
}
function applyTheme(t: "dark" | "light") {
  document.documentElement.dataset.theme = t;
  localStorage.setItem("scoreDisplay.theme", t);
}

function StatusPill({ status }: { status: OrgStatus }) {
  const label = status === "active" ? "Active" : status === "suspended" ? "Suspendue" : "Archivée";
  const dot =
    status === "active" ? "var(--ok)" : status === "suspended" ? "var(--warn)" : "var(--muted)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 10px",
        borderRadius: 999,
        border: "1px solid var(--border)",
        background: "var(--panel)",
        fontSize: 12,
        fontWeight: 800,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 999, background: dot }} />
      {label}
    </span>
  );
}

export default function OrgsPage() {
  const supabase = useMemo(() => getSupabase(), []);
  const [theme, setTheme] = useState<"dark" | "light">(getThemeFromStorage());

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "active+archived" | "all">("active");
  const [sportFilter, setSportFilter] = useState<string>("all");

  useEffect(() => applyTheme(theme), [theme]);

  async function load() {
    setLoading(true);
    setErr(null);

    const { data, error } = await supabase
      .from("orgs")
      .select("id, slug, name, status, org_sport, sport, suspended_at, archived_at, is_master")
      .order("slug", { ascending: true });

    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }

    setOrgs((data || []) as OrgRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sports = useMemo(() => {
    const set = new Set<string>();
    for (const o of orgs) {
      const s = (o.org_sport || o.sport || "").trim();
      if (s) set.add(s);
    }
    return Array.from(set).sort();
  }, [orgs]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return orgs
      .filter((o) => {
        const st = (o.status || "active") as OrgStatus;

        if (statusFilter === "active" && st !== "active") return false;
        if (statusFilter === "active+archived" && !(st === "active" || st === "archived")) return false;

        if (sportFilter !== "all") {
          const s = (o.org_sport || o.sport || "").trim();
          if (s !== sportFilter) return false;
        }

        if (!qq) return true;
        const hay = `${o.slug} ${o.name || ""}`.toLowerCase();
        return hay.includes(qq);
      })
      .sort((a, b) => {
        const sa = (a.status || "active") as OrgStatus;
        const sb = (b.status || "active") as OrgStatus;
        if (sa !== sb) return sa === "active" ? -1 : 1;
        return a.slug.localeCompare(b.slug);
      });
  }, [orgs, q, statusFilter, sportFilter]);

  async function updateOrgStatus(org: OrgRow, next: OrgStatus) {
    const patch: Partial<OrgRow> = { status: next };

    if (next === "active") {
      patch.suspended_at = null;
      patch.archived_at = null;
    }
    if (next === "suspended") {
      patch.suspended_at = new Date().toISOString();
    }
    if (next === "archived") {
      patch.archived_at = new Date().toISOString();
    }

    const ok = window.confirm(
      next === "active"
        ? `Réactiver l'organisation "${org.slug}" ?`
        : next === "suspended"
        ? `Suspendre "${org.slug}" ? (Operator bloqué)`
        : `Archiver "${org.slug}" ? (lecture seule)`
    );
    if (!ok) return;

    const { error } = await supabase.from("orgs").update(patch).eq("id", org.id);
    if (error) {
      alert(`Erreur: ${error.message}`);
      return;
    }
    await load();
  }

  function openOperator(org: OrgRow) {
    if (!OPERATOR_URL) {
      alert("VITE_OPERATOR_URL n'est pas configurée sur le projet admin.");
      return;
    }
    window.open(`${OPERATOR_URL}/?org=${encodeURIComponent(org.slug)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div style={{ padding: 24 }}>
      <style>{`
        :root{
          --bg:#0b0d10; --panel:rgba(255,255,255,.03); --text:#e5e7eb; --muted:#9ca3af; --border:#1b2230; --primary:#60a5fa;
          --danger:#ef4444; --warn:#f59e0b; --ok:#22c55e;
        }
        :root[data-theme="light"]{
          --bg:#f6f7fb; --panel:#ffffff; --text:#0f172a; --muted:#475569; --border:#e2e8f0; --primary:#2563eb;
          --danger:#dc2626; --warn:#d97706; --ok:#16a34a;
        }
        body{ background: var(--bg); color: var(--text); }
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
          border-radius: 12px;
          cursor: pointer;
          font-weight: 800;
        }
        button.primary{ border-color: transparent; background: var(--primary); color: white; }
        button.danger{ border-color: transparent; background: var(--danger); color: white; }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0 }}>scoreDisplay — Organisations</h1>
          <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 13 }}>
            Par défaut, seules les organisations <b>actives</b> sont listées.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
            {theme === "dark" ? "🌙 Sombre" : "☀️ Clair"}
          </button>
          <button onClick={() => load()}>↻ Rafraîchir</button>
          <button
            className="danger"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.reload();
            }}
          >
            Déconnexion
          </button>
        </div>
      </div>

      <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher (slug / nom)…"
          style={{ minWidth: 280 }}
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
      </div>

      {loading ? (
        <div style={{ marginTop: 18, color: "var(--muted)" }}>Chargement…</div>
      ) : err ? (
        <div style={{ marginTop: 18, color: "var(--danger)", fontWeight: 800 }}>Erreur: {err}</div>
      ) : (
        <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
          {filtered.map((o) => {
            const st = (o.status || "active") as OrgStatus;
            const sport = (o.org_sport || o.sport || "").trim();

            return (
              <div
                key={o.id}
                style={{
                  border: "1px solid var(--border)",
                  background: "var(--panel)",
                  borderRadius: 14,
                  padding: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ minWidth: 280 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 900, fontSize: 16 }}>
                      {o.name || o.slug}{" "}
                      {o.is_master ? <span style={{ color: "var(--muted)", fontSize: 12 }}>(master)</span> : null}
                    </div>
                    <StatusPill status={st} />
                    {sport ? (
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>
                        Sport : <b style={{ color: "var(--text)" }}>{sport}</b>
                      </span>
                    ) : null}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>slug: {o.slug}</div>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <button onClick={() => openOperator(o)}>Ouvrir Operator →</button>

                  {!o.is_master && st !== "suspended" ? (
                    <button onClick={() => updateOrgStatus(o, "suspended")}>Suspendre</button>
                  ) : null}

                  {!o.is_master && st === "suspended" ? (
                    <button className="primary" onClick={() => updateOrgStatus(o, "active")}>
                      Réactiver
                    </button>
                  ) : null}

                  {!o.is_master && st !== "archived" ? (
                    <button onClick={() => updateOrgStatus(o, "archived")}>Archiver</button>
                  ) : null}

                  {!o.is_master && st === "archived" ? (
                    <button className="primary" onClick={() => updateOrgStatus(o, "active")}>
                      Désarchiver
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 ? (
            <div style={{ padding: 14, border: "1px solid var(--border)", borderRadius: 14, background: "var(--panel)" }}>
              Aucune organisation pour ces filtres.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
