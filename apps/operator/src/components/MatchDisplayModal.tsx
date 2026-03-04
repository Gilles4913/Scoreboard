import { useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { buildDisplayUrl, copyToClipboard } from "../utils/displayLink";

type MatchLite = {
  id: string;
  name?: string | null;
  display_token: string;
  home_name?: string | null;
  away_name?: string | null;
  org_slug?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  match: MatchLite | null;
};

export function MatchDisplayModal({ open, onClose, match }: Props) {
  const [copied, setCopied] = useState<"" | "token" | "org">("");

  const urls = useMemo(() => {
    if (!match) return { tokenUrl: "", orgUrl: "" };
    const tokenUrl = buildDisplayUrl({ token: match.display_token });
    const orgUrl = match.org_slug ? buildDisplayUrl({ org: match.org_slug }) : "";
    return { tokenUrl, orgUrl };
  }, [match]);

  if (!open || !match) return null;

  const subtitle =
    match.home_name && match.away_name ? `${match.home_name} vs ${match.away_name}` : "";

  async function onCopy(kind: "token" | "org") {
    const val = kind === "token" ? urls.tokenUrl : urls.orgUrl;
    if (!val) return;
    await copyToClipboard(val);
    setCopied(kind);
    setTimeout(() => setCopied(""), 1200);
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
          width: "min(920px, 96vw)",
          color: "#e5e7eb",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 14,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 320 }}>
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>📺 Display</div>

            <div style={{ fontWeight: 700, marginBottom: 4 }}>{match.name ?? "Match"}</div>
            {subtitle ? <div style={{ color: "#9aa0a6", marginBottom: 12 }}>{subtitle}</div> : null}

            {/* TOKEN URL (recommandée) */}
            <div style={{ fontWeight: 800, marginBottom: 6 }}>URL match (token)</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <code
                style={{
                  padding: "10px 12px",
                  background: "#111214",
                  borderRadius: 10,
                  userSelect: "all",
                  overflowWrap: "anywhere",
                  border: "1px solid #1b1c1f",
                  flex: 1,
                  minWidth: 280,
                }}
              >
                {urls.tokenUrl}
              </code>

              <button
                onClick={() => onCopy("token")}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #2a2d33",
                  background: "#14161a",
                  color: "#e5e7eb",
                  cursor: "pointer",
                }}
              >
                {copied === "token" ? "✅ Copié" : "📋 Copier"}
              </button>

              <a
                href={urls.tokenUrl}
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
              Recommandé : <code>?token=...</code> (affiche ce match précisément)
            </div>

            {/* ORG URL (optionnelle) */}
            <div style={{ marginTop: 16, fontWeight: 800, marginBottom: 6 }}>URL organisation (live)</div>
            {urls.orgUrl ? (
              <>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <code
                    style={{
                      padding: "10px 12px",
                      background: "#111214",
                      borderRadius: 10,
                      userSelect: "all",
                      overflowWrap: "anywhere",
                      border: "1px solid #1b1c1f",
                      flex: 1,
                      minWidth: 280,
                    }}
                  >
                    {urls.orgUrl}
                  </code>

                  <button
                    onClick={() => onCopy("org")}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid #2a2d33",
                      background: "#14161a",
                      color: "#e5e7eb",
                      cursor: "pointer",
                    }}
                  >
                    {copied === "org" ? "✅ Copié" : "📋 Copier"}
                  </button>

                  <a
                    href={urls.orgUrl}
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
                  Optionnel : <code>?org=...</code> (affiche le match live de l’org via Edge Function)
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                org_slug indisponible sur ce match. (Optionnel : expose <code>org_slug</code> dans ta vue <code>matches</code>.)
              </div>
            )}

            <div style={{ marginTop: 12, fontSize: 12, color: "#6b7280" }}>
              matchId: <code style={{ userSelect: "all" }}>{match.id}</code>
            </div>
          </div>

          <div style={{ minWidth: 360, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "#9aa0a6", marginBottom: 8 }}>QR Code (token)</div>

            <div style={{ background: "white", padding: 16, borderRadius: 16, display: "inline-block" }}>
              <QRCodeCanvas value={urls.tokenUrl} size={320} />
            </div>

            {urls.orgUrl ? (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, color: "#9aa0a6", marginBottom: 8 }}>QR Code (org live)</div>
                <div style={{ background: "white", padding: 12, borderRadius: 16, display: "inline-block" }}>
                  <QRCodeCanvas value={urls.orgUrl} size={240} />
                </div>
              </div>
            ) : null}
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
