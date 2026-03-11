import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabase";

const LS_ACTIVE_ORG_ID = "scoreDisplay.activeOrgId";
const LS_ACTIVE_ORG_SLUG = "scoreDisplay.activeOrgSlug";

type OrgRow = {
  id: string;
  slug: string | null;
  name: string;
  sport: string | null;
};

type TeamRow = {
  id: string;
  org_id: string;
  slug: string | null;
  name: string;
  category: string | null;
  code: string | null;
};

type TeamOption = {
  id: string;
  name: string;
  slug: string | null;
  category: string | null;
  code: string | null;
};

type SportSettingsRow = {
  org_id: string;
  sport: string | null;
  period_count: number | null;
  period_duration_s: number | null;
  extra_time_enabled: boolean | null;
  penalties_enabled: boolean | null;
  show_team_fouls: boolean | null;
  show_player_fouls: boolean | null;
  show_timeouts: boolean | null;
  show_bonus: boolean | null;
  show_sets: boolean | null;
  show_cards: boolean | null;
  show_shot_clock: boolean | null;
  max_team_fouls: number | null;
  max_player_fouls: number | null;
  max_timeouts: number | null;
  shot_clock_s: number | null;
};

function normalizeSport(v: string | null | undefined) {
  return ((v || "football") + "").toLowerCase().trim();
}

function defaultClockMsBySport(sport: string, periodDurationS?: number | null) {
  if (typeof periodDurationS === "number" && periodDurationS >= 0) {
    return periodDurationS * 1000;
  }
  const s = normalizeSport(sport);
  if (s === "basket") return 10 * 60 * 1000;
  if (s === "handball") return 30 * 60 * 1000;
  if (s === "rugby") return 40 * 60 * 1000;
  if (s === "volleyball") return 0;
  return 45 * 60 * 1000;
}

function defaultPeriodLabelBySport(sport: string) {
  const s = normalizeSport(sport);
  if (s === "basket") return "Q1";
  if (s === "volleyball") return "Set 1";
  return "1MT";
}

function defaultStatusBySport() {
  return "scheduled";
}

function buildDefaultMatchName(homeName: string, awayName: string) {
  const h = homeName.trim() || "Domicile";
  const a = awayName.trim() || "Extérieur";
  return `${h} vs ${a}`;
}

function toIsoLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function inferDefaultScheduledAt() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  return toIsoLocalInputValue(d);
}

