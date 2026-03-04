import type { SupabaseClient } from "@supabase/supabase-js";
import { supa } from "./supabase";

/**
 * Room naming convention (Pro)
 * - org room: sb2:org:<org_id>
 * - match room fallback: sb2:match:<match_id>
 */
const orgChannels = new Map<string, ReturnType<SupabaseClient["channel"]>>();

async function ensureOrgChannel(orgId: string) {
  const key = `sb2:org:${orgId}`;
  const existing = orgChannels.get(key);
  if (existing) return existing;

  const ch = supa.channel(key, { config: { broadcast: { self: true } } });

  // subscribe once
  const { error } = await ch.subscribe();
  if (error) throw error;

  orgChannels.set(key, ch);
  return ch;
}

/**
 * Broadcast full match payload (recommended).
 * Display listens to event: "match_update" and replaces state.
 */
export async function broadcastMatchUpdate(orgId: string, match: any) {
  const ch = await ensureOrgChannel(orgId);
  const { error } = await ch.send({
    type: "broadcast",
    event: "match_update",
    payload: { match },
  });
  if (error) throw error;
}

/**
 * Broadcast partial patch (optional).
 * Display listens to event: "score_update" and merges patch.
 */
export async function broadcastScorePatch(orgId: string, patch: Record<string, any>) {
  const ch = await ensureOrgChannel(orgId);
  const { error } = await ch.send({
    type: "broadcast",
    event: "score_update",
    payload: patch,
  });
  if (error) throw error;
}

/**
 * Optional: clean up all channels (ex: logout)
 */
export async function realtimeCleanup() {
  for (const ch of orgChannels.values()) {
    try {
      await supa.removeChannel(ch);
    } catch {}
  }
  orgChannels.clear();
}
