import React, { useMemo, useState } from "react";
import type { MatchInfo } from "@pkg/types";
import { MatchDisplayModal } from "../components/MatchDisplayModal";
import { supa } from "../supabase";

type Props = {
  match: MatchInfo;
  onBack: () => void;
  activeMatch: MatchInfo | null; // peut être null si tu ne gères pas encore "match actif"
  onMatchesUpdate: (next: MatchInfo[]) => void; // callback pour mettre à jour la liste en mémoire
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

  async function refreshOrgMatches() {
    // Recharge les matches de l'org pour que la liste (SpacePage) se mette à jour
    const { data, error } = await supa
      .from("matches")
      .select(
        "id,org_id,name,home_name,away_name,scheduled_at,status,public_display,display_token,created_at,updated_at,home_team_id,away_team_id"
      )
      .eq("org_id", orgId)
      .order("scheduled_at", { ascending: true });

    if (error) throw error;
    onMatchesUpdate((data ?? []) as any);
  }

  async function updateStatus(nextStatus: "scheduled" | "live" | "finished") {
    try {
      setBusy(true);
      setError("");

      const { error } = await supa.from("matches").update({ status: nextStatus }).eq("id", matchId);
      if (error) throw error;

      await refreshOrgMatches();
    } catch (e: any) {
      setError(e?.message ?? "Erreur mise à jour status");
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

      await refreshOrgMatches();
    } catch (e: any) {
      setError(e?.message ?? "Erreur toggle public_display");
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
            title="Le Display Edge Function n'autorise que public_display=true"
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

      {/* Actions LIVE */}
      <div style={{ marginTop: 16, border: "1px solid #2a2d33", borderRadius: 14, padding: 12, background: "#0f1114" }}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>Contrôles match</div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={() => updateStatus("live")}
            disabled={busy || isLive}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #2a2d33",
              background: isLive ? "#0f1114" : "#14161a",
              color: isLive ? "#6b7280" : "#e5e7eb",
              cursor: busy || isLive ? "not-allowed" : "pointer",
            }}
            title="Passe le match en LIVE (affichage temps réel / broadcast)"
          >
            ▶️ Start (LIVE)
          </button>

          <button
            onClick={() => updateStatus("scheduled")}
            disabled={busy || status === "scheduled"}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #2a2d33",
              background: status === "scheduled" ? "#0f1114" : "#14161a",
              color: status === "scheduled" ? "#6b7280" : "#e5e7eb",
              cursor: busy || status === "scheduled" ? "not-allowed" : "pointer",
            }}
            title="Remet le match en préparation"
          >
            ↩️ Back to scheduled
          </button>

          <button
            onClick={() => updateStatus("finished")}
            disabled={busy || isFinished}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #2a2d33",
              background: isFinished ? "#0f1114" : "#14161a",
              color: isFinished ? "#6b7280" : "#e5e7eb",
              cursor: busy || isFinished ? "not-allowed" : "pointer",
            }}
            title="Passe le match en terminé (archivable)"
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
          Pour l’instant ta DB n’a que <code>scheduled</code>. Ces boutons introduisent <code>live</code> et <code>finished</code>.
        </div>
      </div>

      {/* Infos DB */}
      <div style={{ marginTop: 16, border: "1px solid #2a2d33", borderRadius: 14, padding: 12, background: "#0f1114" }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Infos DB</div>
        <div style={{ fontSize: 12, color: "#9aa0a6" }}>
          id: <code style={{ userSelect: "all" }}>{matchId}</code>
        </div>
        <div style={{ fontSize: 12, color: "#9aa0a6" }}>
          org_id: <code style={{ userSelect: "all" }}>{orgId}</code>
        </div>
        <div style={{ fontSize: 12, color: "#9aa0a6" }}>
          token: <code style={{ userSelect: "all" }}>{(match as any).display_token ?? "—"}</code>
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
        }}
      />
    </div>
  );
}
