import React from "react";
import { Link } from "react-router-dom";

export default function AdminHome() {
  return (
    <div style={{ padding: 28, fontFamily: "Inter, system-ui, Arial" }}>
      <h1 style={{ marginTop: 0 }}>scoreDisplay — Admin Console</h1>

      <p style={{ maxWidth: 760, opacity: 0.85 }}>
        Console Super Admin : gestion des organisations (statut, sport), des membres, et contrôles de sécurité.
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
        <Link to="/orgs" style={btn()}>
          Organisations
        </Link>
        <Link to="/members" style={btn()}>
          Membres
        </Link>
        <Link to="/sports" style={btn()}>
          Sports
        </Link>
      </div>

      <div style={{ marginTop: 18, opacity: 0.7, fontSize: 12 }}>
        Rappels : une org <b>archivée</b> = lecture seule. Une org <b>suspendue</b> = accès bloqué (Operator/DB).
      </div>
    </div>
  );
}

function btn(): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #1b2230",
    background: "rgba(255,255,255,.03)",
    color: "inherit",
    textDecoration: "none",
    fontWeight: 800,
  };
}
