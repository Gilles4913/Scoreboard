import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "../supabase";

/**
 * SuperAdminGuard
 * - Autorise uniquement les super_admin (déduits de org_members.role='super_admin' dans l'org master)
 * - Ne dépend PAS de profiles.role (qui n'existe pas dans ta DB)
 * - S'appuie sur la fonction SQL: public.is_super_admin(p_uid uuid) returns boolean
 */
export default function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);

      // 1) session
      const { data: sess, error: sessErr } = await supabase.auth.getSession();
      if (cancelled) return;

      if (sessErr) {
        setHasSession(false);
        setAllowed(false);
        setError(`Erreur session: ${sessErr.message}`);
        setLoading(false);
        return;
      }

      if (!sess.session?.user?.id) {
        setHasSession(false);
        setAllowed(false);
        setLoading(false);
        return;
      }

      setHasSession(true);

      // 2) check super_admin via RPC
      const uid = sess.session.user.id;
      const { data, error } = await supabase.rpc("is_super_admin", { p_uid: uid });

      if (cancelled) return;

      if (error) {
        setAllowed(false);
        setError(`Erreur droits: ${error.message}`);
        setLoading(false);
        return;
      }

      setAllowed(Boolean(data));
      setLoading(false);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  // Pas de session => redirection vers Home (ou login admin si tu en as un)
  // Ici on suppose que le login se fait via l'app Home.
  if (!loading && !hasSession) {
    // On garde la route demandée en "state" au cas où tu fais un retour après login.
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  if (loading) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        <h2 style={{ margin: 0 }}>scoreDisplay — Admin</h2>
        <p style={{ marginTop: 8 }}>Vérification des droits super_admin…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        <h2 style={{ margin: 0 }}>scoreDisplay — Admin</h2>
        <p style={{ marginTop: 8, color: "crimson", fontWeight: 700 }}>Accès impossible</p>
        <pre
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 10,
            background: "rgba(0,0,0,0.06)",
            overflowX: "auto",
          }}
        >
          {error}
        </pre>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        <h2 style={{ margin: 0 }}>scoreDisplay — Admin</h2>
        <p style={{ marginTop: 8, color: "crimson", fontWeight: 800 }}>
          Accès refusé (super_admin uniquement)
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