export default function NewMatchPage() {
  const nav = useNavigate();
  const { teamId = "" } = useParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [org, setOrg] = useState<OrgRow | null>(null);
  const [team, setTeam] = useState<TeamRow | null>(null);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [sportSettings, setSportSettings] = useState<SportSettingsRow | null>(null);

  const [scheduledAt, setScheduledAt] = useState(inferDefaultScheduledAt());
  const [name, setName] = useState("");
  const [homeTeamId, setHomeTeamId] = useState(teamId || "");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [homeName, setHomeName] = useState("");
  const [awayName, setAwayName] = useState("");
  const [neutralMatchName, setNeutralMatchName] = useState(false);

  const activeOrgId = useMemo(() => (localStorage.getItem(LS_ACTIVE_ORG_ID) || "").trim(), []);
  const activeOrgSlug = useMemo(() => (localStorage.getItem(LS_ACTIVE_ORG_SLUG) || "").trim(), []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setErr("");

      const orgQuery = supabase.from("orgs").select("id, slug, name, sport");
      const { data: orgRow, error: orgErr } = activeOrgId
        ? await orgQuery.eq("id", activeOrgId).maybeSingle()
        : await orgQuery.eq("slug", activeOrgSlug).maybeSingle();

      if (cancelled) return;

      if (orgErr || !orgRow) {
        setErr(orgErr?.message || "Organisation introuvable.");
        setLoading(false);
        return;
      }

      const currentOrg = orgRow as OrgRow;
      setOrg(currentOrg);

      const [{ data: teamRow, error: teamErr }, { data: teamRows, error: teamsErr }, { data: ssRow, error: ssErr }] =
        await Promise.all([
          supabase
            .from("teams")
            .select("id, org_id, slug, name, category, code")
            .eq("id", teamId)
            .maybeSingle(),
          supabase
            .from("teams")
            .select("id, name, slug, category, code")
            .eq("org_id", currentOrg.id)
            .order("name", { ascending: true }),
          supabase
            .from("org_sport_settings")
            .select(`
              org_id,
              sport,
              period_count,
              period_duration_s,
              extra_time_enabled,
              penalties_enabled,
              show_team_fouls,
              show_player_fouls,
              show_timeouts,
              show_bonus,
              show_sets,
              show_cards,
              show_shot_clock,
              max_team_fouls,
              max_player_fouls,
              max_timeouts,
              shot_clock_s
            `)
            .eq("org_id", currentOrg.id)
            .maybeSingle(),
        ]);

      if (cancelled) return;

      if (teamErr || !teamRow) {
        setErr(teamErr?.message || "Équipe introuvable.");
        setLoading(false);
        return;
      }

      if (teamsErr) {
        setErr(teamsErr.message);
        setLoading(false);
        return;
      }

      if (ssErr) {
        setErr(ssErr.message);
        setLoading(false);
        return;
      }

      const currentTeam = teamRow as TeamRow;
      const teamOptions = (teamRows as TeamOption[]) || [];
      const settings = (ssRow as SportSettingsRow) || null;

      setTeam(currentTeam);
      setTeams(teamOptions);
      setSportSettings(settings);

      const initialHomeName = currentTeam.name || "Domicile";
      setHomeName(initialHomeName);

      const firstOpponent =
        teamOptions.find((t) => t.id !== currentTeam.id) || null;

      if (firstOpponent) {
        setAwayTeamId(firstOpponent.id);
        setAwayName(firstOpponent.name || "Extérieur");
        setName(buildDefaultMatchName(initialHomeName, firstOpponent.name || "Extérieur"));
      } else {
        setAwayName("Extérieur");
        setName(buildDefaultMatchName(initialHomeName, "Extérieur"));
      }

      setLoading(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [activeOrgId, activeOrgSlug, teamId]);

  useEffect(() => {
    if (!neutralMatchName) {
      setName(buildDefaultMatchName(homeName, awayName));
    }
  }, [homeName, awayName, neutralMatchName]);

  const sport = normalizeSport(org?.sport || sportSettings?.sport);

  const opponentOptions = useMemo(
    () => teams.filter((t) => t.id !== homeTeamId),
    [teams, homeTeamId],
  );

  async function createMatch() {
    if (!org || !team) return;

    const trimmedHome = homeName.trim() || team.name || "Domicile";
    const trimmedAway = awayName.trim() || "Extérieur";
    const trimmedName = (neutralMatchName ? name.trim() : buildDefaultMatchName(trimmedHome, trimmedAway)) || buildDefaultMatchName(trimmedHome, trimmedAway);

    if (!scheduledAt.trim()) {
      setErr("La date / heure du match est obligatoire.");
      return;
    }

    if (!trimmedHome || !trimmedAway) {
      setErr("Les noms domicile / extérieur sont obligatoires.");
      return;
    }

    setSaving(true);
    setErr("");

    const insertPayload: Record<string, any> = {
      org_id: org.id,
      team_id: team.id,
      home_team_id: homeTeamId || team.id,
      away_team_id: awayTeamId || null,
      name: trimmedName,
      status: defaultStatusBySport(),
      scheduled_at: new Date(scheduledAt).toISOString(),
      home_name: trimmedHome,
      away_name: trimmedAway,
      home_score: 0,
      away_score: 0,
      period_label: defaultPeriodLabelBySport(sport),
      clock_ms: defaultClockMsBySport(sport, sportSettings?.period_duration_s),
      clock_running: false,

      home_team_fouls: 0,
      away_team_fouls: 0,
      home_timeouts: 0,
      away_timeouts: 0,
      home_bonus: false,
      away_bonus: false,
      shot_clock_s: sportSettings?.shot_clock_s ?? 24,
      home_sets_won: 0,
      away_sets_won: 0,
      home_yellow_cards: 0,
      away_yellow_cards: 0,
      home_red_cards: 0,
      away_red_cards: 0,
      current_period_index: 1,
      is_overtime: false,
      possession_arrow: "home",

      rugby_home_tries: 0,
      rugby_away_tries: 0,
      rugby_home_conversions: 0,
      rugby_away_conversions: 0,
      rugby_home_penalties: 0,
      rugby_away_penalties: 0,
      rugby_home_drop_goals: 0,
      rugby_away_drop_goals: 0,
      rugby_home_yellow_sin_bin: 0,
      rugby_away_yellow_sin_bin: 0,
      rugby_home_sin_bin_active: 0,
      rugby_away_sin_bin_active: 0,
      rugby_extra_time: false,
      rugby_tiebreak_mode: null,

      handball_home_2min: 0,
      handball_away_2min: 0,
      handball_home_2min_active: 0,
      handball_away_2min_active: 0,
      handball_home_team_timeouts: 0,
      handball_away_team_timeouts: 0,
      handball_home_warnings: 0,
      handball_away_warnings: 0,
      handball_home_disqualifications: 0,
      handball_away_disqualifications: 0,
      handball_extra_time: false,
      handball_shootout_mode: null,

      volleyball_home_timeouts: 0,
      volleyball_away_timeouts: 0,
      volleyball_home_set_points: 0,
      volleyball_away_set_points: 0,
      volleyball_home_serving: false,
      volleyball_away_serving: false,
      volleyball_current_set: 1,
      volleyball_is_tiebreak: false,

      football_home_yellow_cards: 0,
      football_away_yellow_cards: 0,
      football_home_red_cards: 0,
      football_away_red_cards: 0,
      football_home_penalty_shootout: 0,
      football_away_penalty_shootout: 0,
      football_extra_time: false,
      football_added_time_first_half: 0,
      football_added_time_second_half: 0,
      football_added_time_extra_1: 0,
      football_added_time_extra_2: 0,
    };

    const { data, error } = await supabase
      .from("matches")
      .insert(insertPayload)
      .select("id")
      .maybeSingle();

    setSaving(false);

    if (error || !data?.id) {
      setErr(error?.message || "Impossible de créer le match.");
      return;
    }

    nav(`/matches/${data.id}/control`);
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.centerBox}>Chargement…</div>
      </div>
    );
  }

  if (err && !org) {
    return (
      <div style={styles.page}>
        <div style={styles.errorBox}>{err}</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.topbar}>
          <div>
            <div style={styles.title}>Préparer un match</div>
            <div style={styles.subtitle}>
              {org?.name || "Organisation"} {team?.name ? `• ${team.name}` : ""} {sport ? `• ${sport}` : ""}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => nav(team?.id ? `/teams/${team.id}/matches` : "/teams")}
              style={styles.ghostBtn}
            >
              Retour
            </button>
          </div>
        </div>

        {err ? <div style={styles.inlineError}>{err}</div> : null}

        <div style={styles.panel}>
          <div style={styles.sectionTitle}>Configuration initiale</div>

          <div style={styles.formGrid}>
            <Field label="Date / heure">
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                style={styles.input}
              />
            </Field>

            <Field label="Équipe support">
              <input
                readOnly
                value={team?.name || ""}
                style={{ ...styles.input, opacity: 0.82 }}
              />
            </Field>

            <Field label="Équipe domicile">
              <select
                value={homeTeamId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  const nextTeam = teams.find((t) => t.id === nextId) || null;
                  setHomeTeamId(nextId);
                  setHomeName(nextTeam?.name || "Domicile");

                  if (awayTeamId === nextId) {
                    const replacement = teams.find((t) => t.id !== nextId) || null;
                    setAwayTeamId(replacement?.id || "");
                    setAwayName(replacement?.name || "Extérieur");
                  }
                }}
                style={styles.input}
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Équipe extérieure">
              <select
                value={awayTeamId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  const nextTeam = teams.find((t) => t.id === nextId) || null;
                  setAwayTeamId(nextId);
                  setAwayName(nextTeam?.name || "Extérieur");
                }}
                style={styles.input}
              >
                <option value="">Équipe extérieure libre</option>
                {opponentOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Nom affiché domicile">
              <input
                value={homeName}
                onChange={(e) => setHomeName(e.target.value)}
                style={styles.input}
              />
            </Field>

            <Field label="Nom affiché extérieur">
              <input
                value={awayName}
                onChange={(e) => setAwayName(e.target.value)}
                style={styles.input}
              />
            </Field>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={styles.switchRow}>
                <input
                  type="checkbox"
                  checked={neutralMatchName}
                  onChange={(e) => setNeutralMatchName(e.target.checked)}
                />
                <span>Nom de match personnalisé</span>
              </label>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="Nom du match">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    ...styles.input,
                    opacity: neutralMatchName ? 1 : 0.78,
                  }}
                  readOnly={!neutralMatchName}
                />
              </Field>
            </div>
          </div>
        </div>

        <div style={styles.grid}>
          <section style={styles.panel}>
            <div style={styles.sectionTitle}>Initialisation live</div>

            <div style={styles.infoList}>
              <InfoLine label="Statut initial" value="scheduled" />
              <InfoLine label="Période initiale" value={defaultPeriodLabelBySport(sport)} />
              <InfoLine
                label="Horloge initiale"
                value={`${Math.floor(defaultClockMsBySport(sport, sportSettings?.period_duration_s) / 60000)} min`}
              />
              <InfoLine
                label="Shot clock initial"
                value={String(sportSettings?.shot_clock_s ?? 24)}
              />
            </div>
          </section>

          <section style={styles.panel}>
            <div style={styles.sectionTitle}>Mode public</div>

            <div style={styles.helpText}>
              Le mode public par token a été supprimé. Le futur écran public de ce match passera par l’URL stable de l’équipe support.
            </div>

            <div style={styles.publicBox}>
              <div style={styles.publicLabel}>Équipe support</div>
              <div style={styles.publicValue}>
                {team?.name || "—"} {team?.slug ? `• slug: ${team.slug}` : "• pas de slug"}
              </div>
            </div>
          </section>
        </div>

        <div style={styles.bottomBar}>
          <button
            onClick={() => nav(team?.id ? `/teams/${team.id}/matches` : "/teams")}
            style={styles.ghostBtn}
            disabled={saving}
          >
            Annuler
          </button>

          <button
            onClick={createMatch}
            style={styles.primaryBtn}
            disabled={saving}
          >
            {saving ? "Création…" : "Créer le match"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 13, opacity: 0.78, marginBottom: 6 }}>{label}</div>
      {children}
    </label>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.infoLine}>
      <span style={styles.infoLineLabel}>{label}</span>
      <span style={styles.infoLineValue}>{value}</span>
    </div>
  );
}

