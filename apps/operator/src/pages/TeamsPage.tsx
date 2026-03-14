import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

const LS_ACTIVE_ORG_ID = "scoreDisplay.activeOrgId";
const LS_ACTIVE_ORG_SLUG = "scoreDisplay.activeOrgSlug";

type OrgRow = {
  id: string;
  slug: string;
  name: string;
  status: string | null;
  sport: string | null;
};

type TeamRow = {
  id: string;
  org_id: string;
  name: string;
};

type MatchRow = {
  id: string;
  team_id: string | null;
  status: string | null;
  scheduled_at: string | null;
};

function getEnv(name: string): string {
  const v = (import.meta as any).env?.[name];
  return typeof v === "string" ? v : "";
}

const HOME_URL = getEnv("VITE_HOME_URL") || "https://scoreboard-home.vercel.app";

function fmtDate(input: string | null) {
  if (!input) return "Date non définie";
  try {
    return new Date(input).toLocaleString();
  } catch {
    return input;
  }
}

function normalizeStatus(status: string | null | undefined) {
  return ((status || "scheduled") + "").toLowerCase();
}

function badgeForStatus(status: string | null | undefined) {
  const s = normalizeStatus(status);
  if (s === "live") return { label: "En cours", color: "#dc2626", bg: "rgba(220,38,38,.12)" };
  if (s === "scheduled") return { label: "À venir", color: "#2563eb", bg: "rgba(37,99,235,.12)" };
  if (s === "finished") return { label: "Terminé", color: "#16a34a", bg: "rgba(22,163,74,.12)" };
  return { label: s || "—", color: "#94a3b8", bg: "rgba(148,163,184,.12)" };
}

