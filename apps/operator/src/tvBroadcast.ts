import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const TV_URL = import.meta.env.VITE_TV_BROADCAST_URL;

export async function tvEmit(matchId, type, payload) {

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  await fetch(TV_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      match_id: matchId,
      type,
      payload,
      ts: Date.now(),
    }),
  });
}
