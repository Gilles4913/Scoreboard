import React from "react";

type TeamLike = {
  id?: string | null;
  slug?: string | null;
  name?: string | null;
};

type Props = {
  team?: TeamLike | null;
  displayBaseUrl?: string;
  title?: string;
  description?: string;
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

export default function DisplayLinkCard({
  team,
  displayBaseUrl = ((import.meta as any).env?.VITE_DISPLAY_APP_URL ||
    (import.meta as any).env?.VITE_DISPLAY_URL ||
    "") as string,
  title,
  description,
}: Props) {
  const stableUrl = buildStableDisplayUrl(displayBaseUrl, team);

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div>
          <div style={styles.title}>
            {title || `Écran public stable${team?.name ? ` — ${team.name}` : ""}`}
          </div>
          <div style={styles.description}>
            {description ||
              "Le mode public par token match a été supprimé. Cette carte expose uniquement l’URL stable par équipe."}
          </div>
        </div>
      </div>

      {!stableUrl ? (
        <div style={styles.warningBox}>
          Impossible de générer le lien public stable. Cette équipe doit avoir un <b>slug</b> ou un <b>id</b> exploitable.
        </div>
      ) : (
        <>
          <div style={styles.label}>URL stable équipe</div>
          <div style={styles.urlBox}>{stableUrl}</div>

          <div style={styles.helpText}>
            Cette URL est destinée à un écran fixe, une TV ou un panneau LED affecté à cette équipe.
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

          <div style={styles.footerNote}>
            Paramètre utilisé : <code>?teamSlug=...</code> ou <code>?teamId=...</code>
          </div>
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    padding: 16,
    borderRadius: 16,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.08)",
    color: "#e7eefc",
    fontFamily:
      "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
  },
  title: {
    fontSize: 16,
    fontWeight: 900,
  },
  description: {
    marginTop: 6,
    fontSize: 13,
    opacity: 0.8,
    lineHeight: 1.55,
  },
  warningBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    background: "rgba(217,119,6,.12)",
    border: "1px solid rgba(217,119,6,.3)",
    lineHeight: 1.6,
    fontSize: 14,
  },
  label: {
    marginTop: 14,
    fontSize: 12,
    opacity: 0.72,
  },
  urlBox: {
    marginTop: 8,
    padding: 14,
    borderRadius: 14,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.08)",
    wordBreak: "break-all",
    lineHeight: 1.6,
    fontSize: 14,
  },
  helpText: {
    marginTop: 12,
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
    marginTop: 14,
    fontSize: 12,
    opacity: 0.72,
  },
};
