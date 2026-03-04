import { useMemo } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { buildDisplayUrl, copyToClipboard } from "../utils/displayLink";

type MatchLite = {
  id: string;
  name?: string | null;
  display_token: string;
  home_name?: string | null;
  away_name?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  match: MatchLite | null;
};

export function MatchDisplayModal({ open, onClose, match }: Props) {
  const url = useMemo(() => {
    if (!match) return "";
    return buildDisplayUrl({ token: match.display_token });
  }, [match]);

  if (!open || !match) return null;

  const subtitle =
    match.home_name && match.away_name ? `${match.home_name} vs ${match.away_name}` : "";

  async function onCopy() {
    if (!url) return;
    await copyToClipboard(url);
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#0f1114",
          border: "1px solid #2a2d33",
          borderRadius: 16,
          padding: 18,
          width: "min(820px, 96vw)",
          color: "#e5e7eb",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 320 }}>
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>
              📺 Display Link
            </div>

            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              {match.name ?? "Match"}
            </div>
            {subtitle ? (
              <div style={{ color: "#9aa0a6", marginBottom: 12 }}>{subtitle}</div>
            ) : null}

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <code
                style={{
                  padding: "10px 12px",
                  background: "#111214",
                  borderRadius: 10,
                  userSelect: "all",
                  overflowWrap: "anywhere",
                  border: "1px solid #1b1c1f",
                }}
              >
                {url}
              </code>

              <button
                onClick={onCopy}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #2a2d33",
                  background: "#14161a",
                  color: "#e5e7eb",
                  cursor: "pointer",
                }}
              >
                📋 Copier
              </button>

              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #2a2d33",
                  background: "#14161a",
                  color: "#e5e7eb",
                  textDecoration: "none",
                }}
              >
                Ouvrir
              </a>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: "#9aa0a6" }}>
              URL recommandée : <code>?token=...</code> (token-only)
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
              matchId: <code style={{ userSelect: "all" }}>{match.id}</code>
            </div>
          </div>

          <div style={{ minWidth: 360, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "#9aa0a6", marginBottom: 8 }}>
              QR Code (scan → ouvre l’affichage)
            </div>

            <div
              style={{
                background: "white",
                padding: 16,
                borderRadius: 16,
                display: "inline-block",
              }}
            >
              <QRCodeCanvas value={url} size={320} />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #2a2d33",
              background: "#14161a",
              color: "#e5e7eb",
              cursor: "pointer",
            }}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
