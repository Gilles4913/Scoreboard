// apps/operator/src/components/DisplayLinkCard.tsx
import { useMemo, useState } from "react";
import { buildDisplayUrl, copyToClipboard } from "../utils/displayLink";

type Props = {
  matchId: string;
  displayToken: string;
  matchName?: string;
};

export function DisplayLinkCard({ matchId, displayToken, matchName }: Props) {
  const [copied, setCopied] = useState(false);

  const url = useMemo(() => buildDisplayUrl({ token: displayToken /* matchId optional */ }), [displayToken]);

  async function onCopy() {
    await copyToClipboard(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div style={{ border: "1px solid #2a2d33", borderRadius: 12, padding: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Lien Display</div>
      {matchName ? <div style={{ color: "#9aa0a6", marginBottom: 8 }}>{matchName}</div> : null}

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <code style={{ padding: "6px 8px", background: "#111214", borderRadius: 8, userSelect: "all" }}>{url}</code>
        <button onClick={onCopy} style={{ padding: "6px 10px", borderRadius: 10 }}>
          {copied ? "✅ Copié" : "📋 Copier"}
        </button>
        <a href={url} target="_blank" rel="noreferrer" style={{ padding: "6px 10px" }}>
          Ouvrir
        </a>
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: "#9aa0a6" }}>
        Astuce : colle ce lien dans le navigateur de l’écran / TV.
      </div>
    </div>
  );
}
