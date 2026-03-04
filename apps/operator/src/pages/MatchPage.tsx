import React, { useMemo, useState } from "react";
import type { MatchInfo } from "@pkg/types";
import { MatchDisplayModal } from "../components/MatchDisplayModal";
import { supa } from "../supabase";
import { broadcastMatchUpdate } from "../realtime";

type Props = {
  match: MatchInfo;
  onBack: () => void;
  activeMatch: MatchInfo | null;
  onMatchesUpdate: (next: MatchInfo[]) => void;
};

function fmtDate(iso: any) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

function normStatus(s: any): string {
  return String(s ?? "").toLowerCase().trim();
}

// Champs optionnels "Pro" (si pas encore en DB, on fallback)
function getScore(m: any) {
  return {
    home: typeof m?.home_score === "number" ? m.home_score : 0,
    away: typeof m?.away_score === "number" ? m.away_score : 0,
  };
}

export function MatchPage({ match, onBack, activeMatch, onMatchesUpdate }: Props) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [displayOpen, setDisplayOpen] = useState(false);

  const matchId = (match as any).id as string;
  const orgId = (match as any).org_id as string;

  const status = useMemo(() => normStatus((match as any).status), [match]);

  const isLive = status === "live" || status === "in_progress";
  const isFinished = status === "finished" || status === "completed" || status === "archived";

  const isActive = useMemo(() => {
    if (!activeMatch) return false;
    const aId = (activeMatch as any).id;
    return aId === matchId;
  }, [activeMatch, matchId]);

  const score = useMemo(() => getScore(match as any), [match]);

  async function refreshOrgMatches() {
    // IMPORTANT: on sélectionne large (y compris scores/is_live/archived_at/org_slug si exposé via view)
    const { data, error } = await supa
      .from("matches")
      .select(
        "id,org_id,org_slug,name,home_name,away_name,scheduled_at,status,public_display,display_token,created_at,updated_at,home_team_id,away_team_id,home_score,away_score,is_live,archived_at"
      )
      .eq("org_id", orgId)
      .order("scheduled_at", { ascending: true });

    if (error) throw error;
    onMatchesUpdate((data ?? []) as any);
  }

  async function fetchMatchById(id: string) {
    const { data, error } = await supa
      .from("matches")
      .select(
        "id,org_id,org_slug,name,home_name,away_name,scheduled_at,status,public_display,display_token,created_at,updated_at,home_team_id,away_team_id,home_score,away_score,is_live,archived_at"
      )
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as any;
  }

  async function setLivePro() {
    // Pro: 1 seul match live par org (index unique) + broadcast
    try {
      setBusy(true);
      setError("");

      // 1) Reset is_live sur tous les matches de l'org
      {
        const { error } = await supa.from("matches").update({ is_live: false }).eq("org_id", orgId);
        if (error) throw error;
      }

      // 2) Set ce match live + status=live
      {
        const { error } = await supa
          .from("matches")
          .update({ status: "live", is_live: true })
          .eq("id", matchId);
        if (error) throw error;
      }

      // 3) Recharge et broadcast le match canon
      const canon = await fetchMatchById(matchId);
      await broadcastMatchUpdate(orgId, canon);

      await refreshOrgMatches();
    } catch (e: any) {
      setError(e?.message ?? "Erreur Start LIVE");
    } finally {
      setBusy(false);
    }
  }

  async function setScheduledPro() {
    try {
      setBusy(true);
      setError("");

      const { error } = await supa
        .from("matches")
        .update({ status: "scheduled", is_live: false })
        .eq("id", matchId);
      if (error) throw error;

      const canon = await fetchMatchById(matchId);
      await broadcastMatchUpdate(orgId, canon);

      await refreshOrgMatches();
    } catch (e: any) {
      setError(e?.message ?? "Erreur Back to scheduled");
    } finally {
      setBusy(false);
    }
  }

  async function finishPro() {
    try {
      setBusy(true);
      setError("");

      const { error } = await supa
        .from("matches")
        .update({ status: "finished", is_live: false })
        .eq("id", matchId);
      if (error) throw error;

      const canon = await fetchMatchById(matchId);
      await broadcastMatchUpdate(orgId, canon);

      await refreshOrgMatches();
    } catch (e: any) {
      setError(e?.message ?? "Erreur Finish");
    } finally {
      setBusy(false);
    }
  }

  async function togglePublicDisplay() {
    try {
      setBusy(true);
      setError("");

      const next = !(match as any).public_display;
      const { error } = await supa.from("matches").update({ public_display: next }).eq("id", matchId);
      if (error) throw error;

      const canon = await fetchMatchById(matchId);
      await broadcastMatchUpdate(orgId, canon);

      await refreshOrgMatches();
    } catch (e: any) {
      setError(e?.message ?? "Erreur toggle public_display");
    } finally {
      setBusy(false);
    }
  }

  async function updateScore(deltaHome: number, deltaAway: number) {
    try {
      setBusy(true);
      setError("");

      const nextHome = Math.max(0, score.home + deltaHome);
      const nextAway = Math.max(0, score.away + deltaAway);

      const { error } = await supa
        .from("matches")
        .update({ home_score: nextHome, away_score: nextAway })
        .eq("id", matchId);
      if (error) throw error;

      const canon = await fetchMatchById(matchId);
      await broadcastMatchUpdate(orgId, canon);

      await refreshOrgMatches();
    } catch (e: any) {
      setError(e?.message ?? "Erreur update score");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 18, color: "#e5e7eb" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>{(match as any).name ?? "Match"}</div>
          <div style={{ fontSize: 12, color: "#9aa0a6" }}>
            {(match as any).home_name ?? "HOME"} vs {(match as any).away_name ?? "AWAY"}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            {fmtDate((match as any).scheduled_at)} • status: <code>{String((match as any).status ?? "")}</code>
            {" • "}
            is_live: <code>{String((match as any).is_live ?? false)}</code>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={onBack}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #2a2d33",
              background: "#14161a",
              color: "#e5e7eb",
              cursor: "pointer",
            }}
          >
            ← Retour
          </button>

          <button
            onClick={togglePublicDisplay}
            disabled={busy}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #2a2d33",
              background: "#14161a",
              color: "#e5e7eb",
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            public_display: {(match as any).public_display ? "ON" : "OFF"}
          </button>

          <button
            onClick={() => setDisplayOpen(true)}
            disabled={!(match as any).display_token}
            title={!(match as any).display_token ? "display_token manquant" : "Lien + QR code Display"}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #2a2d33",
              background: !(match as any).display_token ? "#0f1114" : "#14161a",
              color: !(match as any).display_token ? "#6b7280" : "#e5e7eb",
              cursor: !(match as any).display_token ? "not-allowed" : "pointer",
            }}
          >
            📺 Display (QR)
          </button>

          <div style={{ fontSize: 12, color: isLive ? "#4ade80" : "#9aa0a6" }}>
            {isLive ? "🔴 LIVE" : isFinished ? "🏁 FINISHED" : "🗓️ SCHEDULED"}
          </div>

          <div style={{ fontSize: 12, color: isActive ? "#4ade80" : "#9aa0a6" }}>
            {isActive ? "⭐ match actif (UI)" : ""}
          </div>
        </div>
      </div>

      {error ? (
        <div style={{ marginTop: 12, background: "#1a0f10", border: "1px solid #3a1c1f", padding: 12, borderRadius: 12 }}>
          ❌ {error}
        </div>
      ) : null}

      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
        {/* Match lifecycle */}
        <div style={{ border: "1px solid #2a2d33", borderRadius: 14, padding: 12, background: "#0f1114" }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Contrôles match (Pro)</div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button
              onClick={setLivePro}
              disabled={busy || isLive}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #2a2d33",
                background: isLive ? "#0f1114" : "#14161a",
                color: isLive ? "#6b7280" : "#e5e7eb",
                cursor: busy || isLive ? "not-allowed" : "pointer",
              }}
            >
              ▶️ Start (LIVE)
            </button>

            <button
              onClick={setScheduledPro}
              disabled={busy || status === "scheduled"}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #2a2d33",
                background: status === "scheduled" ? "#0f1114" : "#14161a",
                color: status === "scheduled" ? "#6b7280" : "#e5e7eb",
                cursor: busy || status === "scheduled" ? "not-allowed" : "pointer",
              }}
            >
              ↩️ Back to scheduled
            </button>

            <button
              onClick={finishPro}
              disabled={busy || isFinished}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #2a2d33",
                background: isFinished ? "#0f1114" : "#14161a",
                color: isFinished ? "#6b7280" : "#e5e7eb",
                cursor: busy || isFinished ? "not-allowed" : "pointer",
              }}
            >
              🏁 Finish
            </button>

            <button
              onClick={async () => {
                try {
                  setBusy(true);
                  setError("");
                  await refreshOrgMatches();
                } catch (e: any) {
                  setError(e?.message ?? "Erreur refresh");
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #2a2d33",
                background: "#14161a",
                color: "#e5e7eb",
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              🔄 Refresh
            </button>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: "#9aa0a6" }}>
            Broadcast Realtime vers Display sur <code>sb2:org:{orgId}</code>.
          </div>
        </div>

        {/* Scoreboard */}
        <div style={{ border: "1px solid #2a2d33", borderRadius: 14, padding: 12, background: "#0f1114" }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Score (Pro)</div>

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ minWidth: 220 }}>
              <div style={{ fontSize: 12, color: "#9aa0a6" }}>HOME</div>
              <div style={{ fontWeight: 900, fontSize: 28 }}>{score.home}</div>
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button
                  onClick={() => updateScore(+1, 0)}
                  disabled={busy}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #2a2d33",
                    background: "#14161a",
                    color: "#e5e7eb",
                    cursor: busy ? "not-allowed" : "pointer",
                  }}
                >
                  +1
                </button>
                <button
                  onClick={() => updateScore(-1, 0)}
                  disabled={busy || score.home <= 0}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #2a2d33",
                    background: "#14161a",
                    color: "#e5e7eb",
                    cursor: busy || score.home <= 0 ? "not-allowed" : "pointer",
                  }}
                >
                  -1
                </button>
              </div>
            </div>

            <div style={{ minWidth: 220 }}>
              <div style={{ fontSize: 12, color: "#9aa0a6" }}>AWAY</div>
              <div style={{ fontWeight: 900, fontSize: 28 }}>{score.away}</div>
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button
                  onClick={() => updateScore(0, +1)}
                  disabled={busy}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #2a2d33",
                    background: "#14161a",
                    color: "#e5e7eb",
                    cursor: busy ? "not-allowed" : "pointer",
                  }}
                >
                  +1
                </button>
                <button
                  onClick={() => updateScore(0, -1)}
                  disabled={busy || score.away <= 0}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #2a2d33",
                    background: "#14161a",
                    color: "#e5e7eb",
                    cursor: busy || score.away <= 0 ? "not-allowed" : "pointer",
                  }}
                >
                  -1
                </button>
              </div>
            </div>

            <div style={{ fontSize: 12, color: "#9aa0a6", maxWidth: 460 }}>
              Chaque modification = DB update puis broadcast Realtime vers Display.
            </div>
          </div>
        </div>

        {/* Infos DB */}
        <div style={{ border: "1px solid #2a2d33", borderRadius: 14, padding: 12, background: "#0f1114" }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Infos DB</div>
          <div style={{ fontSize: 12, color: "#9aa0a6" }}>
            id: <code style={{ userSelect: "all" }}>{matchId}</code>
          </div>
          <div style={{ fontSize: 12, color: "#9aa0a6" }}>
            org_id: <code style={{ userSelect: "all" }}>{orgId}</code>
          </div>
          <div style={{ fontSize: 12, color: "#9aa0a6" }}>
            org_slug: <code style={{ userSelect: "all" }}>{(match as any).org_slug ?? "—"}</code>
          </div>
          <div style={{ fontSize: 12, color: "#9aa0a6" }}>
            token: <code style={{ userSelect: "all" }}>{(match as any).display_token ?? "—"}</code>
          </div>
          <div style={{ fontSize: 12, color: "#9aa0a6" }}>
            archived_at: <code style={{ userSelect: "all" }}>{String((match as any).archived_at ?? "—")}</code>
          </div>
        </div>
      </div>

      {/* Modal QR */}
      <MatchDisplayModal
        open={displayOpen}
        onClose={() => setDisplayOpen(false)}
        match={{
          id: (match as any).id,
          name: (match as any).name,
          display_token: (match as any).display_token,
          home_name: (match as any).home_name,
          away_name: (match as any).away_name,
          org_slug: (match as any).org_slug,
        }}
      />
    </div>
  );
}
