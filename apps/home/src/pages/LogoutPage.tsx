import React, { useEffect, useState } from "react";
import { supa } from "../supabase";
import { Navigate } from "react-router-dom";

export function LogoutPage() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    supa.auth.signOut().finally(() => setDone(true));
  }, []);

  if (!done) return <div style={{ padding: 18 }}>Déconnexion…</div>;
  return <Navigate to="/login" replace />;
}
