import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TV_WS_RELAY_URL = Deno.env.get("TV_WS_RELAY_URL")!; // ex: https://<project>.functions.supabase.co/tv-ws-relay

function corsHeaders(origin?: string) {
  return {
    "access-control-allow-origin": origin ?? "*",
    "access-control-allow-methods": "POST,OPTIONS",
    "access-control-allow-headers": "authorization,content-type",
  };
}

async function getUserIdFromJwt(jwt: string): Promise<string | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      "apikey": ANON_KEY,
      "authorization": `Bearer ${jwt}`,
    },
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.id ?? null;
}

async function getMatchOrgId(matchId: string): Promise<string | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/matches?select=org_id&id=eq.${matchId}&limit=1`, {
    headers: { apikey: SERVICE_ROLE, authorization: `Bearer ${SERVICE_ROLE}` },
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.[0]?.org_id ?? null;
}

async function isMember(userId: string, orgId: string): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/org_members?select=user_id&org_id=eq.${orgId}&user_id=eq.${userId}&limit=1`, {
    headers: { apikey: SERVICE_ROLE, authorization: `Bearer ${SERVICE_ROLE}` },
  });
  if (!res.ok) return false;
  const json = await res.json();
  return Array.isArray(json) && json.length > 0;
}

serve(async (req) => {
  const origin = req.headers.get("origin") ?? "*";

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return new Response("Not found", { status: 404, headers: corsHeaders(origin) });

  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing Authorization Bearer" }), {
      status: 401,
      headers: { ...corsHeaders(origin), "content-type": "application/json" },
    });
  }
  const jwt = auth.slice("Bearer ".length);

  const body = await req.json().catch(() => null);
  if (!body?.match_id || !body?.type) {
    return new Response(JSON.stringify({ error: "match_id and type required" }), {
      status: 400,
      headers: { ...corsHeaders(origin), "content-type": "application/json" },
    });
  }

  const userId = await getUserIdFromJwt(jwt);
  if (!userId) {
    return new Response(JSON.stringify({ error: "Invalid JWT" }), {
      status: 401,
      headers: { ...corsHeaders(origin), "content-type": "application/json" },
    });
  }

  const orgId = await getMatchOrgId(body.match_id);
  if (!orgId) {
    return new Response(JSON.stringify({ error: "Match not found" }), {
      status: 404,
      headers: { ...corsHeaders(origin), "content-type": "application/json" },
    });
  }

  const ok = await isMember(userId, orgId);
  if (!ok) {
    return new Response(JSON.stringify({ error: "Forbidden (not org member)" }), {
      status: 403,
      headers: { ...corsHeaders(origin), "content-type": "application/json" },
    });
  }

  // fanout vers tv-ws-relay
  const relayRes = await fetch(TV_WS_RELAY_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // important: relay accepte bearer (peut être n'importe quoi) dans la version simple,
      // ici on met service role pour permettre un hardening futur
      "authorization": `Bearer ${SERVICE_ROLE}`,
    },
    body: JSON.stringify({
      match_id: body.match_id,
      type: body.type,
      ts: body.ts ?? Date.now(),
      seq: body.seq ?? 0,
      payload: body.payload ?? {},
    }),
  });

  if (!relayRes.ok) {
    const text = await relayRes.text();
    return new Response(JSON.stringify({ error: "Relay failed", details: text }), {
      status: 502,
      headers: { ...corsHeaders(origin), "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders(origin), "content-type": "application/json" },
  });
});
