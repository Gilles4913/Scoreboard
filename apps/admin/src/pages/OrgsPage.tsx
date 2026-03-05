import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

type OrgStatus = "active" | "suspended" | "archived" | string;

type Org = {
  id: string;
  slug: string;
  name: string | null;
  sport: string | null;
  status: OrgStatus | null;
  is_master?: boolean | null;
  created_at?: string | null;
};

function getEnv(name: string) {
  const v = (import.meta as any).env?.[name];
  return typeof v === "string" ? v : "";
}

const OPERATOR_URL = (getEnv("VITE_OPERATOR_URL") || "").replace(/\/$/, "");

function statusLabel(s: OrgStatus | null) {
  const x = ((s || "active") + "").toLowerCase();
  if (x === "active") return "🟢 Active";
  if (x === "suspended") return "🟠 Suspendue";
  if (x === "archived") return "⚪ Archivée";
  return x;
}

export default function OrgsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Filters
  const [q, setQ] = useState("");
  const [sportFilter, setSportFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"active" | "all" | "active+archived">("active");

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [cSlug, setCSlug] = useState("");
  const [cName, setCName] = useState("");
  const [cSport, setCSport] = useState("football"); // default demo
  const [cStatus, setCStatus] = useState<OrgStatus>("active");

  async function load() {
    setLoading(true);
    setErr(null);

    const { data, error } = await supabase
      .from("orgs")
      .select("id,slug,name,sport,status,is_master,created_at")
      .order("slug", { ascending: true })
      .limit(1000);

    if (error) {
      setErr(error.message);
      setOrgs([]);
      setLoading(false);
      return;
    }

    setOrgs(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const sports = useMemo(() => {
    const set = new Set<string>();
    for (const o of orgs) if (o.sport) set.add(o.sport);
    return Array.from(set).sort();
  }, [orgs]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return orgs
      .filter((o) => {
        const status = ((o.status || "active") + "").toLowerCase();

        if (statusFilter === "active" && status !== "active") return false;
        if (statusFilter === "active+archived" && !(status === "active" || status === "archived")) return false;

        if (sportFilter !== "all") {
          if ((o.sport || "") !== sportFilter) return false;
        }

        if (!qq) return true;
        const hay = `${o.slug} ${o.name || ""}`.toLowerCase();
        return hay.includes(qq);
      })
      .sort((a, b) => a.slug.localeCompare(b.slug));
  }, [orgs, q, sportFilter, statusFilter]);

  async function updateStatus(org: Org, status: OrgStatus) {
    if (org.slug === "master" || org.is_master) return;

    setBusyId(org.id);
    setErr(null);

    const { error } = await supabase.from("orgs").update({ status }).eq("id", org.id);

    setBusyId(null);

    if (error) {
      setErr(error.message);
      return;
    }

    await load();
  }

  function openOperator(orgSlug: string) {
    if (!OPERATOR_URL) return;
    window.location.assign(`${OPERATOR_URL}/?org=${encodeURIComponent(orgSlug)}`);
  }

  function normalizeSlug(s: string) {
    return s
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-_]/g, "");
  }

  async function createOrg() {
    const slug = normalizeSlug(cSlug);
    if (!slug) {
      setErr("Slug invalide.");
      return;
    }

    setErr(null);
    setBusyId("create");

    const payload = {
      slug,
      name: cName.trim() || slug,
      sport: cSport,
      status: cStatus,
      is_master: false,
    };

    const { error } = await supabase.from("orgs").insert(payload);

    setBusyId(null);

    if (error) {
      setErr(error.message);
      return;
    }

    setCreateOpen(false);
    setCSlug("");
    setCName("");
    setCSport("football");
    setCStatus("active");
    await load();
  }

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h2 style={{ marginTop: 0, marginBottom: 10 }}>Organisations</h2>
        <button onClick={() => setCreateOpen(true)} style={btn()}>
          + Créer une org
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Recherche (slug/nom)..." style={input()} />

        <select value={sportFilter} onChange={(e) => setSportFilter(e.target.value)} style={input()}>
          <option value="all">Tous sports</option>
          {sports.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} style={input()}>
          <option value="active">Actives</option>
          <option value="active+archived">Actives + Archivées</option>
          <option value="all">Toutes</option>
        </select>

        <div style={{ marginLeft: "auto", opacity: 0.75, fontSize: 12 }}>
          {loading ? "Chargement…" : `${filtered.length} org(s)`}
        </div>
      </div>

      {err ? (
        <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, border: "1px solid rgba(220,38,38,.35)", background: "rgba(220,38,38,.12)" }}>
          {err}
        </div>
      ) : null}

      {loading ? (
        <div>Chargement…</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {filtered.map((o) => {
            const isMaster = o.slug === "master" || o.is_master;
            const isBusy = busyId === o.id;

            return (
              <div key={o.id} style={row()}>
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 950 }}>{o.name || o.slug}</div>
                    <span style={{ opacity: 0.7, fontSize: 12 }}>{o.slug}</span>
                    {isMaster ? (
                      <span style={pill()}>MASTER</span>
                    ) : (
                      <span style={{ opacity: 0.8, fontSize: 12 }}>{statusLabel(o.status)}</span>
                    )}
                    {o.sport ? <span style={{ opacity: 0.8, fontSize: 12 }}>🏷️ {o.sport}</span> : null}
                  </div>
                  <div style={{ opacity: 0.75, fontSize: 12 }}>{o.created_at ? `Créée: ${new Date(o.created_at).toLocaleString()}` : ""}</div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <button onClick={() => openOperator(o.slug)} style={btnGhost()}>
                    Operator
                  </button>

                  <button disabled={isMaster || isBusy} onClick={() => updateStatus(o, "active")} style={btnGhost()}>
                    Activer
                  </button>

                  <button disabled={isMaster || isBusy} onClick={() => updateStatus(o, "suspended")} style={btnGhost()}>
                    Suspendre
                  </button>

                  <button disabled={isMaster || isBusy} onClick={() => updateStatus(o, "archived")} style={btnDanger()}>
                    Archiver
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {createOpen ? (
        <div style={modalOverlay()}>
          <div style={modal()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontWeight: 950 }}>Créer une organisation</div>
              <button onClick={() => setCreateOpen(false)} style={btnGhost()}>
                ✕
              </button>
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <label style={lbl()}>
                Slug (unique)
                <input value={cSlug} onChange={(e) => setCSlug(e.target.value)} placeholder="ex: ville-paris / club-asm" style={input()} />
              </label>

              <label style={lbl()}>
                Nom
                <input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Nom affiché" style={input()} />
              </label>

              <label style={lbl()}>
                Sport
                <select value={cSport} onChange={(e) => setCSport(e.target.value)} style={input()}>
                  <option value="football">football</option>
                  <option value="basket">basket</option>
                  <option value="handball">handball</option>
                  <option value="volleyball">volleyball</option>
                  <option value="rugby">rugby</option>
                </select>
              </label>

              <label style={lbl()}>
                Status initial
                <select value={cStatus} onChange={(e) => setCStatus(e.target.value)} style={input()}>
                  <option value="active">active</option>
                  <option value="suspended">suspended</option>
                  <option value="archived">archived</option>
                </select>
              </label>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
                <button onClick={() => setCreateOpen(false)} style={btnGhost()}>
                  Annuler
                </button>
                <button disabled={busyId === "create"} onClick={createOrg} style={btn()}>
                  {busyId === "create" ? "Création…" : "Créer"}
                </button>
              </div>

              <div style={{ opacity: 0.75, fontSize: 12 }}>
                Note: une org <b>archivée</b> sera en <b>read-only</b> (RLS).
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* minimal UI helpers (AdminLayout injecte déjà vars CSS) */
function row(): React.CSSProperties {
  return { border: "1px solid var(--border)", background: "var(--panel)", borderRadius: 14, padding: 12, display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center" };
}
function input(): React.CSSProperties {
  return { border: "1px solid var(--border)", background: "var(--panel)", color: "var(--text)", padding: "10px 12px", borderRadius: 12, outline: "none", minWidth: 220 };
}
function btn(): React.CSSProperties {
  return { border: "1px solid var(--border)", background: "rgba(96,165,250,.18)", color: "var(--text)", padding: "10px 12px", borderRadius: 12, fontWeight: 950, cursor: "pointer" };
}
function btnGhost(): React.CSSProperties {
  return { border: "1px solid var(--border)", background: "var(--panel)", color: "var(--text)", padding: "10px 12px", borderRadius: 12, fontWeight: 900, cursor: "pointer" };
}
function btnDanger(): React.CSSProperties {
  return { border: "1px solid rgba(220,38,38,.35)", background: "rgba(220,38,38,.14)", color: "var(--text)", padding: "10px 12px", borderRadius: 12, fontWeight: 900, cursor: "pointer" };
}
function pill(): React.CSSProperties {
  return { border: "1px solid var(--border)", background: "rgba(255,255,255,.06)", padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 900 };
}
function modalOverlay(): React.CSSProperties {
  return { position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "grid", placeItems: "center", padding: 14, zIndex: 50 };
}
function modal(): React.CSSProperties {
  return { width: "min(560px, 96vw)", background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 16, padding: 14 };
}
function lbl(): React.CSSProperties {
  return { display: "grid", gap: 6, fontSize: 12, opacity: 0.9 };
}