export default function TeamsPage() {
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<OrgRow | null>(null);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [err, setErr] = useState("");

  const activeOrgId = useMemo(() => (localStorage.getItem(LS_ACTIVE_ORG_ID) || "").trim(), []);
  const activeOrgSlug = useMemo(() => (localStorage.getItem(LS_ACTIVE_ORG_SLUG) || "").trim(), []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setErr("");

      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session?.user) {
        setErr("Session absente. Reviens sur Home.");
        setLoading(false);
        return;
      }

      const orgQuery = supabase.from("orgs").select("id, slug, name, status, sport");
      const { data: orgRow, error: orgErr } = activeOrgId
        ? await orgQuery.eq("id", activeOrgId).maybeSingle()
        : await orgQuery.eq("slug", activeOrgSlug).maybeSingle();

      if (cancelled) return;

      if (orgErr || !orgRow) {
        setErr(orgErr?.message || "Organisation introuvable.");
        setLoading(false);
        return;
      }

      setOrg(orgRow as OrgRow);

      const [{ data: teamsData, error: teamsErr }, { data: matchesData, error: matchesErr }] = await Promise.all([
        supabase.from("teams").select("id, org_id, name").eq("org_id", (orgRow as OrgRow).id).order("name"),
        supabase.from("matches").select("id, team_id, status, scheduled_at").eq("org_id", (orgRow as OrgRow).id).order("scheduled_at", { ascending: true, nullsFirst: true }),
      ]);

      if (cancelled) return;

      if (teamsErr) {
        setErr(teamsErr.message);
      } else {
        setTeams((teamsData as TeamRow[]) || []);
      }

      if (matchesErr) {
        setErr(matchesErr.message);
      } else {
        setMatches((matchesData as MatchRow[]) || []);
      }

      setLoading(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [activeOrgId, activeOrgSlug]);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = `${HOME_URL.replace(/\/$/, "")}/?forceLogin=1`;
  }

  const enrichedTeams = useMemo(() => {
    return teams.map((team) => {
      const teamMatches = matches.filter((m) => m.team_id === team.id);
      const live = teamMatches.find((m) => normalizeStatus(m.status) === "live") || null;
      const upcoming = teamMatches.find((m) => normalizeStatus(m.status) === "scheduled") || null;
      const finishedCount = teamMatches.filter((m) => normalizeStatus(m.status) === "finished").length;

      return {
        ...team,
        live,
        upcoming,
        matchesCount: teamMatches.length,
        finishedCount,
      };
    });
  }, [teams, matches]);

  if (loading) {
    return <div style={styles.page}><div style={styles.centerBox}>Chargement des équipes…</div></div>;
  }

  if (err) {
    return (
      <div style={styles.page}>
        <div style={styles.errorBox}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Erreur</div>
          <div style={{ marginTop: 8 }}>{err}</div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={() => (window.location.href = HOME_URL)} style={styles.primaryBtn}>Retour Home</button>
          </div>
        </div>
      </div>
    );
  }

  if (!org) {
    return (
      <div style={styles.page}>
        <div style={styles.centerBox}>Organisation introuvable.</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.topbar}>
          <div>
            <div style={styles.title}>{org.name}</div>
            <div style={styles.subtitle}>Sport principal : <b>{org.sport || "football"}</b></div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => {
                localStorage.removeItem(LS_ACTIVE_ORG_ID);
                localStorage.removeItem(LS_ACTIVE_ORG_SLUG);
                window.location.href = HOME_URL;
              }}
              style={styles.ghostBtn}
            >
              Changer d'organisation
            </button>
            <button onClick={() => nav("/display-settings")} style={styles.ghostBtn}>Paramètres Display</button>
            <button onClick={logout} style={styles.ghostBtn}>Déconnexion</button>
          </div>
        </div>

        <div style={styles.hero}>
          <div>
            <div style={styles.heroTitle}>Pilotage club</div>
            <div style={styles.heroText}>
              Cette page représente l’organisation sportive. Chaque carte correspond à une équipe. Tu peux ensuite ouvrir ses matchs puis la régie live du match choisi.
            </div>
          </div>

          <div style={styles.kpiGrid}>
            <div style={styles.kpiCard}>
              <div style={styles.kpiLabel}>Équipes</div>
              <div style={styles.kpiValue}>{teams.length}</div>
            </div>
            <div style={styles.kpiCard}>
              <div style={styles.kpiLabel}>Matchs liés</div>
              <div style={styles.kpiValue}>{matches.length}</div>
            </div>
            <div style={styles.kpiCard}>
              <div style={styles.kpiLabel}>Non affectés</div>
              <div style={styles.kpiValue}>{matches.filter((m) => !m.team_id).length}</div>
            </div>
          </div>
        </div>

        <div style={styles.noticeCard}>
          <div style={styles.noticeTitle}>Notice</div>
          <div style={styles.noticeText}>
            1. Choisis une équipe.<br />
            2. Ouvre sa liste de matchs.<br />
            3. Lance la régie live sur le match à piloter.<br />
            4. Ajuste ensuite l’écran public dans Paramètres Display.
          </div>
        </div>

        <div style={styles.grid}>
          {enrichedTeams.map((team) => {
            const statusRef = team.live?.status || team.upcoming?.status || null;
            const badge = badgeForStatus(statusRef);

            return (
              <div key={team.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <div style={styles.cardTitle}>{team.name}</div>
                    <div style={styles.cardMeta}>Équipe</div>
                  </div>

                  <span style={{ ...styles.badge, color: badge.color, background: badge.bg, borderColor: `${badge.color}33` }}>
                    {badge.label}
                  </span>
                </div>

                <div style={styles.statsRow}>
                  <div style={styles.statBox}>
                    <div style={styles.statLabel}>Matchs</div>
                    <div style={styles.statValue}>{team.matchesCount}</div>
                  </div>
                  <div style={styles.statBox}>
                    <div style={styles.statLabel}>Terminés</div>
                    <div style={styles.statValue}>{team.finishedCount}</div>
                  </div>
                </div>

                <div style={{ marginTop: 14, fontSize: 14, lineHeight: 1.6, opacity: 0.86 }}>
                  <div><b>En cours :</b> {team.live ? fmtDate(team.live.scheduled_at) : "Aucun"}</div>
                  <div><b>Prochain match :</b> {team.upcoming ? fmtDate(team.upcoming.scheduled_at) : "Aucun"}</div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
                  <button onClick={() => nav(`/teams/${team.id}/matches`)} style={styles.primaryBtn}>Voir les matchs</button>
                  {team.live ? (
                    <button onClick={() => nav(`/matches/${team.live.id}/control`)} style={styles.ghostBtn}>Régie live</button>
                  ) : team.upcoming ? (
                    <button onClick={() => nav(`/matches/${team.upcoming.id}/control`)} style={styles.ghostBtn}>Préparer le prochain</button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {teams.length === 0 ? (
          <div style={styles.emptyCard}>
            Aucune équipe trouvée dans cette organisation.
          </div>
        ) : null}
      </div>
    </div>
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
  container: { maxWidth: 1280, margin: "0 auto" },
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
    gridTemplateColumns: "1.2fr .9fr",
    gap: 16,
    padding: 18,
    borderRadius: 18,
    background: "linear-gradient(180deg, rgba(37,99,235,.10), rgba(255,255,255,.03))",
    border: "1px solid rgba(255,255,255,.08)",
  },
  heroTitle: { fontSize: 22, fontWeight: 900 },
  heroText: { marginTop: 8, lineHeight: 1.6, opacity: 0.9 },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 },
  kpiCard: {
    padding: 16,
    borderRadius: 16,
    background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(255,255,255,.08)",
  },
  kpiLabel: { fontSize: 13, opacity: 0.74 },
  kpiValue: { fontSize: 28, fontWeight: 900, marginTop: 6 },
  noticeCard: {
    marginTop: 14,
    padding: 16,
    borderRadius: 16,
    background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(255,255,255,.08)",
  },
  noticeTitle: { fontWeight: 900, fontSize: 16, marginBottom: 8 },
  noticeText: { fontSize: 14, lineHeight: 1.7, opacity: 0.9 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 18,
    marginTop: 22,
  },
  card: {
    padding: 18,
    borderRadius: 18,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.08)",
  },
  cardHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  cardTitle: { fontSize: 20, fontWeight: 900 },
  cardMeta: { marginTop: 4, fontSize: 13, opacity: 0.7 },
  badge: {
    border: "1px solid transparent",
    borderRadius: 999,
    padding: "7px 12px",
    fontSize: 13,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  statsRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 },
  statBox: {
    padding: 12,
    borderRadius: 14,
    background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(255,255,255,.08)",
  },
  statLabel: { fontSize: 12, opacity: 0.72 },
  statValue: { marginTop: 4, fontWeight: 900, fontSize: 22 },
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
  emptyCard: {
    marginTop: 18,
    padding: 16,
    borderRadius: 16,
    background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(255,255,255,.08)",
  },
};
