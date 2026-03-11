import React from "react";
import { QRCodeSVG } from "qrcode.react";

type TeamLike = {
  id?: string | null;
  slug?: string | null;
  name?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  team?: TeamLike | null;
  displayBaseUrl?: string;
  title?: string;
};

function buildStableDisplayUrl(displayBaseUrl: string, team?: TeamLike | null) {
  const base = (displayBaseUrl || "").trim().replace(/\/$/, "");
  if (!base || !team) return "";

  if (team.slug) {
    return `${base}/?teamSlug=${encodeURIComponent(team.slug)}`;
  }

  if (team.id) {
    return `${base}/?teamId=${encodeURIComponent(team.id)}`;
  }

  return "";
}

async function copyToClipboard(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export default function MatchDisplayModal({
  open,
  onClose,
  team,
  displayBaseUrl = ((import.meta as any).env?.VITE_DISPLAY_APP_URL ||
    (import.meta as any).env?.VITE_DISPLAY_URL ||
    "") as string,
  title,
}: Props) {
  const stableUrl = buildStableDisplayUrl(displayBaseUrl, team);
  const modalTitle = title || `Écran public stable${team?.name ? ` — ${team.name}` : ""}`;

  if (!open) return null;

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <div style={styles.title}>{modalTitle}</div>
            <div style={styles.subtitle}>
              Le mode public par token match a été supprimé. Le lien public officiel est désormais l’URL stable par équipe.
            </div>
          </div>

          <button onClick={onClose} style={styles.closeBtn}>
            Fermer
          </button>
        </div>

        {!stableUrl ? (
          <div style={styles.warningBox}>
            Impossible de générer l’écran public stable. Cette équipe doit avoir au moins un <b>slug</b> ou un <b>id</b> exploitable.
          </div>
        ) : (
          <>
            <div style={styles.content}>
              <div style={styles.qrCard}>
                <div style={styles.blockTitle}>QR écran public stable</div>
                <div style={styles.qrBox}>
                  <QRCodeSVG value={stableUrl} size={220} />
                </div>
              </div>

              <div style={styles.linkCard}>
                <div style={styles.blockTitle}>URL stable équipe</div>
                <div style={styles.urlBox}>{stableUrl}</div>

                <div style={styles.helpText}>
                  Cette URL est prévue pour un écran fixe, un panneau LED ou une TV affectée à cette équipe.
                  Elle bascule automatiquement vers le bon match selon le fallback serveur.
                </div>

                <div style={styles.actions}>
                  <button
                    style={styles.primaryBtn}
                    onClick={async () => {
                      const ok = await copyToClipboard(stableUrl);
                      window.alert(ok ? "Lien copié." : "Copie impossible.");
                    }}
                  >
                    Copier le lien
                  </button>

                  <a
                    href={stableUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={styles.linkBtn}
                  >
                    Ouvrir l’écran
                  </a>
                </div>
              </div>
            </div>

            <div style={styles.footerNote}>
              Paramètre utilisé : <code>?teamSlug=...</code> ou <code>?teamId=...</code>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    zIndex: 1000,
  },
  modal: {
    width: "min(920px, 100%)",
    background: "#0b0f14",
    color: "#e7eefc",
    border: "1px solid rgba(255,255,255,.1)",
    borderRadius: 20,
    boxShadow: "0 20px 80px rgba(0,0,0,.45)",
    padding: 20,
    fontFamily:
      "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    marginBottom: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: 900,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    opacity: 0.8,
    lineHeight: 1.55,
    maxWidth: 680,
  },
  closeBtn: {
    background: "transparent",
    color: "#e7eefc",
    border: "1px solid rgba(255,255,255,.16)",
    borderRadius: 12,
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  warningBox: {
    padding: 16,
    borderRadius: 14,
    background: "rgba(217,119,6,.12)",
    border: "1px solid rgba(217,119,6,.3)",
    lineHeight: 1.6,
  },
  content: {
    display: "grid",
    gridTemplateColumns: "320px 1fr",
    gap: 18,
  },
  qrCard: {
    padding: 16,
    borderRadius: 16,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.08)",
  },
  qrBox: {
    marginTop: 14,
    background: "white",
    borderRadius: 14,
    padding: 12,
    display: "inline-flex",
  },
  linkCard: {
    padding: 16,
    borderRadius: 16,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.08)",
  },
  blockTitle: {
    fontSize: 16,
    fontWeight: 900,
  },
  urlBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.08)",
    wordBreak: "break-all",
    lineHeight: 1.6,
    fontSize: 14,
  },
  helpText: {
    marginTop: 14,
    opacity: 0.82,
    lineHeight: 1.6,
    fontSize: 14,
  },
  actions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 16,
  },
  primaryBtn: {
    background: "#2563eb",
    color: "white",
    border: "1px solid rgba(255,255,255,.1)",
    borderRadius: 12,
    padding: "12px 16px",
    fontWeight: 800,
    cursor: "pointer",
  },
  linkBtn: {
    textDecoration: "none",
    background: "#1e3a8a",
    color: "white",
    border: "1px solid rgba(255,255,255,.1)",
    borderRadius: 12,
    padding: "12px 16px",
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
  },
  footerNote: {
    marginTop: 16,
    fontSize: 13,
    opacity: 0.72,
  },
};
