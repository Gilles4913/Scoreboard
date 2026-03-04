import { supa } from "./supabase";
import { pickRole, AppRole } from "./roles";

export async function getUserRole(): Promise<{ role: AppRole; memberships: any[] }> {
  const { data: auth, error: authErr } = await supa.auth.getUser();
  if (authErr) throw authErr;
  const user = auth.user;
  if (!user) return { role: "unknown", memberships: [] };

  // On récupère toutes les memberships + info org (slug, is_master)
  const { data, error } = await supa
    .from("org_members")
    .select("role, orgs!inner(slug, is_master)")
    .eq("user_id", user.id);

  if (error) throw error;

  const rows = (data ?? []).map((m: any) => ({
    role: m.role,
    org_slug: m.orgs?.slug,
    is_master: !!m.orgs?.is_master,
  }));

  return { role: pickRole(rows), memberships: rows };
}
