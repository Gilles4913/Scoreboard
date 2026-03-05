import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { supabase } from "./supabase";

/**
 * Home redirige vers Operator avec:
 *   /?org=slug#access_token=...&refresh_token=...
 * Ici on “consomme” le hash, on fait supabase.auth.setSession(), puis on nettoie l’URL.
 */
async function boot() {
  const hash = window.location.hash || "";
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);

  const access_token = params.get("access_token") || "";
  const refresh_token = params.get("refresh_token") || "";

  if (access_token && refresh_token) {
    try {
      await supabase.auth.setSession({ access_token, refresh_token });
    } catch {
      // si setSession échoue, on laisse App gérer (il montrera login via Home)
    }

    // Nettoyage URL (retire tokens du hash)
    window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

boot();
