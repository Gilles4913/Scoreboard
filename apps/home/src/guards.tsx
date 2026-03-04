import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supa } from "./supabase";
import { getUserRole } from "./api";
import type { AppRole } from "./roles";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [logged, setLogged] = useState(false);

  useEffect(() => {
    let unsub: any;

    supa.auth.getSession().then(({ data }) => {
      setLogged(!!data.session);
      setReady(true);
    });

    const { data } = supa.auth.onAuthStateChange((_e, session) => {
      setLogged(!!session);
    });
    unsub = data.subscription;

    return () => unsub?.unsubscribe?.();
  }, []);

  if (!ready) return <div style={{ padding: 18 }}>Chargement…</div>;
  if (!logged) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function RoleGate({ allow, children }: { allow: AppRole[]; children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<AppRole>("unknown");

  useEffect(() => {
    getUserRole()
      .then((r) => {
        setRole(r.role);
        setReady(true);
      })
      .catch(() => {
        setRole("unknown");
        setReady(true);
      });
  }, []);

  if (!ready) return <div style={{ padding: 18 }}>Chargement…</div>;
  if (!allow.includes(role)) return <Navigate to="/app" replace />;
  return <>{children}</>;
}
