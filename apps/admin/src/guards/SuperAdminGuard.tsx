import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "../supabase";

type OrgRow = {
  id: string;
  slug: string;
  is_master?: boolean | null;
};

type MemberJoinRow = {
  role: string | null;
  orgs: OrgRow | null;
};

export default function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    async function check() {
      try {
        setErr(null);

        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr) throw sessionErr;

        const user = sessionData.session?.user;
        if (!user) {
          if (!mounted) return;
          setAllowed(false);
          setLoading(false);
          return;
        }

        // IMPORTANT: on ne dépend pas de profiles.role
        // Super admin = membre de l'org "master" avec role = "super_admin"
        const { data, error } = await supabase
          .from("org_members")
          .select("role, orgs(id,slug,is_master)")
          .eq("user_id", user.id);

        if (error) throw error;

        const rows = (data || []) as unknown as MemberJoinRow[];
        const isSA = rows.some(
          (r) =>
            (r.role || "").toLowerCase() === "super_admin" &&
            r.orgs &&
            ((r.orgs.slug || "").toLowerCase() === "master" || r.orgs.is_master === true)
        );

        if (!mounted) return;
        setAllowed(isSA);
        setLoading(false);
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message || "Erreur de vérification super admin");
        setAllowed(false);
        setLoading(false);
      }
    }

    check();
    return () => {
      mounted = false;
    };
  }, [location.pathname]);

  if (loading) {
    return (
      <div style={pageStyle()}>
        <div style={cardStyle()}>
          <div style={{ fontWeight: 900 }}>scoreDisplay Admin</div>
          <div style={{ marginTop: 8, opacity: 0.8 }}>Vérification des droits…</div>
        </div>
      </div>
    );
  }

  if (!allowed) {
    // si pas connecté => login
    // (si tu as une route /login dédiée, remplace par Navigate("/login"))
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      {err ? (
        <div style={{ padding: 10, margin: 10, borderRadius: 10, border: "1px solid rgba(220,38,38,.35)", background: "rgba(220,38,38,.12)" }}>
          {err}
        </div>
      ) : null}
      {children}
    </>
  );
}

function pageStyle(): React.CSSProperties {
  return {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "var(--bg, #0b0d12)",
    color: "var(--text, #e5e7eb)",
    padding: 18,
    fontFamily: "system-ui",
  };
}
function cardStyle(): React.CSSProperties {
  return {
    width: "min(520px, 92vw)",
    background: "var(--panel, #0f141b)",
    border: "1px solid var(--border, #1f2a3a)",
    borderRadius: 16,
    padding: 16,
  };
}
