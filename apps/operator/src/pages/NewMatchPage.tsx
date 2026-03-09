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

type PlayerRow = {
  id: string;
  org_id: string;
  team_id: string;
  number: string;
  name: string;
  position: string | null;
  is_active: boolean;
};

type SelectedPlayer = {
  player_id: string;
  shirt_number: string;
  is_selected: boolean;
  is_starter: boolean;
};

function normalizeSport(v: string | null | undefined) {
  return ((v || "football") + "").toLowerCase().trim();
}

function defaultDisplayToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
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

function buildInitialSelection(players: PlayerRow[]) {
  const out: Record<string, SelectedPlayer> = {};
  players.forEach((p, index) => {
    out[p.id] = {
      player_id: p.id,
      shirt_number: p.number,
      is_selected: true,
      is_starter: index < 5,
    };
  });
  return out;
}

export default function NewMatchPage() {
  const nav = useNavigate();
  const { teamId = "" } = useParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  const [org, setOrg] = useState<OrgRow | null>(null);
  const [homeTeam, setHomeTeam] = useState<TeamRow | null>(null);
  const [allTeams, setAllTeams] = useState<TeamRow[]>([]);
  const [sportSettings, setSportSettings] = useState<SportSettingsRow | null>(null);

  const [homePlayers, setHomePlayers] = useState<PlayerRow[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<PlayerRow[]>([]);

  const [selectedHomePlayers, setSelectedHomePlayers] = useState<Record<string, SelectedPlayer>>({});
  const [selectedAwayPlayers, setSelectedAwayPlayers] = useState<Record<string, SelectedPlayer>>({});

  const [awayTeamMode, setAwayTeamMode] = useState<"internal" | "external">("external");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [awayExternalName, setAwayExternalName] = useState("Adversaire");

  const [matchName, setMatchName] = useState("");
  const [homeName, setHomeName] = useState("");
  const [awayName, setAwayName] = useState("");
  const [scheduledAt, setScheduledAt] = useState(
    toLocalDatetimeInputValue(new Date(Date.now() + 86400000)),
  );
  const [publicDisplay, setPublicDisplay] = useState(true);
  const [displayToken, setDisplayToken] = useState(defaultDisplayToken());

  const activeOrgId = useMemo(
    () => (localStorage.getItem(LS_ACTIVE_ORG_ID) || "").trim(),
    [],
  );
  const activeOrgSlug = useMemo(
    () => (localStorage.getItem(LS_ACTIVE_ORG_SLUG) || "").trim(),
    [],
  );

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

      const [
        { data: homeTeamRow, error: homeTeamErr },
        { data: sportRow, error: sportErr },
        { data: teamsRows, error: teamsErr },
        { data: homePlayersRows, error: homePlayersErr },
      ] = await Promise.all([
        supabase
          .from("teams")
          .select("id, org_id, name, category, code")
          .eq("id", teamId)
          .maybeSingle(),
        supabase
          .from("org_sport_settings")
          .select("org_id, sport, period_count, period_duration_s")
          .eq("org_id", currentOrg.id)
          .maybeSingle(),
        supabase
          .from("teams")
          .select("id, org_id, name, category, code")
          .eq("org_id", currentOrg.id)
          .order("name", { ascending: true }),
        supabase
          .from("players")
          .select("id, org_id, team_id, number, name, position, is_active")
          .eq("team_id", teamId)
          .eq("is_active", true)
          .order("number", { ascending: true }),
      ]);

      if (cancelled) return;

      if (homeTeamErr || !homeTeamRow) {
        setErr(homeTeamErr?.message || "Équipe domicile introuvable.");
        setLoading(false);
        return;
      }

      if (sportErr) {
        setErr(sportErr.message);
        setLoading(false);
        return;
      }

      if (teamsErr) {
        setErr(teamsErr.message);
        setLoading(false);
        return;
      }

      if (homePlayersErr) {
        setErr(homePlayersErr.message);
        setLoading(false);
        return;
      }

      const currentHomeTeam = homeTeamRow as TeamRow;
      const currentTeams = (teamsRows as TeamRow[]) || [];
      const currentHomePlayers = (homePlayersRows as PlayerRow[]) || [];

      setHomeTeam(currentHomeTeam);
      setSportSettings((sportRow as SportSettingsRow | null) || null);
      setAllTeams(currentTeams);
      setHomePlayers(currentHomePlayers);
      setSelectedHomePlayers(buildInitialSelection(currentHomePlayers));

      const defaultHome = currentHomeTeam.name || currentOrg.name || "Équipe domicile";
      const defaultAway = "Adversaire";

      setHomeName(defaultHome);
      setAwayName(defaultAway);
      setAwayExternalName(defaultAway);
      setMatchName(`${defaultHome} vs ${defaultAway}`);

      setLoading(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [activeOrgId, activeOrgSlug, teamId]);

  useEffect(() => {
    let cancelled = false;

    async function loadAwayPlayers() {
      if (awayTeamMode !== "internal" || !awayTeamId) {
        setAwayPlayers([]);
        setSelectedAwayPlayers({});
        return;
      }

      const { data, error } = await supabase
        .from("players")
        .select("id, org_id, team_id, number, name, position, is_active")
        .eq("team_id", awayTeamId)
        .eq("is_active", true)
        .order("number", { ascending: true });

      if (cancelled) return;

      if (error) {
        flash(`Erreur chargement joueurs extérieurs : ${error.message}`);
        setAwayPlayers([]);
        setSelectedAwayPlayers({});
        return;
      }

      const rows = (data as PlayerRow[]) || [];
      setAwayPlayers(rows);
      setSelectedAwayPlayers(buildInitialSelection(rows));
    }

    loadAwayPlayers();
    return () => {
      cancelled = true;
    };
  }, [awayTeamMode, awayTeamId]);

  useEffect(() => {
    if (!homeTeam) return;

    const homeLabel = homeTeam.name || "Domicile";
    const awayLabel =
      awayTeamMode === "internal"
        ? allTeams.find((t) => t.id === awayTeamId)?.name || "Équipe extérieure"
        : awayExternalName || "Adversaire";

    setHomeName(homeLabel);
    setAwayName(awayLabel);
    setMatchName(`${homeLabel} vs ${awayLabel}`);
  }, [homeTeam, awayTeamMode, awayTeamId, awayExternalName, allTeams]);

  function flash(message: string) {
    setInfo(message);
    window.setTimeout(() => setInfo(""), 2600);
  }

  function togglePlayerSelection(
    player: PlayerRow,
    side: "home" | "away",
  ) {
    const setter = side === "home" ? setSelectedHomePlayers : setSelectedAwayPlayers;

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
    const setter = side === "home" ? setSelectedHomePlayers : setSelectedAwayPlayers;

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
    const setter = side === "home" ? setSelectedHomePlayers : setSelectedAwayPlayers;

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

  async function createMatch() {
    if (!org || !homeTeam) return;

    const homeSelected = Object.values(selectedHomePlayers).filter((p) => p.is_selected);
    if (homeSelected.length === 0) {
      flash("Sélectionne au moins un joueur domicile.");
      return;
    }

    const resolvedAwayTeam =
      awayTeamMode === "internal"
        ? allTeams.find((t) => t.id === awayTeamId) || null
        : null;

    const awaySelected =
      awayTeamMode === "internal"
        ? Object.values(selectedAwayPlayers).filter((p) => p.is_selected)
        : [];

    if (awayTeamMode === "internal" && !resolvedAwayTeam) {
      flash("Choisis une équipe extérieure.");
      return;
    }

    if (awayTeamMode === "internal" && awaySelected.length === 0) {
      flash("Sélectionne au moins un joueur extérieur.");
      return;
    }

    setSaving(true);

    const payload: Record<string, any> = {
      org_id: org.id,
      team_id: homeTeam.id,
      home_team_id: homeTeam.id,
      away_team_id: resolvedAwayTeam?.id || null,
      name: matchName.trim() || `${homeName.trim() || homeTeam.name} vs ${awayName.trim() || "Adversaire"}`,
      status: "scheduled",
      scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      home_name: homeName.trim() || homeTeam.name,
      away_name: awayName.trim() || resolvedAwayTeam?.name || "Adversaire",
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

    if (error || !data?.id) {
      setSaving(false);
      flash(error?.message || "Impossible de créer le match.");
      return;
    }

    const matchId = data.id as string;

    const homeMatchPlayersPayload = homePlayers
      .filter((p) => selectedHomePlayers[p.id]?.is_selected)
      .map((p) => ({
        org_id: org.id,
        match_id: matchId,
        team_id: homeTeam.id,
        player_id: p.id,
        shirt_number: selectedHomePlayers[p.id]?.shirt_number?.trim() || p.number,
        is_starter: !!selectedHomePlayers[p.id]?.is_starter,
        is_selected: true,
        fouls: 0,
        points: 0,
        yellow_cards: 0,
        red_cards: 0,
      }));

    const awayMatchPlayersPayload =
      awayTeamMode === "internal" && resolvedAwayTeam
        ? awayPlayers
            .filter((p) => selectedAwayPlayers[p.id]?.is_selected)
            .map((p) => ({
              org_id: org.id,
              match_id: matchId,
              team_id: resolvedAwayTeam.id,
              player_id: p.id,
              shirt_number: selectedAwayPlayers[p.id]?.shirt_number?.trim() || p.number,
              is_starter: !!selectedAwayPlayers[p.id]?.is_starter,
              is_selected: true,
              fouls: 0,
              points: 0,
              yellow_cards: 0,
              red_cards: 0,
            }))
        : [];

    const matchPlayersPayload = [...homeMatchPlayersPayload, ...awayMatchPlayersPayload];

    if (matchPlayersPayload.length > 0) {
      const { error: mpErr } = await supabase.from("match_players").insert(matchPlayersPayload);
      if (mpErr) {
        setSaving(false);
        flash(`Match créé, mais erreur feuille de match : ${mpErr.message}`);
        return;
      }
    }

    setSaving(false);
    flash("Match préparé avec succès.");
    nav(`/matches/${matchId}/control`, { replace: true });
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.centerBox}>Chargement de la préparation match…</div>
      </div>
    );
  }

  if (err || !org || !homeTeam) {
    return (
      <div style={styles.page}>
        <div style={styles.errorBox}>{err || "Contexte introuvable."}</div>
      </div>
    );
  }

  const selectedHomeCount = Object.values(selectedHomePlayers).filter((p) => p.is_selected).length;
  const selectedAwayCount = Object.values(selectedAwayPlayers).filter((p) => p.is_selected).length;
  const sport = normalizeSport(org.sport);
  const awayInternalChoices = allTeams.filter((t) => t.id !== homeTeam.id);

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.topbar}>
          <div>
            <div style={styles.title}>Préparer un match</div>
            <div style={styles.subtitle}>
              {org.name} • {homeTeam.name} • sport : <b>{sport}</b>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => nav(`/teams/${homeTeam.id}/matches`)} style={styles.ghostBtn}>
              Retour matchs
            </button>
            <button onClick={() => nav(`/teams/${homeTeam.id}/players`)} style={styles.ghostBtn}>
              Gérer joueurs domicile
            </button>
            {awayTeamMode === "internal" && awayTeamId ? (
              <button onClick={() => nav(`/teams/${awayTeamId}/players`)} style={styles.ghostBtn}>
                Gérer joueurs extérieur
              </button>
            ) : null}
          </div>
        </div>

        {info ? <div style={styles.infoBox}>{info}</div> : null}

        <div style={styles.hero}>
          <div>
            <div style={styles.heroTitle}>Création match V2</div>
            <div style={styles.heroText}>
              Cette version prépare un vrai match domicile / extérieur, avec feuille de match pour les deux côtés.
            </div>
          </div>

          <div style={styles.kpiGrid}>
            <div style={styles.kpiCard}>
              <div style={styles.kpiLabel}>Joueurs domicile</div>
              <div style={styles.kpiValue}>{selectedHomeCount}</div>
            </div>
            <div style={styles.kpiCard}>
              <div style={styles.kpiLabel}>Joueurs extérieur</div>
              <div style={styles.kpiValue}>{awayTeamMode === "internal" ? selectedAwayCount : 0}</div>
            </div>
            <div style={styles.kpiCard}>
              <div style={styles.kpiLabel}>Display public</div>
              <div style={styles.kpiValue}>{publicDisplay ? "Oui" : "Non"}</div>
            </div>
          </div>
        </div>

        <section style={styles.panel}>
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

            <Field label="Mode équipe extérieure">
              <select
                value={awayTeamMode}
                onChange={(e) => setAwayTeamMode(e.target.value as "internal" | "external")}
                style={styles.input}
              >
                <option value="external">Adversaire externe (texte)</option>
                <option value="internal">Équipe interne</option>
              </select>
            </Field>

            {awayTeamMode === "internal" ? (
              <Field label="Équipe extérieure">
                <select
                  value={awayTeamId}
                  onChange={(e) => setAwayTeamId(e.target.value)}
                  style={styles.input}
                >
                  <option value="">Choisir une équipe</option>
                  {awayInternalChoices.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field label="Nom adversaire extérieur">
                <input
                  value={awayExternalName}
                  onChange={(e) => setAwayExternalName(e.target.value)}
                  style={styles.input}
                />
              </Field>
            )}

            <Field label="Nom affiché équipe extérieure">
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
        </section>

        <Section title="Feuille de match — domicile">
          {homePlayers.length === 0 ? (
            <div style={styles.emptyCard}>Aucun joueur actif sur l’équipe domicile.</div>
          ) : (
            <PlayerSelectionList
              players={homePlayers}
              selectedPlayers={selectedHomePlayers}
              side="home"
              onTogglePlayer={togglePlayerSelection}
              onToggleStarter={toggleStarter}
              onUpdateShirtNumber={updateShirtNumber}
            />
          )}
        </Section>

        {awayTeamMode === "internal" ? (
          <Section title="Feuille de match — extérieur">
            {!awayTeamId ? (
              <div style={styles.emptyCard}>Choisis d’abord une équipe extérieure.</div>
            ) : awayPlayers.length === 0 ? (
              <div style={styles.emptyCard}>Aucun joueur actif sur l’équipe extérieure.</div>
            ) : (
              <PlayerSelectionList
                players={awayPlayers}
                selectedPlayers={selectedAwayPlayers}
                side="away"
                onTogglePlayer={togglePlayerSelection}
                onToggleStarter={toggleStarter}
                onUpdateShirtNumber={updateShirtNumber}
              />
            )}
          </Section>
        ) : null}

        <section style={styles.noticeCard}>
          <div style={styles.noticeTitle}>Préconfiguration</div>
          <div style={styles.noticeText}>
            Le match sera créé avec :
            <br />
            • `home_team_id` = équipe actuelle
            <br />
            • `away_team_id` = équipe extérieure si interne
            <br />
            • feuille de match persistée dans <b>match_players</b>
            <br />
            • fallback texte conservé via `home_name` / `away_name`
          </div>
        </section>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
          <button onClick={createMatch} style={styles.primaryBtn} disabled={saving}>
            {saving ? "Création..." : "Créer et ouvrir la régie"}
          </button>
          <button onClick={() => nav(`/teams/${homeTeam.id}/matches`)} style={styles.ghostBtn}>
            Annuler
          </button>
        </div>
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
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10 },
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
  emptyCard: {
    padding: 16,
    borderRadius: 16,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.08)",
  },
};
