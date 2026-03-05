import React, { useEffect, useState } from "react";
import { supabase } from "./supabase";

const OPERATOR_URL = import.meta.env.VITE_OPERATOR_URL;
const ADMIN_URL = import.meta.env.VITE_ADMIN_URL;

const LS_ACTIVE_ORG_KEY = "scoreDisplay.activeOrgSlug";

type OrgRow = {
  id: string;
  slug: string;
  name: string;
  status?: string | null;
};

type MemberRow = {
  role: string;
  orgs: OrgRow | null;
};

export default function App() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);

  const [rows, setRows] = useState<MemberRow[]>([]);
  const [err, setErr] = useState("");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");

  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    setLoading(true);
    setErr("");

    const url = new URL(window.location.href);

    if (url.searchParams.get("forceLogin") === "1") {
      await supabase.auth.signOut();
    }

    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;

    if (!user) {
      setLoading(false);
      return;
    }

    setEmail(user.email || "");
    setSessionUserId(user.id);

    await loadOrgs(user.id);
    await loadSuperAdmin(user.id);

    setLoading(false);
  }

  async function loadOrgs(userId: string) {
    const { data, error } = await supabase
      .from("org_members")
      .select("role, orgs(id,slug,name,status)")
      .eq("user_id", userId);

    if (error) {
      setErr(error.message);
      setRows([]);
      return;
    }

    setRows((data as any) || []);
  }

  async function loadSuperAdmin(userId: string) {
    const { data, error } = await supabase.rpc("is_super_admin", {
      p_user: userId
    });

    if (!error) {
      setIsSuperAdmin(!!data);
    }
  }

  async function login() {
    setErr("");

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPass
    });

    if (error) {
      setErr(error.message);
      return;
    }

    window.location.reload();
  }

  async function logout() {
    await supabase.auth.signOut();
    localStorage.removeItem(LS_ACTIVE_ORG_KEY);
    window.location.reload();
  }
async function openInOperator(org: { id: string; slug: string }) {
  localStorage.setItem("scoreDisplay.activeOrgId", org.id);
  localStorage.setItem("scoreDisplay.activeOrgSlug", org.slug);

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    // pas de session => retour login
    window.location.href = "/?forceLogin=1";
    return;
  }

  const operatorUrl = (import.meta as any).env?.VITE_OPERATOR_URL as string;
  const base = (operatorUrl || "").replace(/\/$/, "");
  const access_token = data.session.access_token;
  const refresh_token = data.session.refresh_token;

  // IMPORTANT: passer les tokens, puis Operator les “consomme” et nettoie l’URL.
  window.location.href = `${base}/?access_token=${encodeURIComponent(access_token)}&refresh_token=${encodeURIComponent(
    refresh_token
  )}`;
}
  

  function openAdmin() {
    window.open(ADMIN_URL, "_blank");
  }

  if (loading) {
    return <div style={{ padding: 40 }}>Chargement...</div>;
  }

  if (!sessionUserId) {
    return (
      <div style={{ padding: 40 }}>
        <h1>scoreDisplay</h1>

        <div style={{ marginTop: 20 }}>
          <input
            placeholder="email"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
          />
        </div>

        <div style={{ marginTop: 10 }}>
          <input
            type="password"
            placeholder="password"
            value={loginPass}
            onChange={(e) => setLoginPass(e.target.value)}
          />
        </div>

        <button style={{ marginTop: 10 }} onClick={login}>
          Login
        </button>

        {err && <div style={{ color: "crimson" }}>{err}</div>}
      </div>
    );
  }

  const orgs = rows
    .map((r) => r.orgs)
    .filter((o): o is OrgRow => !!o)
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  return (
    <div style={{ padding: 40 }}>
      <h1>scoreDisplay</h1>

      <div style={{ marginBottom: 10 }}>
        connecté : <b>{email}</b>{" "}
        <button onClick={logout}>logout</button>
      </div>

      {isSuperAdmin && (
        <div style={{ marginBottom: 20 }}>
          <button onClick={openAdmin}>
            Admin console
          </button>
        </div>
      )}

      <h2>Organisations</h2>

      {orgs.length === 0 && (
        <div>Aucune organisation.</div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {orgs.map((o) => (
          <div
            key={o.id}
            style={{
              border: "1px solid #3333",
              borderRadius: 10,
              padding: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}
          >
            <div>
              <div style={{ fontWeight: 700 }}>
                {o.name}
              </div>

              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {o.slug} {o.status ? "• " + o.status : ""}
              </div>
            </div>

            <button onClick={() => openOperator(o.slug)}>
              Ouvrir
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
