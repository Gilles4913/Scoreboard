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

function normalizeDisplaySettings(settings: any) {
  return {
    theme: settings?.theme ?? "dark",
    layout_mode: settings?.layout_mode ?? "stadium",
    show_score: settings?.show_score ?? true,
    show_clock: settings?.show_clock ?? true,
    show_period: settings?.show_period ?? true,
    show_status: settings?.show_status ?? true,
    show_lower_third: settings?.show_lower_third ?? true,
    show_logos: settings?.show_logos ?? true,
    show_sponsors: settings?.show_sponsors ?? true,
    dual_language: settings?.dual_language ?? true,
    lang_primary: settings?.lang_primary ?? "FR",
    lang_secondary: settings?.lang_secondary ?? "EN",
    sponsor_rotate_s: settings?.sponsor_rotate_s ?? 10,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return json(
        { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
        500,
      );
    }

    const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const url = new URL(req.url);
    const token = url.searchParams.get("token")?.trim() || "";
    const orgSlug = url.searchParams.get("org")?.trim() || "";
    const matchId = url.searchParams.get("matchId")?.trim() || "";

    if (!token && !orgSlug && !matchId) {
      return json({ error: "Missing query param: token or org or matchId" }, 400);
    }

    const matchSelect =
      "id, org_id, name, status, scheduled_at, public_display, display_token, " +
      "home_name, away_name, home_team_id, away_team_id, " +
      "home_score, away_score, is_live, archived_at, created_at, updated_at";

    async function loadOrgAndSettings(orgId: string) {
      const { data: org, error: orgErr } = await supa
        .from("orgs")
        .select("id, slug, name, status, sport")
        .eq("id", orgId)
        .maybeSingle();

      if (orgErr) {
        throw new Error(orgErr.message);
      }

      const { data: displaySettings, error: dsErr } = await supa
        .from("org_display_settings")
        .select(`
          org_id,
          theme,
          layout_mode,
          show_score,
          show_clock,
          show_period,
          show_status,
          show_lower_third,
          show_logos,
          show_sponsors,
          dual_language,
          lang_primary,
          lang_secondary,
          sponsor_rotate_s
        `)
        .eq("org_id", orgId)
        .maybeSingle();

      if (dsErr) {
        throw new Error(dsErr.message);
      }

      return {
        org: org || null,
        display_settings: normalizeDisplaySettings(displaySettings),
      };
    }

    // 1) mode token: match by display_token
    if (token) {
      const { data: match, error } = await supa
        .from("matches")
        .select(matchSelect)
        .eq("display_token", token)
        .maybeSingle();

      if (error) return json({ error: error.message }, 500);
      if (!match) return json({ error: "Match not found for token" }, 404);

      const { org, display_settings } = await loadOrgAndSettings(match.org_id);

      return json({
        match,
        org,
        display_settings,
        channel: match.org_id
          ? `sb2:org:${match.org_id}`
          : `sb2:match:${match.id}`,
      });
    }

    // 2) mode matchId direct
    if (matchId) {
      const { data: match, error } = await supa
        .from("matches")
        .select(matchSelect)
        .eq("id", matchId)
        .maybeSingle();

      if (error) return json({ error: error.message }, 500);
      if (!match) return json({ error: "Match not found" }, 404);

      const { org, display_settings } = await loadOrgAndSettings(match.org_id);

      return json({
        match,
        org,
        display_settings,
        channel: match.org_id
          ? `sb2:org:${match.org_id}`
          : `sb2:match:${match.id}`,
      });
    }

    // 3) mode org slug: find org then live match else fallback scheduled
    const { data: org, error: orgError } = await supa
      .from("orgs")
      .select("id, slug, name, status, sport")
      .eq("slug", orgSlug)
      .maybeSingle();

    if (orgError) return json({ error: orgError.message }, 500);
    if (!org) return json({ error: "Org not found" }, 404);

    const { data: displaySettings, error: dsErr } = await supa
      .from("org_display_settings")
      .select(`
        org_id,
        theme,
        layout_mode,
        show_score,
        show_clock,
        show_period,
        show_status,
        show_lower_third,
        show_logos,
        show_sponsors,
        dual_language,
        lang_primary,
        lang_secondary,
        sponsor_rotate_s
      `)
      .eq("org_id", org.id)
      .maybeSingle();

    if (dsErr) return json({ error: dsErr.message }, 500);

    let { data: match, error: matchErr } = await supa
      .from("matches")
      .select(matchSelect)
      .eq("org_id", org.id)
      .eq("is_live", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (matchErr) return json({ error: matchErr.message }, 500);

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
      display_settings: normalizeDisplaySettings(displaySettings),
      channel: `sb2:org:${org.id}`,
    });
  } catch (e: any) {
    return json({ error: e?.message || "Unknown error" }, 500);
  }
});
