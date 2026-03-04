import React, { useEffect, useMemo, useState } from "react";
import { supa } from "../supabase";
import type { MatchInfo } from "@pkg/types";
import { MatchPage } from "./MatchPage";

type Props = {
  orgId: string;
};

function isArchived(m: any) {
  const s = String(m?.status ?? "").toLowerCase().trim();
  return s === "finished" || s === "archived" || !!m?.archived_at;
}

function fmt(iso: any) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

export function MatchesPage({ orgId }: Props) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [matches, setMatches] = useState<MatchInfo[]>([]);
  const [selected, setSelected] = useState<MatchInfo | null>(null);

  // “activeMatch” (si tu veux garder une logique de match en cours)
  const activeMatch = useMemo(() => {
    const live = (matches as any[]).find((m) => m?.is_live === true || String(m?.status ?? "").toLowerCase() === "live");
    return (live ?? null) as any;
  }, [matches]);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      // On récupère tous les matchs de l'org
      const { data, error } = await supa
        .from("matches")
        .select(
          "id,org_id,org_slug,name,home_name,away_name,scheduled_at,status,public_display,display_token,created_at,updated_at,home_team_id,away_team_id,home_score,away_score,is_live,archived_at"
        )
        .eq("org_id", orgId)
        .order("scheduled_at", { ascending: true });

      if (error) throw error;
      setMatches((data ?? []) as any);
    } catch (e: any) {
      setErr(e?.message ?? "Erreur chargement matches");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const scheduled = useMemo(() => (matches as any[]).filter((m) => !isArchived(m)), [matches]);
  const archived = useMemo(
    () =>
      (matches as any[])
        .filter((m) => isArchived(m))
        .sort((a, b) => {
          // archived_at desc, sinon updated_at desc
          const ta = new Date(a.archived_at ?? a.updated_at ?? 0).getTime();
          const tb = new Date(b.archived_at ?? b.updated_at ?? 0).getTime();
          return tb - ta;
        }),
    [matches]
  );

  if (selected) {
    return (
      <MatchPage
        match={selected as any}
        activeMatch={activeMatch as any}
        onBack={() => setSelected(null)}
        onMatchesUpdate={(next) => setMatches(next as any)}
      />
    );
  }

  return (
    <div style={{ padding: 18, color: "#e5e7eb" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Matches</div>
          <div style={{ fontSize: 12, color: "#9aa0a6" }}>
            org_id: <code style={{ userSelect: "all" }}>{orgId}</code>
          </div>
        </div>

        <button
          onClick={load}
          disabled={loading}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #2a2d33",
            background: "#14161a",
            color: "#e5e7eb",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {err ? (
        <div style={{ marginTop: 12, background: "#1a0f10", border: "1px solid #3a1c1f", padding: 12, borderRadius: 12 }}>
          ❌ {err}
        </div>
      ) : null}

      {loading ? <div style={{ marginTop: 12, color: "#9aa0a6" }}>Chargement…</div> : null}

      {/* Scheduled */}
      <div style={{ marginTop: 16, border: "1px solid #2a2d33", borderRadius: 14, padding: 12, background: "#0f1114" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <div style={{ fontWeight: 900 }}>À venir / préparation</div>
          <div style={{ fontSize: 12, color: "#9aa0a6" }}>{scheduled.length} match(s)</div>
        </div>

        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          {scheduled.length === 0 ? (
            <div style={{ color: "#6b7280", fontSize: 12 }}>Aucun match en préparation.</div>
          ) : (
            scheduled.map((m: any) => (
              <button
                key={m.id}
                onClick={() => setSelected(m)}
                style={{
                  textAlign: "left",
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid #2a2d33",
                  background: "#111214",
                  color: "#e5e7eb",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{m.name ?? "Match"}</div>
                    <div style={{ fontSize: 12, color: "#9aa0a6" }}>
                      {m.home_name ?? "HOME"} vs {m.away_name ?? "AWAY"}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>{fmt(m.scheduled_at)}</div>
                  </div>

                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontSize: 12, color: String(m.status).toLowerCase() === "live" || m.is_live ? "#4ade80" : "#9aa0a6" }}>
                      {String(m.status ?? "scheduled").toUpperCase()}
                      {m.is_live ? " 🔴" : ""}
                    </div>

                    <div style={{ fontSize: 12, color: "#9aa0a6" }}>
                      public: <code>{String(!!m.public_display)}</code>
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Archived */}
      <div style={{ marginTop: 16, border: "1px solid #2a2d33", borderRadius: 14, padding: 12, background: "#0f1114" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <div style={{ fontWeight: 900 }}>Archivés</div>
          <div style={{ fontSize: 12, color: "#9aa0a6" }}>{archived.length} match(s)</div>
        </div>

        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          {archived.length === 0 ? (
            <div style={{ color: "#6b7280", fontSize: 12 }}>Aucun match archivé.</div>
          ) : (
            archived.map((m: any) => (
              <button
                key={m.id}
                onClick={() => setSelected(m)}
                style={{
                  textAlign: "left",
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid #2a2d33",
                  background: "#0e0f12",
                  color: "#e5e7eb",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{m.name ?? "Match"}</div>
                    <div style={{ fontSize: 12, color: "#9aa0a6" }}>
                      {m.home_name ?? "HOME"} vs {m.away_name ?? "AWAY"}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      archivé: {fmt(m.archived_at ?? m.updated_at)}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontSize: 12, color: "#9aa0a6" }}>
                      score: <code>{m.home_score ?? 0}</code> - <code>{m.away_score ?? 0}</code>
                    </div>
                    <div style={{ fontSize: 12, color: "#9aa0a6" }}>
                      status: <code>{String(m.status ?? "")}</code>
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
