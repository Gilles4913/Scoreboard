import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useAuthRedirect } from './hooks/useAuthRedirect';

import SuperAdminPage from './pages/SuperAdminPage';
import OperatorPage from './pages/OperatorPage';
import AuthDebugPage from './pages/AuthDebugPage';
import SelectOrgPage from './pages/SelectOrgPage';
import DisplayPage from './pages/DisplayPage';
import LoginPage from './pages/LoginPage';

// Page d'aiguillage : redirige selon le rôle si connecté, sinon /login
function HomeRedirector() {
  useAuthRedirect();
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Redirection automatique selon le rôle */}
        <Route path="/" element={<HomeRedirector />} />

        {/* Auth */}
        <Route path="/login" element={<LoginPage />} />

        {/* Pages "app" protégées par la logique du HomeRedirector */}
        <Route path="/super-admin" element={<SuperAdminPage />} />
        <Route path="/matches" element={<OperatorPage />} />
        <Route path="/select-org" element={<SelectOrgPage />} />
        <Route path="/auth-debug" element={<AuthDebugPage />} />

        {/* ✅ Route publique pour l'écran d'affichage */}
        <Route path="/display" element={<DisplayPage />} />
      </Routes>
    </BrowserRouter>
  );
}
