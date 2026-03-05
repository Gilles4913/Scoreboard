import React from "react";
import ReactDOM from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import App from "./App";

// IMPORTANT: assure-toi d'avoir ces variables sur Vercel (projet admin)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function getSupabase() {
  if (!SUPABASE_URL) throw new Error("VITE_SUPABASE_URL is required");
  if (!SUPABASE_ANON_KEY) throw new Error("VITE_SUPABASE_ANON_KEY is required");
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

async function consumeAuthHashAndSetSession() {
  // Hash format attendu (envoyé par Home) :
  // #access_token=...&refresh_token=...&token_type=bearer&expires_in=3600
  const hash = window.location.hash;
  if (!hash || hash.length < 2) return;

  const params = new URLSearchParams(hash.slice(1));
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");

  if (!access_token || !refresh_token) return;

  const supabase = getSupabase();

  await supabase.auth.setSession({
    access_token,
    refresh_token,
  });

  // Nettoie l’URL (enlève le hash) pour éviter de le rejouer au refresh
  const cleanUrl = window.location.pathname + window.location.search;
  window.history.replaceState({}, document.title, cleanUrl);
}

async function bootstrap() {
  try {
    await consumeAuthHashAndSetSession();
  } catch (e) {
    // Ne bloque pas l'app si le handoff échoue (au pire l'Admin demandera de se reconnecter via Home)
    console.error("[admin] session handoff failed:", e);
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

bootstrap();