const styles: Record<string, any> = {
  page: {
    minHeight: "100vh",
    background: "#0b0f14",
    color: "#e7eefc",
    padding: 24,
    fontFamily:
      "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
  },
  container: { maxWidth: 1080, margin: "0 auto" },
  topbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 18,
  },
  title: { fontSize: 30, fontWeight: 900 },
  subtitle: { marginTop: 4, fontSize: 13, opacity: 0.72 },
  centerBox: {
    maxWidth: 560,
    margin: "60px auto",
    padding: 18,
    borderRadius: 16,
    background: "rgba(255,255,255,.05)",
    border: "1px solid rgba(255,255,255,.08)",
    textAlign: "center",
  },
  errorBox: {
    maxWidth: 620,
    margin: "60px auto",
    padding: 18,
    borderRadius: 16,
    background: "rgba(220,38,38,.10)",
    border: "1px solid rgba(220,38,38,.28)",
  },
  inlineError: {
    marginBottom: 14,
    padding: 14,
    borderRadius: 14,
    background: "rgba(220,38,38,.10)",
    border: "1px solid rgba(220,38,38,.28)",
    color: "#fecaca",
    fontWeight: 700,
  },
  panel: {
    padding: 16,
    borderRadius: 18,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.08)",
    marginBottom: 18,
  },
  sectionTitle: { fontSize: 18, fontWeight: 900, marginBottom: 14 },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  input: {
    width: "100%",
    background: "rgba(255,255,255,.05)",
    color: "#e7eefc",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 12,
    padding: "12px 14px",
    outline: "none",
    boxSizing: "border-box",
  },
  switchRow: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    marginTop: 4,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 18,
    marginTop: 4,
  },
  infoList: { display: "grid", gap: 10 },
  infoLine: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.08)",
  },
  infoLineLabel: { opacity: 0.72 },
  infoLineValue: { fontWeight: 800 },
  helpText: { lineHeight: 1.6, opacity: 0.9 },
  publicBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.08)",
  },
  publicLabel: { fontSize: 13, opacity: 0.72, marginBottom: 8 },
  publicValue: { fontWeight: 800 },
  bottomBar: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 20,
    flexWrap: "wrap",
  },
  primaryBtn: {
    background: "#2563eb",
    color: "white",
    border: "1px solid rgba(255,255,255,.10)",
    borderRadius: 12,
    padding: "12px 16px",
    fontWeight: 800,
    cursor: "pointer",
  },
  ghostBtn: {
    background: "transparent",
    color: "#e7eefc",
    border: "1px solid rgba(255,255,255,.14)",
    borderRadius: 12,
    padding: "12px 16px",
    fontWeight: 700,
    cursor: "pointer",
  },
};
