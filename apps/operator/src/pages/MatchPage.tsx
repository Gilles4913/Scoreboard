import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

const LS_ACTIVE_ORG_KEY = "scoreDisplay.activeOrgSlug";

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
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<OrgRow | null>(null);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [err, setErr] = useState("");

  const displayBaseUrl = (import.meta as any).env?.VITE_DISPLAY_URL as string | undefined;

  const activeOrgSlug = useMemo(() => {
    return (localStorage.getItem(LS_ACTIVE_ORG_KEY) || "").trim();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setErr("");
      setLoading(true);

      if (!activeOrgSlug) {
        nav("/select-org", { replace: true });
        return;
      }

      // charge org
      const { data: orgRow, error: orgErr } = await supabase
        .from("orgs")
        .select("id, slug, name, status")
        .eq("slug", activeOrgSlug)
        .maybeSingle();

      if (cancelled) return;

      if (orgErr || !orgRow) {
        setErr(orgErr?.message || "Organisation introuvable.");
        setOrg(null);
        setMatches([]);
        setLoading(false);
        return;
      }

      setOrg(orgRow as any);

      // charge matchs de l'org
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
  }, [activeOrgSlug, nav]);

  function switchOrg() {
    localStorage.removeItem(LS_ACTIVE_ORG_KEY);
    nav("/select-org");
  }

  function displayLink(m: MatchRow) {
    // ton display utilise token ou matchId selon ton implémentation
    // Ici je pars sur token (plus standard pour display public)
    if (!displayBaseUrl) return "";
    if (m.display_token) return `${displayBaseUrl.replace(/\/$/, "")}/?token=${encodeURIComponent(m.display_token)}`;
    // fallback matchId
    return `${displayBaseUrl.replace(/\/$/, "")}/?matchId=${encodeURIComponent(m.id)}`;
  }

  if (loading) return <div style={{ padding: 24 }}>Chargement…</div>;
  if (err) return <div style={{ padding: 24, color: "crimson" }}>Erreur: {err}</div>;
  if (!org) return <div style={{ padding: 24 }}>Organisation non définie.</div>;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>{org.name}</h1>
          <div style={{ opacity: 0.75, fontSize: 12 }}>
            slug: {org.slug} {org.status ? `• status: ${org.status}` : null}
          </div>
        </div>
        <button onClick={switchOrg}>Changer d’org</button>
      </div>

      <h2 style={{ marginTop: 18 }}>Matchs</h2>

      {matches.length === 0 ? (
        <div>Aucun match.</div>
      ) : (
        <div style={{ display: "grid", gap: 12, maxWidth: 900 }}>
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
                    <span style={{ fontSize: 12, color: "crimson" }}>
                      VITE_DISPLAY_URL manquant côté operator.
                    </span>
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
