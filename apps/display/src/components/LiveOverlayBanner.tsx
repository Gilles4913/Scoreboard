import React from "react";

export type LiveOverlay = {
  type: "substitution";
  sport: string;
  team_side: "home" | "away";
  team_name?: string;
  player_out_name?: string;
  player_out_number?: string;
  player_in_name?: string;
  player_in_number?: string;
  duration_ms?: number;
  event_id?: string;
  emitted_at?: number;
};

type Props = {
  overlay: LiveOverlay;
};

export default function LiveOverlayBanner({ overlay }: Props) {
  const teamLabel = overlay.team_name || (overlay.team_side === "home" ? "Domicile" : "Extérieur");
  const out = [overlay.player_out_number ? `#${overlay.player_out_number}` : null, overlay.player_out_name || null].filter(Boolean).join(" ") || "—";
  const inn = [overlay.player_in_number ? `#${overlay.player_in_number}` : null, overlay.player_in_name || null].filter(Boolean).join(" ") || "—";

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 999,
        background: "rgba(10, 16, 30, 0.96)",
        borderTop: "3px solid #3b82f6",
        display: "flex",
        alignItems: "center",
        gap: 0,
        padding: "0 32px",
        height: 80,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          background: "#3b82f6",
          color: "#fff",
          fontWeight: 900,
          fontSize: 13,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          padding: "6px 14px",
          borderRadius: 6,
          marginRight: 24,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {teamLabel}
      </div>

      <div
        style={{
          color: "#94a3b8",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          marginRight: 20,
          flexShrink: 0,
        }}
      >
        REMPLACEMENT
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 20, flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontSize: 12,
              color: "#ef4444",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              flexShrink: 0,
            }}
          >
            SORTIE
          </span>
          <span
            style={{
              fontSize: 26,
              fontWeight: 900,
              color: "#f8fafc",
              letterSpacing: "0.02em",
              whiteSpace: "nowrap",
            }}
          >
            {out}
          </span>
          <span style={{ fontSize: 22, color: "#ef4444", fontWeight: 900 }}>↓</span>
        </div>

        <div
          style={{
            width: 1,
            height: 40,
            background: "#334155",
            flexShrink: 0,
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontSize: 12,
              color: "#22c55e",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              flexShrink: 0,
            }}
          >
            ENTRÉE
          </span>
          <span
            style={{
              fontSize: 26,
              fontWeight: 900,
              color: "#f8fafc",
              letterSpacing: "0.02em",
              whiteSpace: "nowrap",
            }}
          >
            {inn}
          </span>
          <span style={{ fontSize: 22, color: "#22c55e", fontWeight: 900 }}>↑</span>
        </div>
      </div>
    </div>
  );
}
