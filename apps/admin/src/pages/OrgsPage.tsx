import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

type Org = {
  id: string;
  slug: string;
  name: string | null;
  sport: string | null;
  status: string | null;
  created_at?: string | null;
};

function getEnv(name: string) {
  const v = (import.meta as any).env?.[name];
  return typeof v === "string" ? v : "";
}

const OPERATOR_URL = (getEnv("VITE_OPERATOR_URL") || "").replace(/\/$/, "");

export default function OrgsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [sportFilter, setSportFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");

  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);

    const { data, error } = await supabase
      .from("orgs")
      .select("id,slug,name,sport,status,created_at")
      .order("slug");

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

  async function updateStatus(org: Org, status: string) {
    const { error } = await supabase
      .from("orgs")
      .update({ status })
      .eq("id", org.id);

    if (error) {
      alert(error.message);
      return;
    }

    await load();
  }

  function openOperator(slug: string) {
    if (!OPERATOR_URL) return;
    window.location.assign(`${OPERATOR_URL}/?org=${slug}`);
  }

  const sports = useMemo(() => {
    const set = new Set<string>();
    orgs.forEach(o => {
      if (o.sport) set.add(o.sport);
    });
    return Array.from(set).sort();
  }, [orgs]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();

    return orgs.filter(o => {
      const status = (o.status || "active").toLowerCase();

      if (statusFilter === "active" && status !== "active") return false;
      if (statusFilter === "archived" && status !== "archived") return false;

      if (sportFilter !== "all" && o.sport !== sportFilter) return false;

      if (!q) return true;

      return (
        (o.slug || "").toLowerCase().includes(q) ||
        (o.name || "").toLowerCase().includes(q)
      );
    });
  }, [orgs, query, sportFilter, statusFilter]);

  return (
    <div style={{ maxWidth: 1100 }}>
      <h2>Organisations</h2>

      <div style={{ marginBottom: 16, display: "flex", gap: 10 }}>
        <input
          placeholder="Recherche organisation..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />

        <select
          value={sportFilter}
          onChange={e => setSportFilter(e.target.value)}
        >
          <option value="all">Tous sports</option>
          {sports.map(s => (
            <option key={s}>{s}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="active">Actives</option>
          <option value="archived">Archivées</option>
          <option value="all">Toutes</option>
        </select>
      </div>

      {loading ? (
        <div>Chargement...</div>
      ) : (
        <table style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Slug</th>
              <th>Nom</th>
              <th>Sport</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map(org => (
              <tr key={org.id}>
                <td>{org.slug}</td>
                <td>{org.name}</td>
                <td>{org.sport}</td>

                <td>
                  {org.status === "active" && "🟢 Active"}
                  {org.status === "suspended" && "🟠 Suspendue"}
                  {org.status === "archived" && "⚪ Archivée"}
                </td>

                <td style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => openOperator(org.slug)}>
                    Operator
                  </button>

                  {org.status !== "active" && (
                    <button onClick={() => updateStatus(org, "active")}>
                      Activer
                    </button>
                  )}

                  {org.status === "active" && (
                    <button onClick={() => updateStatus(org, "suspended")}>
                      Suspendre
                    </button>
                  )}

                  {org.status !== "archived" && (
                    <button onClick={() => updateStatus(org, "archived")}>
                      Archiver
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {err && <div style={{ color: "red" }}>{err}</div>}
    </div>
  );
}
