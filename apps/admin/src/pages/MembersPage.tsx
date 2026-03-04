import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";

type Org = { id: string; slug: string; name: string; is_master: boolean };
type Profile = { id: string; email: string; role: string | null };
type MemberRow = { org_id: string; user_id: string; role: string };

const MEMBER_ROLES = ["org_admin", "operator", "viewer"];

export default function MembersPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [orgId, setOrgId] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [role, setRole] = useState<string>("operator");

  async function load() {
    setErr(null);

    const o = await supabase.from("orgs").select("id,slug,name,is_master").order("is_master", { ascending: false }).order("name");
    const p = await supabase.from("profiles").select("id,email,role").order("email");
    const m = await supabase.from("org_members").select("org_id,user_id,role").order("org_id");

    if (o.error) return setErr(o.error.message);
    if (p.error) return setErr(p.error.message);
    if (m.error) return setErr(m.error.message);

    setOrgs((o.data as Org[]) ?? []);
    setProfiles((p.data as Profile[]) ?? []);
    setMembers((m.data as MemberRow[]) ?? []);

    if (!orgId && o.data?.[0]?.id) setOrgId(o.data[0].id);
    if (!userId && p.data?.[0]?.id) setUserId(p.data[0].id);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addMember() {
    setErr(null);
    if (!orgId || !userId) return;

    const { error } = await supabase.from("org_members").insert({ org_id: orgId, user_id: userId, role });
    if (error) return setErr(error.message);
    await load();
  }

  async function removeMember(r: MemberRow) {
    setErr(null);
    if (!confirm("Retirer ce membre ?")) return;

    const { error } = await supabase.from("org_members").delete().match({ org_id: r.org_id, user_id: r.user_id });
    if (error) return setErr(error.message);
    await load();
  }

  function orgLabel(id: string) {
    const o = orgs.find((x) => x.id === id);
    return o ? `${o.name} (${o.slug})` : id;
  }
  function userLabel(id: string) {
    const u = profiles.find((x) => x.id === id);
    return u ? u.email : id;
  }

  return (
    <div>
      <h2>Membres</h2>

      <div style={{ display: "grid", gap: 8, maxWidth: 720, padding: 12, border: "1px solid #e5e7eb", borderRadius: 12 }}>
        <div style={{ fontWeight: 800 }}>Ajouter un membre à une organisation</div>

        <label>Organisation</label>
        <select value={orgId} onChange={(e) => setOrgId(e.target.value)}>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.is_master ? "⭐ " : ""}{o.name} ({o.slug})
            </option>
          ))}
        </select>

        <label>Utilisateur (profiles)</label>
        <select value={userId} onChange={(e) => setUserId(e.target.value)}>
          {profiles.map((u) => (
            <option key={u.id} value={u.id}>
              {u.email} {u.role === "super_admin" ? "(super_admin)" : ""}
            </option>
          ))}
        </select>

        <label>Rôle</label>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          {MEMBER_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        <button onClick={addMember} style={{ padding: "8px 10px", fontWeight: 800 }}>
          Ajouter
        </button>

        {err && <div style={{ color: "crimson" }}>{err}</div>}
      </div>

      <div style={{ height: 16 }} />

      <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: 980 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Organisation</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Utilisateur</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Rôle</th>
            <th style={{ borderBottom: "1px solid #e5e7eb", padding: 8 }} />
          </tr>
        </thead>
        <tbody>
          {members.map((r) => (
            <tr key={`${r.org_id}:${r.user_id}`}>
              <td style={{ padding: 8 }}>{orgLabel(r.org_id)}</td>
              <td style={{ padding: 8 }}>{userLabel(r.user_id)}</td>
              <td style={{ padding: 8 }}>{r.role}</td>
              <td style={{ padding: 8, textAlign: "right" }}>
                <button onClick={() => removeMember(r)}>Retirer</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
