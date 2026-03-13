// apps/admin/src/pages/DashboardPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabase";

type OrgRow = {
  id: string;
  slug: string;
  name: string;
  status?: string | null;
  sport?: string | null;
};

const OPERATOR_URL = (import.meta as any).env?.VITE_OPERATOR_URL || "https://scoreboard-operator.vercel.app";

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.10)",
        fontSize: 12,
        lineHeight: "16px",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [orgs, setOrgs] = useState<OrgRow[]>([]);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "suspended" | "archived" | "all">("active");
  const [sportFilter, setSportFilter] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setErr("");
      setLoading(true);

            const { data, error } = await supabase
        .from("orgs")
        .select("id,slug,name,status,sport")
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        setErr(error.message);
        setOrgs([]);
      } else {
        setOrgs((data as any) || []);
      }

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const normalized = useMemo(() => {
    return orgs.map((o) => ({
      ...o,
      status: (o.status || "active").toLowerCase(),
      sport: (o.sport || "").toLowerCase() || null,
    }));
  }, [orgs]);

  const sportsList = useMemo(() => {
    const set = new Set<string>();
    for (const o of normalized) if (o.sport) set.add(o.sport);
    return Array.from(set).sort();
  }, [normalized]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return normalized.filter((o) => {
      const okQ =
        !qq ||
        o.slug.toLowerCase().includes(qq) ||
        (o.name || "").toLowerCase().includes(qq);

      const okStatus = statusFilter === "all" ? true : (o.status || "active") === statusFilter;
      const okSport = sportFilter === "all" ? true : (o.sport || "") === sportFilter;

      return okQ && okStatus && okSport;
    });
  }, [normalized, q, statusFilter, sportFilter]);

  const stats = useMemo(() => {
    const total = normalized.length;
    const active = normalized.filter((o) => (o.status || "active") === "active").length;
    const suspended = normalized.filter((o) => o.status === "suspended").length;
    const archived = normalized.filter((o) => o.status === "archived").length;
    return { total, active, suspended, archived };
  }, [normalized]);

  function openOperator(orgSlug: string) {
    // On ouvre Operator en forçant ?org=slug
    // L’Operator App.tsx persist et pousse /matches.
    const url = `${OPERATOR_URL.replace(/\/$/, "")}/?org=${encodeURIComponent(orgSlug)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>scoreDisplay — Admin Dashboard</h1>
          <div style={{ opacity: 0.75, marginTop: 6 }}>
            Super admin : vue globale, recherche et accès direct aux organisations.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Link to="/orgs">Orgs</Link>
          <Link to="/members">Membres</Link>
          <Link to="/sports">Sports</Link>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
        <Badge>Total: {stats.total}</Badge>
        <Badge>Actives: {stats.active}</Badge>
        <Badge>Suspendues: {stats.suspended}</Badge>
        <Badge>Archivées: {stats.archived}</Badge>
      </div>

      <div
        style={{
          marginTop: 16,
          padding: 14,
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.04)",
        }}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Recherche org (slug / nom)…"
            style={{ padding: "10px 12px", borderRadius: 10, minWidth: 260 }}
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            style={{ padding: "10px 12px", borderRadius: 10 }}
          >
            <option value="active">Actives</option>
            <option value="suspended">Suspendues</option>
            <option value="archived">Archivées</option>
            <option value="all">Toutes</option>
          </select>

          <select
            value={sportFilter}
            onChange={(e) => setSportFilter(e.target.value)}
            style={{ padding: "10px 12px", borderRadius: 10 }}
          >
            <option value="all">Tous sports</option>
            {sportsList.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <div style={{ marginLeft: "auto", opacity: 0.75 }}>{filtered.length} org(s)</div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 20 }}>Chargement…</div>
      ) : err ? (
        <div style={{ padding: 20, color: "crimson" }}>Erreur: {err}</div>
      ) : (
        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
          {filtered.map((o) => (
            <div
              key={o.id}
              style={{
                padding: 14,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.03)",
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{o.name}</div>
                  <div style={{ opacity: 0.8, fontSize: 12 }}>{o.slug}</div>
                  <Badge>{(o.status || "active") as string}</Badge>
                  {o.sport ? <Badge>{o.sport}</Badge> : null}
                </div>

                <button onClick={() => openOperator(o.slug)} style={{ padding: "8px 12px", borderRadius: 10 }}>
                  Ouvrir en Operator
                </button>
              </div>

              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Tip: une org “archived” doit être read-only ; une org “suspended” peut être bloquée côté login/accès.
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
