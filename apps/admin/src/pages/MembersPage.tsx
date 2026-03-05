import React, { useEffect, useMemo, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type OrgStatus = "active" | "suspended" | "archived";

type MemberRow = {
  org_id: string;
  user_id: string;
  role: string;
  orgs: {
    id: string;
    slug: string;
    name?: string | null;
    status?: OrgStatus | null;
    org_sport?: string | null;
    sport?: string | null;
    is_master?: boolean | null;
  } | null;
  app_users: {
    id: string;
    email: string;
  } | null;
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

export default function MembersPage() {
  const supabase = useMemo(() => getSupabase(), []);
  const [theme, setTheme] = useState<"dark" | "light">(getThemeFromStorage());

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [rows, setRows] = useState<MemberRow[]>([]);
  const [q, setQ] = useState("");

  const [statusFilter, setStatusFilter] = useState<"active" | "active+archived" | "all">("active");
  const [sportFilter, setSportFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  useEffect(() => applyTheme(theme), [theme]);

  async function load() {
    setLoading(true);
    setErr(null);

    // org_members + orgs + app_users (email)
    const { data, error } = await supabase
      .from("org_members")
      .select(
        `
        org_id,
        user_id,
        role,
        orgs:org_id(id,slug,name,status,org_sport,sport,is_master),
        app_users:user_id(id,email)
      `
      )
      .order("org_id", { ascending: true });

    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }

    setRows((data || []) as unknown as MemberRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sports = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const o = r.orgs;
      if (!o) continue;
      const s = (o.org_sport || o.sport || "").trim();
      if (s) set.add(s);
    }
    return Array.from(set).sort();
  }, [rows]);

  const roles = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(r.role);
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return rows.filter((r) => {
      const org = r.orgs;
      const status = (org?.status || "active") as OrgStatus;

      if (statusFilter === "active" && status !== "active") return false;
      if (statusFilter === "active+archived" && !(status === "active" || status === "archived")) return false;

      if (sportFilter !== "all") {
        const s = (org?.org_sport || org?.sport || "").trim();
        if (s !== sportFilter) return false;
      }

      if (roleFilter !== "all" && r.role !== roleFilter) return false;

      if (!qq) return true;

      const email = r.app_users?.email || "";
      const slug = org?.slug || "";
      const name = org?.name || "";
      const hay = `${email} ${slug} ${name} ${r.role}`.toLowerCase();
      return hay.includes(qq);
    });
  }, [rows, q, statusFilter, sportFilter, roleFilter]);

  function openOperator(orgSlug: string) {
    if (!OPERATOR_URL) {
      alert("VITE_OPERATOR_URL n'est pas configurée sur le projet admin.");
      return;
    }
    window.open(`${OPERATOR_URL}/?org=${encodeURIComponent(orgSlug)}`, "_blank", "noopener,noreferrer");
  }

  async function setRole(r: MemberRow, nextRole: string) {
    const orgSlug = r.orgs?.slug || r.org_id;
    const email = r.app_users?.email || r.user_id;

    const ok = window.confirm(`Changer le rôle de ${email} dans ${orgSlug} → ${nextRole} ?`);
    if (!ok) return;

    const { error } = await supabase
      .from("org_members")
      .update({ role: nextRole })
      .eq("org_id", r.org_id)
      .eq("user_id", r.user_id);

    if (error) {
      alert(`Erreur: ${error.message}`);
      return;
    }
    await load();
  }

  async function removeMember(r: MemberRow) {
    const orgSlug = r.orgs?.slug || r.org_id;
    const email = r.app_users?.email || r.user_id;

    // éviter suppression du super_admin master par erreur
    if (r.orgs?.is_master && r.role === "super_admin") {
      alert("Suppression interdite : super_admin sur org master.");
      return;
    }

    const ok = window.confirm(`Retirer ${email} de l'organisation ${orgSlug} ?`);
    if (!ok) return;

    const { error } = await supabase.from("org_members").delete().eq("org_id", r.org_id).eq("user_id", r.user_id);
    if (error) {
      alert(`Erreur: ${error.message}`);
      return;
    }
    await load();
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
        button.danger{ border-color: transparent; background: var(--danger); color: white; }
        button.primary{ border-color: transparent; background: var(--primary); color: white; }
        table{ width: 100%; border-collapse: collapse; }
        th,td{ padding: 10px 8px; border-bottom: 1px solid var(--border); font-size: 13px; }
        th{ text-align: left; color: var(--muted); font-weight: 900; }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0 }}>scoreDisplay — Membres</h1>
          <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 13 }}>
            Recherche globale (email / org / rôle). Par défaut : orgs <b>actives</b> uniquement.
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
          placeholder="Rechercher (email / org / rôle)…"
          style={{ minWidth: 300 }}
        />

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
          <option value="active">Orgs actives uniquement</option>
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

        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="all">Tous rôles</option>
          {roles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        <div style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 12 }}>
          {filtered.length} résultat(s)
        </div>
      </div>

      {loading ? (
        <div style={{ marginTop: 18, color: "var(--muted)" }}>Chargement…</div>
      ) : err ? (
        <div style={{ marginTop: 18, color: "var(--danger)", fontWeight: 800 }}>Erreur: {err}</div>
      ) : (
        <div style={{ marginTop: 14, border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Organisation</th>
                <th>Sport</th>
                <th>Status</th>
                <th>Rôle</th>
                <th style={{ width: 360 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const email = r.app_users?.email || r.user_id;
                const org = r.orgs;
                const orgLabel = org?.name || org?.slug || r.org_id;
                const sport = (org?.org_sport || org?.sport || "").trim();
                const status = (org?.status || "active") as OrgStatus;

                return (
                  <tr key={`${r.org_id}:${r.user_id}`}>
                    <td style={{ fontWeight: 900 }}>{email}</td>
                    <td>
                      <div style={{ fontWeight: 900 }}>{orgLabel}</div>
                      <div style={{ color: "var(--muted)", fontSize: 12 }}>{org?.slug}</div>
                    </td>
                    <td>{sport || <span style={{ color: "var(--muted)" }}>—</span>}</td>
                    <td>
                      <span style={{ color: "var(--muted)", fontWeight: 900 }}>{status}</span>
                    </td>
                    <td style={{ fontWeight: 900 }}>{r.role}</td>
                    <td>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {org?.slug ? <button onClick={() => openOperator(org.slug)}>Operator</button> : null}

                        <select
                          value={r.role}
                          onChange={(e) => setRole(r, e.target.value)}
                          style={{ padding: "10px 10px", borderRadius: 12 }}
                        >
                          <option value="super_admin">super_admin</option>
                          <option value="org_admin">org_admin</option>
                          <option value="operator">operator</option>
                          <option value="viewer">viewer</option>
                        </select>

                        <button className="danger" onClick={() => removeMember(r)}>
                          Retirer
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 14, color: "var(--muted)" }}>
                    Aucun membre ne correspond aux filtres.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
