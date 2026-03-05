// apps/admin/src/App.tsx
import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import SuperAdminGuard from "./guards/SuperAdminGuard";
import AdminLayout from "./components/AdminLayout";

import DashboardPage from "./pages/DashboardPage";
import OrgsPage from "./pages/OrgsPage";
import MembersPage from "./pages/MembersPage";
import SportsPage from "./pages/SportsPage";

export default function App() {
  return (
    <BrowserRouter>
      <SuperAdminGuard>
        <AdminLayout>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/orgs" element={<OrgsPage />} />
            <Route path="/members" element={<MembersPage />} />
            <Route path="/sports" element={<SportsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AdminLayout>
      </SuperAdminGuard>
    </BrowserRouter>
  );
}
