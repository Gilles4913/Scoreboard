export type TeamLike = {
  id?: string | null;
  slug?: string | null;
  name?: string | null;
};

function sanitizeBaseUrl(displayBaseUrl?: string | null) {
  return (displayBaseUrl || "").trim().replace(/\/$/, "");
}

export function buildStableDisplayUrl(
  displayBaseUrl: string,
  team?: TeamLike | null,
): string {
  const base = sanitizeBaseUrl(displayBaseUrl);
  if (!base || !team) return "";

  if (team.slug) {
    return `${base}/?teamSlug=${encodeURIComponent(team.slug)}`;
  }

  if (team.id) {
    return `${base}/?teamId=${encodeURIComponent(team.id)}`;
  }

  return "";
}

export function hasStableDisplayTarget(team?: TeamLike | null): boolean {
  return !!(team && (team.slug || team.id));
}

export function getDisplayBaseUrl(): string {
  const env = (import.meta as any)?.env || {};
  return sanitizeBaseUrl(env.VITE_DISPLAY_APP_URL || env.VITE_DISPLAY_URL || "");
}
