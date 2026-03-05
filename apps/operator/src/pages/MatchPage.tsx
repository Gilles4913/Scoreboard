// apps/operator/src/pages/MatchPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

const LS_ACTIVE_ORG_ID = "scoreDisplay.activeOrgId";
const LS_ACTIVE_ORG_SLUG = "scoreDisplay.activeOrgSlug";

type MatchRow = {
  id: string;
  name: string | null;
  status: string | null;
  scheduled_at: string | null;
  public_display: boolean | null;
  display_token: string | null;
  home_name: string | null;
  away_name: string | null;
};

type OrgRow = {
  id: string;
  slug: string;
  name: string;
  status?: string | null;
};

export default function MatchPage() {
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<OrgRow | null>(null);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [err, setErr] = useState("");

  const displayBaseUrl = ((import.meta as any).env?.VITE_DISPLAY_URL as string | undefined) || "";

  const activeOrgId = useMemo(() => (localStorage.getItem(LS_ACTIVE_ORG_ID) || "").trim(), []);
  const activeOrgSlug = useMemo(() => (localStorage.getItem(LS_ACTIVE_ORG_SLUG) || "").trim(), []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setErr("");
      setLoading(true);

      // 1) il faut une session auth (sinon RLS refuse)
      const { data: sess } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!sess.session?.user) {
        setErr("Non connecté. Reviens sur Home pour te connecter.");
        setLoading(false);
        return;
      }

      // 2) il faut une org sélectionnée dans Home
      if (!activeOrgId && !activeOrgSlug) {
        setErr("Aucune organisation sélectionnée. Reviens sur Home et clique sur Ouvrir.");
        setLoading(false);
        return;
      }

      // charge org (par id si dispo, sinon slug)
      const orgQuery = supabase.from("orgs").select("id, slug, name, status");
      const { data: orgRow, error: orgErr } = activeOrgId
        ? await orgQuery.eq("id", activeOrgId).maybeSingle()
        : await orgQuery.eq("slug", activeOrgSlug).maybeSingle();

      if (cancelled) return;

      if (orgErr || !orgRow) {
        setErr(orgErr?.message || "Organisation introuvable.");
        setOrg(null);
        setMatches([]);
        setLoading(false);
        return;
      }

      setOrg(orgRow as any);

      // charge matchs
      const { data: ms, error: mErr } = await supabase
        .from("matches")
        .select("id, name, status, scheduled_at, public_display, display_token, home_name, away_name")
        .eq("org_id", (orgRow as any).id)
        .order("scheduled_at", { ascending: true, nullsFirst: true });

      if (cancelled) return;

      if (mErr) {
        setErr(mErr.message);
        setMatches([]);
      } else {
        setMatches((ms as any) || []);
      }

      setLoading(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [activeOrgId, activeOrgSlug]);

  async function logout() {
    await supabase.auth.signOut();
    window.location.reload();
  }

  function displayLink(m: MatchRow) {
    if (!displayBaseUrl) return "";
    const base = displayBaseUrl.replace(/\/$/, "");
    if (m.display_token) return `${base}/?token=${encodeURIComponent(m.display_token)}`;
    return `${base}/?matchId=${encodeURIComponent(m.id)}`;
  }

  if (loading) return <div style={{ padding: 24 }}>Chargement…</div>;

  if (err)
    return (
      <div style={{ padding: 24 }}>
        <div style={{ color: "crimson", fontWeight: 700 }}>Erreur: {err}</div>
        <div style={{ marginTop: 12 }}>
          <button onClick={logout}>Se déconnecter</button>
        </div>
      </div>
    );

  if (!org) return <div style={{ padding: 24 }}>Organisation non définie.</div>;

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>{org.name}</h1>
          <div style={{ opacity: 0.75, fontSize: 12 }}>
            slug: {org.slug} {org.status ? `• status: ${org.status}` : null}
          </div>
        </div>
        <button onClick={logout}>Déconnexion</button>
      </div>

      <h2 style={{ marginTop: 18 }}>Matchs</h2>

      {matches.length === 0 ? (
        <div>Aucun match.</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {matches.map((m) => {
            const link = displayLink(m);
            return (
              <div
                key={m.id}
                style={{
                  border: "1px solid #3333",
                  borderRadius: 12,
                  padding: 12,
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ fontWeight: 700 }}>
                    {m.name || `${m.home_name || "Home"} vs ${m.away_name || "Away"}`}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    {m.status || "scheduled"} {m.scheduled_at ? `• ${new Date(m.scheduled_at).toLocaleString()}` : ""}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, opacity: 0.9 }}>
                    Display: {m.public_display ? "public" : "privé"} {m.display_token ? "• token OK" : ""}
                  </span>

                  {link ? (
                    <>
                      <a href={link} target="_blank" rel="noreferrer">
                        Ouvrir Display
                      </a>
                      <button
                        onClick={() => navigator.clipboard.writeText(link)}
                        style={{ fontSize: 12, padding: "6px 10px" }}
                      >
                        Copier lien
                      </button>
                    </>
                  ) : (
                    <span style={{ fontSize: 12, color: "crimson" }}>VITE_DISPLAY_URL manquant côté operator.</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
