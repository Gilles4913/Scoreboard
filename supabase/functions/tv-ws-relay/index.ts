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
    "access-control-allow-headers": "authorization,content-type,apikey,x-client-info",
    "content-type": "application/json",
  };
}

function json(body: unknown, status = 200, origin?: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(origin),
  });
}

async function getMatchIdFromToken(displayToken: string): Promise<string | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/matches?select=id&display_token=eq.${encodeURIComponent(displayToken)}&limit=1`,
    {
      headers: {
        apikey: SERVICE_ROLE,
        authorization: `Bearer ${SERVICE_ROLE}`,
      },
    },
  );
  if (!res.ok) return null;
  const data = await res.json().catch(() => []);
  return data?.[0]?.id ?? null;
}

function broadcast(matchId: string, msg: any) {
  const clients = rooms.get(matchId);
  if (!clients || clients.size === 0) return 0;

  const payload = JSON.stringify(msg);
  let sent = 0;

  for (const c of [...clients]) {
    try {
      if (c.ws.readyState === WebSocket.OPEN) {
        c.ws.send(payload);
        sent++;
      } else {
        clients.delete(c);
      }
    } catch {
      clients.delete(c);
    }
  }

  if (clients.size === 0) {
    rooms.delete(matchId);
  }

  return sent;
}

serve(async (req) => {
  const origin = req.headers.get("origin") ?? "*";

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }

  const url = new URL(req.url);

  // ---- WS CONNECT (Display) ----
  if (req.method === "GET" && req.headers.get("upgrade")?.toLowerCase() === "websocket") {
    const displayToken = (url.searchParams.get("token") || "").trim();
    const directMatchId = (url.searchParams.get("matchId") || "").trim();

    let matchId = directMatchId;

    if (!matchId && displayToken) {
      matchId = (await getMatchIdFromToken(displayToken)) || "";
    }

    if (!matchId) {
      return new Response("Missing token or matchId", { status: 400, headers: corsHeaders(origin) });
    }

    const { socket, response } = Deno.upgradeWebSocket(req);
    const client: Client = { ws: socket, matchId, lastSeq: -1 };

    socket.onopen = () => {
      if (!rooms.has(matchId)) rooms.set(matchId, new Set());
      rooms.get(matchId)!.add(client);

      socket.send(JSON.stringify({
        type: "hello",
        match_id: matchId,
        ts: Date.now(),
      }));
    };

    socket.onmessage = (ev) => {
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
      const set = rooms.get(matchId);
      if (set) {
        set.delete(client);
        if (set.size === 0) rooms.delete(matchId);
      }
    };

    return response;
  }

  // ---- BROADCAST (tv-broadcast -> POST) ----
  if (req.method === "POST") {
    const auth = req.headers.get("authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      return json({ error: "Missing Authorization Bearer" }, 401, origin);
    }

    const body = await req.json().catch(() => null);
    if (!body?.match_id) {
      return json({ error: "match_id required" }, 400, origin);
    }

    const matchId = String(body.match_id).trim();
    const type = String(body.type || "patch").trim();
    const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
    const patch = body.patch && typeof body.patch === "object" ? body.patch : payload;
    const ts = Number.isFinite(body.ts) ? body.ts : Date.now();
    const seq = Number.isFinite(body.seq) ? body.seq : 0;

    const msg = {
      match_id: matchId,
      type,
      ts,
      seq,
      payload,
      patch,
    };

    const sent = broadcast(matchId, msg);

    return json({ ok: true, sent, rooms: rooms.get(matchId)?.size ?? 0 }, 200, origin);
  }

  return json({ error: "Not found" }, 404, origin);
});
