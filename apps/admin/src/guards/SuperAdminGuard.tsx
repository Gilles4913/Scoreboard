import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ loading: boolean; error?: string }>({ loading: true });

  useEffect(() => {
    (async () => {
      const { data: s, error: sessErr } = await supabase.auth.getSession();

      if (sessErr) {
        setState({ loading: false, error: `Erreur session: ${sessErr.message}` });
        return;
      }

      if (!s.session) {
        setState({ loading: false, error: "Non connecté. Connecte-toi via Home." });
        return;
      }

      const { data, error } = await supabase.rpc("is_super_admin", { p_uid: s.session.user.id });

      if (error) {
        setState({ loading: false, error: `Erreur droits: ${error.message}` });
        return;
      }

      if (!data) {
        setState({ loading: false, error: "Accès refusé: super_admin uniquement." });
        return;
      }

      setState({ loading: false });
    })();
  }, []);

  if (state.loading) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        <h2>Admin Console</h2>
        <p>Vérification des droits...</p>
      </div>
    );
  }

  if (state.error) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        <h2>Admin Console</h2>
        <p style={{ color: "crimson" }}>{state.error}</p>
      </div>
    );
  }

  return <>{children}</>;
}
