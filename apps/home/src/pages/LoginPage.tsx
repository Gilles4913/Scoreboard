import React, { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";

export default function LoginPage({ supabase }: { supabase: SupabaseClient }) {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) nav("/", { replace: true });
    })();
  }, [nav, supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }

    nav("/", { replace: true });
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b0d10", color: "#e5e7eb", fontFamily: "Inter, system-ui" }}>
      <form onSubmit={onSubmit} style={{ width: 420, padding: 24, border: "1px solid #1b2230", borderRadius: 14, background: "rgba(255,255,255,.03)" }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Connexion</h1>
        <p style={{ marginTop: 8, opacity: 0.8 }}>Scoreboard Home</p>

        <label style={{ display: "block", marginTop: 16, fontSize: 12, opacity: 0.9 }}>Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          type="email"
          required
          style={{ width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 10, border: "1px solid #1d2636", background: "#0b0f1a", color: "#e5e7eb" }}
        />

        <label style={{ display: "block", marginTop: 14, fontSize: 12, opacity: 0.9 }}>Mot de passe</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          type="password"
          required
          style={{ width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 10, border: "1px solid #1d2636", background: "#0b0f1a", color: "#e5e7eb" }}
        />

        {err && (
          <div style={{ marginTop: 12, padding: 10, borderRadius: 10, background: "rgba(220,38,38,.12)", border: "1px solid rgba(220,38,38,.35)", color: "#fecaca" }}>
            {err}
          </div>
        )}

        <button
          disabled={busy}
          type="submit"
          style={{
            width: "100%",
            marginTop: 16,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #2563eb",
            background: busy ? "#1f3c85" : "#2563eb",
            color: "white",
            fontWeight: 800,
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          {busy ? "Connexion..." : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
