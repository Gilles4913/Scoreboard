import React, { useCallback, useEffect, useRef, useState } from "react";

export type ConfirmVariant = "danger" | "warning" | "info";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

const VARIANT_COLORS: Record<ConfirmVariant, { btn: string; btnHover: string }> = {
  danger:  { btn: "#dc2626", btnHover: "#b91c1c" },
  warning: { btn: "#d97706", btnHover: "#b45309" },
  info:    { btn: "#2563eb", btnHover: "#1d4ed8" },
};

export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ ...options, resolve });
    });
  }, []);

  const handleClose = useCallback(
    (value: boolean) => {
      if (state) {
        state.resolve(value);
        setState(null);
      }
    },
    [state],
  );

  return { confirm, dialogState: state, handleClose };
}

interface ConfirmDialogProps {
  state: ConfirmState | null;
  onClose: (value: boolean) => void;
}

export function ConfirmDialog({ state, onClose }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!state) return;
    cancelRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose(false);
      if (e.key === "Enter") onClose(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, onClose]);

  if (!state) return null;

  const variant = state.variant ?? "danger";
  const vc = VARIANT_COLORS[variant];
  const confirmLabel = state.confirmLabel ?? "Confirmer";
  const cancelLabel = state.cancelLabel ?? "Annuler";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(0,0,0,.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(false);
      }}
    >
      <div
        style={{
          background: "#1e293b",
          border: "1px solid #334155",
          borderRadius: 14,
          padding: "28px 28px 24px",
          maxWidth: 420,
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,.7)",
        }}
      >
        <div
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: "#f1f5f9",
            marginBottom: 10,
          }}
        >
          {state.title}
        </div>
        <div
          style={{
            fontSize: 14,
            color: "#94a3b8",
            lineHeight: 1.6,
            marginBottom: 24,
          }}
        >
          {state.message}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            ref={cancelRef}
            onClick={() => onClose(false)}
            style={{
              padding: "9px 20px",
              borderRadius: 8,
              border: "1px solid #475569",
              background: "transparent",
              color: "#cbd5e1",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => onClose(true)}
            style={{
              padding: "9px 20px",
              borderRadius: 8,
              border: "none",
              background: vc.btn,
              color: "#fff",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
