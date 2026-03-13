import React, { useCallback, useRef, useState } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

const COLORS: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: { bg: "#14532d", border: "#22c55e", icon: "✓" },
  error:   { bg: "#450a0a", border: "#ef4444", icon: "✕" },
  warning: { bg: "#451a03", border: "#f97316", icon: "⚠" },
  info:    { bg: "#0c1a2e", border: "#3b82f6", icon: "ℹ" },
};

let _nextId = 1;

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, number>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timers.current.has(id)) {
      window.clearTimeout(timers.current.get(id));
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = "info", durationMs = 3500) => {
      const id = _nextId++;
      setToasts((prev) => [...prev, { id, message, type }]);
      const timer = window.setTimeout(() => dismiss(id), durationMs);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  return { toast, toasts, dismiss };
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        right: 20,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        maxWidth: 360,
        width: "calc(100vw - 40px)",
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => {
        const c = COLORS[t.type];
        return (
          <div
            key={t.id}
            style={{
              background: c.bg,
              border: `1px solid ${c.border}`,
              borderRadius: 10,
              padding: "12px 40px 12px 14px",
              color: "#f1f5f9",
              fontSize: 14,
              fontWeight: 500,
              lineHeight: 1.4,
              boxShadow: "0 8px 24px rgba(0,0,0,.5)",
              position: "relative",
              pointerEvents: "all",
              animation: "toastIn .2s ease",
            }}
          >
            <span style={{ marginRight: 8, color: c.border }}>{c.icon}</span>
            {t.message}
            <button
              onClick={() => onDismiss(t.id)}
              style={{
                position: "absolute",
                top: 8,
                right: 10,
                background: "none",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                fontSize: 16,
                lineHeight: 1,
                padding: "2px 4px",
              }}
              aria-label="Fermer"
            >
              ×
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(-8px) scale(.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
