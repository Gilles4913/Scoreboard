import { useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY!;

const ADMIN_URL = import.meta.env.VITE_ADMIN_URL;
const OPERATOR_URL = import.meta.env.VITE_OPERATOR_URL;
const DISPLAY_URL = import.meta.env.VITE_DISPLAY_URL;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

export default function App() {

  useEffect(() => {
    init();
  }, []);

  async function init() {

    const { data } = await supabase.auth.getSession();

    if (!data.session) {
      window.location.href = "/login.html";
      return;
    }

    const userId = data.session.user.id;

    // récupère profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (!profile) {
      document.body.innerHTML = "Profile not found";
      return;
    }

    if (profile.role === "super_admin") {

      if (ADMIN_URL) {
        window.location.href = ADMIN_URL;
        return;
      }

      document.body.innerHTML = "Admin URL not configured";
      return;
    }

    if (profile.role === "org_admin" || profile.role === "operator") {

      if (OPERATOR_URL) {
        window.location.href = OPERATOR_URL;
        return;
      }

      document.body.innerHTML = "Operator URL not configured";
      return;
    }

    document.body.innerHTML = "No role assigned";

  }

  return (
    <div style={{padding:40,fontFamily:"sans-serif"}}>
      Redirection en cours...
    </div>
  );

}
