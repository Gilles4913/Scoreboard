// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);
    }

    const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const url = new URL(req.url);
    const token = url.searchParams.get("token")?.trim() || "";
    const orgSlug = url.searchParams.get("org")?.trim() || "";

    if (!token && !orgSlug) {
      return json({ error: "Missing query param: token or org" }, 400);
    }

    // Helper: select safe match fields (adapte si tu ajoutes/retire des colonnes)
    const matchSelect =
      "id, org_id, name, status, scheduled_at, public_display, display_token, " +
      "home_name, away_name, home_team_id, away_team_id, " +
      "home_score, away_score, is_live, archived_at, created_at, updated_at";

    // 1) mode token: match by display_token
    if (token) {
      const { data: match, error } = await supa
        .from("matches")
        .select(matchSelect)
        .eq("display_token", token)
        .maybeSingle();

      if (error) return json({ error: error.message }, 500);
      if (!match) return json({ error: "Match not found for token" }, 404);

      // Option: si tu veux refuser un match non public_display, active ça:
      // if (!match.public_display) return json({ error: "Match not public" }, 403);

      const { data: org, error: orgErr } = await supa
        .from("orgs")
        .select("id, slug, is_master, sport, display_settings")
        .eq("id", match.org_id)
        .maybeSingle();

      if (orgErr) return json({ error: orgErr.message }, 500);

      return json({
        match,
        org: org || null,
        channel: match.org_id ? `sb2:org:${match.org_id}` : `sb2:match:${match.id}`,
      });
    }

    // 2) mode org slug: find org then live match else fallback scheduled
    const { data: org, error: orgError } = await supa
      .from("orgs")
      .select("id, slug, is_master, sport, display_settings")
      .eq("slug", orgSlug)
      .maybeSingle();

    if (orgError) return json({ error: orgError.message }, 500);
    if (!org) return json({ error: "Org not found" }, 404);

    // Try live match first
    let { data: match, error: matchErr } = await supa
      .from("matches")
      .select(matchSelect)
      .eq("org_id", org.id)
      .eq("is_live", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (matchErr) return json({ error: matchErr.message }, 500);

    // fallback: latest scheduled (future)
    if (!match) {
      const r = await supa
        .from("matches")
        .select(matchSelect)
        .eq("org_id", org.id)
        .eq("status", "scheduled")
        .order("scheduled_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      match = r.data as any;
      matchErr = r.error as any;
      if (matchErr) return json({ error: matchErr.message }, 500);
    }

    if (!match) return json({ error: "No match for org" }, 404);

    return json({
      match,
      org,
      channel: `sb2:org:${org.id}`,
    });
  } catch (e: any) {
    return json({ error: e?.message || "Unknown error" }, 500);
  }
});
