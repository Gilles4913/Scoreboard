// apps/operator/src/components/DisplayLinkCard.tsx
import { useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { buildDisplayUrl, copyToClipboard } from "../utils/displayLink";

type Props = {
  matchId: string;
  displayToken: string;
  matchName?: string;
  subtitle?: string; // ex: "HOME vs AWAY"
};

export function DisplayLinkCard({ matchId, displayToken, matchName, subtitle }: Props) {
  const [copied, setCopied] = useState(false);
  const [bigQr, setBigQr] = useState(false);

  // ✅ token-only URL (matchId optionnel)
  const url = useMemo(() => buildDisplayUrl({ token: displayToken /* matchId */ }), [displayToken]);

  async function onCopy() {
    await copyToClipboard(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div style={{ border: "1px solid #2a2d33", borderRadius: 12, padding: 14, background: "#0f1114" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ fontWeight: 800, marginBottom: 6, fontSize: 16 }}>📺 Lien Display (TV / écran)</div>
          {matchName ? <div style={{ color: "#e5e7eb", marginBottom: 4, fontWeight: 700 }}>{matchName}</div> : null}
          {subtitle ? <div style={{ color: "#9aa0a6", marginBottom: 10 }}>{subtitle}</div> : null}

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <code
              style={{
                padding: "8px 10px",
                background: "#111214",
                borderRadius: 10,
                userSelect: "all",
                overflowWrap: "anywhere",
                border: "1px solid #1b1c1f",
              }}
            >
              {url}
            </code>

            <button onClick={onCopy} style={{ padding: "8px 12px", borderRadius: 10 }}>
              {copied ? "✅ Copié" : "📋 Copier"}
            </button>

            <a href={url} target="_blank" rel="noreferrer" style={{ padding: "8px 12px" }}>
              Ouvrir
            </a>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: "#9aa0a6" }}>
            ✅ Recommandé : scanne le QR depuis ton téléphone, puis ouvre le lien sur l’écran (AirPlay/Chromecast/SmartTV).
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
            matchId: <code style={{ userSelect: "all" }}>{matchId}</code>
          </div>
        </div>

        <div style={{ textAlign: "center", minWidth: 160 }}>
          <div style={{ fontSize: 12, color: "#9aa0a6", marginBottom: 6 }}>QR Code</div>

          <div
            style={{
              background: "white",
              padding: 10,
              borderRadius: 12,
              display: "inline-block",
              cursor: "pointer",
              border: "1px solid #e5e7eb",
            }}
            title="Cliquer pour agrandir"
            onClick={() => setBigQr(true)}
          >
            <QRCodeCanvas value={url} size={140} />
          </div>

          <div style={{ marginTop: 8 }}>
            <button onClick={() => setBigQr(true)} style={{ padding: "6px 10px", borderRadius: 10, fontSize: 12 }}>
              🔍 Grand QR
            </button>
          </div>
        </div>
      </div>

      {/* Simple modal */}
      {bigQr && (
        <div
          onClick={() => setBigQr(false)}
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
              width: "min(520px, 95vw)",
              textAlign: "center",
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 10, fontSize: 16, color: "#e5e7eb" }}>QR Code Display</div>
            <div style={{ background: "white", padding: 16, borderRadius: 16, display: "inline-block" }}>
              <QRCodeCanvas value={url} size={360} />
            </div>

            <div style={{ marginTop: 14 }}>
              <code
                style={{
                  display: "inline-block",
                  maxWidth: "100%",
                  padding: "8px 10px",
                  background: "#111214",
                  borderRadius: 10,
                  userSelect: "all",
                  overflowWrap: "anywhere",
                  color: "#e5e7eb",
                  border: "1px solid #1b1c1f",
                }}
              >
                {url}
              </code>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 12, flexWrap: "wrap" }}>
              <button onClick={onCopy} style={{ padding: "8px 12px", borderRadius: 10 }}>
                {copied ? "✅ Copié" : "📋 Copier"}
              </button>
              <a href={url} target="_blank" rel="noreferrer" style={{ padding: "8px 12px" }}>
                Ouvrir
              </a>
              <button onClick={() => setBigQr(false)} style={{ padding: "8px 12px", borderRadius: 10 }}>
                Fermer
              </button>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: "#9aa0a6" }}>
              Clique en dehors de la fenêtre pour fermer.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
