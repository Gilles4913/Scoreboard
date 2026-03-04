import React from "react";
import { Link, NavLink } from "react-router-dom";
import { supabase } from "../supabase";

const navStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  padding: "12px 16px",
  borderBottom: "1px solid #e5e7eb",
  alignItems: "center",
  fontFamily: "system-ui",
};

const active = ({ isActive }: { isActive: boolean }) => ({
  textDecoration: "none",
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  background: isActive ? "#111827" : "white",
  color: isActive ? "white" : "#111827",
  fontWeight: 700,
});

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div style={navStyle}>
        <Link to="/" style={{ textDecoration: "none", fontWeight: 900, color: "#111827" }}>
          SB2 Admin
        </Link>
        <NavLink to="/orgs" style={active}>
          Organisations
        </NavLink>
        <NavLink to="/members" style={active}>
          Membres
        </NavLink>
        <NavLink to="/sports" style={active}>
          Sports
        </NavLink>
        <div style={{ flex: 1 }} />
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.assign("/");
          }}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            background: "white",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Déconnexion
        </button>
      </div>

      <div style={{ padding: 16, fontFamily: "system-ui" }}>{children}</div>
    </div>
  );
}
