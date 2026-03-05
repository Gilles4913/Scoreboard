import React, { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

function getEnv(name: string) {
  const v = (import.meta as any).env?.[name];
  return typeof v === "string" ? v : "";
}

const HOME_URL = (getEnv("VITE_HOME_URL") || "https://scoreboard-home.vercel.app/").replace(/\/$/, "");
const OPERATOR_URL = (getEnv("VITE_OPERATOR_URL") || "").replace(/\/$/, "");
const DISPLAY_URL = (getEnv("VITE_DISPLAY_URL") || "").replace(/\/$/, "");

type Theme = "dark" | "light";

function getTheme(): Theme {
  const t = (localStorage.getItem("scoreDisplay.admin.theme") || "").toLowerCase();
  return t === "light" ? "light" : "dark";
}
function setTheme(t: Theme) {
  localStorage.setItem("scoreDisplay.admin.theme", t);
  document.documentElement.dataset.theme = t;
}

export default function AdminLayout() {
  const nav = useNavigate();
  const loc = useLocation();

  const [email, setEmail] = useState<string | null>(null);
  const [theme, setThemeState] = useState<Theme>(getTheme());

  useEffect(() => setTheme(theme), [theme]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setEmail(data.session?.user?.email ?? null);
    })();
  }, [loc.pathname]);

  const active = useMemo(() => {
    const p = loc.pathname;
    if (p.startsWith("/orgs")) return "orgs";
    if (p.startsWith("/members")) return "members";
    return "orgs";
  }, [loc.pathname]);

  async function logout() {
    await supabase.auth.signOut();
    // Retour vers home (login)
    window.location.assign(`${HOME_URL}/?forceLogin=1`);
  }

  function external(url: string) {
    if (!url) return;
    window.location.assign(url);
  }

  return (
    <div style={shell()}>
      <style>{styles}</style>

      <header style={topbar()}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontWeight: 950, letterSpacing: 0.2 }}>scoreDisplay</div>
          <div style={{ opacity: 0.75, fontSize: 12 }}>Admin Console</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button style={btnGhost()} onClick={() => setThemeState((t) => (t === "dark" ? "light" : "dark"))} title="Thème">
            {theme === "dark" ? "🌙 Sombre" : "☀️ Clair"}
          </button>

          {DISPLAY_URL ? (
            <button style={btnGhost()} onClick={() => external(DISPLAY_URL)} title="Ouvrir Display">
              📺 Display
            </button>
          ) : null}

          {OPERATOR_URL ? (
            <button style={btnGhost()} onClick={() => external(OPERATOR_URL)} title="Ouvrir Operator">
              ⚙️ Operator
            </button>
          ) : null}

          <button style={btn()} onClick={logout} title="Déconnexion">
            Déconnexion
          </button>
        </div>
      </header>

      <div style={layout()}>
        <aside style={sidebar()}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Connecté</div>
            <div style={{ fontWeight: 900, fontSize: 13 }}>{email || "…"}</div>
          </div>

          <nav style={{ display: "grid", gap: 8 }}>
            <Link style={navItem(active === "orgs")} to="/orgs">
              Organisations
            </Link>
            <Link style={navItem(active === "members")} to="/members">
              Membres
            </Link>
          </nav>

          <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 12, display: "grid", gap: 8 }}>
            <button style={btnGhost()} onClick={() => nav("/orgs")} title="Liste organisations (actives par défaut)">
              🔎 Recherche / filtres
            </button>
            <button style={btnGhost()} onClick={() => window.location.assign(`${HOME_URL}/`)} title="Retour Home">
              🏠 Home
            </button>
          </div>

          <div style={{ marginTop: "auto", fontSize: 12, opacity: 0.7 }}>
            Astuce: <code>?forceLogin=1</code> sur Home pour forcer la reconnexion.
          </div>
        </aside>

        <main style={main()}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/* styles */
const styles = `
  :root{
    --bg:#0b0d10; --panel:rgba(255,255,255,.04); --text:#e5e7eb; --muted:#9ca3af; --border:#1b2230; --primary:#60a5fa;
  }
  :root[data-theme="light"]{
    --bg:#f6f7fb; --panel:#ffffff; --text:#0f172a; --muted:#475569; --border:#e2e8f0; --primary:#2563eb;
  }
  *{ box-sizing: border-box; }
  a{ color: inherit; text-decoration: none; }
  code{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
`;

function shell(): React.CSSProperties {
  return { minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "Inter, system-ui, Arial" };
}
function topbar(): React.CSSProperties {
  return {
    position: "sticky",
    top: 0,
    zIndex: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "14px 18px",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg)",
  };
}
function layout(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "260px 1fr", minHeight: "calc(100vh - 56px)" };
}
function sidebar(): React.CSSProperties {
  return {
    borderRight: "1px solid var(--border)",
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  };
}
function main(): React.CSSProperties {
  return { padding: 16 };
}
function navItem(active: boolean): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: active ? "rgba(96,165,250,.16)" : "var(--panel)",
    fontWeight: 900,
  };
}
function btn(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "rgba(96,165,250,.18)",
    color: "var(--text)",
    cursor: "pointer",
    fontWeight: 900,
  };
}
function btnGhost(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--panel)",
    color: "var(--text)",
    cursor: "pointer",
    fontWeight: 900,
  };
}
