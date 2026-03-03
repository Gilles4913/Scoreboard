import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Json = Record<string, any>;

function deepMerge(base: any, patch: any): any {
  if (!patch) return base;
  const out: any = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === "object" && !Array.isArray(v) && base?.[k] && typeof base[k] === "object") {
      out[k] = deepMerge(base[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const matchId = url.searchParams.get("matchId");
    const token = url.searchParams.get("token");

    if (!matchId || !token) {
      return new Response(JSON.stringify({ error: "matchId and token are required" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: match, error: matchErr } = await supabase
      .from("matches")
      .select(
        "id,name,status,scheduled_at,public_display,home_name,away_name,home_team_id,away_team_id,orgs!inner(id,slug,name,sport,display_defaults)"
      )
      .eq("id", matchId)
      .eq("display_token", token)
      .eq("public_display", true)
      .maybeSingle();

    if (matchErr) throw matchErr;
    if (!match) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

    const org = (match as any).orgs;
    const sport = org.sport as string;
    const orgDefaults = org.display_defaults ?? {};

    const teamIds = [match.home_team_id, match.away_team_id].filter(Boolean) as string[];
    const teamsById: Record<string, Json> = {};

    if (teamIds.length) {
      const { data: teams, error: teamErr } = await supabase
        .from("teams")
        .select("id,org_id,name,short_name,logo,colors,display_overrides")
        .in("id", teamIds);

      if (teamErr) throw teamErr;
      for (const t of teams ?? []) teamsById[(t as any).id] = t as any;
    }

    const homeTeam = match.home_team_id ? teamsById[match.home_team_id] : null;
    const awayTeam = match.away_team_id ? teamsById[match.away_team_id] : null;

    const homeDisplay = deepMerge(orgDefaults, homeTeam?.display_overrides ?? {});
    const awayDisplay = deepMerge(orgDefaults, awayTeam?.display_overrides ?? {});
    if (!homeDisplay[sport] && orgDefaults[sport]) homeDisplay[sport] = orgDefaults[sport];
    if (!awayDisplay[sport] && orgDefaults[sport]) awayDisplay[sport] = orgDefaults[sport];

    const payload = {
      match: {
        id: match.id,
        name: match.name,
        status: match.status,
        scheduled_at: match.scheduled_at,
        public_display: match.public_display,
      },
      org: { id: org.id, slug: org.slug, name: org.name, sport },
      home: { team: homeTeam ?? { name: match.home_name }, display: homeDisplay },
      away: { team: awayTeam ?? { name: match.away_name }, display: awayDisplay },
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});