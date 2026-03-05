// apps/operator/src/App.tsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import MatchPage from "./pages/MatchPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MatchPage />} />
      <Route path="/matches" element={<MatchPage />} />
      {/* routes legacy supprimées */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
