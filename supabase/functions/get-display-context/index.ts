import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  try {

    const url = new URL(req.url);

    const token = url.searchParams.get("token");
    const orgSlug = url.searchParams.get("org");

    if (!token && !orgSlug) {
      return new Response(
        JSON.stringify({ error: "token or org required" }),
        { status: 400 }
      );
    }

    let match;

    // -------------------------
    // MODE MATCH TOKEN
    // -------------------------

    if (token) {

      const { data, error } = await supabase
        .from("matches")
        .select(`
          id,
          name,
          status,
          home_name,
          away_name,
          home_score,
          away_score,
          org_id,
          display_token,
          public_display
        `)
        .eq("display_token", token)
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: "match not found" }),
          { status: 404 }
        );
      }

      if (!data.public_display) {
        return new Response(
          JSON.stringify({ error: "display disabled" }),
          { status: 403 }
        );
      }

      match = data;
    }

    // -------------------------
    // MODE ORG
    // -------------------------

    if (orgSlug) {

      const { data: org } = await supabase
        .from("orgs")
        .select("id")
        .eq("slug", orgSlug)
        .single();

      if (!org) {
        return new Response(
          JSON.stringify({ error: "org not found" }),
          { status: 404 }
        );
      }

      const { data } = await supabase
        .from("matches")
        .select(`
          id,
          name,
          status,
          home_name,
          away_name,
          home_score,
          away_score,
          display_token
        `)
        .eq("org_id", org.id)
        .eq("is_live", true)
        .single();

      match = data;
    }

    if (!match) {
      return new Response(
        JSON.stringify({ error: "no active match" }),
        { status: 404 }
      );
    }

    return new Response(
      JSON.stringify({
        match,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store"
        }
      }
    );

  } catch (e) {

    return new Response(
      JSON.stringify({
        error: "internal error",
        detail: String(e)
      }),
      { status: 500 }
    );

  }
});
