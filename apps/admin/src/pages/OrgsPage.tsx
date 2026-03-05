import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

type OrgStatus = "active" | "suspended" | "archived";

type OrgRow = {
  id: string;
  slug: string;
  name: string | null;
  is_master: boolean | null;
  status: OrgStatus | null;
  sport: string | null;
  suspended_at: string | null;
  archived_at: string | null;
  created_at?: string | null;
};

type SportKey = "football" | "basket" | "volleyball" | "handball" | "rugby";

const SPORTS: { key: SportKey; label: string }[] = [
  { key: "football", label: "Football" },
  { key: "basket", label: "Basket" },
  { key: "volleyball", label: "Volley" },
  { key: "handball", label: "Handball" },
  { key: "rugby", label: "Rugby" },
];

function normalizeStatus(s: OrgRow["status"]): OrgStatus {
  if (s === "suspended" || s === "archived" || s === "active") return s;
  return "active";
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function statusBadgeStyle(status: OrgStatus, dark: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    border: `1px solid ${dark ? "#202938" : "#e5e7eb"}`,
  };

  if (status === "active") return { ...base, background: dark ? "rgba(16,185,129,.12)" : "rgba(16,185,129,.14)" };
  if (status === "archived") return { ...base, background: dark ? "rgba(59,130,246,.12)" : "rgba(59,130,246,.12)" };
  return { ...base, background: dark ? "rgba(239,68,68,.12)" : "rgba(239,68,68,.12)" };
}

