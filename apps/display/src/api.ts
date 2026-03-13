// apps/display/src/api.ts
export type Json = Record<string, any>;

export type DisplayContext = {
  match: {
    id: string;
    name: string;
    status: string;
    scheduled_at: string | null;
  };
  org: {
    id: string;
    slug: string;
    name: string;
    sport: string;
  };
  home: {
    team: { id?: string; name: string; short_name?: string | null; logo?: string | null; colors?: Json | null } | null;
    display: Json;
  };
  away: {
    team: { id?: string; name: string; short_name?: string | null; logo?: string | null; colors?: Json | null } | null;
    display: Json;
  };
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const EDGE_CONTEXT_URL = (import.meta.env.VITE_EDGE_CONTEXT_URL as string) || "";

function requireEnv() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
  }
  if (!EDGE_CONTEXT_URL) {
    throw new Error("Missing VITE_EDGE_CONTEXT_URL");
  }
}

export async function fetchDisplayContext(params: {
  teamSlug?: string;
  teamId?: string;
  matchId?: string;
}): Promise<DisplayContext> {
  requireEnv();

  const url = new URL(EDGE_CONTEXT_URL.replace(/\/$/, ""));
  if (params.teamSlug) url.searchParams.set("teamSlug", params.teamSlug);
  if (params.teamId) url.searchParams.set("teamId", params.teamId);
  if (params.matchId) url.searchParams.set("matchId", params.matchId);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`get-display-context failed: ${res.status} ${text}`.trim());
  }

  return (await res.json()) as DisplayContext;
}
