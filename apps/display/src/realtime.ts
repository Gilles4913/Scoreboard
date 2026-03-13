// apps/display/src/realtime.ts
import { createClient } from "@supabase/supabase-js";
import type { MatchState } from "@pkg/types";

export function channelKey(org: string, matchId: string) {
  return `match:${org}:${matchId}`;
}

export function connectDisplay(
  org: string,
  matchId: string,
  onState: (state: MatchState, info?: any) => void
) {
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const supa = createClient(url, anon, { auth: { persistSession: false } });

  const channelName = channelKey(org, matchId);
  console.log("Display - Connexion au canal:", channelName);

  const ch = supa.channel(channelName, {
    config: {
      broadcast: { ack: true },
      presence: { key: "display" },
    },
  });

  ch.on("broadcast", { event: "state" }, (p) => {
    const { state, info } = p.payload as any;
    if (state) onState(state, info);
  });

  ch.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      ch.send({
        type: "broadcast",
        event: "hello",
        payload: { want: "state", display: true },
      });

      setTimeout(() => {
        ch.send({
          type: "broadcast",
          event: "request_state",
          payload: { display: true },
        });
      }, 500);
    }
  });

  return {
    close: () => {
      supa.removeChannel(ch);
    },
  };
}
