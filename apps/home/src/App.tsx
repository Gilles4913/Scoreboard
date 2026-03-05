import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const ADMIN_URL = import.meta.env.VITE_ADMIN_URL;
const OPERATOR_URL = import.meta.env.VITE_OPERATOR_URL;

export default function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {

      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session) {
        setLoading(false);
        return;
      }

      const userId = session.user.id;

      const { data: memberships } = await supabase
        .from("org_members")
        .select("role,orgs(slug)")
        .eq("user_id", userId);

      const isSuperAdmin = memberships?.some(
        (m) => m.orgs?.slug === "master" && m.role === "super_admin"
      );

      if (isSuperAdmin) {
        window.location.href = ADMIN_URL;
        return;
      }

      window.location.href = OPERATOR_URL;
    }

    init();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Scoreboard</h1>
      <p>Connexion requise.</p>
    </div>
  );
}
