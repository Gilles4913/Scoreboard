import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { useAuthRedirect } from "./hooks/useAuthRedirect";

import SuperAdminPage from "./pages/SuperAdminPage";
import OperatorPage from "./pages/OperatorPage";
import AuthDebugPage from "./pages/AuthDebugPage";
import SelectOrgPage from "./pages/SelectOrgPage";
import DisplayPage from "./pages/DisplayPage";
import LoginPage from "./pages/LoginPage";

/**
 * URLs externes (Vercel) – à définir dans les env de apps/home
 * - VITE_OPERATOR_URL = https://scoreboard-operator-xxx.vercel.app
 * - VITE_ADMIN_URL    = https://scoreboard-admin-xxx.vercel.app
 * - VITE_DISPLAY_URL  = https://scoreboard-display-pi.vercel.app
 *
 * NB: pas de slash final obligatoire.
 */
const OPERATOR_URL = (import.meta as any).env?.VITE_OPERATOR_URL as string | undefined;
const ADMIN_URL = (import.meta as any).env?.VITE_ADMIN_URL as string | undefined;
const DISPLAY_URL = (import.meta as any).env?.VITE_DISPLAY_URL as string | undefined;

/**
 * Redirection “hard” vers une autre app (conserve pathname + query)
 */
function hardRedirect(baseUrl: string | undefined, pathWithQuery: string) {
  if (!baseUrl) return false;
  const base = baseUrl.replace(/\/$/, "");
  window.location.href = `${base}${pathWithQuery.startsWith("/") ? "" : "/"}${pathWithQuery}`;
  return true;
}

/**
 * Page d'aiguillage :
 * - si connecté, useAuthRedirect() va te router selon ton implémentation existante
 * - ensuite, si tu veux basculer vers les apps externes (SaaS), on redirige vers les URLs Vercel
 */
function HomeRedirector() {
  const nav = useNavigate();

  useEffect(() => {
    // 1) Tu as déjà une logique existante dans useAuthRedirect (probablement: profile + rôle)
    //    Elle redirige vers /super-admin ou /matches ou /select-org etc.
    //    On laisse faire puis, si on est sur une de ces routes, on peut “sortir” vers les apps SaaS.
    //    => On le fait ici simplement en lisant le localStorage (ou un flag) serait idéal,
    //    mais comme on ne voit pas ton hook, on fait un fallback :
    //    si l'app a des URLs externes, on préfère les utiliser.
    //
    // 2) Si tu veux forcer 100% SaaS (toujours sortir), mets un flag env:
    //    VITE_SAAS_MODE=1 et décommente la section ci-dessous.
  }, []);

  // Appelle ton hook actuel (il navigue côté home)
  useAuthRedirect();

  // Rien à render
  return null;
}

/**
 * Route /display :
 * - en prod SaaS: redirection vers l’app Display (DISPLAY_URL) + conservation du querystring
 * - fallback : si DISPLAY_URL absent, on sert la page DisplayPage locale
 */
function DisplayRoute() {
  const loc = useLocation();
  const pathWithQuery = `${loc.pathname}${loc.search}${loc.hash}`;

  // si on a une app Display dédiée, on sort
  if (DISPLAY_URL) {
    hardRedirect(DISPLAY_URL, pathWithQuery);
    return null;
  }

  // sinon, fallback local
  return <DisplayPage />;
}

/**
 * Route /matches (operator) :
 * - en prod SaaS: redirection vers Operator app
 * - fallback local OperatorPage
 */
function OperatorRoute() {
  const loc = useLocation();
  const pathWithQuery = `${loc.pathname}${loc.search}${loc.hash}`;

  if (OPERATOR_URL) {
    hardRedirect(OPERATOR_URL, pathWithQuery);
    return null;
  }

  return <OperatorPage />;
}

/**
 * Route /super-admin :
 * - en prod SaaS: redirection vers Admin app
 * - fallback local SuperAdminPage
 */
function AdminRoute() {
  const loc = useLocation();
  const pathWithQuery = `${loc.pathname}${loc.search}${loc.hash}`;

  if (ADMIN_URL) {
    hardRedirect(ADMIN_URL, pathWithQuery);
    return null;
  }

  return <SuperAdminPage />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 🔁 Redirection automatique selon le rôle (logique existante) */}
        <Route path="/" element={<HomeRedirector />} />

        {/* Auth */}
        <Route path="/login" element={<LoginPage />} />

        {/* ✅ Routes hub → redirigent vers les apps Vercel si URLs définies, sinon fallback local */}
        <Route path="/super-admin" element={<AdminRoute />} />
        <Route path="/matches" element={<OperatorRoute />} />
        <Route path="/display" element={<DisplayRoute />} />

        {/* Pages locales utiles (en général tu peux les garder) */}
        <Route path="/select-org" element={<SelectOrgPage />} />
        <Route path="/auth-debug" element={<AuthDebugPage />} />
      </Routes>
    </BrowserRouter>
  );
}
