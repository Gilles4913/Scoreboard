import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { AppRouterPage } from "./pages/AppRouterPage";
import { LogoutPage } from "./pages/LogoutPage";
import { AdminGatePage } from "./pages/AdminGatePage";
import { AuthGate, RoleGate } from "./guards";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/app"
          element={
            <AuthGate>
              <AppRouterPage />
            </AuthGate>
          }
        />

        <Route
          path="/admin"
          element={
            <AuthGate>
              <RoleGate allow={["super_admin"]}>
                <AdminGatePage />
              </RoleGate>
            </AuthGate>
          }
        />

        <Route
          path="/logout"
          element={
            <AuthGate>
              <LogoutPage />
            </AuthGate>
          }
        />

        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
