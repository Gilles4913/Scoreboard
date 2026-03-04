import { supabase } from "./supabase";

const TV_BROADCAST_URL = import.meta.env.VITE_TV_BROADCAST_URL as string | undefined;

export type TVEventType =
  | "score.set"
  | "timer.set"
  | "timer.start"
  | "timer.pause"
  | "period.set"
  | "state.patch"
  | "event.add";

export async function tvEmit(matchId: string, type: TVEventType, payload: any, seq: number) {
  if (!TV_BROADCAST_URL) return { ok: false, error: "VITE_TV_BROADCAST_URL not set" };

  const { data } = await supabase.auth.getSession();
  const jwt = data.session?.access_token;
  if (!jwt) return { ok: false, error: "not authenticated" };

  const res = await fetch(TV_BROADCAST_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ match_id: matchId, type, ts: Date.now(), seq, payload }),
  });

  if (!res.ok) return { ok: false, error: await res.text() };
  return { ok: true };
}
