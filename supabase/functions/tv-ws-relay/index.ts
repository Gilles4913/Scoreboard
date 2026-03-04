/// <reference lib="deno.unstable" />
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Client = { ws: WebSocket; matchId: string; lastSeq: number };

const rooms = new Map<string, Set<Client>>();

function corsHeaders(origin?: string) {
  return {
    "access-control-allow-origin": origin ?? "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "authorization,content-type",
  };
}

async function getMatchIdFromToken(displayToken: string): Promise<string | null> {
  // Service role query
  const res = await fetch(`${SUPABASE_URL}/rest/v1/matches?select=id&display_token=eq.${encodeURIComponent(displayToken)}&limit=1`, {
    headers: {
      "apikey": SERVICE_ROLE,
      "authorization": `Bearer ${SERVICE_ROLE}`,
    },
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.[0]?.id ?? null;
}

function broadcast(matchId: string, msg: any) {
  const clients = rooms.get(matchId);
  if (!clients) return;
  const payload = JSON.stringify(msg);
  for (const c of clients) {
    try {
      c.ws.send(payload);
    } catch {
      // ignore
    }
  }
}

serve(async (req) => {
  const origin = req.headers.get("origin") ?? "*";

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }

  const url = new URL(req.url);

  // ---- WS CONNECT (Display) ----
  if (req.method === "GET" && req.headers.get("upgrade")?.toLowerCase() === "websocket") {
    const displayToken = url.searchParams.get("token") || "";
    if (!displayToken) {
      return new Response("Missing token", { status: 400, headers: corsHeaders(origin) });
    }

    const matchId = await getMatchIdFromToken(displayToken);
    if (!matchId) {
      return new Response("Invalid token", { status: 401, headers: corsHeaders(origin) });
    }

    const { socket, response } = Deno.upgradeWebSocket(req);
    const client: Client = { ws: socket, matchId, lastSeq: -1 };

    socket.onopen = () => {
      if (!rooms.has(matchId)) rooms.set(matchId, new Set());
      rooms.get(matchId)!.add(client);

      socket.send(JSON.stringify({ type: "hello", match_id: matchId, ts: Date.now() }));
    };

    socket.onmessage = (ev) => {
      // optional: ping/pong + client ack
      try {
        const msg = JSON.parse(ev.data);
        if (msg?.type === "pong") return;
        if (msg?.type === "ack" && typeof msg.seq === "number") {
          client.lastSeq = msg.seq;
        }
      } catch {
        // ignore
      }
    };

    socket.onclose = () => {
      const set = rooms.get(matchId);
      if (set) {
        set.delete(client);
        if (set.size === 0) rooms.delete(matchId);
      }
    };

    socket.onerror = () => {
      // will be cleaned by close
    };

    return response;
  }

  // ---- BROADCAST (Operator -> POST) ----
  if (req.method === "POST") {
    const auth = req.headers.get("authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing Authorization Bearer" }), {
        status: 401,
        headers: { ...corsHeaders(origin), "content-type": "application/json" },
      });
    }

    // NOTE: ici on ne re-vérifie pas le JWT via GoTrue (pour rester simple),
    // mais on pourrait le faire (et vérifier org_members) dans tv-broadcast (separate).
    // Comme tu veux un setup rapide, on fait la vérif “service-only” côté Operator via une clé.
    // => pour la prod stricte: on split en 2 functions et on valide membership.
    const body = await req.json().catch(() => null);
    if (!body?.match_id || !body?.type) {
      return new Response(JSON.stringify({ error: "match_id and type required" }), {
        status: 400,
        headers: { ...corsHeaders(origin), "content-type": "application/json" },
      });
    }

    const msg = {
      match_id: body.match_id,
      type: body.type,
      ts: body.ts ?? Date.now(),
      seq: body.seq ?? 0,
      payload: body.payload ?? {},
    };

    broadcast(body.match_id, msg);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders(origin), "content-type": "application/json" },
    });
  }

  return new Response("Not found", { status: 404, headers: corsHeaders(origin) });
});