export default function OrgsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<OrgRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // filters
  const [q, setQ] = useState("");
  const [sport, setSport] = useState<string>("all");
  const [status, setStatus] = useState<"active" | "suspended" | "archived" | "all">("active");

  // ui
  const [busyOrgId, setBusyOrgId] = useState<string | null>(null);

  // detect theme from data-theme
  const isDark = useMemo(() => document.documentElement.getAttribute("data-theme") === "dark", []);

  const styles = useMemo(() => {
    const dark = isDark;

    const panel = dark ? "#0f141b" : "#ffffff";
    const text = dark ? "#e5e7eb" : "#111827";
    const muted = dark ? "#a7b0bf" : "#6b7280";
    const border = dark ? "#202938" : "#e5e7eb";
    const bgInput = dark ? "#0b0d10" : "#ffffff";

    return {
      h1: { margin: "0 0 10px 0", fontSize: 22 } as React.CSSProperties,
      sub: { margin: "0 0 16px 0", color: muted } as React.CSSProperties,
      toolbar: {
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        alignItems: "center",
        marginBottom: 14,
      } as React.CSSProperties,
      input: {
        padding: "10px 12px",
        borderRadius: 10,
        border: `1px solid ${border}`,
        background: bgInput,
        color: text,
        minWidth: 260,
        outline: "none",
      } as React.CSSProperties,
      select: {
        padding: "10px 12px",
        borderRadius: 10,
        border: `1px solid ${border}`,
        background: bgInput,
        color: text,
        outline: "none",
      } as React.CSSProperties,
      card: {
        background: panel,
        border: `1px solid ${border}`,
        borderRadius: 14,
        overflow: "hidden",
      } as React.CSSProperties,
      table: { width: "100%", borderCollapse: "collapse" } as React.CSSProperties,
      th: {
        textAlign: "left",
        fontSize: 12,
        color: muted,
        padding: "10px 12px",
        borderBottom: `1px solid ${border}`,
        whiteSpace: "nowrap",
      } as React.CSSProperties,
      td: {
        padding: "10px 12px",
        borderBottom: `1px solid ${border}`,
        verticalAlign: "middle",
      } as React.CSSProperties,
      name: { fontWeight: 900 } as React.CSSProperties,
      slug: { color: muted, fontSize: 12, marginTop: 2 } as React.CSSProperties,
      btn: {
        padding: "8px 10px",
        borderRadius: 10,
        border: `1px solid ${border}`,
        background: panel,
        color: text,
        cursor: "pointer",
        fontWeight: 800,
      } as React.CSSProperties,
      btnDanger: {
        padding: "8px 10px",
        borderRadius: 10,
        border: `1px solid ${border}`,
        background: dark ? "rgba(239,68,68,.15)" : "rgba(239,68,68,.12)",
        color: text,
        cursor: "pointer",
        fontWeight: 900,
      } as React.CSSProperties,
      btnPrimary: {
        padding: "8px 10px",
        borderRadius: 10,
        border: `1px solid ${border}`,
        background: dark ? "rgba(59,130,246,.18)" : "rgba(59,130,246,.14)",
        color: text,
        cursor: "pointer",
        fontWeight: 900,
      } as React.CSSProperties,
      rowActions: { display: "flex", gap: 8, flexWrap: "wrap" } as React.CSSProperties,
      empty: { padding: 16, color: muted } as React.CSSProperties,
      err: { padding: 12, borderRadius: 12, background: "rgba(239,68,68,.12)", color: text } as React.CSSProperties,
    };
  }, [isDark]);

  async function load() {
    setLoading(true);
    setError(null);

    const sel =
      "id,slug,name,is_master,status,sport,suspended_at,archived_at,created_at";

    const { data, error } = await supabase
      .from("orgs")
      .select(sel)
      .order("is_master", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data || []) as OrgRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows.filter((o) => {
      const st = normalizeStatus(o.status);
      if (status !== "all" && st !== status) return false;
      if (sport !== "all" && (o.sport || "").toLowerCase() !== sport) return false;

      if (!qq) return true;

      const name = (o.name || "").toLowerCase();
      const slug = (o.slug || "").toLowerCase();
      return name.includes(qq) || slug.includes(qq);
    });
  }, [rows, q, sport, status]);

  async function callRpc(fn: "rpc_suspend_org" | "rpc_archive_org" | "rpc_reactivate_org", org: OrgRow) {
    if (!org?.id) return;
    if (org.is_master) return;

    setBusyOrgId(org.id);
    setError(null);

    const { error } = await supabase.rpc(fn, { p_org_id: org.id });

    if (error) {
      setError(error.message);
      setBusyOrgId(null);
      return;
    }

    await load();
    setBusyOrgId(null);
  }

  function StatusCell({ org }: { org: OrgRow }) {
    const st = normalizeStatus(org.status);
    const label =
      st === "active" ? "Active" : st === "archived" ? "Archivée" : "Suspendue";

    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={statusBadgeStyle(st, isDark)}>{label}</span>
        <span style={{ fontSize: 12, opacity: 0.85 }}>
          {st === "archived" ? `archivé: ${fmtDate(org.archived_at)}` : null}
          {st === "suspended" ? `suspendu: ${fmtDate(org.suspended_at)}` : null}
        </span>
      </div>
    );
  }

  return (
    <div>
      <h1 style={styles.h1}>Organisations</h1>
      <p style={styles.sub}>
        Par défaut, seules les organisations <b>actives</b> sont listées. Recherche + filtres disponibles.
      </p>

      {error ? <div style={styles.err}>Erreur: {error}</div> : null}

      <div style={styles.toolbar}>
        <input
          style={styles.input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher (nom, slug)…"
        />

        <select style={styles.select} value={sport} onChange={(e) => setSport(e.target.value)}>
          <option value="all">Tous sports</option>
          {SPORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>

        <select style={styles.select} value={status} onChange={(e) => setStatus(e.target.value as any)}>
          <option value="active">Actives</option>
          <option value="archived">Archivées</option>
          <option value="suspended">Suspendues</option>
          <option value="all">Toutes</option>
        </select>

        <button style={styles.btn} onClick={load} disabled={loading}>
          {loading ? "Chargement…" : "Rafraîchir"}
        </button>
      </div>

      <div style={styles.card}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Organisation</th>
              <th style={styles.th}>Sport</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td style={styles.td} colSpan={4}>
                  Chargement…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td style={styles.td} colSpan={4}>
                  <div style={styles.empty}>Aucune organisation trouvée avec ces filtres.</div>
                </td>
              </tr>
            ) : (
              filtered.map((org) => {
                const st = normalizeStatus(org.status);
                const busy = busyOrgId === org.id;

                return (
                  <tr key={org.id}>
                    <td style={styles.td}>
                      <div style={styles.name}>
                        {org.name || org.slug || "Organisation"}
                        {org.is_master ? " (MASTER)" : ""}
                      </div>
                      <div style={styles.slug}>{org.slug}</div>
                      <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                        id: <code>{org.id}</code>
                      </div>
                    </td>

                    <td style={styles.td}>
                      {(org.sport || "—").toString()}
                    </td>

                    <td style={styles.td}>
                      <StatusCell org={org} />
                    </td>

                    <td style={styles.td}>
                      <div style={styles.rowActions}>
                        <button
                          style={styles.btnDanger}
                          disabled={busy || Boolean(org.is_master) || st === "suspended"}
                          onClick={() => callRpc("rpc_suspend_org", org)}
                          title={org.is_master ? "Master non modifiable" : "Suspendre (bloque accès membres)"}
                        >
                          Suspendre
                        </button>

                        <button
                          style={styles.btnPrimary}
                          disabled={busy || Boolean(org.is_master) || st === "archived"}
                          onClick={() => callRpc("rpc_archive_org", org)}
                          title={org.is_master ? "Master non modifiable" : "Archiver (read-only)"}
                        >
                          Archiver
                        </button>

                        <button
                          style={styles.btn}
                          disabled={busy || st === "active"}
                          onClick={() => callRpc("rpc_reactivate_org", org)}
                          title="Réactiver (read/write)"
                        >
                          Réactiver
                        </button>
                      </div>
                      {busy ? (
                        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>Action en cours…</div>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
        Rappel: <b>Suspendue</b> = bloqué (pas de lecture/écriture pour membres), <b>Archivée</b> = lecture seule.
      </div>
    </div>
  );
}
