import React, { useState } from "react";
import { supa } from "../supabase";
import { useNavigate } from "react-router-dom";

export function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const { error } = await supa.auth.signInWithPassword({ email, password: pwd });
      if (error) throw error;
      nav("/app", { replace: true });
    } catch (e: any) {
      setErr(e?.message ?? "Erreur login");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto", padding: 18 }}>
      <h2 style={{ marginTop: 0 }}>Scoreboard</h2>
      <div style={{ color: "#9aa0a6", marginBottom: 16 }}>Connexion</div>

      {err ? (
        <div style={{ background: "#1a0f10", border: "1px solid #3a1c1f", padding: 12, borderRadius: 12, marginBottom: 12 }}>
          ❌ {err}
        </div>
      ) : null}

      <form onSubmit={onLogin} style={{ display: "grid", gap: 10 }}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email"
          type="email"
          required
          style={{ padding: 12, borderRadius: 10, border: "1px solid #2a2d33", background: "#0f1114", color: "#e5e7eb" }}
        />
        <input
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          placeholder="mot de passe"
          type="password"
          required
          style={{ padding: 12, borderRadius: 10, border: "1px solid #2a2d33", background: "#0f1114", color: "#e5e7eb" }}
        />
        <button
          disabled={busy}
          style={{ padding: 12, borderRadius: 10, border: "1px solid #2a2d33", background: "#14161a", color: "#e5e7eb" }}
        >
          {busy ? "…" : "Se connecter"}
        </button>
      </form>

      <div style={{ marginTop: 14, fontSize: 12, color: "#6b7280" }}>
        Super admin : <code>gilles.guerrin@a2display.fr</code>
      </div>
    </div>
  );
}
