// apps/display/src/api.ts
export type Json = Record<string, any>;

export type DisplayContext = {
  match: {
    id: string;
    name: string;
    status: string;
    scheduled_at: string | null;
    public_display: boolean;
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

function requireEnv() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
  }
  if (SUPABASE_URL.includes("your_supabase") || SUPABASE_ANON_KEY.includes("your_supabase")) {
    throw new Error("Invalid Supabase env values (placeholders detected)");
  }
}

export async function fetchDisplayContext(params: { matchId: string; token: string }): Promise<DisplayContext> {
  requireEnv();

  const url = new URL(`${SUPABASE_URL}/functions/v1/get-display-context`);
  url.searchParams.set("matchId", params.matchId);
  url.searchParams.set("token", params.token);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      // Edge Function call from browser (verify_jwt=false OR with anon headers)
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
