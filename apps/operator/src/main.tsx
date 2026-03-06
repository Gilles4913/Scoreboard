import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { supabase } from "./supabase";

const LS_ACTIVE_ORG_KEY = "scoreDisplay.activeOrgSlug";

function getHashParams() {
  const raw = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;

  return new URLSearchParams(raw);
}

function getSearchParam(name: string) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name) || "";
}

async function bootstrapOperatorAuth() {
  const org = getSearchParam("org").trim();

  if (org) {
    localStorage.setItem(LS_ACTIVE_ORG_KEY, org);
  }

  const hash = getHashParams();
  const access_token = (hash.get("access_token") || "").trim();
  const refresh_token = (hash.get("refresh_token") || "").trim();

  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    const url = new URL(window.location.href);
    url.hash = "";
    window.history.replaceState({}, document.title, url.toString());

    if (error) {
      console.error("[operator] setSession error:", error);
    }
  }
}

bootstrapOperatorAuth()
  .catch((e) => {
    console.error("[operator] bootstrap error:", e);
  })
  .finally(() => {
    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </React.StrictMode>
    );
  });
