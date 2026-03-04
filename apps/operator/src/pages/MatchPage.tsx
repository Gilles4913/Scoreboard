import React, { useMemo, useState } from "react";
import type { MatchInfo } from "@pkg/types";
import { MatchDisplayModal } from "../components/MatchDisplayModal";
import { supa } from "../supabase";

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

export function MatchPage({ match, onBack, activeMatch, onMatchesUpdate }: Props) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // modal display (QR)
  const [displayOpen, setDisplayOpen] = useState(false);

  const isActive = useMemo(() => {
    if (!activeMatch) return false;
    return activeMatch.id === (match as any).id && (normStatus((match as any).status) === "live" || normStatus((match as any).status) === "in_progress");
  }, [activeMatch, match]);

  async function togglePublicDisplay() {
    try {
      setSaving(true);
      setError("");

      const next = !(match as any).public_display;

      const { error } = await supa
        .from("matches")
        .update({ public_display: next })
        .eq("id", (match as any).id);

      if (error) throw error;

      // recharge liste (simple : re-fetch org matches)
      const { data, error: e2 } = await supa
        .from("matches")
        .select("id,org_id,name,home_name,away_name,scheduled_at,status,public_display,display_token,created_at,updated_at,home_team_id,away_team_id")
        .eq("org_id", (match as any).org_id);

      if (e2) throw e2;
      onMatchesUpdate((data ?? []) as any);
    } catch (e: any) {
      setError(e?.message ?? "Erreur toggle public_display");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 18, color: "#e5e7eb" }}>
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
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #2a2d33", background: "#14161a", color: "#e5e7eb" }}
          >
            ← Retour
          </button>

          <button
            onClick={togglePublicDisplay}
            disabled={saving}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #2a2d33",
              background: "#14161a",
              color: "#e5e7eb",
            }}
            title="Active/désactive l’affichage public (Edge Function vérifie public_display=true)"
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

          <div style={{ fontSize: 12, color: isActive ? "#4ade80" : "#9aa0a6" }}>
            {isActive ? "🔴 Match actif" : "⏸️ Inactif"}
          </div>
        </div>
      </div>

      {error ? (
        <div style={{ marginTop: 12, background: "#1a0f10", border: "1px solid #3a1c1f", padding: 12, borderRadius: 12 }}>
          ❌ {error}
        </div>
      ) : null}

      {/* Ici tu peux ré-intégrer tes blocs “faits de jeu / score / contrôles” si tu les avais déjà.
          Cette version est safe DB car elle ne dépend que de matches.
      */}
      <div style={{ marginTop: 16, border: "1px solid #2a2d33", borderRadius: 14, padding: 12, background: "#0f1114" }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Infos DB</div>
        <div style={{ fontSize: 12, color: "#9aa0a6" }}>
          id: <code style={{ userSelect: "all" }}>{(match as any).id}</code>
        </div>
        <div style={{ fontSize: 12, color: "#9aa0a6" }}>
          org_id: <code style={{ userSelect: "all" }}>{(match as any).org_id}</code>
        </div>
        <div style={{ fontSize: 12, color: "#9aa0a6" }}>
          token: <code style={{ userSelect: "all" }}>{(match as any).display_token ?? "—"}</code>
        </div>
      </div>

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
