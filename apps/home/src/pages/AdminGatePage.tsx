import React, { useEffect, useState } from "react";
import { getUserRole } from "../api";
import { ADMIN_URL } from "../config";

export function AdminGatePage() {
  const [err, setErr] = useState("");

  useEffect(() => {
    getUserRole()
      .then(({ role }) => {
        if (role !== "super_admin") {
          throw new Error("Accès admin refusé (super_admin uniquement).");
        }
        if (!ADMIN_URL) throw new Error("VITE_ADMIN_URL manquant");
        window.location.href = ADMIN_URL;
      })
      .catch((e: any) => setErr(e?.message ?? "Erreur"));
  }, []);

  if (err) return <div style={{ padding: 18, color: "#fca5a5" }}>❌ {err}</div>;
  return <div style={{ padding: 18 }}>Redirect admin…</div>;
}
