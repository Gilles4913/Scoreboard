import React, { useEffect, useState } from "react";
import { getUserRole } from "../api";
import { ADMIN_URL, OPERATOR_URL } from "../config";
import type { AppRole } from "../roles";

function redirectTo(url: string) {
  // hard redirect (cross-domain)
  window.location.href = url;
}

export function AppRouterPage() {
  const [role, setRole] = useState<AppRole>("unknown");
  const [err, setErr] = useState("");

  useEffect(() => {
    getUserRole()
      .then(({ role }) => {
        setRole(role);

        if (role === "super_admin") {
          if (!ADMIN_URL) throw new Error("VITE_ADMIN_URL manquant");
          redirectTo(ADMIN_URL);
          return;
        }

        // org_admin / operator / unknown -> Operator
        if (!OPERATOR_URL) throw new Error("VITE_OPERATOR_URL manquant");
        redirectTo(OPERATOR_URL);
      })
      .catch((e: any) => setErr(e?.message ?? "Erreur routing"));
  }, []);

  return (
    <div style={{ padding: 18 }}>
      <div>Routing…</div>
      <div style={{ fontSize: 12, color: "#9aa0a6" }}>role: {role}</div>
      {err ? <div style={{ marginTop: 10, color: "#fca5a5" }}>❌ {err}</div> : null}
    </div>
  );
}
