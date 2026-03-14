import React, { useCallback, useEffect, useRef, useState } from "react";

export interface PlayerOption {
  id: string;
  name: string;
  number: string;
}

interface PickerOptions {
  title: string;
  players: PlayerOption[];
}

interface PickerState extends PickerOptions {
  resolve: (value: PlayerOption | null | undefined) => void;
}

export function usePlayerPicker() {
  const [state, setState] = useState<PickerState | null>(null);

  const pick = useCallback(
    (options: PickerOptions): Promise<PlayerOption | null | undefined> =>
      new Promise((resolve) => setState({ ...options, resolve })),
    [],
  );

  const handleClose = useCallback(
    (value: PlayerOption | null | undefined) => {
      if (state) { state.resolve(value); setState(null); }
    },
    [state],
  );

  return { pick, pickerState: state, handlePickerClose: handleClose };
}

export function PlayerPickerDialog({
  state,
  onClose,
}: {
  state: PickerState | null;
  onClose: (value: PlayerOption | null | undefined) => void;
}) {
  const [manualName, setManualName] = useState("");
  const [manualNum, setManualNum] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!state) { setManualName(""); setManualNum(""); return; }
    const t = setTimeout(() => nameRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [state]);

  useEffect(() => {
    if (!state) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose(undefined);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, onClose]);

  if (!state) return null;

  function submitManual() {
    const name = manualName.trim();
    const number = manualNum.trim();
    if (!name && !number) { onClose(null); return; }
    onClose({ id: "", name: name || "Anonyme", number: number || "?" });
  }

  const overlay: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 10001,
    background: "rgba(0,0,0,.7)",
    display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
  };
  const box: React.CSSProperties = {
    background: "#1e293b", border: "1px solid #334155", borderRadius: 14,
    padding: "24px 24px 20px", width: "100%", maxWidth: 480,
    boxShadow: "0 20px 60px rgba(0,0,0,.8)", display: "flex", flexDirection: "column", gap: 16,
  };
  const sectionLabel: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, letterSpacing: 1.2,
    textTransform: "uppercase", color: "#64748b", marginBottom: 6,
  };
  const playerBtn: React.CSSProperties = {
    background: "#0f172a", border: "1px solid #334155", borderRadius: 8,
    color: "#e2e8f0", cursor: "pointer", padding: "8px 14px",
    textAlign: "left", fontSize: 14, fontWeight: 600,
    display: "flex", gap: 10, alignItems: "center",
    transition: "background .15s",
  };
  const input: React.CSSProperties = {
    background: "#0f172a", border: "1px solid #334155", borderRadius: 8,
    color: "#e2e8f0", padding: "8px 12px", fontSize: 14, outline: "none",
    flex: 1, minWidth: 0,
  };
  const ghostBtn: React.CSSProperties = {
    padding: "8px 16px", borderRadius: 8, border: "1px solid #475569",
    background: "transparent", color: "#94a3b8", cursor: "pointer",
    fontSize: 13, fontWeight: 500,
  };
  const primaryBtn: React.CSSProperties = {
    padding: "8px 16px", borderRadius: 8, border: "none",
    background: "#2563eb", color: "#fff", cursor: "pointer",
    fontSize: 13, fontWeight: 600,
  };

  return (
    <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(undefined); }}>
      <div style={box}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>{state.title}</div>

        <div>
          <div style={sectionLabel}>Joueur de l&apos;équipe</div>
          {state.players.length > 0 ? (
            <div style={{ display: "grid", gap: 6, maxHeight: 240, overflowY: "auto" }}>
              {state.players.map((p) => (
                <button
                  key={p.id || p.number}
                  style={playerBtn}
                  onClick={() => onClose(p)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#1e3a5f")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#0f172a")}
                >
                  <span style={{ opacity: 0.5, minWidth: 28 }}>#{p.number}</span>
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "#64748b", padding: "8px 0" }}>
              Aucun joueur dans la feuille de match. Ajoutez des joueurs via la feuille de match ou saisissez manuellement ci-dessous.
            </div>
          )}
        </div>

        <div>
          <div style={sectionLabel}>Saisie manuelle</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              ref={nameRef}
              style={{ ...input, flex: 2 }}
              placeholder="Nom du joueur"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitManual(); }}
            />
            <input
              style={{ ...input, width: 72, flex: "none" }}
              placeholder="N°"
              value={manualNum}
              onChange={(e) => setManualNum(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitManual(); }}
            />
            <button style={primaryBtn} onClick={submitManual}>OK</button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "space-between", marginTop: 4 }}>
          <button style={ghostBtn} onClick={() => onClose(null)}>Sans joueur</button>
          <button style={{ ...ghostBtn, color: "#64748b" }} onClick={() => onClose(undefined)}>Annuler</button>
        </div>
      </div>
    </div>
  );
}
