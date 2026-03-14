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
  const [selectedId, setSelectedId] = useState<string>("");
  const [manualName, setManualName] = useState("");
  const [manualNum, setManualNum] = useState("");
  const [mode, setMode] = useState<"list" | "manual">("list");
  const selectRef = useRef<HTMLSelectElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!state) {
      setSelectedId("");
      setManualName("");
      setManualNum("");
      setMode("list");
      return;
    }
    setMode(state.players.length > 0 ? "list" : "manual");
    setSelectedId(state.players.length > 0 ? state.players[0].id : "");
    const t = setTimeout(() => {
      if (state.players.length > 0) selectRef.current?.focus();
      else nameRef.current?.focus();
    }, 80);
    return () => clearTimeout(t);
  }, [state]);

  useEffect(() => {
    if (!state) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose(undefined);
      if (e.key === "Enter" && mode === "list") handleConfirm();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, onClose, mode, selectedId]);

  if (!state) return null;

  function handleConfirm() {
    if (selectedId === "__anon__" || selectedId === "") {
      onClose(null);
      return;
    }
    const found = state!.players.find((p) => p.id === selectedId);
    onClose(found ?? null);
  }

  function submitManual() {
    const name = manualName.trim();
    const number = manualNum.trim();
    if (!name && !number) { onClose(null); return; }
    onClose({ id: "", name: name || "Anonyme", number: number || "?" });
  }

  const overlay: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 10001,
    background: "rgba(0,0,0,.75)",
    display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
  };
  const box: React.CSSProperties = {
    background: "#1e293b", border: "1px solid #334155", borderRadius: 14,
    padding: "24px 24px 20px", width: "100%", maxWidth: 440,
    boxShadow: "0 20px 60px rgba(0,0,0,.85)", display: "flex", flexDirection: "column", gap: 16,
  };
  const label: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, letterSpacing: 1.2,
    textTransform: "uppercase", color: "#64748b", marginBottom: 6,
    display: "block",
  };
  const selectStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 8,
    border: "1px solid #334155", background: "#0f172a",
    color: "#e2e8f0", fontSize: 15, outline: "none", cursor: "pointer",
    appearance: "auto",
  };
  const inputStyle: React.CSSProperties = {
    background: "#0f172a", border: "1px solid #334155", borderRadius: 8,
    color: "#e2e8f0", padding: "9px 12px", fontSize: 14, outline: "none",
    flex: 1, minWidth: 0,
  };
  const primaryBtn: React.CSSProperties = {
    padding: "10px 20px", borderRadius: 8, border: "none",
    background: "#2563eb", color: "#fff", cursor: "pointer",
    fontSize: 14, fontWeight: 600, flex: 1,
  };
  const ghostBtn: React.CSSProperties = {
    padding: "10px 16px", borderRadius: 8, border: "1px solid #475569",
    background: "transparent", color: "#94a3b8", cursor: "pointer",
    fontSize: 13, fontWeight: 500,
  };
  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer",
    background: active ? "#334155" : "transparent",
    color: active ? "#f1f5f9" : "#64748b", fontSize: 12, fontWeight: 600,
  });

  return (
    <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(undefined); }}>
      <div style={box}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>{state.title}</div>

        {/* tabs */}
        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #334155", paddingBottom: 8 }}>
          <button style={tabBtn(mode === "list")} onClick={() => setMode("list")}>
            Feuille de match {state.players.length > 0 ? `(${state.players.length})` : ""}
          </button>
          <button style={tabBtn(mode === "manual")} onClick={() => setMode("manual")}>
            Saisie manuelle
          </button>
        </div>

        {mode === "list" ? (
          <div>
            {state.players.length > 0 ? (
              <>
                <label style={label}>Choisir un joueur</label>
                <select
                  ref={selectRef}
                  style={selectStyle}
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  size={Math.min(state.players.length + 1, 8)}
                >
                  <option value="__anon__">— Anonyme / sans joueur —</option>
                  {state.players.map((p) => (
                    <option key={p.id} value={p.id}>
                      #{p.number} — {p.name}
                    </option>
                  ))}
                </select>
                <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                  <button style={ghostBtn} onClick={() => onClose(undefined)}>Annuler</button>
                  <button style={primaryBtn} onClick={handleConfirm}>Valider</button>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
                Aucun joueur dans la feuille de match pour ce match.
                <br />
                Utilisez l'onglet <strong style={{ color: "#94a3b8" }}>Saisie manuelle</strong> ou ajoutez des joueurs via la feuille de match.
                <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                  <button style={ghostBtn} onClick={() => onClose(undefined)}>Annuler</button>
                  <button style={primaryBtn} onClick={() => setMode("manual")}>Saisie manuelle →</button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            <label style={label}>Nom et numéro</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                ref={nameRef}
                style={{ ...inputStyle, flex: 2 }}
                placeholder="Nom du joueur"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitManual(); }}
              />
              <input
                style={{ ...inputStyle, width: 68, flex: "none" }}
                placeholder="N°"
                value={manualNum}
                onChange={(e) => setManualNum(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitManual(); }}
              />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button style={ghostBtn} onClick={() => onClose(undefined)}>Annuler</button>
              <button style={primaryBtn} onClick={submitManual}>Valider</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
