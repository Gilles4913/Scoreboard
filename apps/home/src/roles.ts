export type AppRole = "super_admin" | "org_admin" | "operator" | "viewer" | "unknown";

export function pickRole(rows: any[]): AppRole {
  // rows = [{ org_slug, is_master, role }]
  if (!rows || rows.length === 0) return "unknown";

  // super_admin prioritaire
  if (rows.some((r) => r.role === "super_admin")) return "super_admin";
  if (rows.some((r) => r.role === "org_admin")) return "org_admin";
  if (rows.some((r) => r.role === "operator")) return "operator";

  return "unknown";
}

export function canAccessAdmin(role: AppRole) {
  return role === "super_admin";
}
