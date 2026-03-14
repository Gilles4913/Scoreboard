import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabase";

type MatchSummary = {
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  points_scored: number;
  points_conceded: number;
  points_diff: number;
  avg_points_scored: number;
  avg_points_conceded: number;
};

type DisciplineSummary = {
  matches_with_cards: number;
  yellow_cards: number;
  red_cards: number;
  avg_yellow_per_match: number;
  avg_red_per_match: number;
};

type PlayerStat = {
  player_id: string;
  player_name: string;
  player_number: string;
  match_selections: number;
  match_starts: number;
  total_points: number;
  total_fouls: number;
  total_yellow_cards: number;
  total_red_cards: number;
};

type TeamRow = { id: string; name: string; slug: string | null };

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#0f172a", color: "#f8fafc", fontFamily: "system-ui, sans-serif", padding: "24px 16px" },
  header: { display: "flex", alignItems: "center", gap: 12, marginBottom: 28 },
  backBtn: { background: "none", border: "1px solid #334155", borderRadius: 8, color: "#94a3b8", cursor: "pointer", padding: "6px 14px", fontSize: 13 },
  title: { fontSize: 22, fontWeight: 700, color: "#f8fafc" },
  subtitle: { fontSize: 14, color: "#64748b", marginTop: 2 },
  grid3: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, marginBottom: 24 },
  card: { background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: 20 },
  cardTitle: { fontSize: 13, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 },
  statRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #1e293b" },
  statLabel: { fontSize: 14, color: "#cbd5e1" },
  statValue: { fontSize: 15, fontWeight: 700, color: "#f8fafc" },
  table: { width: "100%", borderCollapse: "collapse" as const },
  th: { textAlign: "left" as const, padding: "8px 12px", borderBottom: "1px solid #334155", fontSize: 12, color: "#64748b", textTransform: "uppercase" as const, letterSpacing: "0.06em" },
  td: { padding: "8px 12px", borderBottom: "1px solid #1e293b", fontSize: 14, color: "#e2e8f0" },
  notice: { background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: 16, fontSize: 13, color: "#64748b", lineHeight: 1.6 },
  badge: (color: string) => ({ background: color, color: "#fff", borderRadius: 4, padding: "2px 8px", fontSize: 13, fontWeight: 700 }),
};

export default function TeamStatsPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const nav = useNavigate();

  const [team, setTeam] = useState<TeamRow | null>(null);
  const [matchSummary, setMatchSummary] = useState<MatchSummary | null>(null);
  const [discipline, setDiscipline] = useState<DisciplineSummary | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      const [
        { data: teamData },
        { data: matchData },
        { data: discData },
        { data: playerData },
      ] = await Promise.all([
        supabase.from("teams").select("id, name, slug").eq("id", teamId!).maybeSingle(),
        supabase.rpc("get_team_match_summary", { p_team_id: teamId }),
        supabase.rpc("get_team_discipline_summary", { p_team_id: teamId }),
        supabase.rpc("get_team_player_stats", { p_team_id: teamId }),
      ]);

      if (cancelled) return;

      if (teamData) setTeam(teamData as TeamRow);
      if (matchData && Array.isArray(matchData) && matchData.length > 0) setMatchSummary(matchData[0] as MatchSummary);
      if (discData && Array.isArray(discData) && discData.length > 0) setDiscipline(discData[0] as DisciplineSummary);
      if (playerData) setPlayerStats(playerData as PlayerStat[]);

      setLoading(false);
    }

    load().catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [teamId]);

  if (loading) return <div style={styles.page}><div style={{ color: "#64748b" }}>Chargement…</div></div>;
  if (error) return <div style={styles.page}><div style={{ color: "#f87171" }}>Erreur : {error}</div></div>;

  const ms = matchSummary;
  const d = discipline;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => nav(-1)}>← Retour</button>
        <div>
          <div style={styles.title}>Statistiques — {team?.name || teamId}</div>
          <div style={styles.subtitle}>Données calculées sur les matchs terminés uniquement</div>
        </div>
      </div>

      <div style={styles.grid3}>
        <div style={styles.card}>
          <div style={styles.cardTitle}>Bilan équipe</div>
          {ms ? (
            <>
              {[
                { label: "Matchs joués", value: ms.matches_played },
                { label: "Victoires", value: ms.wins },
                { label: "Nuls", value: ms.draws },
                { label: "Défaites", value: ms.losses },
                { label: "Points marqués", value: ms.points_scored },
                { label: "Points encaissés", value: ms.points_conceded },
                { label: "Différence", value: ms.points_diff > 0 ? `+${ms.points_diff}` : ms.points_diff },
                { label: "Moy. marqués / match", value: ms.avg_points_scored },
                { label: "Moy. encaissés / match", value: ms.avg_points_conceded },
              ].map(({ label, value }) => (
                <div key={label} style={styles.statRow}>
                  <span style={styles.statLabel}>{label}</span>
                  <span style={styles.statValue}>{value}</span>
                </div>
              ))}
            </>
          ) : (
            <div style={{ color: "#64748b", fontSize: 13 }}>Aucun match terminé.</div>
          )}
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>Discipline</div>
          {d ? (
            <>
              {[
                { label: "Cartons jaunes", value: d.yellow_cards },
                { label: "Cartons rouges", value: d.red_cards },
                { label: "Matchs avec carton", value: d.matches_with_cards },
                { label: "Moy. jaunes / match", value: d.avg_yellow_per_match },
                { label: "Moy. rouges / match", value: d.avg_red_per_match },
              ].map(({ label, value }) => (
                <div key={label} style={styles.statRow}>
                  <span style={styles.statLabel}>{label}</span>
                  <span style={styles.statValue}>{value}</span>
                </div>
              ))}
            </>
          ) : (
            <div style={{ color: "#64748b", fontSize: 13 }}>Aucun match terminé.</div>
          )}
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>À propos de ces stats</div>
          <div style={styles.notice}>
            Ces statistiques sont calculées à partir des données <strong>réellement présentes</strong> en base de données.
            <br /><br />
            <strong>Fiables et disponibles</strong> : bilan (V/N/D), score, cartons, sélections, titularisations, points et fautes par joueur.
            <br /><br />
            <strong>Non disponibles</strong> : passes, tirs, km parcourus, et toute donnée non saisie dans l'opérateur.
          </div>
        </div>
      </div>

      <div style={{ ...styles.card, marginBottom: 0 }}>
        <div style={styles.cardTitle}>Statistiques joueurs</div>
        {playerStats.length === 0 ? (
          <div style={{ color: "#64748b", fontSize: 13 }}>Aucune donnée joueur disponible.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {["N°", "Joueur", "Sélections", "Titularisat.", "Points", "Fautes", "Jaunes", "Rouges"].map((h) => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {playerStats.map((p) => (
                  <tr key={p.player_id}>
                    <td style={styles.td}>{p.player_number}</td>
                    <td style={styles.td}>{p.player_name}</td>
                    <td style={styles.td}>{p.match_selections}</td>
                    <td style={styles.td}>{p.match_starts}</td>
                    <td style={styles.td}>{p.total_points}</td>
                    <td style={styles.td}>{p.total_fouls}</td>
                    <td style={styles.td}>
                      {p.total_yellow_cards > 0 ? (
                        <span style={styles.badge("#ca8a04")}>{p.total_yellow_cards}</span>
                      ) : "—"}
                    </td>
                    <td style={styles.td}>
                      {p.total_red_cards > 0 ? (
                        <span style={styles.badge("#dc2626")}>{p.total_red_cards}</span>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
