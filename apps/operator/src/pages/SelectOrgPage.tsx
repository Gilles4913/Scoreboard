import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

const LS_ACTIVE_ORG_KEY = "scoreDisplay.activeOrgSlug";

type OrgRow = {
  id: string;
  slug: string;
  name: string;
  status?: string | null;
};

type MemberRow = {
  role: string;
  orgs: OrgRow | null;
};

export default function SelectOrgPage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string>("");
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [err, setErr] = useState<string>("");

  const orgs = useMemo(() => {
    return rows
      .map((r) => r.orgs)
      .filter((o): o is OrgRow => !!o)
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [rows]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setErr("");
      setLoading(true);

      const { data: s } = await supabase.auth.getSession();
      const user = s.session?.user;
      if (!user) {
        setLoading(false);
        setErr("Non connecté.");
        return;
      }
      setEmail(user.email || "");

      // Récup des orgs dont l'utilisateur est membre
      // IMPORTANT: on ne demande PAS org_sport ici (tu as eu l'erreur colonne inexistante)
      const { data, error } = await supabase
        .from("org_members")
        .select("role, orgs(id, slug, name, status)")
        .eq("user_id", user.id);

      if (cancelled) return;

      if (error) {
        setErr(error.message);
        setRows([]);
      } else {
        setRows((data as any) || []);
      }

      setLoading(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  function pickOrg(slug: string) {
    localStorage.setItem(LS_ACTIVE_ORG_KEY, slug);
    nav("/matches");
  }

  async function logout() {
    await supabase.auth.signOut();
    localStorage.removeItem(LS_ACTIVE_ORG_KEY);
    window.location.href = "/";
  }

  if (loading) return <div style={{ padding: 24 }}>Chargement des organisations…</div>;
  if (err) return <div style={{ padding: 24, color: "crimson" }}>Erreur: {err}</div>;

  return (
    <div style={{ padding: 24 }}>
      <h1>Choisir une organisation</h1>
      <div style={{ marginBottom: 12 }}>
        <strong>{email}</strong>{" "}
        <button onClick={logout} style={{ marginLeft: 8 }}>
          Déconnexion
        </button>
      </div>

      {orgs.length === 0 ? (
        <div>Aucune organisation disponible.</div>
      ) : (
        <div style={{ display: "grid", gap: 12, maxWidth: 720 }}>
          {orgs.map((o) => (
            <div
              key={o.id}
              style={{
                border: "1px solid #3333",
                borderRadius: 10,
                padding: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>{o.name}</div>
                <div style={{ opacity: 0.8, fontSize: 12 }}>Slug: {o.slug}</div>
                {o.status ? <div style={{ opacity: 0.8, fontSize: 12 }}>Status: {o.status}</div> : null}
              </div>
              <button onClick={() => pickOrg(o.slug)}>Sélectionner</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
