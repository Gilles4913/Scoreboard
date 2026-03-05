import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import SuperAdminGuard from "./guards/SuperAdminGuard";
import AdminLayout from "./components/AdminLayout";
import OrgsPage from "./pages/OrgsPage";
import MembersPage from "./pages/MembersPage";
import SportsPage from "./pages/SportsPage";
import DashboardPage from "./pages/DashboardPage";

function Home() {
  return (
    <div>
      <h1>Scoreboard Admin Console</h1>
      <p>Interface Super Admin pour gérer :</p>
      <ul>
        <li>Organisations</li>
        <li>Membres</li>
        <li>Sports</li>
        <li>Paramètres d'affichage (phase suivante)</li>
      </ul>
      <p style={{ marginTop: 12, fontWeight: 700 }}>Utilise le menu en haut.</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <SuperAdminGuard>
        <AdminLayout>
          <Routes
            element={
              <SuperAdminGuard>
                <AdminLayout />
              </SuperAdminGuard>
            }>
            <Route path="/" element={<Home />} />
            <Route path="/orgs" element={<OrgsPage />} />
            <Route path="/members" element={<MembersPage />} />
            <Route path="/sports" element={<SportsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
            <Route path="/" element={<DashboardPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
          </Routes>
        </AdminLayout>
      </SuperAdminGuard>
    </BrowserRouter>
  );
}
