import React, { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { supabase } from "../supabase";

type ThemeMode = "light" | "dark";

const STORAGE_KEY = "scoreDisplay_admin_theme";

function getInitialTheme(): ThemeMode {
  const v = (localStorage.getItem(STORAGE_KEY) || "").toLowerCase();
  return v === "dark" ? "dark" : "light";
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());

  const OPERATOR_URL = (import.meta.env.VITE_OPERATOR_URL || "").replace(/\/$/, "");
  const HOME_URL = (import.meta.env.VITE_HOME_URL || "").replace(/\/$/, "");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const styles = useMemo(() => {
    const isDark = theme === "dark";

    const bg = isDark ? "#0b0d10" : "#f6f7fb";
    const panel = isDark ? "#0f141b" : "#ffffff";
    const text = isDark ? "#e5e7eb" : "#111827";
    const muted = isDark ? "#a7b0bf" : "#6b7280";
    const border = isDark ? "#202938" : "#e5e7eb";

    const activeBg = isDark ? "#e5e7eb" : "#111827";
    const activeText = isDark ? "#0b0d10" : "#ffffff";

    return {
      page: {
        minHeight: "100vh",
        background: bg,
        color: text,
        fontFamily: "system-ui",
      } as React.CSSProperties,
      topbar: {
        display: "flex",
        gap: 10,
        padding: "12px 16px",
        borderBottom: `1px solid ${border}`,
        alignItems: "center",
        background: panel,
        position: "sticky",
        top: 0,
        zIndex: 10,
      } as React.CSSProperties,
      brand: {
        textDecoration: "none",
        fontWeight: 900,
        color: text,
        letterSpacing: 0.2,
      } as React.CSSProperties,
      pill: {
        textDecoration: "none",
        padding: "7px 10px",
        borderRadius: 10,
        border: `1px solid ${border}`,
        color: text,
        fontWeight: 800,
        background: "transparent",
      } as React.CSSProperties,
      pillActive: {
        background: activeBg,
        color: activeText,
        border: `1px solid ${activeBg}`,
      } as React.CSSProperties,
      right: { marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" } as React.CSSProperties,
      btn: {
        padding: "7px 10px",
        borderRadius: 10,
        border: `1px solid ${border}`,
        background: panel,
        color: text,
        cursor: "pointer",
        fontWeight: 800,
      } as React.CSSProperties,
      subtle: { color: muted, fontSize: 12 } as React.CSSProperties,
      content: { padding: 16 } as React.CSSProperties,
    };
  }, [theme]);

  const navLinkStyle = ({ isActive }: { isActive: boolean }) => {
    const base = styles.pill;
    return isActive ? { ...base, ...styles.pillActive } : base;
  };

  async function signOut() {
    await supabase.auth.signOut();
    // On renvoie vers Home (si configuré), sinon racine admin
    if (HOME_URL) window.location.assign(`${HOME_URL}/`);
    else window.location.assign("/");
  }

  return (
    <div style={styles.page}>
      <div style={styles.topbar}>
        <Link to="/" style={styles.brand}>
          scoreDisplay — Admin
        </Link>

        <NavLink to="/orgs" style={navLinkStyle}>
          Organisations
        </NavLink>
        <NavLink to="/members" style={navLinkStyle}>
          Membres
        </NavLink>
        <NavLink to="/sports" style={navLinkStyle}>
          Sports
        </NavLink>

        <div style={styles.right}>
          <div style={styles.subtle} title={loc.pathname}>
            {loc.pathname}
          </div>

          <button
            style={styles.btn}
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            title="Thème clair/sombre"
          >
            {theme === "dark" ? "🌙 Dark" : "☀️ Light"}
          </button>

          {OPERATOR_URL ? (
            <button
              style={styles.btn}
              onClick={() => window.location.assign(`${OPERATOR_URL}/`)}
              title="Aller vers Operator"
            >
              Operator
            </button>
          ) : null}

          <button style={styles.btn} onClick={signOut}>
            Déconnexion
          </button>
        </div>
      </div>

      <div style={styles.content}>{children}</div>
    </div>
  );
}
