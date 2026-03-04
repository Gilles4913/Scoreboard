import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

type Org = {
  id: string;
  slug: string;
  name: string;
  sport: string | null;
  is_master: boolean;
};

const SPORTS = ["football", "basket", "volleyball", "handball", "rugby"];

export default function OrgsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [sport, setSport] = useState("football");

  const canCreate = useMemo(() => slug.trim().length >= 2 && name.trim().length >= 2, [slug, name]);

  async function load() {
    setLoading(true);
    setErr(null);

    const { data, error } = await supabase
      .from("orgs")
      .select("id,slug,name,sport,is_master")
      .order("is_master", { ascending: false })
      .order("name", { ascending: true });

    setLoading(false);

    if (error) {
      setErr(error.message);
      return;
    }
    setOrgs((data as Org[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function createOrg() {
    setErr(null);
    const s = slug.trim();
    const n = name.trim();

    const { error } = await supabase.from("orgs").insert({
      slug: s,
      name: n,
      sport,
      is_master: false,
    });

    if (error) {
      setErr(error.message);
      return;
    }

    setSlug("");
    setName("");
    await load();
  }

  async function deleteOrg(o: Org) {
    if (o.is_master) {
      alert("Impossible de supprimer l'organisation MASTER.");
      return;
    }
    if (!confirm(`Supprimer l'organisation "${o.name}" ?`)) return;

    const { error } = await supabase.from("orgs").delete().eq("id", o.id);
    if (error) {
      setErr(error.message);
      return;
    }
    await load();
  }

  return (
    <div>
      <h2>Organisations</h2>

      <div style={{ display: "grid", gap: 8, maxWidth: 560, padding: 12, border: "1px solid #e5e7eb", borderRadius: 12 }}>
        <div style={{ fontWeight: 800 }}>Créer une organisation</div>

        <label>Slug</label>
        <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="ex: club-psg" />

        <label>Nom</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Club PSG" />

        <label>Sport</label>
        <select value={sport} onChange={(e) => setSport(e.target.value)}>
          {SPORTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <button disabled={!canCreate} onClick={createOrg} style={{ padding: "8px 10px", fontWeight: 800 }}>
          Créer
        </button>

        {err && <div style={{ color: "crimson" }}>{err}</div>}
      </div>

      <div style={{ height: 16 }} />

      {loading ? (
        <p>Chargement...</p>
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: 900 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Nom</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Slug</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Sport</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Master</th>
              <th style={{ borderBottom: "1px solid #e5e7eb", padding: 8 }} />
            </tr>
          </thead>
          <tbody>
            {orgs.map((o) => (
              <tr key={o.id}>
                <td style={{ padding: 8 }}>{o.name}</td>
                <td style={{ padding: 8 }}>{o.slug}</td>
                <td style={{ padding: 8 }}>{o.sport ?? "-"}</td>
                <td style={{ padding: 8 }}>{o.is_master ? "✅" : ""}</td>
                <td style={{ padding: 8, textAlign: "right" }}>
                  <button onClick={() => deleteOrg(o)} disabled={o.is_master}>
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
