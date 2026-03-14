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

const LABEL_W = 160;

export default function LiveOverlayBanner({ overlay }: Props) {
  const teamLabel = (overlay.team_name || (overlay.team_side === "home" ? "DOMICILE" : "EXTÉRIEUR")).toUpperCase();
  const out = [overlay.player_out_number ? `#${overlay.player_out_number}` : null, overlay.player_out_name || null].filter(Boolean).join("  ") || "—";
  const inn = [overlay.player_in_number ? `#${overlay.player_in_number}` : null, overlay.player_in_name || null].filter(Boolean).join("  ") || "—";

  const durationMs = overlay.duration_ms && overlay.duration_ms > 0 ? overlay.duration_ms : 8000;
  const scrollDuration = `${Math.max(6, Math.round(durationMs / 1000))}s`;

  return (
    <>
      <style>{`
        @keyframes sbMarquee {
          from { transform: translateX(calc(100vw - ${LABEL_W}px)); }
          to   { transform: translateX(-100%); }
        }
      `}</style>
      <div
        style={{
          width: "100%",
          height: 100,
          background: "rgba(6, 10, 20, 0.97)",
          borderTop: "3px solid #2563eb",
          borderBottom: "3px solid #2563eb",
          display: "flex",
          alignItems: "stretch",
          overflow: "hidden",
          flexShrink: 0,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            width: LABEL_W,
            flexShrink: 0,
            background: "#2563eb",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            padding: "0 10px",
          }}
        >
          <span
            style={{
              color: "#fff",
              fontWeight: 900,
              fontSize: 13,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              textAlign: "center",
              lineHeight: 1.3,
            }}
          >
            REMPLACE<br />MENT
          </span>
        </div>

        <div
          style={{
            flex: 1,
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: 0,
              whiteSpace: "nowrap",
              animation: `sbMarquee ${scrollDuration} linear 1 forwards`,
            }}
          >
            <span style={{ color: "#93c5fd", fontWeight: 900, fontSize: "clamp(20px,2.5vw,28px)", letterSpacing: "0.14em", textTransform: "uppercase", marginRight: "2vw" }}>
              {teamLabel}
            </span>

            <span style={{ color: "#475569", marginRight: "1.5vw", fontSize: "clamp(18px,2vw,24px)", fontWeight: 300 }}>|</span>

            <span style={{ color: "#fca5a5", fontWeight: 700, fontSize: "clamp(13px,1.4vw,16px)", letterSpacing: "0.14em", textTransform: "uppercase", marginRight: "0.8vw" }}>
              SORTIE
            </span>
            <span style={{ color: "#ef4444", fontSize: "clamp(20px,2.5vw,30px)", marginRight: "0.6vw", lineHeight: 1 }}>⬇</span>
            <span
              style={{
                color: "#f1f5f9",
                fontWeight: 900,
                fontSize: "clamp(32px,4.5vw,56px)",
                fontFamily: "'Courier New','Lucida Console',monospace",
                letterSpacing: 2,
                marginRight: "3vw",
              }}
            >
              {out}
            </span>

            <span style={{ color: "#334155", marginRight: "3vw", fontSize: "clamp(18px,2vw,24px)", fontWeight: 300 }}>|</span>

            <span style={{ color: "#86efac", fontWeight: 700, fontSize: "clamp(13px,1.4vw,16px)", letterSpacing: "0.14em", textTransform: "uppercase", marginRight: "0.8vw" }}>
              ENTRÉE
            </span>
            <span style={{ color: "#22c55e", fontSize: "clamp(20px,2.5vw,30px)", marginRight: "0.6vw", lineHeight: 1 }}>⬆</span>
            <span
              style={{
                color: "#f1f5f9",
                fontWeight: 900,
                fontSize: "clamp(32px,4.5vw,56px)",
                fontFamily: "'Courier New','Lucida Console',monospace",
                letterSpacing: 2,
              }}
            >
              {inn}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
