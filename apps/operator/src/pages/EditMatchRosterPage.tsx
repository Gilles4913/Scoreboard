import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabase";

type MatchRow = {
  id: string;
  org_id: string;
  team_id: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  name: string | null;
  status: string | null;
  scheduled_at: string | null;
  home_name: string | null;
  away_name: string | null;
};

type TeamRow = {
  id: string;
  name: string;
  category: string | null;
  code: string | null;
};

type PlayerRow = {
  id: string;
  org_id: string;
  team_id: string;
  number: string;
  name: string;
  position: string | null;
  is_active: boolean;
};

type MatchPlayerRow = {
  id: string;
  org_id: string;
  match_id: string;
  team_id: string;
  player_id: string;
  shirt_number: string | null;
  is_starter: boolean;
  is_selected: boolean;
  fouls: number;
  points: number;
  yellow_cards: number;
  red_cards: number;
};

type SelectedPlayer = {
  player_id: string;
  shirt_number: string;
  is_selected: boolean;
  is_starter: boolean;
};

function buildSelection(players: PlayerRow[], existing: MatchPlayerRow[]) {
  const existingMap = new Map(existing.map((p) => [p.player_id, p]));
  const out: Record<string, SelectedPlayer> = {};

  players.forEach((p) => {
    const current = existingMap.get(p.id);
    out[p.id] = {
      player_id: p.id,
      shirt_number: current?.shirt_number || p.number,
      is_selected: current?.is_selected ?? false,
      is_starter: current?.is_starter ?? false,
    };
  });

  return out;
}

