import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabase";

const LS_ACTIVE_ORG_ID = "scoreDisplay.activeOrgId";
const LS_ACTIVE_ORG_SLUG = "scoreDisplay.activeOrgSlug";

type OrgRow = {
  id: string;
  slug: string;
  name: string;
  sport: string | null;
};

type TeamRow = {
  id: string;
  org_id: string;
  name: string;
  category: string | null;
  code: string | null;
};

type SportSettingsRow = {
  org_id: string;
  sport: string;
  period_count: number;
  period_duration_s: number;
};

function normalizeSport(v: string | null | undefined) {
  return ((v || "football") + "").toLowerCase().trim();
}

function defaultDisplayToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function defaultPeriodLabel(sport: string, periodCount?: number) {
  const s = normalizeSport(sport);
  if (s === "basket") return "Q1";
  if (s === "volleyball") return "Set 1";
  if (periodCount && periodCount > 2) return "P1";
  return "1MT";
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

function toLocalDatetimeInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export default function NewMatchPage() {
  const nav = useNavigate();
  const { teamId = "" } = useParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  const [org, setOrg] = useState<OrgRow | null>(null);
  const [team, setTeam] = useState<TeamRow | null>(null);
  const [sportSettings, setSportSettings] = useState<SportSettingsRow | null>(null);

  const [matchName, setMatchName] = useState("");
  const [homeName, setHomeName] = useState("");
  const [awayName, setAwayName] = useState("");
  const [scheduledAt, setScheduledAt] = useState(toLocalDatetimeInputValue(new Date(Date.now() + 86400000)));
  const [publicDisplay, setPublicDisplay] = useState(true);
  const [displayToken, setDisplayToken] = useState(defaultDisplayToken());

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

      const [{ data: teamRow, error: teamErr }, { data: sportRow, error: sportErr }] = await Promise.all([
        supabase.from("teams").select("id, org_id, name, category, code").eq("id", teamId).maybeSingle(),
        supabase
          .from("org_sport_settings")
          .select("org_id, sport, period_count, period_duration_s")
          .eq("org_id", currentOrg.id)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      if (teamErr || !teamRow) {
        setErr(teamErr?.message || "Équipe introuvable.");
        setLoading(false);
        return;
      }

      if (sportErr) {
        setErr(sportErr.message);
        setLoading(false);
        return;
      }

      const currentTeam = teamRow as TeamRow;
      const currentSportSettings = (sportRow as SportSettingsRow | null) || null;

      setTeam(currentTeam);
      setSportSettings(currentSportSettings);

      const defaultHome = currentOrg.name || "Équipe domicile";
      const defaultAway = "Adversaire";
      setHomeName(defaultHome);
      setAwayName(defaultAway);
      setMatchName(`${currentTeam.name} vs ${defaultAway}`);

      setLoading(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [activeOrgId, activeOrgSlug, teamId]);

  function flash(message: string) {
    setInfo(message);
    window.setTimeout(() => setInfo(""), 2400);
  }

  async function createMatch() {
    if (!org || !team) return;

    setSaving(true);

    const sport = normalizeSport(org.sport);
    const periodLabel = defaultPeriodLabel(sport, sportSettings?.period_count);
    const clockMs = defaultClockMsBySport(sport, sportSettings?.period_duration_s);

    const payload: Record<string, any> = {
      org_id: org.id,
      team_id: team.id,
      name: matchName.trim() || `${team.name} vs ${awayName.trim() || "Adversaire"}`,
      status: "scheduled",
      scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      home_name: homeName.trim() || org.name || "Équipe domicile",
      away_name: awayName.trim() || "Adversaire",
      home_score: 0,
      away_score: 0,
      public_display: publicDisplay,
      display_token: displayToken.trim() || defaultDisplayToken(),
      is_live: false,
    };

    const { data, error } = await supabase
      .from("matches")
      .insert(payload)
      .select("id")
      .maybeSingle();

    setSaving(false);

    if (error || !data?.id) {
      flash(error?.message || "Impossible de créer le match.");
      return;
    }

    flash("Match préparé avec succès.");
    nav(`/matches/${data.id}/control`, { replace: true });
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.centerBox}>Chargement de la préparation match…</div>
      </div>
    );
  }

  if (err || !org || !team) {
    return (
      <div style={styles.page}>
        <div style={styles.errorBox}>{err || "Contexte introuvable."}</div>
      </div>
    );
  }

  const sport = normalizeSport(org.sport);

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.topbar}>
          <div>
            <div style={styles.title}>Préparer un match</div>
            <div style={styles.subtitle}>
              {org.name} • {team.name} • sport : <b>{sport}</b>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => nav(`/teams/${team.id}/matches`)} style={styles.ghostBtn}>
              Retour matchs
            </button>
            <button onClick={() => nav("/display-settings")} style={styles.ghostBtn}>
              Paramètres Display
            </button>
          </div>
        </div>

        {info ? <div style={styles.infoBox}>{info}</div> : null}

        <div style={styles.hero}>
          <div>
            <div style={styles.heroTitle}>Nouveau match</div>
            <div style={styles.heroText}>
              Prépare une nouvelle rencontre pour cette équipe. Une fois créée, tu seras redirigé directement vers la régie live du match.
            </div>
          </div>

          <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>Équipe</div>
            <div style={styles.kpiValue}>{team.name}</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.74 }}>
              {team.category || "Catégorie libre"} {team.code ? `• ${team.code}` : ""}
            </div>
          </div>
        </div>

        <div style={styles.panel}>
          <div style={styles.sectionTitle}>Informations du match</div>

          <div style={styles.formGrid}>
            <Field label="Nom du match">
              <input value={matchName} onChange={(e) => setMatchName(e.target.value)} style={styles.input} />
            </Field>

            <Field label="Date / heure">
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                style={styles.input}
              />
            </Field>

            <Field label="Équipe domicile">
              <input value={homeName} onChange={(e) => setHomeName(e.target.value)} style={styles.input} />
            </Field>

            <Field label="Équipe extérieure">
              <input value={awayName} onChange={(e) => setAwayName(e.target.value)} style={styles.input} />
            </Field>

            <Field label="Display public">
              <select
                value={publicDisplay ? "yes" : "no"}
                onChange={(e) => setPublicDisplay(e.target.value === "yes")}
                style={styles.input}
              >
                <option value="yes">Oui</option>
                <option value="no">Non</option>
              </select>
            </Field>

            <Field label="Token display">
              <input value={displayToken} onChange={(e) => setDisplayToken(e.target.value)} style={styles.input} />
            </Field>
          </div>

          <div style={styles.noticeCard}>
            <div style={styles.noticeTitle}>Préconfiguration</div>
            <div style={styles.noticeText}>
              Le match sera créé avec :
              <br />
              • score à 0 - 0
              <br />
              • statut “À préparer”
              <br />
              • sport hérité de l’organisation
              <br />
              • paramètres d’affichage et sport déjà disponibles dans la régie
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
            <button onClick={createMatch} style={styles.primaryBtn} disabled={saving}>
              {saving ? "Création..." : "Créer et ouvrir la régie"}
            </button>
            <button onClick={() => nav(`/teams/${team.id}/matches`)} style={styles.ghostBtn}>
              Annuler
            </button>
          </div>
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

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#0b0f14",
    color: "#e7eefc",
    padding: 24,
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
  },
  container: { maxWidth: 1100, margin: "0 auto" },
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
  infoBox: {
    marginBottom: 14,
    padding: 12,
    borderRadius: 12,
    background: "rgba(37,99,235,.12)",
    border: "1px solid rgba(37,99,235,.28)",
    color: "#dbeafe",
  },
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
  hero: {
    display: "grid",
    gridTemplateColumns: "1.2fr .8fr",
    gap: 16,
    padding: 18,
    borderRadius: 18,
    background: "linear-gradient(180deg, rgba(37,99,235,.10), rgba(255,255,255,.03))",
    border: "1px solid rgba(255,255,255,.08)",
    marginBottom: 18,
  },
  heroTitle: { fontSize: 22, fontWeight: 900 },
  heroText: { marginTop: 8, lineHeight: 1.6, opacity: 0.9 },
  kpiCard: {
    padding: 16,
    borderRadius: 16,
    background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(255,255,255,.08)",
  },
  kpiLabel: { fontSize: 13, opacity: 0.74 },
  kpiValue: { fontSize: 28, fontWeight: 900, marginTop: 6 },
  panel: {
    padding: 16,
    borderRadius: 18,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.08)",
  },
  sectionTitle: { fontSize: 18, fontWeight: 900, marginBottom: 14 },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
  },
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
  noticeCard: {
    marginTop: 18,
    padding: 16,
    borderRadius: 16,
    background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(255,255,255,.08)",
  },
  noticeTitle: { fontWeight: 900, fontSize: 16, marginBottom: 8 },
  noticeText: { fontSize: 14, lineHeight: 1.7, opacity: 0.9 },
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
