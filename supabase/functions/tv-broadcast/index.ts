import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TV_WS_RELAY_URL = Deno.env.get("TV_WS_RELAY_URL")!;

function buildCorsHeaders(origin?: string) {
  return {
    "access-control-allow-origin": origin ?? "*",
    "access-control-allow-methods": "POST,OPTIONS",
    "access-control-allow-headers": "authorization,apikey,content-type,x-client-info",
    "content-type": "application/json",
  };
}

function json(body: unknown, status = 200, origin?: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: buildCorsHeaders(origin),
  });
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

async function getAuthenticatedUser(authHeader: string) {
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

async function getMatchOrgId(matchId: string): Promise<string | null> {
  const { data, error } = await admin
    .from("matches")
    .select("org_id")
    .eq("id", matchId)
    .maybeSingle();

  if (error || !data?.org_id) return null;
  return data.org_id as string;
}

async function isOrgMember(userId: string, orgId: string): Promise<boolean> {
  const { data, error } = await admin
    .from("org_members")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .limit(1);

  if (error) return false;
  return Array.isArray(data) && data.length > 0;
}

serve(async (req) => {
  const origin = req.headers.get("origin") ?? "*";

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return json({ error: "Not found" }, 404, origin);
  }

  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE || !TV_WS_RELAY_URL) {
    return json(
      { error: "Missing SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY or TV_WS_RELAY_URL" },
      500,
      origin,
    );
  }

  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "Missing Authorization Bearer" }, 401, origin);
  }

  const user = await getAuthenticatedUser(authHeader);
  if (!user) {
    return json({ error: "Invalid JWT" }, 401, origin);
  }

  const body = await req.json().catch(() => null);
  if (!body?.match_id) {
    return json({ error: "match_id required" }, 400, origin);
  }

  const matchId = String(body.match_id).trim();
  const type = String(body.type || "patch").trim();
  const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
  const ts = Number.isFinite(body.ts) ? body.ts : Date.now();
  const seq = Number.isFinite(body.seq) ? body.seq : 0;

  const orgId = await getMatchOrgId(matchId);
  if (!orgId) {
    return json({ error: "Match not found" }, 404, origin);
  }

  const member = await isOrgMember(user.id, orgId);
  if (!member) {
    return json({ error: "Forbidden (not org member)" }, 403, origin);
  }

  const relayPayload = {
    match_id: matchId,
    org_id: orgId,
    type,
    ts,
    seq,
    payload,
    patch: payload,
  };

  const relayRes = await fetch(TV_WS_RELAY_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${SERVICE_ROLE}`,
    },
    body: JSON.stringify(relayPayload),
  });

  if (!relayRes.ok) {
    const text = await relayRes.text().catch(() => "");
    return json(
      { error: "Relay failed", details: text || `HTTP ${relayRes.status}` },
      502,
      origin,
    );
  }

  return json({ ok: true, relayed: relayPayload }, 200, origin);
});
