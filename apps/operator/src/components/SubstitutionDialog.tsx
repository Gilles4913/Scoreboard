import React, { useState } from "react";

export type SubstPlayer = {
  id: string;
  name: string;
  number: string;
  is_on_field?: boolean;
};

type Props = {
  sport: "rugby" | "football";
  matchId: string;
  orgId: string;
  currentPeriodIndex: number;
  clockMs: number;
  homeName: string;
  awayName: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homePlayers: SubstPlayer[];
  awayPlayers: SubstPlayer[];
  onConfirm: (sub: SubstitutionPayload) => Promise<void>;
  onClose: () => void;
};

export type SubstitutionPayload = {
  teamSide: "home" | "away";
  teamId: string | null;
  playerOut: SubstPlayer;
  playerIn: SubstPlayer;
  reason: string;
  isTemporary: boolean;
  isBloodSubstitution: boolean;
};

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 9999, padding: 16,
};
const box: React.CSSProperties = {
  background: "#1e293b", border: "1px solid #334155",
  borderRadius: 12, padding: 24, width: "100%", maxWidth: 480,
  display: "flex", flexDirection: "column", gap: 20,
};
const title: React.CSSProperties = {
  fontSize: 18, fontWeight: 700, color: "#f8fafc",
};
const label: React.CSSProperties = {
  fontSize: 12, color: "#94a3b8", marginBottom: 4, display: "block",
};
const sel: React.CSSProperties = {
  width: "100%", background: "#0f172a", color: "#f8fafc",
  border: "1px solid #334155", borderRadius: 8, padding: "8px 10px",
  fontSize: 14,
};
const row: React.CSSProperties = { display: "flex", gap: 12, alignItems: "center" };
const checkLabel: React.CSSProperties = { display: "flex", gap: 8, alignItems: "center", color: "#cbd5e1", fontSize: 14 };
const btn = (primary: boolean): React.CSSProperties => ({
  flex: 1, padding: "10px 0", borderRadius: 8, border: "none",
  cursor: "pointer", fontWeight: 600, fontSize: 14,
  background: primary ? "#3b82f6" : "#334155",
  color: primary ? "#fff" : "#cbd5e1",
});

export default function SubstitutionDialog({
  sport, matchId, orgId, currentPeriodIndex, clockMs,
  homeName, awayName, homeTeamId, awayTeamId,
  homePlayers, awayPlayers, onConfirm, onClose,
}: Props) {
  const [teamSide, setTeamSide] = useState<"home" | "away">("home");
  const [playerOutId, setPlayerOutId] = useState("");
  const [playerInId, setPlayerInId] = useState("");
  const [reason, setReason] = useState("tactical");
  const [isTemporary, setIsTemporary] = useState(false);
  const [isBlood, setIsBlood] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const players = teamSide === "home" ? homePlayers : awayPlayers;
  const teamId = teamSide === "home" ? homeTeamId : awayTeamId;

  const candidatesOut = players;
  const candidatesIn = players.filter((p) => p.id !== playerOutId);

  async function handleConfirm() {
    if (!playerOutId || !playerInId) {
      setErr("Sélectionnez un joueur sortant et un joueur entrant.");
      return;
    }
    if (playerOutId === playerInId) {
      setErr("Le joueur sortant et entrant doivent être différents.");
      return;
    }
    const pOut = players.find((p) => p.id === playerOutId);
    const pIn = players.find((p) => p.id === playerInId);
    if (!pOut || !pIn) {
      setErr("Joueur introuvable.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      await onConfirm({
        teamSide,
        teamId,
        playerOut: pOut,
        playerIn: pIn,
        reason,
        isTemporary,
        isBloodSubstitution: isBlood,
      });
      onClose();
    } catch (e: any) {
      setErr(e?.message || "Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={box}>
        <div style={title}>Remplacement {sport === "rugby" ? "rugby" : "football"}</div>

        <div>
          <span style={label}>Équipe</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => { setTeamSide("home"); setPlayerOutId(""); setPlayerInId(""); }}
              style={{ ...btn(teamSide === "home"), flex: "none", padding: "8px 16px" }}
            >
              {homeName}
            </button>
            <button
              onClick={() => { setTeamSide("away"); setPlayerOutId(""); setPlayerInId(""); }}
              style={{ ...btn(teamSide === "away"), flex: "none", padding: "8px 16px" }}
            >
              {awayName}
            </button>
          </div>
        </div>

        <div>
          <span style={label}>Joueur sortant</span>
          <select style={sel} value={playerOutId} onChange={(e) => { setPlayerOutId(e.target.value); if (playerInId === e.target.value) setPlayerInId(""); }}>
            <option value="">— choisir —</option>
            {candidatesOut.map((p) => (
              <option key={p.id} value={p.id} style={{ background: "#0f172a", color: "#f8fafc" }}>
                #{p.number} {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span style={label}>Joueur entrant</span>
          <select style={sel} value={playerInId} onChange={(e) => setPlayerInId(e.target.value)}>
            <option value="">— choisir —</option>
            {candidatesIn.map((p) => (
              <option key={p.id} value={p.id} style={{ background: "#0f172a", color: "#f8fafc" }}>
                #{p.number} {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span style={label}>Raison</span>
          <select style={sel} value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="tactical" style={{ background: "#0f172a", color: "#f8fafc" }}>Tactique</option>
            <option value="injury" style={{ background: "#0f172a", color: "#f8fafc" }}>Blessure</option>
            <option value="blood" style={{ background: "#0f172a", color: "#f8fafc" }}>Blessure sang</option>
            <option value="other" style={{ background: "#0f172a", color: "#f8fafc" }}>Autre</option>
          </select>
        </div>

        {sport === "rugby" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={checkLabel}>
              <input type="checkbox" checked={isTemporary} onChange={(e) => setIsTemporary(e.target.checked)} />
              Remplacement temporaire (HIA / blood)
            </label>
            <label style={checkLabel}>
              <input type="checkbox" checked={isBlood} onChange={(e) => setIsBlood(e.target.checked)} />
              Substitution sang
            </label>
          </div>
        )}

        {err && <div style={{ color: "#f87171", fontSize: 13 }}>{err}</div>}

        <div style={{ ...row, marginTop: 4 }}>
          <button style={btn(false)} onClick={onClose} disabled={saving}>Annuler</button>
          <button style={btn(true)} onClick={handleConfirm} disabled={saving}>
            {saving ? "Enregistrement…" : "Valider"}
          </button>
        </div>
      </div>
    </div>
  );
}
