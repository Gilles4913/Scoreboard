import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { supabase } from "./supabase";

const LS_ACTIVE_ORG_KEY = "scoreDisplay.activeOrgSlug";

function getParam(name: string) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name) || "";
}

function stripAuthParamsFromUrl() {
  const url = new URL(window.location.href);
  ["access_token", "refresh_token", "expires_in", "token_type"].forEach((k) => url.searchParams.delete(k));
  // on garde org si présent
  window.history.replaceState({}, document.title, url.toString());
}

async function bootstrapAuthFromUrl() {
  const org = getParam("org").trim();
  if (org) localStorage.setItem(LS_ACTIVE_ORG_KEY, org);

  const access_token = getParam("access_token").trim();
  const refresh_token = getParam("refresh_token").trim();

  // Si Home a fourni des tokens => setSession
  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    stripAuthParamsFromUrl();

    // Si tokens invalides => on purge et on laissera l’app rediriger vers Home
    if (error) {
      await supabase.auth.signOut();
    }
  }
}

bootstrapAuthFromUrl()
  .catch(async () => {
    // en cas d’erreur inattendue, on purge la session
    try {
      await supabase.auth.signOut();
    } catch {}
  })
  .finally(() => {
    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  });