export default function EditMatchRosterPage() {
  const nav = useNavigate();
  const { matchId = "" } = useParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  const [match, setMatch] = useState<MatchRow | null>(null);
  const [homeTeam, setHomeTeam] = useState<TeamRow | null>(null);
  const [awayTeam, setAwayTeam] = useState<TeamRow | null>(null);

  const [homePlayers, setHomePlayers] = useState<PlayerRow[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<PlayerRow[]>([]);

  const [homeSelection, setHomeSelection] = useState<Record<string, SelectedPlayer>>({});
  const [awaySelection, setAwaySelection] = useState<Record<string, SelectedPlayer>>({});

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setErr("");

      const { data: matchRow, error: matchErr } = await supabase
        .from("matches")
        .select("id, org_id, team_id, home_team_id, away_team_id, name, status, scheduled_at, home_name, away_name")
        .eq("id", matchId)
        .maybeSingle();

      if (cancelled) return;

      if (matchErr || !matchRow) {
        setErr(matchErr?.message || "Match introuvable.");
        setLoading(false);
        return;
      }

      const currentMatch = matchRow as MatchRow;
      setMatch(currentMatch);

      const homeTeamId = currentMatch.home_team_id || currentMatch.team_id || null;
      const awayTeamId = currentMatch.away_team_id || null;

      const teamQueries: Promise<any>[] = [
        homeTeamId
          ? supabase.from("teams").select("id, name, category, code").eq("id", homeTeamId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        awayTeamId
          ? supabase.from("teams").select("id, name, category, code").eq("id", awayTeamId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        homeTeamId
          ? supabase
              .from("players")
              .select("id, org_id, team_id, number, name, position, is_active")
              .eq("team_id", homeTeamId)
              .eq("is_active", true)
              .order("number", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        awayTeamId
          ? supabase
              .from("players")
              .select("id, org_id, team_id, number, name, position, is_active")
              .eq("team_id", awayTeamId)
              .eq("is_active", true)
              .order("number", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("match_players")
          .select("id, org_id, match_id, team_id, player_id, shirt_number, is_starter, is_selected, fouls, points, yellow_cards, red_cards")
          .eq("match_id", currentMatch.id),
      ];

      const [
        homeTeamRes,
        awayTeamRes,
        homePlayersRes,
        awayPlayersRes,
        matchPlayersRes,
      ] = await Promise.all(teamQueries);

      if (cancelled) return;

      if (homeTeamRes.error || homePlayersRes.error || awayPlayersRes.error || matchPlayersRes.error) {
        setErr(
          homeTeamRes.error?.message ||
            homePlayersRes.error?.message ||
            awayPlayersRes.error?.message ||
            matchPlayersRes.error?.message ||
            "Erreur chargement feuille de match.",
        );
        setLoading(false);
        return;
      }

      const homeTeamData = (homeTeamRes.data as TeamRow | null) || null;
      const awayTeamData = (awayTeamRes.data as TeamRow | null) || null;
      const homePlayersData = (homePlayersRes.data as PlayerRow[]) || [];
      const awayPlayersData = (awayPlayersRes.data as PlayerRow[]) || [];
      const matchPlayersData = (matchPlayersRes.data as MatchPlayerRow[]) || [];

      setHomeTeam(homeTeamData);
      setAwayTeam(awayTeamData);
      setHomePlayers(homePlayersData);
      setAwayPlayers(awayPlayersData);

      const homeExisting = matchPlayersData.filter((p) => p.team_id === homeTeamId);
      const awayExisting = matchPlayersData.filter((p) => p.team_id === awayTeamId);

      setHomeSelection(buildSelection(homePlayersData, homeExisting));
      setAwaySelection(buildSelection(awayPlayersData, awayExisting));

      setLoading(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  const selectedHomeCount = useMemo(
    () => Object.values(homeSelection).filter((p) => p.is_selected).length,
    [homeSelection],
  );

  const selectedAwayCount = useMemo(
    () => Object.values(awaySelection).filter((p) => p.is_selected).length,
    [awaySelection],
  );

  function flash(message: string) {
    setInfo(message);
    window.setTimeout(() => setInfo(""), 2600);
  }

  function togglePlayerSelection(
    player: PlayerRow,
    side: "home" | "away",
  ) {
    const setter = side === "home" ? setHomeSelection : setAwaySelection;

    setter((prev) => {
      const current = prev[player.id] || {
        player_id: player.id,
        shirt_number: player.number,
        is_selected: false,
        is_starter: false,
      };

      return {
        ...prev,
        [player.id]: {
          ...current,
          is_selected: !current.is_selected,
          is_starter: current.is_selected ? false : current.is_starter,
        },
      };
    });
  }

  function toggleStarter(player: PlayerRow, side: "home" | "away") {
    const setter = side === "home" ? setHomeSelection : setAwaySelection;

    setter((prev) => {
      const current = prev[player.id] || {
        player_id: player.id,
        shirt_number: player.number,
        is_selected: true,
        is_starter: false,
      };

      return {
        ...prev,
        [player.id]: {
          ...current,
          is_selected: true,
          is_starter: !current.is_starter,
        },
      };
    });
  }

  function updateShirtNumber(
    player: PlayerRow,
    side: "home" | "away",
    shirtNumber: string,
  ) {
    const setter = side === "home" ? setHomeSelection : setAwaySelection;

    setter((prev) => {
      const current = prev[player.id] || {
        player_id: player.id,
        shirt_number: player.number,
        is_selected: true,
        is_starter: false,
      };

      return {
        ...prev,
        [player.id]: {
          ...current,
          shirt_number: shirtNumber,
        },
      };
    });
  }

  async function saveRoster() {
    if (!match || !homeTeam) return;

    setSaving(true);

    const { error: deleteErr } = await supabase
      .from("match_players")
      .delete()
      .eq("match_id", match.id);

    if (deleteErr) {
      setSaving(false);
      flash(`Erreur réinitialisation feuille : ${deleteErr.message}`);
      return;
    }

    const homePayload = homePlayers
      .filter((p) => homeSelection[p.id]?.is_selected)
      .map((p) => ({
        org_id: match.org_id,
        match_id: match.id,
        team_id: homeTeam.id,
        player_id: p.id,
        shirt_number: homeSelection[p.id]?.shirt_number?.trim() || p.number,
        is_starter: !!homeSelection[p.id]?.is_starter,
        is_selected: true,
        fouls: 0,
        points: 0,
        yellow_cards: 0,
        red_cards: 0,
      }));

    const awayPayload =
      awayTeam && awayPlayers.length > 0
        ? awayPlayers
            .filter((p) => awaySelection[p.id]?.is_selected)
            .map((p) => ({
              org_id: match.org_id,
              match_id: match.id,
              team_id: awayTeam.id,
              player_id: p.id,
              shirt_number: awaySelection[p.id]?.shirt_number?.trim() || p.number,
              is_starter: !!awaySelection[p.id]?.is_starter,
              is_selected: true,
              fouls: 0,
              points: 0,
              yellow_cards: 0,
              red_cards: 0,
            }))
        : [];

    const payload = [...homePayload, ...awayPayload];

    if (payload.length > 0) {
      const { error: insertErr } = await supabase
        .from("match_players")
        .insert(payload);

      if (insertErr) {
        setSaving(false);
        flash(`Erreur sauvegarde feuille : ${insertErr.message}`);
        return;
      }
    }

    setSaving(false);
    flash("Feuille de match sauvegardée.");
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.centerBox}>Chargement feuille de match…</div>
      </div>
    );
  }

  if (err || !match || !homeTeam) {
    return (
      <div style={styles.page}>
        <div style={styles.errorBox}>{err || "Contexte introuvable."}</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.topbar}>
          <div>
            <div style={styles.title}>Éditer feuille de match</div>
            <div style={styles.subtitle}>
              {match.name || `${match.home_name || "Domicile"} vs ${match.away_name || "Extérieur"}`}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => nav(`/matches/${match.id}/control`)} style={styles.ghostBtn}>
              Retour régie
            </button>
            <button onClick={saveRoster} style={styles.primaryBtn} disabled={saving}>
              {saving ? "Sauvegarde..." : "Sauvegarder"}
            </button>
          </div>
        </div>

        {info ? <div style={styles.infoBox}>{info}</div> : null}

        <div style={styles.hero}>
          <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>Domicile sélectionnés</div>
            <div style={styles.kpiValue}>{selectedHomeCount}</div>
          </div>
          <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>Extérieur sélectionnés</div>
            <div style={styles.kpiValue}>{selectedAwayCount}</div>
          </div>
          <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>Statut match</div>
            <div style={styles.kpiValueSmall}>{match.status || "scheduled"}</div>
          </div>
        </div>

        <Section title={`Feuille domicile — ${match.home_name || homeTeam.name}`}>
          {homePlayers.length === 0 ? (
            <div style={styles.emptyCard}>Aucun joueur actif côté domicile.</div>
          ) : (
            <PlayerSelectionList
              players={homePlayers}
              selectedPlayers={homeSelection}
              side="home"
              onTogglePlayer={togglePlayerSelection}
              onToggleStarter={toggleStarter}
              onUpdateShirtNumber={updateShirtNumber}
            />
          )}
        </Section>

        {awayTeam ? (
          <Section title={`Feuille extérieure — ${match.away_name || awayTeam.name}`}>
            {awayPlayers.length === 0 ? (
              <div style={styles.emptyCard}>Aucun joueur actif côté extérieur.</div>
            ) : (
              <PlayerSelectionList
                players={awayPlayers}
                selectedPlayers={awaySelection}
                side="away"
                onTogglePlayer={togglePlayerSelection}
                onToggleStarter={toggleStarter}
                onUpdateShirtNumber={updateShirtNumber}
              />
            )}
          </Section>
        ) : null}
      </div>
    </div>
  );
}

function PlayerSelectionList({
  players,
  selectedPlayers,
  side,
  onTogglePlayer,
  onToggleStarter,
  onUpdateShirtNumber,
}: {
  players: PlayerRow[];
  selectedPlayers: Record<string, SelectedPlayer>;
  side: "home" | "away";
  onTogglePlayer: (player: PlayerRow, side: "home" | "away") => void;
  onToggleStarter: (player: PlayerRow, side: "home" | "away") => void;
  onUpdateShirtNumber: (player: PlayerRow, side: "home" | "away", shirtNumber: string) => void;
}) {
  return (
    <div style={styles.list}>
      {players.map((player) => {
        const selection = selectedPlayers[player.id] || {
          player_id: player.id,
          shirt_number: player.number,
          is_selected: false,
          is_starter: false,
        };

        return (
          <div key={player.id} style={styles.playerCard}>
            <div style={styles.playerCardGrid}>
              <div>
                <div style={styles.playerName}>
                  #{selection.shirt_number || player.number} {player.name}
                </div>
                <div style={styles.playerMeta}>{player.position || "Poste libre"}</div>
              </div>

              <div style={styles.playerControls}>
                <label style={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={selection.is_selected}
                    onChange={() => onTogglePlayer(player, side)}
                  />
                  <span>Sélectionné</span>
                </label>

                <label style={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={selection.is_starter}
                    onChange={() => onToggleStarter(player, side)}
                  />
                  <span>Titulaire</span>
                </label>

                <div style={{ minWidth: 110 }}>
                  <div style={{ fontSize: 12, opacity: 0.72, marginBottom: 6 }}>N° match</div>
                  <input
                    value={selection.shirt_number}
                    onChange={(e) => onUpdateShirtNumber(player, side, e.target.value)}
                    style={styles.input}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 22 }}>
      <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 12 }}>{title}</div>
      {children}
    </section>
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
  container: { maxWidth: 1180, margin: "0 auto" },
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
    gridTemplateColumns: "repeat(3, minmax(0,1fr))",
    gap: 12,
    marginBottom: 18,
  },
  kpiCard: {
    padding: 16,
    borderRadius: 16,
    background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(255,255,255,.08)",
  },
  kpiLabel: { fontSize: 13, opacity: 0.72 },
  kpiValue: { fontSize: 30, fontWeight: 900, marginTop: 6 },
  kpiValueSmall: { fontSize: 22, fontWeight: 900, marginTop: 8 },
  list: { display: "grid", gap: 12 },
  playerCard: {
    padding: 14,
    borderRadius: 16,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.08)",
  },
  playerCardGrid: {
    display: "grid",
    gridTemplateColumns: "1.2fr 1fr",
    gap: 14,
    alignItems: "center",
  },
  playerName: { fontSize: 16, fontWeight: 900 },
  playerMeta: { marginTop: 4, fontSize: 13, opacity: 0.72 },
  playerControls: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  checkboxRow: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
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
    padding: 16,
    borderRadius: 16,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.08)",
  },
};
