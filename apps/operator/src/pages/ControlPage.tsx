import React, { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useNavigate, useParams } from "react-router-dom";
import { sendTvBroadcast } from "../realtime";
import { supabase } from "../supabase";
import { useToast, ToastContainer } from "../components/Toast";
import { useConfirm, ConfirmDialog } from "../components/ConfirmDialog";
import { usePlayerPicker, PlayerPickerDialog } from "../components/PlayerPickerDialog";

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
  home_score: number | null;
  away_score: number | null;

  period_label: string | null;
  clock_ms: number | null;
  clock_running: boolean | null;

  home_team_fouls: number | null;
  away_team_fouls: number | null;
  home_timeouts: number | null;
  away_timeouts: number | null;
  home_bonus: boolean | null;
  away_bonus: boolean | null;
  shot_clock_s: number | null;
  home_sets_won: number | null;
  away_sets_won: number | null;
  home_yellow_cards: number | null;
  away_yellow_cards: number | null;
  home_red_cards: number | null;
  away_red_cards: number | null;

  current_period_index: number | null;
  is_overtime: boolean | null;
  possession_arrow: "home" | "away" | null;
  team_fouls_period_home: number | null;
  team_fouls_period_away: number | null;
  timeouts_first_half_home: number | null;
  timeouts_first_half_away: number | null;
  timeouts_second_half_home: number | null;
  timeouts_second_half_away: number | null;
  timeouts_overtime_home: number | null;
  timeouts_overtime_away: number | null;
  last_event_seq: number | null;

  rugby_home_tries: number | null;
  rugby_away_tries: number | null;
  rugby_home_conversions: number | null;
  rugby_away_conversions: number | null;
  rugby_home_penalties: number | null;
  rugby_away_penalties: number | null;
  rugby_home_drop_goals: number | null;
  rugby_away_drop_goals: number | null;
  rugby_home_yellow_sin_bin: number | null;
  rugby_away_yellow_sin_bin: number | null;
  rugby_home_sin_bin_active: number | null;
  rugby_away_sin_bin_active: number | null;
  rugby_extra_time: boolean | null;
  rugby_tiebreak_mode: string | null;

  handball_home_2min: number | null;
  handball_away_2min: number | null;
  handball_home_2min_active: number | null;
  handball_away_2min_active: number | null;
  handball_home_team_timeouts: number | null;
  handball_away_team_timeouts: number | null;
  handball_home_warnings: number | null;
  handball_away_warnings: number | null;
  handball_home_disqualifications: number | null;
  handball_away_disqualifications: number | null;
  handball_extra_time: boolean | null;
  handball_shootout_mode: string | null;

  volleyball_home_timeouts: number | null;
  volleyball_away_timeouts: number | null;
  volleyball_home_set_points: number | null;
  volleyball_away_set_points: number | null;
  volleyball_home_serving: boolean | null;
  volleyball_away_serving: boolean | null;
  volleyball_current_set: number | null;
  volleyball_is_tiebreak: boolean | null;

  football_home_yellow_cards: number | null;
  football_away_yellow_cards: number | null;
  football_home_red_cards: number | null;
  football_away_red_cards: number | null;
  football_home_penalty_shootout: number | null;
  football_away_penalty_shootout: number | null;
  football_extra_time: boolean | null;
  football_added_time_first_half: number | null;
  football_added_time_second_half: number | null;
  football_added_time_extra_1: number | null;
  football_added_time_extra_2: number | null;
};

type OrgRow = {
  id: string;
  slug: string;
  name: string;
  sport: string | null;
};

type TeamRow = {
  id: string;
  name: string;
  slug: string | null;
};

type MatchPlayerRow = {
  id: string;
  player_id: string;
  team_id: string;
  shirt_number: string | null;
  fouls: number;
  points: number;
  yellow_cards: number;
  red_cards: number;
  is_selected: boolean;
  is_starter: boolean;
  player: {
    id: string;
    name: string;
    number: string;
  } | null;
};

type DisplaySettings = {
  theme: string;
  layout_mode: string;
  show_score: boolean;
  show_clock: boolean;
  show_period: boolean;
  show_status: boolean;
  show_lower_third: boolean;
  show_logos: boolean;
  show_sponsors: boolean;
  dual_language: boolean;
  lang_primary: string;
  lang_secondary: string;
  sponsor_rotate_s: number;
};

type SportSettings = {
  org_id: string;
  sport: string;
  period_count: number;
  period_duration_s: number;
  extra_time_enabled: boolean;
  penalties_enabled: boolean;
  show_team_fouls: boolean;
  show_player_fouls: boolean;
  show_timeouts: boolean;
  show_bonus: boolean;
  show_sets: boolean;
  show_cards: boolean;
  show_shot_clock: boolean;
  max_team_fouls: number | null;
  max_player_fouls: number | null;
  max_timeouts: number | null;
  shot_clock_s: number | null;
};

type PlayerStatRow = {
  id: string;
  team_id?: string;
  name: string;
  number: string;
  fouls: number;
  points?: number;
  yellow_cards?: number;
  red_cards?: number;
};

type MatchEventRow = {
  id: string;
  seq: number;
  event_type: string;
  team_side: "home" | "away" | null;
  period_index: number | null;
  game_clock_ms: number | null;
  shot_clock_s: number | null;
  payload: Record<string, any>;
  created_at: string;
};

type SuspensionRow = {
  id: string;
  team_side: "home" | "away";
  player_id: string | null;
  player_name_snapshot: string | null;
  shirt_number_snapshot: string | null;
  started_game_clock_ms: number;
  duration_s: number;
  ended_game_clock_ms: number | null;
  is_active: boolean;
  created_at: string;
};

function getEnv(name: string): string {
  const v = (import.meta as any).env?.[name];
  return typeof v === "string" ? v : "";
}

const DISPLAY_URL =
  getEnv("VITE_DISPLAY_APP_URL") ||
  getEnv("VITE_DISPLAY_URL") ||
  "";

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

function periodOptionsBySport(sport: string, periodCount?: number) {
  const s = normalizeSport(sport);
  const count = Math.max(1, Number(periodCount || 2));

  if (s === "basket") {
    const base = Array.from({ length: Math.max(4, count) }, (_, i) => `Q${i + 1}`);
    base.push("OT");
    return base;
  }
  if (s === "volleyball") {
    return Array.from({ length: Math.max(3, count) }, (_, i) => `Set ${i + 1}`);
  }
  if (s === "rugby" || s === "handball" || s === "football") {
    return ["1MT", "2MT", "Prolongation"];
  }
  if (count === 2) return ["1MT", "2MT", "Prolongation"];
  return Array.from({ length: count }, (_, i) => `P${i + 1}`);
}

function scoreStepOptionsBySport(sport: string) {
  const s = normalizeSport(sport);
  if (s === "basket") return [1, 2, 3];
  if (s === "rugby") return [3, 5, 7];
  return [1];
}


function fmtEventType(event_type: string): string {
  const map: Record<string, string> = {
    rugby_yellow_card: "Carton jaune (excl. temp.)",
    rugby_red_card: "Carton rouge",
    rugby_sin_bin_end: "Fin exclusion temporaire",
    rugby_tries: "Essai",
    rugby_conversions: "Transformation",
    rugby_penalties: "Pénalité",
    rugby_drops: "Drop",
    rugby_score: "Score modifié",
    rugby_player_yellow_cards: "Carton jaune (joueur)",
    rugby_player_red_cards: "Carton rouge (joueur)",
    rugby_player_fouls: "Faute joueur",
    rugby_player_points: "Points joueur",
    handball_2min: "Exclusion 2 min",
    handball_2min_end: "Fin excl. 2 min",
    handball_warning: "Avertissement",
    handball_disqualification: "Disqualification",
    handball_score: "But",
    football_score: "But / score",
    football_yellow_card: "Carton jaune",
    football_red_card: "Carton rouge",
    basket_period_change: "Changement de période",
    basket_possession_arrow: "Flèche possession",
    basket_score: "Score",
    basket_foul: "Faute",
    volleyball_score: "Point volleyball",
    volleyball_set_end: "Fin de set",
  };
  if (map[event_type]) return map[event_type];
  // Generic fallback: replace underscores with spaces
  return event_type.replace(/_/g, " ").replace(/w/g, (l) => l.toUpperCase());
}

function fmtEventPayload(event_type: string, payload: Record<string, any>): string {
  if (!payload || Object.keys(payload).length === 0) return "";
  const p = payload;
  // Player identification
  const playerTag = p.player_name
    ? (p.shirt_number ? `#${p.shirt_number} ${p.player_name}` : p.player_name)
    : p.shirt_number
    ? `#${p.shirt_number}`
    : null;
  // Rugby scoring events
  if (["rugby_tries","rugby_conversions","rugby_penalties","rugby_drops"].includes(event_type)) {
    const side = p.delta > 0 ? (p.home_score !== undefined ? "Dom." : "") : "";
    const delta = p.delta > 0 ? `+${p.delta}` : p.delta;
    const score = p.home_score !== undefined && p.away_score !== undefined
      ? ` → ${p.home_score}-${p.away_score}`
      : "";
    return `${delta}${score}`;
  }
  // Card events with player
  if (["rugby_yellow_card","rugby_red_card","rugby_sin_bin_end","handball_2min","handball_2min_end","handball_warning","handball_disqualification"].includes(event_type)) {
    return playerTag || "Joueur non renseigné";
  }
  // Player stat events
  if (event_type.includes("player_")) {
    const fieldMap: Record<string, string> = { fouls: "Fautes", points: "Points", yellow_cards: "Jaunes", red_cards: "Rouges" };
    const fieldLabel = fieldMap[p.field] || p.field || "";
    const delta = p.delta > 0 ? `+${p.delta}` : p.delta;
    const val = p.value !== undefined ? ` = ${p.value}` : "";
    return `${playerTag ? playerTag + " • " : ""}${fieldLabel} ${delta}${val}`;
  }
  // Period change
  if (event_type === "basket_period_change") return `Période : ${p.period_label || p.label || ""}`;
  // Score events
  if (event_type.includes("score") && p.home_score !== undefined) return `${p.home_score}-${p.away_score}`;
  // Possession
  if (event_type === "basket_possession_arrow") return p.possession_arrow === "home" ? "Dom." : "Ext.";
  return "";
}

function fmtClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function clampMin(n: number, min = 0) {
  return Math.max(min, n);
}

function toPlayerStatRows(matchPlayers: MatchPlayerRow[]) {
  return matchPlayers
    .map((p) => ({
      id: p.player_id,
      team_id: p.team_id,
      name: p.player?.name || "Joueur",
      number: p.shirt_number || p.player?.number || "?",
      fouls: p.fouls || 0,
      points: p.points || 0,
      yellow_cards: p.yellow_cards || 0,
      red_cards: p.red_cards || 0,
    }));
}

function recomputeRugbyScore(parts: {
  tries: number;
  conversions: number;
  penalties: number;
  drops: number;
}) {
  return parts.tries * 5 + parts.conversions * 2 + parts.penalties * 3 + parts.drops * 3;
}

export default function ControlPage() {
  const nav = useNavigate();
  const { matchId = "" } = useParams();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const { toast, toasts, dismiss } = useToast();
  const { confirm, dialogState, handleClose } = useConfirm();
  const { pick, pickerState, handlePickerClose } = usePlayerPicker();

  const [match, setMatch] = useState<MatchRow | null>(null);
  const [org, setOrg] = useState<OrgRow | null>(null);
  const [team, setTeam] = useState<TeamRow | null>(null);
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings | null>(null);
  const [sportSettings, setSportSettings] = useState<SportSettings | null>(null);
  const [events, setEvents] = useState<MatchEventRow[]>([]);
  const [rugbySuspensions, setRugbySuspensions] = useState<SuspensionRow[]>([]);
  const [handballSuspensions, setHandballSuspensions] = useState<SuspensionRow[]>([]);

  const [matchName, setMatchName] = useState("");
  const [homeName, setHomeName] = useState("");
  const [awayName, setAwayName] = useState("");
  const [status, setStatus] = useState("scheduled");
  const [periodLabel, setPeriodLabel] = useState("1MT");
  const [currentPeriodIndex, setCurrentPeriodIndex] = useState(1);
  const [isOvertime, setIsOvertime] = useState(false);
  const [possessionArrow, setPossessionArrow] = useState<"home" | "away">("home");

  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [clockMs, setClockMs] = useState(0);
  const [clockRunning, setClockRunning] = useState(false);
  const [autoLive, setAutoLive] = useState(true);

  const [homeTeamFouls, setHomeTeamFouls] = useState(0);
  const [awayTeamFouls, setAwayTeamFouls] = useState(0);
  const [homeTimeouts, setHomeTimeouts] = useState(0);
  const [awayTimeouts, setAwayTimeouts] = useState(0);
  const [homeBonus, setHomeBonus] = useState(false);
  const [awayBonus, setAwayBonus] = useState(false);
  const [shotClockS, setShotClockS] = useState(24);

  const [homeSetsWon, setHomeSetsWon] = useState(0);
  const [awaySetsWon, setAwaySetsWon] = useState(0);

  const [homeYellowCards, setHomeYellowCards] = useState(0);
  const [awayYellowCards, setAwayYellowCards] = useState(0);
  const [homeRedCards, setHomeRedCards] = useState(0);
  const [awayRedCards, setAwayRedCards] = useState(0);

  const [homePlayers, setHomePlayers] = useState<PlayerStatRow[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<PlayerStatRow[]>([]);

  const [rugbyHomeTries, setRugbyHomeTries] = useState(0);
  const [rugbyAwayTries, setRugbyAwayTries] = useState(0);
  const [rugbyHomeConversions, setRugbyHomeConversions] = useState(0);
  const [rugbyAwayConversions, setRugbyAwayConversions] = useState(0);
  const [rugbyHomePenalties, setRugbyHomePenalties] = useState(0);
  const [rugbyAwayPenalties, setRugbyAwayPenalties] = useState(0);
  const [rugbyHomeDrops, setRugbyHomeDrops] = useState(0);
  const [rugbyAwayDrops, setRugbyAwayDrops] = useState(0);
  const [rugbyHomeYellowSinBin, setRugbyHomeYellowSinBin] = useState(0);
  const [rugbyAwayYellowSinBin, setRugbyAwayYellowSinBin] = useState(0);
  const [rugbyHomeSinBinActive, setRugbyHomeSinBinActive] = useState(0);
  const [rugbyAwaySinBinActive, setRugbyAwaySinBinActive] = useState(0);
  const [rugbyExtraTime, setRugbyExtraTime] = useState(false);
  const [rugbyTiebreakMode, setRugbyTiebreakMode] = useState("");

  const [handballHome2Min, setHandballHome2Min] = useState(0);
  const [handballAway2Min, setHandballAway2Min] = useState(0);
  const [handballHome2MinActive, setHandballHome2MinActive] = useState(0);
  const [handballAway2MinActive, setHandballAway2MinActive] = useState(0);
  const [handballHomeTimeouts, setHandballHomeTimeouts] = useState(0);
  const [handballAwayTimeouts, setHandballAwayTimeouts] = useState(0);
  const [handballHomeWarnings, setHandballHomeWarnings] = useState(0);
  const [handballAwayWarnings, setHandballAwayWarnings] = useState(0);
  const [handballHomeDisq, setHandballHomeDisq] = useState(0);
  const [handballAwayDisq, setHandballAwayDisq] = useState(0);
  const [handballExtraTime, setHandballExtraTime] = useState(false);
  const [handballShootoutMode, setHandballShootoutMode] = useState("");

  const [volleyHomeTimeouts, setVolleyHomeTimeouts] = useState(0);
  const [volleyAwayTimeouts, setVolleyAwayTimeouts] = useState(0);
  const [volleyHomeSetPoints, setVolleyHomeSetPoints] = useState(0);
  const [volleyAwaySetPoints, setVolleyAwaySetPoints] = useState(0);
  const [volleyHomeServing, setVolleyHomeServing] = useState(false);
  const [volleyAwayServing, setVolleyAwayServing] = useState(false);
  const [volleyCurrentSet, setVolleyCurrentSet] = useState(1);
  const [volleyIsTiebreak, setVolleyIsTiebreak] = useState(false);

  const [footballHomeYellows, setFootballHomeYellows] = useState(0);
  const [footballAwayYellows, setFootballAwayYellows] = useState(0);
  const [footballHomeReds, setFootballHomeReds] = useState(0);
  const [footballAwayReds, setFootballAwayReds] = useState(0);
  const [footballHomePens, setFootballHomePens] = useState(0);
  const [footballAwayPens, setFootballAwayPens] = useState(0);
  const [footballExtraTime, setFootballExtraTime] = useState(false);
  const [footballAdded1, setFootballAdded1] = useState(0);
  const [footballAdded2, setFootballAdded2] = useState(0);
  const [footballAddedEx1, setFootballAddedEx1] = useState(0);
  const [footballAddedEx2, setFootballAddedEx2] = useState(0);

  const timerRef = useRef<number | null>(null);
  const liveSeqRef = useRef<number>(0);
  const eventSeqRef = useRef<number>(0);
  const clockMsRef = useRef<number>(0);
  const clockRunningRef = useRef<boolean>(false);
  const clockAnchorRef = useRef<{ epoch: number; ms: number }>({ epoch: Date.now(), ms: 0 });

  const sport = normalizeSport(org?.sport);
  const canScore = status === "live";
  const isBasket = sport === "basket";
  const isRugby = sport === "rugby";
  const isHandball = sport === "handball";
  const isVolleyball = sport === "volleyball";
  const isFootball = sport === "football";

  const periodOptions = useMemo(
    () => periodOptionsBySport(sport, sportSettings?.period_count),
    [sport, sportSettings?.period_count],
  );
  const scoreSteps = useMemo(() => scoreStepOptionsBySport(sport), [sport]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setErr("");

      const { data: matchRow, error: matchErr } = await supabase
        .from("matches")
        .select("*")
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

      const [
        { data: orgRow },
        { data: teamRow },
        { data: dsRow },
        { data: ssRow },
        { data: eventsRows, error: eventsErr },
        { data: rugbyRows },
        { data: handballRows },
      ] = await Promise.all([
        supabase.from("orgs").select("id, slug, name, sport").eq("id", currentMatch.org_id).maybeSingle(),
        currentMatch.team_id
          ? supabase.from("teams").select("id, name, slug").eq("id", currentMatch.team_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from("org_display_settings")
          .select("theme, layout_mode, show_score, show_clock, show_period, show_status, show_lower_third, show_logos, show_sponsors, dual_language, lang_primary, lang_secondary, sponsor_rotate_s")
          .eq("org_id", currentMatch.org_id)
          .maybeSingle(),
        supabase
          .from("org_sport_settings")
          .select("org_id, sport, period_count, period_duration_s, extra_time_enabled, penalties_enabled, show_team_fouls, show_player_fouls, show_timeouts, show_bonus, show_sets, show_cards, show_shot_clock, max_team_fouls, max_player_fouls, max_timeouts, shot_clock_s")
          .eq("org_id", currentMatch.org_id)
          .maybeSingle(),
        supabase
          .from("match_events")
          .select("id, seq, event_type, team_side, period_index, game_clock_ms, shot_clock_s, payload, created_at")
          .eq("match_id", currentMatch.id)
          .order("seq", { ascending: false })
          .limit(50),
        supabase
          .from("match_sin_bins")
          .select("id, team_side, player_id, player_name_snapshot, shirt_number_snapshot, started_game_clock_ms, duration_s, ended_game_clock_ms, is_active, created_at")
          .eq("match_id", currentMatch.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("match_two_min_suspensions")
          .select("id, team_side, player_id, player_name_snapshot, shirt_number_snapshot, started_game_clock_ms, duration_s, ended_game_clock_ms, is_active, created_at")
          .eq("match_id", currentMatch.id)
          .order("created_at", { ascending: false }),
      ]);

      if (cancelled) return;

      if (eventsErr) {
        setErr(eventsErr.message);
        setLoading(false);
        return;
      }

      setOrg((orgRow as OrgRow) || null);
      setTeam((teamRow as TeamRow) || null);
      setDisplaySettings((dsRow as DisplaySettings) || null);
      setSportSettings((ssRow as SportSettings) || null);
      const loadedEvents = (eventsRows as MatchEventRow[]) || [];
      setEvents(loadedEvents);
      setRugbySuspensions((rugbyRows as SuspensionRow[]) || []);
      setHandballSuspensions((handballRows as SuspensionRow[]) || []);
      eventSeqRef.current = loadedEvents.length > 0 ? Math.max(...loadedEvents.map((e) => e.seq || 0)) : Number(currentMatch.last_event_seq || 0);

      const sportValue = normalizeSport((orgRow as OrgRow | null)?.sport);
      const ss = (ssRow as SportSettings | null) || null;

      setMatchName(currentMatch.name || `${currentMatch.home_name || "Domicile"} vs ${currentMatch.away_name || "Extérieur"}`);
      setHomeName(currentMatch.home_name || "Domicile");
      setAwayName(currentMatch.away_name || "Extérieur");
      setStatus((currentMatch.status || "scheduled").toLowerCase());
      setPeriodLabel(currentMatch.period_label || periodOptionsBySport(sportValue, ss?.period_count)[0] || "1MT");
      setCurrentPeriodIndex(Number(currentMatch.current_period_index || 1));
      setIsOvertime(!!currentMatch.is_overtime);
      setPossessionArrow((currentMatch.possession_arrow || "home") as "home" | "away");

      setHomeScore(Number(currentMatch.home_score || 0));
      setAwayScore(Number(currentMatch.away_score || 0));
      const initClockMs =
        typeof currentMatch.clock_ms === "number"
          ? currentMatch.clock_ms
          : defaultClockMsBySport(sportValue, ss?.period_duration_s);
      const initClockRunning = !!currentMatch.clock_running;
      clockMsRef.current = initClockMs;
      clockRunningRef.current = initClockRunning;
      clockAnchorRef.current = { epoch: Date.now(), ms: initClockMs };
      setClockMs(initClockMs);
      setClockRunning(initClockRunning);

      setHomeTeamFouls(Number(currentMatch.home_team_fouls || 0));
      setAwayTeamFouls(Number(currentMatch.away_team_fouls || 0));
      setHomeTimeouts(Number(currentMatch.home_timeouts || 0));
      setAwayTimeouts(Number(currentMatch.away_timeouts || 0));
      setHomeBonus(!!currentMatch.home_bonus);
      setAwayBonus(!!currentMatch.away_bonus);
      setShotClockS(typeof currentMatch.shot_clock_s === "number" ? currentMatch.shot_clock_s : Number(ss?.shot_clock_s || 24));
      setHomeSetsWon(Number(currentMatch.home_sets_won || 0));
      setAwaySetsWon(Number(currentMatch.away_sets_won || 0));
      setHomeYellowCards(Number(currentMatch.home_yellow_cards || 0));
      setAwayYellowCards(Number(currentMatch.away_yellow_cards || 0));
      setHomeRedCards(Number(currentMatch.home_red_cards || 0));
      setAwayRedCards(Number(currentMatch.away_red_cards || 0));

      setRugbyHomeTries(Number(currentMatch.rugby_home_tries || 0));
      setRugbyAwayTries(Number(currentMatch.rugby_away_tries || 0));
      setRugbyHomeConversions(Number(currentMatch.rugby_home_conversions || 0));
      setRugbyAwayConversions(Number(currentMatch.rugby_away_conversions || 0));
      setRugbyHomePenalties(Number(currentMatch.rugby_home_penalties || 0));
      setRugbyAwayPenalties(Number(currentMatch.rugby_away_penalties || 0));
      setRugbyHomeDrops(Number(currentMatch.rugby_home_drop_goals || 0));
      setRugbyAwayDrops(Number(currentMatch.rugby_away_drop_goals || 0));
      setRugbyHomeYellowSinBin(Number(currentMatch.rugby_home_yellow_sin_bin || 0));
      setRugbyAwayYellowSinBin(Number(currentMatch.rugby_away_yellow_sin_bin || 0));
      setRugbyHomeSinBinActive(Number(currentMatch.rugby_home_sin_bin_active || 0));
      setRugbyAwaySinBinActive(Number(currentMatch.rugby_away_sin_bin_active || 0));
      setRugbyExtraTime(!!currentMatch.rugby_extra_time);
      setRugbyTiebreakMode(currentMatch.rugby_tiebreak_mode || "");

      setHandballHome2Min(Number(currentMatch.handball_home_2min || 0));
      setHandballAway2Min(Number(currentMatch.handball_away_2min || 0));
      setHandballHome2MinActive(Number(currentMatch.handball_home_2min_active || 0));
      setHandballAway2MinActive(Number(currentMatch.handball_away_2min_active || 0));
      setHandballHomeTimeouts(Number(currentMatch.handball_home_team_timeouts || 0));
      setHandballAwayTimeouts(Number(currentMatch.handball_away_team_timeouts || 0));
      setHandballHomeWarnings(Number(currentMatch.handball_home_warnings || 0));
      setHandballAwayWarnings(Number(currentMatch.handball_away_warnings || 0));
      setHandballHomeDisq(Number(currentMatch.handball_home_disqualifications || 0));
      setHandballAwayDisq(Number(currentMatch.handball_away_disqualifications || 0));
      setHandballExtraTime(!!currentMatch.handball_extra_time);
      setHandballShootoutMode(currentMatch.handball_shootout_mode || "");

      setVolleyHomeTimeouts(Number(currentMatch.volleyball_home_timeouts || 0));
      setVolleyAwayTimeouts(Number(currentMatch.volleyball_away_timeouts || 0));
      setVolleyHomeSetPoints(Number(currentMatch.volleyball_home_set_points || 0));
      setVolleyAwaySetPoints(Number(currentMatch.volleyball_away_set_points || 0));
      setVolleyHomeServing(!!currentMatch.volleyball_home_serving);
      setVolleyAwayServing(!!currentMatch.volleyball_away_serving);
      setVolleyCurrentSet(Number(currentMatch.volleyball_current_set || 1));
      setVolleyIsTiebreak(!!currentMatch.volleyball_is_tiebreak);

      setFootballHomeYellows(Number(currentMatch.football_home_yellow_cards || 0));
      setFootballAwayYellows(Number(currentMatch.football_away_yellow_cards || 0));
      setFootballHomeReds(Number(currentMatch.football_home_red_cards || 0));
      setFootballAwayReds(Number(currentMatch.football_away_red_cards || 0));
      setFootballHomePens(Number(currentMatch.football_home_penalty_shootout || 0));
      setFootballAwayPens(Number(currentMatch.football_away_penalty_shootout || 0));
      setFootballExtraTime(!!currentMatch.football_extra_time);
      setFootballAdded1(Number(currentMatch.football_added_time_first_half || 0));
      setFootballAdded2(Number(currentMatch.football_added_time_second_half || 0));
      setFootballAddedEx1(Number(currentMatch.football_added_time_extra_1 || 0));
      setFootballAddedEx2(Number(currentMatch.football_added_time_extra_2 || 0));

      const { data: matchPlayersData, error: matchPlayersErr } = await supabase
        .from("match_players")
        .select(`
          id,
          player_id,
          team_id,
          shirt_number,
          fouls,
          points,
          yellow_cards,
          red_cards,
          is_selected,
          is_starter,
          player:players (
            id,
            name,
            number
          )
        `)
        .eq("match_id", currentMatch.id)
        .order("shirt_number", { ascending: true });

      if (!cancelled && !matchPlayersErr) {
        const mp = (matchPlayersData as unknown as MatchPlayerRow[]) || [];
        const homeTeamId = currentMatch.home_team_id || currentMatch.team_id || null;
        const awayTeamId = currentMatch.away_team_id || null;

        const homeMp = mp.filter((p) => !homeTeamId || p.team_id === homeTeamId);
        const awayMp = awayTeamId ? mp.filter((p) => p.team_id === awayTeamId) : [];

        let homeRows = toPlayerStatRows(homeMp);
        let awayRows = toPlayerStatRows(awayMp);

        /* fallback: si match_players vide, charger les joueurs depuis la table players de l'équipe */
        const fallbackPromises: Promise<void>[] = [];
        if (homeRows.length === 0 && homeTeamId) {
          fallbackPromises.push(
            supabase.from("players").select("id, name, number").eq("team_id", homeTeamId).order("number", { ascending: true })
              .then(({ data }) => {
                if (data && !cancelled) {
                  homeRows = (data as { id: string; name: string; number: string }[]).map((p) => ({
                    id: p.id, team_id: homeTeamId, name: p.name || "Joueur", number: p.number || "?", fouls: 0,
                  }));
                }
              })
          );
        }
        if (awayRows.length === 0 && awayTeamId) {
          fallbackPromises.push(
            supabase.from("players").select("id, name, number").eq("team_id", awayTeamId).order("number", { ascending: true })
              .then(({ data }) => {
                if (data && !cancelled) {
                  awayRows = (data as { id: string; name: string; number: string }[]).map((p) => ({
                    id: p.id, team_id: awayTeamId, name: p.name || "Joueur", number: p.number || "?", fouls: 0,
                  }));
                }
              })
          );
        }
        if (fallbackPromises.length > 0) await Promise.all(fallbackPromises);

        if (!cancelled) {
          setHomePlayers(homeRows);
          setAwayPlayers(awayRows);
        }
      }

      setLoading(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  useEffect(() => {
    if (!clockRunning) return;

    timerRef.current = window.setInterval(() => {
      const { epoch, ms: anchorMs } = clockAnchorRef.current;
      const computed = Math.max(0, anchorMs - (Date.now() - epoch));
      clockMsRef.current = computed;
      setClockMs(computed);
      if (computed === 0) {
        clockRunningRef.current = false;
        setClockRunning(false);
      }
    }, 100);

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [clockRunning]);

  useEffect(() => {
    if (isRugby) {
      const active = rugbySuspensions.filter((s) => s.is_active);
      setRugbyHomeSinBinActive(active.filter((s) => s.team_side === "home").length);
      setRugbyAwaySinBinActive(active.filter((s) => s.team_side === "away").length);
    }
  }, [rugbySuspensions, isRugby]);

  useEffect(() => {
    if (isHandball) {
      const active = handballSuspensions.filter((s) => s.is_active);
      setHandballHome2MinActive(active.filter((s) => s.team_side === "home").length);
      setHandballAway2MinActive(active.filter((s) => s.team_side === "away").length);
    }
  }, [handballSuspensions, isHandball]);

  useEffect(() => {
    const orgId = org?.id;
    if (!orgId) return;
    const ch = supabase
      .channel(`org_ds:${orgId}`)
      .on(
        "postgres_changes" as any,
        { event: "UPDATE", schema: "public", table: "org_display_settings", filter: `org_id=eq.${orgId}` },
        (payload: any) => {
          setDisplaySettings(payload.new as DisplaySettings);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [org?.id]);

  function displayLink() {
    if (!DISPLAY_URL) return "";
    const base = DISPLAY_URL.replace(/\/$/, "");
    if (team?.slug) return `${base}/?teamSlug=${encodeURIComponent(team.slug)}`;
    if (team?.id) return `${base}/?teamId=${encodeURIComponent(team.id)}`;
    return "";
  }

  function controlLink() {
    return `${window.location.origin}/matches/${matchId}/mobile`;
  }

  function nextLiveSeq(): number {
    liveSeqRef.current += 1;
    return liveSeqRef.current;
  }

  async function persistLiveState(patch: Partial<MatchRow>) {
    if (!match) return;

    const dbPatch: Partial<MatchRow> = { ...patch };
    if ((dbPatch as any).status === "paused") {
      (dbPatch as any).status = "live";
    }

    const { error } = await supabase
      .from("matches")
      .update(dbPatch)
      .eq("id", match.id);

    if (error) {
      toast(`Erreur persistance match : ${error.message}`, "error");
      throw error;
    }

    setMatch((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  async function appendEvent(params: {
    event_type: string;
    team_side?: "home" | "away" | null;
    player_id?: string | null;
    payload?: Record<string, any>;
  }) {
    if (!match) return;

    eventSeqRef.current += 1;
    const nextSeq = eventSeqRef.current;

    const { data, error } = await supabase
      .from("match_events")
      .insert({
        org_id: match.org_id,
        match_id: match.id,
        seq: nextSeq,
        event_type: params.event_type,
        team_side: params.team_side || null,
        player_id: params.player_id || null,
        period_index: currentPeriodIndex,
        game_clock_ms: clockMsRef.current,
        shot_clock_s: shotClockS,
        payload: params.payload || {},
      })
      .select("id, seq, event_type, team_side, period_index, game_clock_ms, shot_clock_s, payload, created_at")
      .maybeSingle();

    if (error) {
      toast(`Erreur journal événement : ${error.message}`, "error");
      return;
    }

    if (data) {
      setEvents((prev) => [data as MatchEventRow, ...prev].slice(0, 50));

    }
  }

  async function pushPatch(extra: Record<string, any>) {
    if (!match) return;

    const payload = {
      match_id: match.id,
      match_name: matchName,
      venue: org?.name || "",
      sport,
      status,
      home_name: homeName,
      away_name: awayName,
      home_score: homeScore,
      away_score: awayScore,
      clock_ms: clockMsRef.current,
      clock_running: clockRunningRef.current,
      period_label: periodLabel,

      show_score: displaySettings?.show_score ?? true,
      show_clock: displaySettings?.show_clock ?? true,
      show_period: displaySettings?.show_period ?? true,
      show_status: displaySettings?.show_status ?? true,
      show_lower_third: displaySettings?.show_lower_third ?? true,
      show_logos: displaySettings?.show_logos ?? true,
      show_sponsors: displaySettings?.show_sponsors ?? true,

      show_team_fouls: sportSettings?.show_team_fouls ?? false,
      show_player_fouls: sportSettings?.show_player_fouls ?? false,
      show_timeouts: sportSettings?.show_timeouts ?? false,
      show_bonus: sportSettings?.show_bonus ?? false,
      show_sets: sportSettings?.show_sets ?? false,
      show_cards: sportSettings?.show_cards ?? false,
      show_shot_clock: sportSettings?.show_shot_clock ?? false,

      layout_mode: displaySettings?.layout_mode ?? "stadium",

      home: { name: homeName },
      away: { name: awayName },

      home_team_fouls: homeTeamFouls,
      away_team_fouls: awayTeamFouls,
      home_timeouts: isHandball ? handballHomeTimeouts : isVolleyball ? volleyHomeTimeouts : homeTimeouts,
      away_timeouts: isHandball ? handballAwayTimeouts : isVolleyball ? volleyAwayTimeouts : awayTimeouts,
      home_bonus: homeBonus,
      away_bonus: awayBonus,
      shot_clock_s: shotClockS,
      home_sets_won: homeSetsWon,
      away_sets_won: awaySetsWon,
      home_yellow_cards: isFootball ? footballHomeYellows : homeYellowCards,
      away_yellow_cards: isFootball ? footballAwayYellows : awayYellowCards,
      home_red_cards: isFootball ? footballHomeReds : homeRedCards,
      away_red_cards: isFootball ? footballAwayReds : awayRedCards,
      home_players: homePlayers,
      away_players: awayPlayers,

      possession_arrow: possessionArrow,
      current_period_index: currentPeriodIndex,
      is_overtime: isOvertime,

      rugby_home_tries: rugbyHomeTries,
      rugby_away_tries: rugbyAwayTries,
      rugby_home_conversions: rugbyHomeConversions,
      rugby_away_conversions: rugbyAwayConversions,
      rugby_home_penalties: rugbyHomePenalties,
      rugby_away_penalties: rugbyAwayPenalties,
      rugby_home_drop_goals: rugbyHomeDrops,
      rugby_away_drop_goals: rugbyAwayDrops,
      rugby_home_yellow_sin_bin: rugbyHomeYellowSinBin,
      rugby_away_yellow_sin_bin: rugbyAwayYellowSinBin,
      rugby_home_sin_bin_active: rugbyHomeSinBinActive,
      rugby_away_sin_bin_active: rugbyAwaySinBinActive,
      rugby_extra_time: rugbyExtraTime,
      rugby_tiebreak_mode: rugbyTiebreakMode,

      handball_home_2min: handballHome2Min,
      handball_away_2min: handballAway2Min,
      handball_home_2min_active: handballHome2MinActive,
      handball_away_2min_active: handballAway2MinActive,
      handball_home_team_timeouts: handballHomeTimeouts,
      handball_away_team_timeouts: handballAwayTimeouts,
      handball_home_warnings: handballHomeWarnings,
      handball_away_warnings: handballAwayWarnings,
      handball_home_disqualifications: handballHomeDisq,
      handball_away_disqualifications: handballAwayDisq,
      handball_extra_time: handballExtraTime,
      handball_shootout_mode: handballShootoutMode,

      volleyball_home_timeouts: volleyHomeTimeouts,
      volleyball_away_timeouts: volleyAwayTimeouts,
      volleyball_home_set_points: volleyHomeSetPoints,
      volleyball_away_set_points: volleyAwaySetPoints,
      volleyball_home_serving: volleyHomeServing,
      volleyball_away_serving: volleyAwayServing,
      volleyball_current_set: volleyCurrentSet,
      volleyball_is_tiebreak: volleyIsTiebreak,

      football_home_yellow_cards: footballHomeYellows,
      football_away_yellow_cards: footballAwayYellows,
      football_home_red_cards: footballHomeReds,
      football_away_red_cards: footballAwayReds,
      football_home_penalty_shootout: footballHomePens,
      football_away_penalty_shootout: footballAwayPens,
      football_extra_time: footballExtraTime,
      football_added_time_first_half: footballAdded1,
      football_added_time_second_half: footballAdded2,
      football_added_time_extra_1: footballAddedEx1,
      football_added_time_extra_2: footballAddedEx2,

      ...extra,
      live_seq: nextLiveSeq(),
      clock_anchor_epoch: clockAnchorRef.current.epoch,
      clock_anchor_ms: clockAnchorRef.current.ms,
      emitted_at: Date.now(),
    };

    await sendTvBroadcast(match.id, payload);
  }

  async function saveMatch() {
    const payload: Partial<MatchRow> = {
      name: matchName.trim() || `${homeName} vs ${awayName}`,
      home_name: homeName,
      away_name: awayName,
      status,
      home_score: homeScore,
      away_score: awayScore,
      period_label: periodLabel,
      clock_ms: clockMs,
      clock_running: clockRunning,
      home_team_fouls: homeTeamFouls,
      away_team_fouls: awayTeamFouls,
      home_timeouts: homeTimeouts,
      away_timeouts: awayTimeouts,
      home_bonus: homeBonus,
      away_bonus: awayBonus,
      shot_clock_s: shotClockS,
      home_sets_won: homeSetsWon,
      away_sets_won: awaySetsWon,
      home_yellow_cards: homeYellowCards,
      away_yellow_cards: awayYellowCards,
      home_red_cards: homeRedCards,
      away_red_cards: awayRedCards,
      current_period_index: currentPeriodIndex,
      is_overtime: isOvertime,
      possession_arrow: possessionArrow,

      rugby_home_tries: rugbyHomeTries,
      rugby_away_tries: rugbyAwayTries,
      rugby_home_conversions: rugbyHomeConversions,
      rugby_away_conversions: rugbyAwayConversions,
      rugby_home_penalties: rugbyHomePenalties,
      rugby_away_penalties: rugbyAwayPenalties,
      rugby_home_drop_goals: rugbyHomeDrops,
      rugby_away_drop_goals: rugbyAwayDrops,
      rugby_home_yellow_sin_bin: rugbyHomeYellowSinBin,
      rugby_away_yellow_sin_bin: rugbyAwayYellowSinBin,
      rugby_home_sin_bin_active: rugbyHomeSinBinActive,
      rugby_away_sin_bin_active: rugbyAwaySinBinActive,
      rugby_extra_time: rugbyExtraTime,
      rugby_tiebreak_mode: rugbyTiebreakMode || null,

      handball_home_2min: handballHome2Min,
      handball_away_2min: handballAway2Min,
      handball_home_2min_active: handballHome2MinActive,
      handball_away_2min_active: handballAway2MinActive,
      handball_home_team_timeouts: handballHomeTimeouts,
      handball_away_team_timeouts: handballAwayTimeouts,
      handball_home_warnings: handballHomeWarnings,
      handball_away_warnings: handballAwayWarnings,
      handball_home_disqualifications: handballHomeDisq,
      handball_away_disqualifications: handballAwayDisq,
      handball_extra_time: handballExtraTime,
      handball_shootout_mode: handballShootoutMode || null,

      volleyball_home_timeouts: volleyHomeTimeouts,
      volleyball_away_timeouts: volleyAwayTimeouts,
      volleyball_home_set_points: volleyHomeSetPoints,
      volleyball_away_set_points: volleyAwaySetPoints,
      volleyball_home_serving: volleyHomeServing,
      volleyball_away_serving: volleyAwayServing,
      volleyball_current_set: volleyCurrentSet,
      volleyball_is_tiebreak: volleyIsTiebreak,

      football_home_yellow_cards: footballHomeYellows,
      football_away_yellow_cards: footballAwayYellows,
      football_home_red_cards: footballHomeReds,
      football_away_red_cards: footballAwayReds,
      football_home_penalty_shootout: footballHomePens,
      football_away_penalty_shootout: footballAwayPens,
      football_extra_time: footballExtraTime,
      football_added_time_first_half: footballAdded1,
      football_added_time_second_half: footballAdded2,
      football_added_time_extra_1: footballAddedEx1,
      football_added_time_extra_2: footballAddedEx2,
    };

    try {
      const pushP = pushPatch(payload);
      const persistP = persistLiveState(payload);
      // Also persist org sport if it was changed
      if (org?.id && org?.sport) {
        void supabase.from("orgs").update({ sport: org.sport }).eq("id", org.id);
      }
      await persistP;
      await pushP;
      toast("Match sauvegardé.", "success");
    } catch {}
  }

  async function archiveMatch() {
    if (!match) return;
    const ok = await confirm({
      title: "Archiver ce match ?",
      message: "Le match sera marqué comme archivé. Toutes les données (score, statistiques, événements) sont conservées et ne pourront plus être modifiées depuis la régie.",
      confirmLabel: "Archiver",
      cancelLabel: "Annuler",
      variant: "danger",
    });
    if (!ok) return;
    try {
      const { error } = await supabase.from("matches").update({ status: "archived" }).eq("id", match.id);
      if (error) { toast(error.message, "error"); return; }
      setStatus("archived");
      void pushPatch({ status: "archived" });
      toast("Match archivé.", "success");
    } catch (e: any) {
      toast(e?.message || "Erreur archivage.", "error");
    }
  }

  async function startClock() {
    const nextClockMs =
      clockMsRef.current > 0 ? clockMsRef.current : defaultClockMsBySport(sport, sportSettings?.period_duration_s);

    clockMsRef.current = nextClockMs;
    clockRunningRef.current = true;
    clockAnchorRef.current = { epoch: Date.now(), ms: nextClockMs };
    setClockMs(nextClockMs);
    setClockRunning(true);
    setStatus("live");

    try {
      const pushP = autoLive
        ? pushPatch({ clock_ms: nextClockMs, clock_running: true, status: "live" })
        : Promise.resolve(null);
      void persistLiveState({ clock_ms: nextClockMs, clock_running: true, status: "live" });
      await pushP;
    } catch {}
  }

  async function pauseClock() {
    const capturedClockMs = clockMsRef.current;
    clockRunningRef.current = false;
    setClockRunning(false);
    setStatus("paused");

    try {
      const pushP = autoLive
        ? pushPatch({ clock_running: false, status: "paused", clock_ms: capturedClockMs })
        : Promise.resolve(null);
      void persistLiveState({ clock_running: false, status: "paused", clock_ms: capturedClockMs });
      await pushP;
    } catch {}
  }

  async function resetClock() {
    const next = defaultClockMsBySport(sport, sportSettings?.period_duration_s);

    clockMsRef.current = next;
    clockRunningRef.current = false;
    clockAnchorRef.current = { epoch: Date.now(), ms: next };
    setClockMs(next);
    setClockRunning(false);

    try {
      const pushP = autoLive
        ? pushPatch({ clock_ms: next, clock_running: false })
        : Promise.resolve(null);
      void persistLiveState({ clock_ms: next, clock_running: false });
      await pushP;
    } catch {}
  }

  async function resetAll() {
    const defaultClock = defaultClockMsBySport(sport, sportSettings?.period_duration_s);
    const firstPeriod = periodOptions[0] || periodLabel;

    clockMsRef.current = defaultClock;
    clockRunningRef.current = false;
    clockAnchorRef.current = { epoch: Date.now(), ms: defaultClock };
    setClockMs(defaultClock);
    setClockRunning(false);
    setHomeScore(0);
    setAwayScore(0);
    setPeriodLabel(firstPeriod);
    setCurrentPeriodIndex(0);
    setIsOvertime(false);
    setHomeTeamFouls(0);
    setAwayTeamFouls(0);
    setHomeYellowCards(0);
    setAwayYellowCards(0);
    setHomeRedCards(0);
    setAwayRedCards(0);
    setHomeSetsWon(0);
    setAwaySetsWon(0);
    setHomeBonus(false);
    setAwayBonus(false);
    setShotClockS(0);
    setPossessionArrow("home");
    setHomeTimeouts(0);
    setAwayTimeouts(0);
    setRugbyHomeTries(0);
    setRugbyAwayTries(0);
    setRugbyHomeConversions(0);
    setRugbyAwayConversions(0);
    setRugbyHomePenalties(0);
    setRugbyAwayPenalties(0);
    setRugbyHomeDrops(0);
    setRugbyAwayDrops(0);
    setRugbyHomeYellowSinBin(0);
    setRugbyAwayYellowSinBin(0);
    setRugbyHomeSinBinActive(0);
    setRugbyAwaySinBinActive(0);
    setHandballHome2Min(0);
    setHandballAway2Min(0);
    setHandballHome2MinActive(0);
    setHandballAway2MinActive(0);
    setHandballHomeTimeouts(0);
    setHandballAwayTimeouts(0);
    setHandballHomeWarnings(0);
    setHandballAwayWarnings(0);
    setHandballHomeDisq(0);
    setHandballAwayDisq(0);
    setVolleyHomeSetPoints(0);
    setVolleyAwaySetPoints(0);
    setVolleyCurrentSet(1);
    setVolleyIsTiebreak(false);
    setFootballHomeYellows(0);
    setFootballAwayYellows(0);
    setFootballHomeReds(0);
    setFootballAwayReds(0);
    setFootballHomePens(0);
    setFootballAwayPens(0);
    setFootballAdded1(0);
    setFootballAdded2(0);
    setFootballAddedEx1(0);
    setFootballAddedEx2(0);

    const resetPatch = {
      home_score: 0,
      away_score: 0,
      clock_ms: defaultClock,
      clock_running: false,
      period_label: firstPeriod,
      current_period_index: 0,
      is_overtime: false,
      home_team_fouls: 0,
      away_team_fouls: 0,
      home_yellow_cards: 0,
      away_yellow_cards: 0,
      home_red_cards: 0,
      away_red_cards: 0,
      home_sets_won: 0,
      away_sets_won: 0,
      home_bonus: false,
      away_bonus: false,
      shot_clock_s: 0,
      possession_arrow: "home",
      home_timeouts: 0,
      away_timeouts: 0,
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
      football_home_yellow_cards: 0,
      football_away_yellow_cards: 0,
      football_home_red_cards: 0,
      football_away_red_cards: 0,
      football_home_penalty_shootout: 0,
      football_away_penalty_shootout: 0,
      football_added_time_first_half: 0,
      football_added_time_second_half: 0,
      football_added_time_extra_1: 0,
      football_added_time_extra_2: 0,
    };

    // Reset local UI state for sin bins, events, player stats
    setEvents([]);
    setRugbySuspensions([]);
    setHandballSuspensions([]);
    eventSeqRef.current = 0;
    const resetPlayers = (rows: PlayerStatRow[]) =>
      rows.map((p) => ({ ...p, fouls: 0, points: 0, yellow_cards: 0, red_cards: 0 }));
    setHomePlayers((prev) => resetPlayers(prev));
    setAwayPlayers((prev) => resetPlayers(prev));

    try {
      const pushP = autoLive ? pushPatch(resetPatch) : Promise.resolve(null);
      void persistLiveState(resetPatch as any);

      if (match) {
        const mid = match.id;
        await Promise.allSettled([
          supabase.from("match_events").delete().eq("match_id", mid),
          supabase.from("match_sin_bins").delete().eq("match_id", mid),
          supabase.from("match_two_min_suspensions").delete().eq("match_id", mid),
          supabase.from("match_players").update({ fouls: 0, points: 0, yellow_cards: 0, red_cards: 0 }).eq("match_id", mid),
        ]);
      }

      await pushP;
      toast("Régie réinitialisée.", "success");
    } catch {
      toast("Réinitialisation persistée, envoi à l'écran échoué.", "warning");
    }
  }

  async function adjustClock(deltaMs: number) {
    const next = Math.max(0, clockMsRef.current + deltaMs);
    clockMsRef.current = next;
    clockAnchorRef.current = { epoch: Date.now(), ms: next };
    setClockMs(next);

    try {
      const pushP = autoLive ? pushPatch({ clock_ms: next }) : Promise.resolve(null);
      void persistLiveState({ clock_ms: next });
      await pushP;
    } catch {}
  }

  async function changeScore(side: "home" | "away", delta: number) {
    if (!canScore) return;
    const nextHome = side === "home" ? Math.max(0, homeScore + delta) : homeScore;
    const nextAway = side === "away" ? Math.max(0, awayScore + delta) : awayScore;

    setHomeScore(nextHome);
    setAwayScore(nextAway);

    try {
      const pushP = autoLive
        ? pushPatch({ home_score: nextHome, away_score: nextAway })
        : Promise.resolve(null);
      void persistLiveState({ home_score: nextHome, away_score: nextAway });
      await pushP;
      void appendEvent({
        event_type: `${sport}_score`,
        team_side: side,
        payload: { delta, home_score: nextHome, away_score: nextAway },
      });
    } catch {}
  }

  async function changeTeamFouls(side: "home" | "away", delta: number) {
    const nextHome = side === "home" ? Math.max(0, homeTeamFouls + delta) : homeTeamFouls;
    const nextAway = side === "away" ? Math.max(0, awayTeamFouls + delta) : awayTeamFouls;

    setHomeTeamFouls(nextHome);
    setAwayTeamFouls(nextAway);

    try {
      const pushP = autoLive
        ? pushPatch({ home_team_fouls: nextHome, away_team_fouls: nextAway })
        : Promise.resolve(null);
      void persistLiveState({ home_team_fouls: nextHome, away_team_fouls: nextAway });
      await pushP;
      void appendEvent({
        event_type: `${sport}_team_foul`,
        team_side: side,
        payload: { home_team_fouls: nextHome, away_team_fouls: nextAway, delta },
      });
    } catch {}
  }

  async function changeSetsWon(side: "home" | "away", delta: number) {
    const nextHome = side === "home" ? Math.max(0, homeSetsWon + delta) : homeSetsWon;
    const nextAway = side === "away" ? Math.max(0, awaySetsWon + delta) : awaySetsWon;

    setHomeSetsWon(nextHome);
    setAwaySetsWon(nextAway);

    try {
      const pushP = autoLive
        ? pushPatch({ home_sets_won: nextHome, away_sets_won: nextAway })
        : Promise.resolve(null);
      void persistLiveState({ home_sets_won: nextHome, away_sets_won: nextAway });
      await pushP;
      void appendEvent({
        event_type: `${sport}_sets`,
        team_side: side,
        payload: { home_sets_won: nextHome, away_sets_won: nextAway, delta },
      });
    } catch {}
  }

  async function toggleBonus(side: "home" | "away") {
    const nextHome = side === "home" ? !homeBonus : homeBonus;
    const nextAway = side === "away" ? !awayBonus : awayBonus;

    setHomeBonus(nextHome);
    setAwayBonus(nextAway);

    try {
      const pushP = autoLive
        ? pushPatch({ home_bonus: nextHome, away_bonus: nextAway })
        : Promise.resolve(null);
      void persistLiveState({ home_bonus: nextHome, away_bonus: nextAway });
      await pushP;
      void appendEvent({
        event_type: `${sport}_bonus`,
        team_side: side,
        payload: { home_bonus: nextHome, away_bonus: nextAway },
      });
    } catch {}
  }

  async function changePlayerStat(
    side: "home" | "away",
    playerId: string,
    field: "fouls" | "points" | "yellow_cards" | "red_cards",
    delta: number,
  ) {
    if (!match) return;
    const source = side === "home" ? homePlayers : awayPlayers;
    const player = source.find((p) => p.id === playerId);
    if (!player) return;

    const currentValue =
      field === "fouls"
        ? player.fouls || 0
        : field === "points"
        ? player.points || 0
        : field === "yellow_cards"
        ? player.yellow_cards || 0
        : player.red_cards || 0;

    const nextValue = clampMin(currentValue + delta);

    const next = source.map((p) =>
      p.id === playerId
        ? { ...p, [field]: nextValue }
        : p,
    );

    if (side === "home") setHomePlayers(next);
    else setAwayPlayers(next);

    // For rugby, yellow/red card → also issue a sin bin entry with player name
    const isRugbyCard = sport === "rugby" && (field === "yellow_cards" || field === "red_cards") && delta === 1;
    if (isRugbyCard) {
      if (field === "yellow_cards") issueRugbyYellow(side, player);
      else issueRugbyRed(side, player);
    }

    const { error } = await supabase
      .from("match_players")
      .update({ [field]: nextValue })
      .eq("match_id", match.id)
      .eq("player_id", playerId);

    if (error) {
      toast(`Erreur statistique joueur : ${error.message}`, "error");
      return;
    }

    if (autoLive) {
      try {
        await pushPatch({ [side === "home" ? "home_players" : "away_players"]: next });
      } catch {}
    }

    await appendEvent({
      event_type: `${sport}_player_${field}`,
      team_side: side,
      player_id: playerId,
      payload: { field, delta, value: nextValue },
    });
  }

  async function setBasketPeriod(nextIndex: number) {
    const label = nextIndex <= 4 ? `Q${nextIndex}` : "OT";
    const ot = nextIndex > 4;
    const nextClock = ot ? 5 * 60 * 1000 : defaultClockMsBySport("basket", sportSettings?.period_duration_s);

    clockMsRef.current = nextClock;
    clockRunningRef.current = false;
    clockAnchorRef.current = { epoch: Date.now(), ms: nextClock };
    setCurrentPeriodIndex(nextIndex);
    setIsOvertime(ot);
    setPeriodLabel(label);
    setClockMs(nextClock);
    setClockRunning(false);
    setHomeTeamFouls(0);
    setAwayTeamFouls(0);

    try {
      const periodPatch = {
        current_period_index: nextIndex,
        is_overtime: ot,
        period_label: label,
        clock_ms: nextClock,
        clock_running: false,
        team_fouls_period_home: 0,
        team_fouls_period_away: 0,
        home_team_fouls: 0,
        away_team_fouls: 0,
      };
      const pushP = autoLive ? pushPatch(periodPatch) : Promise.resolve(null);
      void persistLiveState(periodPatch);
      await pushP;
      void appendEvent({
        event_type: "basket_period_change",
        payload: { current_period_index: nextIndex, period_label: label, is_overtime: ot },
      });
    } catch {}
  }

  async function togglePossessionArrow() {
    const next = possessionArrow === "home" ? "away" : "home";
    setPossessionArrow(next);
    try {
      const pushP = autoLive ? pushPatch({ possession_arrow: next }) : Promise.resolve(null);
      void persistLiveState({ possession_arrow: next });
      await pushP;
      void appendEvent({ event_type: "basket_possession_arrow", team_side: next, payload: { possession_arrow: next } });
    } catch {}
  }

  async function changeShotClock(delta: number | null, reset = false, directValue?: number) {
    const next =
      typeof directValue === "number"
        ? Math.max(0, directValue)
        : reset
        ? Number(sportSettings?.shot_clock_s || 24)
        : Math.max(0, shotClockS + (delta || 0));
    setShotClockS(next);
    try {
      const pushP = autoLive ? pushPatch({ shot_clock_s: next }) : Promise.resolve(null);
      void persistLiveState({ shot_clock_s: next });
      await pushP;
    } catch {}
  }

  async function applyRugbyScoring(side: "home" | "away", field: "tries" | "conversions" | "penalties" | "drops", delta: number) {
    if (!canScore) return;
    const currentHome = {
      tries: rugbyHomeTries,
      conversions: rugbyHomeConversions,
      penalties: rugbyHomePenalties,
      drops: rugbyHomeDrops,
    };
    const currentAway = {
      tries: rugbyAwayTries,
      conversions: rugbyAwayConversions,
      penalties: rugbyAwayPenalties,
      drops: rugbyAwayDrops,
    };

    const nextHome = {
      tries: side === "home" && field === "tries" ? clampMin(currentHome.tries + delta) : currentHome.tries,
      conversions: side === "home" && field === "conversions" ? clampMin(currentHome.conversions + delta) : currentHome.conversions,
      penalties: side === "home" && field === "penalties" ? clampMin(currentHome.penalties + delta) : currentHome.penalties,
      drops: side === "home" && field === "drops" ? clampMin(currentHome.drops + delta) : currentHome.drops,
    };
    const nextAway = {
      tries: side === "away" && field === "tries" ? clampMin(currentAway.tries + delta) : currentAway.tries,
      conversions: side === "away" && field === "conversions" ? clampMin(currentAway.conversions + delta) : currentAway.conversions,
      penalties: side === "away" && field === "penalties" ? clampMin(currentAway.penalties + delta) : currentAway.penalties,
      drops: side === "away" && field === "drops" ? clampMin(currentAway.drops + delta) : currentAway.drops,
    };

    setRugbyHomeTries(nextHome.tries);
    setRugbyHomeConversions(nextHome.conversions);
    setRugbyHomePenalties(nextHome.penalties);
    setRugbyHomeDrops(nextHome.drops);
    setRugbyAwayTries(nextAway.tries);
    setRugbyAwayConversions(nextAway.conversions);
    setRugbyAwayPenalties(nextAway.penalties);
    setRugbyAwayDrops(nextAway.drops);

    const nextHomeScore = recomputeRugbyScore(nextHome);
    const nextAwayScore = recomputeRugbyScore(nextAway);
    setHomeScore(nextHomeScore);
    setAwayScore(nextAwayScore);

    const patch: Partial<MatchRow> = {
      home_score: nextHomeScore,
      away_score: nextAwayScore,
      rugby_home_tries: nextHome.tries,
      rugby_home_conversions: nextHome.conversions,
      rugby_home_penalties: nextHome.penalties,
      rugby_home_drop_goals: nextHome.drops,
      rugby_away_tries: nextAway.tries,
      rugby_away_conversions: nextAway.conversions,
      rugby_away_penalties: nextAway.penalties,
      rugby_away_drop_goals: nextAway.drops,
    };

    try {
      const pushP = autoLive ? pushPatch(patch) : Promise.resolve(null);
      void persistLiveState(patch);
      await pushP;
      void appendEvent({
        event_type: `rugby_${field}`,
        team_side: side,
        payload: { delta, home: nextHome, away: nextAway, home_score: nextHomeScore, away_score: nextAwayScore },
      });
    } catch {}
  }

  async function issueRugbyYellow(side: "home" | "away", player?: PlayerStatRow | null) {
    const nextHomeYellow = side === "home" ? rugbyHomeYellowSinBin + 1 : rugbyHomeYellowSinBin;
    const nextAwayYellow = side === "away" ? rugbyAwayYellowSinBin + 1 : rugbyAwayYellowSinBin;
    const nextHomeActive = side === "home" ? rugbyHomeSinBinActive + 1 : rugbyHomeSinBinActive;
    const nextAwayActive = side === "away" ? rugbyAwaySinBinActive + 1 : rugbyAwaySinBinActive;

    setRugbyHomeYellowSinBin(nextHomeYellow);
    setRugbyAwayYellowSinBin(nextAwayYellow);
    setRugbyHomeSinBinActive(nextHomeActive);
    setRugbyAwaySinBinActive(nextAwayActive);

    const patch: Partial<MatchRow> = {
      rugby_home_yellow_sin_bin: nextHomeYellow,
      rugby_away_yellow_sin_bin: nextAwayYellow,
      rugby_home_sin_bin_active: nextHomeActive,
      rugby_away_sin_bin_active: nextAwayActive,
    };

    try {
      const pushP = autoLive ? pushPatch(patch) : Promise.resolve(null);
      void persistLiveState(patch);

      const { data } = await supabase
        .from("match_sin_bins")
        .insert({
          org_id: match!.org_id,
          match_id: match!.id,
          team_side: side,
          team_id: side === "home" ? match!.home_team_id || match!.team_id : match!.away_team_id,
          player_id: player?.id || null,
          player_name_snapshot: player?.name || null,
          shirt_number_snapshot: player?.number || null,
          started_game_clock_ms: clockMsRef.current,
          duration_s: 600,
          is_active: true,
        })
        .select("id, team_side, player_id, player_name_snapshot, shirt_number_snapshot, started_game_clock_ms, duration_s, ended_game_clock_ms, is_active, created_at")
        .maybeSingle();

      if (data) setRugbySuspensions((prev) => [data as SuspensionRow, ...prev]);

      // Also update player.yellow_cards in local state + DB
      if (player?.id) {
        const updatePlayers = (rows: PlayerStatRow[]) =>
          rows.map((p) => p.id === player.id ? { ...p, yellow_cards: (p.yellow_cards || 0) + 1 } : p);
        if (side === "home") setHomePlayers(updatePlayers);
        else setAwayPlayers(updatePlayers);
        void supabase.from("match_players").update({ yellow_cards: (player.yellow_cards || 0) + 1 }).eq("match_id", match!.id).eq("player_id", player.id);
      }

      await pushP;
      void appendEvent({
        event_type: "rugby_yellow_card",
        team_side: side,
        player_id: player?.id || null,
        payload: { player_name: player?.name || null, shirt_number: player?.number || null, duration_s: 600 },
      });
    } catch {}
  }

  async function endRugbySinBin(row: SuspensionRow) {
    const { error } = await supabase
      .from("match_sin_bins")
      .update({ is_active: false, ended_game_clock_ms: clockMsRef.current })
      .eq("id", row.id);

    if (error) {
      toast(error.message, "error");
      return;
    }

    const nextRows = rugbySuspensions.map((r) => (r.id === row.id ? { ...r, is_active: false, ended_game_clock_ms: clockMsRef.current } : r));
    setRugbySuspensions(nextRows);

    const nextHomeActive = nextRows.filter((r) => r.is_active && r.team_side === "home").length;
    const nextAwayActive = nextRows.filter((r) => r.is_active && r.team_side === "away").length;
    setRugbyHomeSinBinActive(nextHomeActive);
    setRugbyAwaySinBinActive(nextAwayActive);

    try {
      const sinBinPatch = {
        rugby_home_sin_bin_active: nextHomeActive,
        rugby_away_sin_bin_active: nextAwayActive,
      };
      const pushP = autoLive ? pushPatch(sinBinPatch) : Promise.resolve(null);
      void persistLiveState(sinBinPatch);
      await pushP;
      void appendEvent({
        event_type: "rugby_sin_bin_end",
        team_side: row.team_side,
        player_id: row.player_id,
        payload: { player_name: row.player_name_snapshot, shirt_number: row.shirt_number_snapshot },
      });
    } catch {}
  }

  async function issueRugbyRed(side: "home" | "away", player?: PlayerStatRow | null) {
    const nextHome = side === "home" ? homeRedCards + 1 : homeRedCards;
    const nextAway = side === "away" ? awayRedCards + 1 : awayRedCards;
    setHomeRedCards(nextHome);
    setAwayRedCards(nextAway);

    try {
      const pushP = autoLive
        ? pushPatch({ home_red_cards: nextHome, away_red_cards: nextAway })
        : Promise.resolve(null);
      void persistLiveState({ home_red_cards: nextHome, away_red_cards: nextAway });
      await pushP;
      // Also update player.red_cards in local state + DB
      if (player?.id) {
        const updatePlayersR = (rows: PlayerStatRow[]) =>
          rows.map((p) => p.id === player!.id ? { ...p, red_cards: (p.red_cards || 0) + 1 } : p);
        if (side === "home") setHomePlayers(updatePlayersR);
        else setAwayPlayers(updatePlayersR);
        void supabase.from("match_players").update({ red_cards: (player!.red_cards || 0) + 1 }).eq("match_id", match!.id).eq("player_id", player!.id);
      }

            void appendEvent({
        event_type: "rugby_red_card",
        team_side: side,
        player_id: player?.id || null,
        payload: { player_name: player?.name || null, shirt_number: player?.number || null },
      });
    } catch {}
  }

  async function issueHandball2Min(side: "home" | "away", player?: PlayerStatRow | null) {
    const nextHome = side === "home" ? handballHome2Min + 1 : handballHome2Min;
    const nextAway = side === "away" ? handballAway2Min + 1 : handballAway2Min;
    const nextHomeActive = side === "home" ? handballHome2MinActive + 1 : handballHome2MinActive;
    const nextAwayActive = side === "away" ? handballAway2MinActive + 1 : handballAway2MinActive;

    setHandballHome2Min(nextHome);
    setHandballAway2Min(nextAway);
    setHandballHome2MinActive(nextHomeActive);
    setHandballAway2MinActive(nextAwayActive);

    const patch: Partial<MatchRow> = {
      handball_home_2min: nextHome,
      handball_away_2min: nextAway,
      handball_home_2min_active: nextHomeActive,
      handball_away_2min_active: nextAwayActive,
    };

    try {
      const pushP = autoLive ? pushPatch(patch) : Promise.resolve(null);
      void persistLiveState(patch);

      const { data } = await supabase
        .from("match_two_min_suspensions")
        .insert({
          org_id: match!.org_id,
          match_id: match!.id,
          team_side: side,
          team_id: side === "home" ? match!.home_team_id || match!.team_id : match!.away_team_id,
          player_id: player?.id || null,
          player_name_snapshot: player?.name || null,
          shirt_number_snapshot: player?.number || null,
          started_game_clock_ms: clockMsRef.current,
          duration_s: 120,
          is_active: true,
        })
        .select("id, team_side, player_id, player_name_snapshot, shirt_number_snapshot, started_game_clock_ms, duration_s, ended_game_clock_ms, is_active, created_at")
        .maybeSingle();

      if (data) setHandballSuspensions((prev) => [data as SuspensionRow, ...prev]);

      await pushP;
      void appendEvent({
        event_type: "handball_2min",
        team_side: side,
        player_id: player?.id || null,
        payload: { player_name: player?.name || null, shirt_number: player?.number || null, duration_s: 120 },
      });
    } catch {}
  }

  async function endHandball2Min(row: SuspensionRow) {
    const { error } = await supabase
      .from("match_two_min_suspensions")
      .update({ is_active: false, ended_game_clock_ms: clockMsRef.current })
      .eq("id", row.id);

    if (error) {
      toast(error.message, "error");
      return;
    }

    const nextRows = handballSuspensions.map((r) => (r.id === row.id ? { ...r, is_active: false, ended_game_clock_ms: clockMsRef.current } : r));
    setHandballSuspensions(nextRows);

    const nextHomeActive = nextRows.filter((r) => r.is_active && r.team_side === "home").length;
    const nextAwayActive = nextRows.filter((r) => r.is_active && r.team_side === "away").length;
    setHandballHome2MinActive(nextHomeActive);
    setHandballAway2MinActive(nextAwayActive);

    try {
      const h2mEndPatch = {
        handball_home_2min_active: nextHomeActive,
        handball_away_2min_active: nextAwayActive,
      };
      const pushP = autoLive ? pushPatch(h2mEndPatch) : Promise.resolve(null);
      void persistLiveState(h2mEndPatch);
      await pushP;
      void appendEvent({
        event_type: "handball_2min_end",
        team_side: row.team_side,
        player_id: row.player_id,
        payload: { player_name: row.player_name_snapshot, shirt_number: row.shirt_number_snapshot },
      });
    } catch {}
  }

  async function issueHandballWarning(side: "home" | "away", player?: PlayerStatRow | null) {
    const nextHome = side === "home" ? handballHomeWarnings + 1 : handballHomeWarnings;
    const nextAway = side === "away" ? handballAwayWarnings + 1 : handballAwayWarnings;
    setHandballHomeWarnings(nextHome);
    setHandballAwayWarnings(nextAway);

    try {
      const warnPatch = { handball_home_warnings: nextHome, handball_away_warnings: nextAway };
      const pushP = autoLive ? pushPatch(warnPatch) : Promise.resolve(null);
      void persistLiveState(warnPatch);
      await pushP;
      void appendEvent({
        event_type: "handball_warning",
        team_side: side,
        player_id: player?.id || null,
        payload: { player_name: player?.name || null, shirt_number: player?.number || null },
      });
    } catch {}
  }

  async function issueHandballDisq(side: "home" | "away", player?: PlayerStatRow | null) {
    const nextHome = side === "home" ? handballHomeDisq + 1 : handballHomeDisq;
    const nextAway = side === "away" ? handballAwayDisq + 1 : handballAwayDisq;
    setHandballHomeDisq(nextHome);
    setHandballAwayDisq(nextAway);

    try {
      const disqPatch = { handball_home_disqualifications: nextHome, handball_away_disqualifications: nextAway };
      const pushP = autoLive ? pushPatch(disqPatch) : Promise.resolve(null);
      void persistLiveState(disqPatch);
      await pushP;
      void appendEvent({
        event_type: "handball_disqualification",
        team_side: side,
        player_id: player?.id || null,
        payload: { player_name: player?.name || null, shirt_number: player?.number || null },
      });
    } catch {}
  }

  async function updateVolleyPatch(patch: Partial<MatchRow>, eventType?: string, teamSide?: "home" | "away") {
    try {
      const pushP = autoLive ? pushPatch(patch as any) : Promise.resolve(null);
      void persistLiveState(patch);
      await pushP;
      if (eventType) void appendEvent({ event_type: eventType, team_side: teamSide || null, payload: patch as any });
    } catch {}
  }

  async function updateFootballPatch(patch: Partial<MatchRow>, eventType?: string, teamSide?: "home" | "away") {
    try {
      const pushP = autoLive ? pushPatch(patch as any) : Promise.resolve(null);
      void persistLiveState(patch);
      await pushP;
      if (eventType) void appendEvent({ event_type: eventType, team_side: teamSide || null, payload: patch as any });
    } catch {}
  }

  async function openFullscreen() {
    const el = document.documentElement as any;
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
      return;
    }
    await el.requestFullscreen?.().catch(() => {});
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.centerBox}>Chargement de la régie…</div>
      </div>
    );
  }

  if (err || !match) {
    return (
      <div style={styles.page}>
        <div style={styles.errorBox}>{err || "Match introuvable."}</div>
      </div>
    );
  }

  const displayHref = displayLink();
  const controlHref = controlLink();

  const showTeamFouls = !!sportSettings?.show_team_fouls;
  const showPlayerFouls = !!sportSettings?.show_player_fouls;
  const showTimeouts = !!sportSettings?.show_timeouts;
  const showBonus = !!sportSettings?.show_bonus;
  const showSets = !!sportSettings?.show_sets || isVolleyball;
  const showCards = !!sportSettings?.show_cards || isRugby || isHandball || isFootball;
  const showShotClock = !!sportSettings?.show_shot_clock;

  const activeRugbyHome = rugbySuspensions.filter((s) => s.is_active && s.team_side === "home");
  const activeRugbyAway = rugbySuspensions.filter((s) => s.is_active && s.team_side === "away");
  const activeHandHome = handballSuspensions.filter((s) => s.is_active && s.team_side === "home");
  const activeHandAway = handballSuspensions.filter((s) => s.is_active && s.team_side === "away");

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.topbar}>
          <div>
            <div style={styles.title}>Régie live</div>
            <div style={styles.subtitle}>
              {org?.name || "Organisation"} {team?.name ? `• ${team.name}` : ""} • {sport}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => nav(team?.id ? `/teams/${team.id}/matches` : "/teams")} style={styles.ghostBtn}>
              Retour
            </button>
            <button onClick={() => nav(`/matches/${match.id}/roster`)} style={styles.ghostBtn}>
              Feuille de match
            </button>
            <button onClick={openFullscreen} style={styles.ghostBtn}>
              Plein écran
            </button>
            <button onClick={() => nav("/display-settings")} style={styles.ghostBtn}>
              Paramètres d'affichage
            </button>
          </div>
        </div>

        <div style={styles.hero}>
          <div>
            <div style={styles.heroTitle}>{matchName}</div>
            <div style={styles.heroText}>
              Cette régie pilote le match courant. L’écran public utilise désormais une <b>URL stable par équipe</b>,
              adaptée à un affichage permanent. En mode <b>Auto live</b>, chaque action est persistée puis envoyée
              immédiatement à l’écran public.
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
              <label style={styles.switchRow}>
                <input type="checkbox" checked={autoLive} onChange={(e) => setAutoLive(e.target.checked)} />
                <span>Auto live</span>
              </label>
            </div>
          </div>

          <div style={styles.heroActions}>
            <button onClick={saveMatch} style={styles.primaryBtn}>
              Sauvegarder
            </button>
            <button
              onClick={async () => {
                const ok = await confirm({
                  title: "Réinitialiser toute la régie ?",
                  message: "Scores, chrono, statistiques et tous les compteurs seront remis à zéro. L’écran d’affichage sera mis à jour immédiatement.",
                  confirmLabel: "Réinitialiser",
                  cancelLabel: "Annuler",
                  variant: "danger",
                });
                if (ok) await resetAll();
              }}
              style={{ ...styles.ghostBtn, borderColor: "rgba(239,68,68,.5)", color: "#ef4444" }}
            >
              Réinitialiser tout
            </button>
            {displayHref ? (
              <a href={displayHref} target="_blank" rel="noreferrer" style={styles.linkBtn}>
                Ouvrir l'écran d'affichage
              </a>
            ) : null}
          </div>
        </div>

        <div style={styles.grid}>
          <section style={styles.panel}>
            <div style={styles.sectionTitle}>Préparation</div>

            <div style={styles.formGrid}>
              <Field label="Nom du match">
                <input value={matchName} onChange={(e) => setMatchName(e.target.value)} style={styles.input} />
              </Field>

              <Field label="Statut">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  style={styles.input}
                  disabled={status === "archived"}
                >
                  <option value="scheduled">À préparer</option>
                  <option value="live">En cours</option>
                  <option value="paused">Pause</option>
                  <option value="finished">Terminé</option>
                  {status === "archived" && <option value="archived">Archivé</option>}
                </select>
              </Field>

              <Field label="Équipe domicile">
                <input value={homeName} onChange={(e) => setHomeName(e.target.value)} style={styles.input} />
              </Field>

              <Field label="Équipe extérieure">
                <input value={awayName} onChange={(e) => setAwayName(e.target.value)} style={styles.input} />
              </Field>

              <Field label="Période">
                <select value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} style={styles.input}>
                  {periodOptions.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Sport">
                <select
                  value={sport}
                  onChange={(e) => {
                    const newSport = e.target.value;
                    setOrg((prev) => prev ? { ...prev, sport: newSport } : prev);
                  }}
                  style={styles.input}
                >
                  <option value="football">Football</option>
                  <option value="rugby">Rugby</option>
                  <option value="basketball">Basketball</option>
                  <option value="handball">Handball</option>
                  <option value="volleyball">Volleyball</option>
                  <option value="hockey">Hockey</option>
                  <option value="autres">Autres</option>
                </select>
              </Field>
            </div>

            {status === "finished" && (
              <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,.08)" }}>
                <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 10 }}>
                  Le match est terminé. Archivez-le pour le verrouiller et le conserver dans l'historique.
                </div>
                <button
                  onClick={archiveMatch}
                  style={{ ...styles.ghostBtn, borderColor: "rgba(148,163,184,.4)", color: "#94a3b8", display: "flex", alignItems: "center", gap: 8 }}
                >
                  📦 Archiver le match
                </button>
              </div>
            )}

            {status === "archived" && (
              <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,.08)", color: "#64748b", fontSize: 13 }}>
                ✅ Ce match est archivé — données verrouillées.
              </div>
            )}
          </section>

          <section style={styles.panel}>
            <div style={styles.sectionTitle}>QR & accès</div>

            <div style={styles.qrGrid}>
              <div style={styles.qrCard}>
                <div style={styles.qrTitle}>QR régie mobile</div>
                <div style={{ background: "white", padding: 8, borderRadius: 10, marginTop: 10, display: "inline-block" }}>
                  <QRCodeSVG value={controlHref} size={160} />
                </div>
              </div>

              <div style={styles.qrCard}>
                <div style={styles.qrTitle}>QR écran public stable équipe</div>
                {displayHref ? (
                  <div style={{ background: "white", padding: 8, borderRadius: 10, marginTop: 10, display: "inline-block" }}>
                    <QRCodeSVG value={displayHref} size={160} />
                  </div>
                ) : (
                  <div style={{ marginTop: 12, opacity: 0.7 }}>
                    Lien écran indisponible. Vérifie qu’une équipe stable est bien rattachée au match.
                  </div>
                )}
              </div>
            </div>
          </section>

          <section style={{ ...styles.panel, gridColumn: "1 / -1" }}>
            <div style={styles.sectionTitle}>Console live</div>

            <div style={styles.consoleGrid}>
              <div style={styles.teamCard}>
                <div style={styles.teamName}>{homeName}</div>
                <div style={styles.scoreValue}>{homeScore}</div>
                {!isRugby ? (
                <div style={styles.scoreActions}>
                  {scoreSteps.map((step) => (
                    <React.Fragment key={`home-${step}`}>
                      <button disabled={!canScore} onClick={() => changeScore("home", -step)} style={{ ...styles.ghostBtnSmall, opacity: canScore ? 1 : 0.35, cursor: canScore ? "pointer" : "not-allowed" }}>
                        -{step}
                      </button>
                      <button disabled={!canScore} onClick={() => changeScore("home", step)} style={{ ...styles.primaryBtnSmall, opacity: canScore ? 1 : 0.35, cursor: canScore ? "pointer" : "not-allowed" }}>
                        +{step}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
                ) : null}
              </div>

              <div style={styles.clockCard}>
                <div style={styles.clockLabel}>{periodLabel}</div>
                <div style={styles.clockValue}>{fmtClock(clockMs)}</div>
                <div style={{ opacity: 0.75, marginBottom: 12 }}>{clockRunning ? "Chrono actif" : "Chrono arrêté"}</div>

                <div style={styles.scoreActions}>
                  <button onClick={startClock} style={styles.primaryBtnSmall}>Start</button>
                  <button onClick={pauseClock} style={styles.ghostBtnSmall}>Pause</button>
                  <button onClick={resetClock} style={styles.ghostBtnSmall}>Réinit. horloge</button>
                </div>

                <div style={{ ...styles.scoreActions, marginTop: 12 }}>
                  <button onClick={() => adjustClock(-60_000)} style={styles.ghostBtnSmall}>-1 min</button>
                  <button onClick={() => adjustClock(60_000)} style={styles.ghostBtnSmall}>+1 min</button>
                  <button onClick={() => adjustClock(-1000)} style={styles.ghostBtnSmall}>-1 sec</button>
                  <button onClick={() => adjustClock(1000)} style={styles.ghostBtnSmall}>+1 sec</button>
                </div>

                {showShotClock ? (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 12, opacity: 0.72 }}>Shot clock</div>
                    <div style={{ fontSize: 28, fontWeight: 900, marginTop: 4 }}>{shotClockS}s</div>
                    <div style={{ ...styles.scoreActions, marginTop: 8 }}>
                      <button onClick={() => changeShotClock(-1)} style={styles.ghostBtnSmall}>-1</button>
                      <button onClick={() => changeShotClock(1)} style={styles.primaryBtnSmall}>+1</button>
                      <button onClick={() => changeShotClock(null, false, 14)} style={styles.ghostBtnSmall}>14</button>
                      <button onClick={() => changeShotClock(null, true)} style={styles.ghostBtnSmall}>24</button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div style={styles.teamCard}>
                <div style={styles.teamName}>{awayName}</div>
                <div style={styles.scoreValue}>{awayScore}</div>
                {!isRugby ? (
                <div style={styles.scoreActions}>
                  {scoreSteps.map((step) => (
                    <React.Fragment key={`away-${step}`}>
                      <button disabled={!canScore} onClick={() => changeScore("away", -step)} style={{ ...styles.ghostBtnSmall, opacity: canScore ? 1 : 0.35, cursor: canScore ? "pointer" : "not-allowed" }}>
                        -{step}
                      </button>
                      <button disabled={!canScore} onClick={() => changeScore("away", step)} style={{ ...styles.primaryBtnSmall, opacity: canScore ? 1 : 0.35, cursor: canScore ? "pointer" : "not-allowed" }}>
                        +{step}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
                ) : null}
              </div>
            </div>
          </section>

          {isBasket ? (
            <section style={{ ...styles.panel, gridColumn: "1 / -1" }}>
              <div style={styles.sectionTitle}>Mode basket</div>
              <div style={styles.modeGrid}>
                <div style={styles.statCard}>
                  <div style={styles.statCardTitle}>Périodes</div>
                  <div style={styles.scoreActions}>
                    {[1, 2, 3, 4].map((q) => (
                      <button
                        key={q}
                        onClick={() => setBasketPeriod(q)}
                        style={currentPeriodIndex === q && !isOvertime ? styles.primaryBtnSmall : styles.ghostBtnSmall}
                      >
                        Q{q}
                      </button>
                    ))}
                    <button onClick={() => setBasketPeriod(5)} style={isOvertime ? styles.primaryBtnSmall : styles.ghostBtnSmall}>
                      OT
                    </button>
                  </div>
                </div>

                <div style={styles.statCard}>
                  <div style={styles.statCardTitle}>Possession alternée</div>
                  <div style={styles.scoreActions}>
                    <button onClick={togglePossessionArrow} style={styles.primaryBtn}>
                      Flèche : {possessionArrow === "home" ? homeName : awayName}
                    </button>
                  </div>
                </div>

                <div style={styles.statCard}>
                  <div style={styles.statCardTitle}>Temps morts</div>
                  <div style={styles.scoreActions}>
                    <button
                      onClick={async () => {
                        const next = homeTimeouts + 1;
                        setHomeTimeouts(next);
                        try {
                          const pushP = autoLive ? pushPatch({ home_timeouts: next }) : Promise.resolve(null);
                          void persistLiveState({ home_timeouts: next });
                          await pushP;
                          void appendEvent({ event_type: "basket_timeout", team_side: "home", payload: { value: next } });
                        } catch {}
                      }}
                      style={styles.ghostBtnSmall}
                    >
                      TM {homeName}
                    </button>
                    <button
                      onClick={async () => {
                        const next = awayTimeouts + 1;
                        setAwayTimeouts(next);
                        try {
                          const pushP = autoLive ? pushPatch({ away_timeouts: next }) : Promise.resolve(null);
                          void persistLiveState({ away_timeouts: next });
                          await pushP;
                          void appendEvent({ event_type: "basket_timeout", team_side: "away", payload: { value: next } });
                        } catch {}
                      }}
                      style={styles.ghostBtnSmall}
                    >
                      TM {awayName}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {isRugby ? (
            <section style={{ ...styles.panel, gridColumn: "1 / -1" }}>
              <div style={styles.sectionTitle}>Mode rugby</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={styles.statCard}>
                  <div style={styles.statCardTitle}>Marque domicile — {homeName}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                    {[
                      { label: "Essai +5", minus: "Essai -5", field: "tries" as const, primary: true },
                      { label: "Transfo +2", minus: "Transfo -2", field: "conversions" as const },
                      { label: "Pénalité +3", minus: "Pénalité -3", field: "penalties" as const },
                      { label: "Drop +3", minus: "Drop -3", field: "drops" as const },
                    ].map(({ label, minus, field, primary }) => (
                      <div key={field} style={{ display: "flex", gap: 6 }}>
                        <button disabled={!canScore} onClick={() => applyRugbyScoring("home", field, 1)} style={primary ? { ...styles.primaryBtnSmall, flex: 1, opacity: canScore ? 1 : 0.35, cursor: canScore ? "pointer" : "not-allowed" } : { ...styles.ghostBtnSmall, flex: 1, opacity: canScore ? 1 : 0.35, cursor: canScore ? "pointer" : "not-allowed" }}>{label}</button>
                        <button disabled={!canScore} onClick={() => applyRugbyScoring("home", field, -1)} style={{ ...styles.ghostBtnSmall, flex: 1, opacity: canScore ? 0.7 : 0.25, cursor: canScore ? "pointer" : "not-allowed" }}>{minus}</button>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={styles.statCard}>
                  <div style={styles.statCardTitle}>Marque extérieure — {awayName}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                    {[
                      { label: "Essai +5", minus: "Essai -5", field: "tries" as const, primary: true },
                      { label: "Transfo +2", minus: "Transfo -2", field: "conversions" as const },
                      { label: "Pénalité +3", minus: "Pénalité -3", field: "penalties" as const },
                      { label: "Drop +3", minus: "Drop -3", field: "drops" as const },
                    ].map(({ label, minus, field, primary }) => (
                      <div key={field} style={{ display: "flex", gap: 6 }}>
                        <button disabled={!canScore} onClick={() => applyRugbyScoring("away", field, 1)} style={primary ? { ...styles.primaryBtnSmall, flex: 1, opacity: canScore ? 1 : 0.35, cursor: canScore ? "pointer" : "not-allowed" } : { ...styles.ghostBtnSmall, flex: 1, opacity: canScore ? 1 : 0.35, cursor: canScore ? "pointer" : "not-allowed" }}>{label}</button>
                        <button disabled={!canScore} onClick={() => applyRugbyScoring("away", field, -1)} style={{ ...styles.ghostBtnSmall, flex: 1, opacity: canScore ? 0.7 : 0.25, cursor: canScore ? "pointer" : "not-allowed" }}>{minus}</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {isHandball ? (
            <section style={{ ...styles.panel, gridColumn: "1 / -1" }}>
              <div style={styles.sectionTitle}>Mode handball</div>
              <div style={styles.modeGrid}>
                <div style={styles.statCard}>
                  <div style={styles.statCardTitle}>Temps morts d’équipe</div>
                  <div style={styles.scoreActions}>
                    <button
                      onClick={async () => {
                        const next = handballHomeTimeouts + 1;
                        setHandballHomeTimeouts(next);
                        try {
                          const tmPatch = { handball_home_team_timeouts: next, home_timeouts: next };
                          const pushP = autoLive ? pushPatch(tmPatch) : Promise.resolve(null);
                          void persistLiveState(tmPatch);
                          await pushP;
                          void appendEvent({ event_type: "handball_timeout", team_side: "home", payload: { value: next } });
                        } catch {}
                      }}
                      style={styles.ghostBtnSmall}
                    >
                      TM {homeName}
                    </button>
                    <button
                      onClick={async () => {
                        const next = handballAwayTimeouts + 1;
                        setHandballAwayTimeouts(next);
                        try {
                          const tmPatch = { handball_away_team_timeouts: next, away_timeouts: next };
                          const pushP = autoLive ? pushPatch(tmPatch) : Promise.resolve(null);
                          void persistLiveState(tmPatch);
                          await pushP;
                          void appendEvent({ event_type: "handball_timeout", team_side: "away", payload: { value: next } });
                        } catch {}
                      }}
                      style={styles.ghostBtnSmall}
                    >
                      TM {awayName}
                    </button>
                  </div>
                </div>

                <div style={styles.statCard}>
                  <div style={styles.statCardTitle}>Sanctions équipe</div>
                  <div style={styles.scoreActions}>
                    <button onClick={() => issueHandballWarning("home")} style={styles.ghostBtnSmall}>Avert. dom.</button>
                    <button onClick={() => issueHandballWarning("away")} style={styles.ghostBtnSmall}>Avert. ext.</button>
                    <button onClick={() => issueHandball2Min("home")} style={styles.ghostBtnSmall}>2 min dom.</button>
                    <button onClick={() => issueHandball2Min("away")} style={styles.ghostBtnSmall}>2 min ext.</button>
                    <button onClick={() => issueHandballDisq("home")} style={styles.ghostBtnSmall}>Disq. dom.</button>
                    <button onClick={() => issueHandballDisq("away")} style={styles.ghostBtnSmall}>Disq. ext.</button>
                  </div>
                </div>

                <div style={styles.statCard}>
                  <div style={styles.statCardTitle}>Paramètres handball</div>
                  <div style={{ display: "grid", gap: 10 }}>
                    <label style={styles.switchRow}>
                      <input
                        type="checkbox"
                        checked={handballExtraTime}
                        onChange={async (e) => {
                          const next = e.target.checked;
                          setHandballExtraTime(next);
                          try {
                            const pushP = autoLive ? pushPatch({ handball_extra_time: next }) : Promise.resolve(null);
                            void persistLiveState({ handball_extra_time: next });
                            await pushP;
                          } catch {}
                        }}
                      />
                      <span>Prolongation</span>
                    </label>
                    <Field label="Mode départage">
                      <input
                        value={handballShootoutMode}
                        onChange={(e) => setHandballShootoutMode(e.target.value)}
                        onBlur={async () => {
                          try {
                            const smPatch = { handball_shootout_mode: handballShootoutMode || null };
                            const pushP = autoLive ? pushPatch(smPatch) : Promise.resolve(null);
                            void persistLiveState(smPatch);
                            await pushP;
                          } catch {}
                        }}
                        style={styles.input}
                        placeholder="Ex: jets de 7m"
                      />
                    </Field>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {isVolleyball ? (
            <section style={{ ...styles.panel, gridColumn: "1 / -1" }}>
              <div style={styles.sectionTitle}>Mode volley</div>
              <div style={styles.modeGrid}>
                <div style={styles.statCard}>
                  <div style={styles.statCardTitle}>Points du set</div>
                  <div style={styles.scoreActions}>
                    <button
                      onClick={() => {
                        const next = volleyHomeSetPoints + 1;
                        setVolleyHomeSetPoints(next);
                        updateVolleyPatch({ volleyball_home_set_points: next }, "volleyball_point", "home");
                      }}
                      style={styles.primaryBtnSmall}
                    >
                      +1 {homeName}
                    </button>
                    <button
                      onClick={() => {
                        const next = Math.max(0, volleyHomeSetPoints - 1);
                        setVolleyHomeSetPoints(next);
                        updateVolleyPatch({ volleyball_home_set_points: next }, "volleyball_point_correction", "home");
                      }}
                      style={styles.ghostBtnSmall}
                    >
                      -1 {homeName}
                    </button>
                    <button
                      onClick={() => {
                        const next = volleyAwaySetPoints + 1;
                        setVolleyAwaySetPoints(next);
                        updateVolleyPatch({ volleyball_away_set_points: next }, "volleyball_point", "away");
                      }}
                      style={styles.primaryBtnSmall}
                    >
                      +1 {awayName}
                    </button>
                    <button
                      onClick={() => {
                        const next = Math.max(0, volleyAwaySetPoints - 1);
                        setVolleyAwaySetPoints(next);
                        updateVolleyPatch({ volleyball_away_set_points: next }, "volleyball_point_correction", "away");
                      }}
                      style={styles.ghostBtnSmall}
                    >
                      -1 {awayName}
                    </button>
                  </div>
                </div>

                <div style={styles.statCard}>
                  <div style={styles.statCardTitle}>Service</div>
                  <div style={styles.scoreActions}>
                    <button
                      onClick={() => {
                        setVolleyHomeServing(true);
                        setVolleyAwayServing(false);
                        updateVolleyPatch({ volleyball_home_serving: true, volleyball_away_serving: false }, "volleyball_service", "home");
                      }}
                      style={volleyHomeServing ? styles.primaryBtnSmall : styles.ghostBtnSmall}
                    >
                      Service {homeName}
                    </button>
                    <button
                      onClick={() => {
                        setVolleyHomeServing(false);
                        setVolleyAwayServing(true);
                        updateVolleyPatch({ volleyball_home_serving: false, volleyball_away_serving: true }, "volleyball_service", "away");
                      }}
                      style={volleyAwayServing ? styles.primaryBtnSmall : styles.ghostBtnSmall}
                    >
                      Service {awayName}
                    </button>
                  </div>
                </div>

                <div style={styles.statCard}>
                  <div style={styles.statCardTitle}>Set & temps morts</div>
                  <div style={styles.scoreActions}>
                    <button
                      onClick={() => {
                        const next = volleyHomeTimeouts + 1;
                        setVolleyHomeTimeouts(next);
                        updateVolleyPatch({ volleyball_home_timeouts: next }, "volleyball_timeout", "home");
                      }}
                      style={styles.ghostBtnSmall}
                    >
                      TM {homeName}
                    </button>
                    <button
                      onClick={() => {
                        const next = volleyAwayTimeouts + 1;
                        setVolleyAwayTimeouts(next);
                        updateVolleyPatch({ volleyball_away_timeouts: next }, "volleyball_timeout", "away");
                      }}
                      style={styles.ghostBtnSmall}
                    >
                      TM {awayName}
                    </button>
                    <button
                      onClick={() => {
                        const next = homeSetsWon + 1;
                        setHomeSetsWon(next);
                        updateVolleyPatch({ home_sets_won: next }, "volleyball_set_win", "home");
                      }}
                      style={styles.primaryBtnSmall}
                    >
                      Set {homeName}
                    </button>
                    <button
                      onClick={() => {
                        const next = awaySetsWon + 1;
                        setAwaySetsWon(next);
                        updateVolleyPatch({ away_sets_won: next }, "volleyball_set_win", "away");
                      }}
                      style={styles.primaryBtnSmall}
                    >
                      Set {awayName}
                    </button>
                    <button
                      onClick={() => {
                        const next = volleyCurrentSet + 1;
                        setVolleyCurrentSet(next);
                        setVolleyHomeSetPoints(0);
                        setVolleyAwaySetPoints(0);
                        updateVolleyPatch({
                          volleyball_current_set: next,
                          volleyball_home_set_points: 0,
                          volleyball_away_set_points: 0,
                        }, "volleyball_next_set");
                      }}
                      style={styles.ghostBtnSmall}
                    >
                      Set suivant
                    </button>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {isFootball ? (
            <section style={{ ...styles.panel, gridColumn: "1 / -1" }}>
              <div style={styles.sectionTitle}>Mode football</div>
              <div style={styles.modeGrid}>
                <div style={styles.statCard}>
                  <div style={styles.statCardTitle}>Cartons</div>
                  <div style={styles.scoreActions}>
                    <button
                      onClick={() => {
                        const next = footballHomeYellows + 1;
                        setFootballHomeYellows(next);
                        updateFootballPatch({ football_home_yellow_cards: next }, "football_yellow", "home");
                      }}
                      style={styles.ghostBtnSmall}
                    >
                      Jaune {homeName}
                    </button>
                    <button
                      onClick={() => {
                        const next = footballAwayYellows + 1;
                        setFootballAwayYellows(next);
                        updateFootballPatch({ football_away_yellow_cards: next }, "football_yellow", "away");
                      }}
                      style={styles.ghostBtnSmall}
                    >
                      Jaune {awayName}
                    </button>
                    <button
                      onClick={() => {
                        const next = footballHomeReds + 1;
                        setFootballHomeReds(next);
                        updateFootballPatch({ football_home_red_cards: next }, "football_red", "home");
                      }}
                      style={styles.ghostBtnSmall}
                    >
                      Rouge {homeName}
                    </button>
                    <button
                      onClick={() => {
                        const next = footballAwayReds + 1;
                        setFootballAwayReds(next);
                        updateFootballPatch({ football_away_red_cards: next }, "football_red", "away");
                      }}
                      style={styles.ghostBtnSmall}
                    >
                      Rouge {awayName}
                    </button>
                  </div>
                </div>

                <div style={styles.statCard}>
                  <div style={styles.statCardTitle}>Prolongation & TAB</div>
                  <div style={{ display: "grid", gap: 10 }}>
                    <label style={styles.switchRow}>
                      <input
                        type="checkbox"
                        checked={footballExtraTime}
                        onChange={(e) => {
                          const next = e.target.checked;
                          setFootballExtraTime(next);
                          updateFootballPatch({ football_extra_time: next }, "football_extra_time");
                        }}
                      />
                      <span>Prolongation</span>
                    </label>
                    <div style={styles.scoreActions}>
                      <button
                        onClick={() => {
                          const next = footballHomePens + 1;
                          setFootballHomePens(next);
                          updateFootballPatch({ football_home_penalty_shootout: next }, "football_penalty_shootout", "home");
                        }}
                        style={styles.ghostBtnSmall}
                      >
                        TAB {homeName}
                      </button>
                      <button
                        onClick={() => {
                          const next = footballAwayPens + 1;
                          setFootballAwayPens(next);
                          updateFootballPatch({ football_away_penalty_shootout: next }, "football_penalty_shootout", "away");
                        }}
                        style={styles.ghostBtnSmall}
                      >
                        TAB {awayName}
                      </button>
                    </div>
                  </div>
                </div>

                <div style={styles.statCard}>
                  <div style={styles.statCardTitle}>Temps additionnel</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    <Field label="1re mi-temps">
                      <input
                        value={footballAdded1}
                        onChange={(e) => setFootballAdded1(Number(e.target.value || 0))}
                        onBlur={() => updateFootballPatch({ football_added_time_first_half: footballAdded1 }, "football_added_time")}
                        style={styles.input}
                        type="number"
                      />
                    </Field>
                    <Field label="2e mi-temps">
                      <input
                        value={footballAdded2}
                        onChange={(e) => setFootballAdded2(Number(e.target.value || 0))}
                        onBlur={() => updateFootballPatch({ football_added_time_second_half: footballAdded2 }, "football_added_time")}
                        style={styles.input}
                        type="number"
                      />
                    </Field>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {(showTeamFouls || showTimeouts || showBonus || showSets || showCards) ? (
            <section style={{ ...styles.panel, gridColumn: "1 / -1" }}>
              <div style={styles.sectionTitle}>Statistiques de match</div>

              <div style={styles.statsGrid}>
                {showTeamFouls ? (
                  <StatPairCard
                    title="Fautes équipe"
                    leftValue={homeTeamFouls}
                    rightValue={awayTeamFouls}
                    leftLabel={homeName}
                    rightLabel={awayName}
                    onLeftMinus={() => changeTeamFouls("home", -1)}
                    onLeftPlus={() => changeTeamFouls("home", 1)}
                    onRightMinus={() => changeTeamFouls("away", -1)}
                    onRightPlus={() => changeTeamFouls("away", 1)}
                  />
                ) : null}

                {showTimeouts ? (
                  <StatPairCard
                    title="Temps morts"
                    leftValue={isHandball ? handballHomeTimeouts : isVolleyball ? volleyHomeTimeouts : homeTimeouts}
                    rightValue={isHandball ? handballAwayTimeouts : isVolleyball ? volleyAwayTimeouts : awayTimeouts}
                    leftLabel={homeName}
                    rightLabel={awayName}
                    onLeftMinus={() => {}}
                    onLeftPlus={() => {}}
                    onRightMinus={() => {}}
                    onRightPlus={() => {}}
                  />
                ) : null}

                {showSets ? (
                  <StatPairCard
                    title="Sets gagnés"
                    leftValue={homeSetsWon}
                    rightValue={awaySetsWon}
                    leftLabel={homeName}
                    rightLabel={awayName}
                    onLeftMinus={() => changeSetsWon("home", -1)}
                    onLeftPlus={() => changeSetsWon("home", 1)}
                    onRightMinus={() => changeSetsWon("away", -1)}
                    onRightPlus={() => changeSetsWon("away", 1)}
                  />
                ) : null}

                {showCards ? (
                  <div style={styles.statCard}>
                    <div style={styles.statCardTitle}>Cartons / sanctions</div>
                    <div style={styles.cardsGrid}>
                      <MiniStat
                        title={`${homeName} • Cartons jaunes`}
                        value={isRugby ? rugbyHomeYellowSinBin : isFootball ? footballHomeYellows : homeYellowCards}
                        onPlus={isRugby ? async () => { const p = await pick({ title: `Carton jaune — ${homeName}`, players: homePlayers }); if (p !== undefined) issueRugbyYellow("home", p ? { id: p.id, team_id: "", name: p.name, number: p.number, fouls: 0 } : null); } : isFootball ? async () => { const picked = await pick({ title: `Carton jaune — ${homeName}`, players: homePlayers }); if (picked === undefined) return; const n = footballHomeYellows + 1; setFootballHomeYellows(n); if (picked?.id) { setHomePlayers((rows) => rows.map((p) => p.id === picked.id ? { ...p, yellow_cards: (p.yellow_cards || 0) + 1 } : p)); void supabase.from("match_players").update({ yellow_cards: (homePlayers.find((p) => p.id === picked.id)?.yellow_cards || 0) + 1 }).eq("match_id", match!.id).eq("player_id", picked.id); } try { const pp = autoLive ? pushPatch({ football_home_yellow_cards: n, home_yellow_cards: n }) : null; void persistLiveState({ football_home_yellow_cards: n, home_yellow_cards: n }); await pp; } catch {} } : async () => { const picked = await pick({ title: `Carton jaune — ${homeName}`, players: homePlayers }); if (picked === undefined) return; const n = homeYellowCards + 1; setHomeYellowCards(n); if (picked?.id) { setHomePlayers((rows) => rows.map((p) => p.id === picked.id ? { ...p, yellow_cards: (p.yellow_cards || 0) + 1 } : p)); void supabase.from("match_players").update({ yellow_cards: (homePlayers.find((p) => p.id === picked.id)?.yellow_cards || 0) + 1 }).eq("match_id", match!.id).eq("player_id", picked.id); } try { const pp = autoLive ? pushPatch({ home_yellow_cards: n }) : null; void persistLiveState({ home_yellow_cards: n }); await pp; } catch {} }}
                        onMinus={async () => { if (isRugby) { const n = Math.max(0, rugbyHomeYellowSinBin - 1); const na = Math.max(0, rugbyHomeSinBinActive - 1); setRugbyHomeYellowSinBin(n); setRugbyHomeSinBinActive(na); try { const patch = { rugby_home_yellow_sin_bin: n, rugby_home_sin_bin_active: na }; const p = autoLive ? pushPatch(patch) : null; void persistLiveState(patch); await p; } catch {} } else if (isFootball) { const n = Math.max(0, footballHomeYellows - 1); setFootballHomeYellows(n); try { const p = autoLive ? pushPatch({ football_home_yellow_cards: n, home_yellow_cards: n }) : null; void persistLiveState({ football_home_yellow_cards: n, home_yellow_cards: n }); await p; } catch {} } else { const n = Math.max(0, homeYellowCards - 1); setHomeYellowCards(n); try { const p = autoLive ? pushPatch({ home_yellow_cards: n }) : null; void persistLiveState({ home_yellow_cards: n }); await p; } catch {} } }}
                      />
                      <MiniStat
                        title={`${awayName} • Cartons jaunes`}
                        value={isRugby ? rugbyAwayYellowSinBin : isFootball ? footballAwayYellows : awayYellowCards}
                        onPlus={isRugby ? async () => { const p = await pick({ title: `Carton jaune — ${awayName}`, players: awayPlayers }); if (p !== undefined) issueRugbyYellow("away", p ? { id: p.id, team_id: "", name: p.name, number: p.number, fouls: 0 } : null); } : isFootball ? async () => { const picked = await pick({ title: `Carton jaune — ${awayName}`, players: awayPlayers }); if (picked === undefined) return; const n = footballAwayYellows + 1; setFootballAwayYellows(n); if (picked?.id) { setAwayPlayers((rows) => rows.map((p) => p.id === picked.id ? { ...p, yellow_cards: (p.yellow_cards || 0) + 1 } : p)); void supabase.from("match_players").update({ yellow_cards: (awayPlayers.find((p) => p.id === picked.id)?.yellow_cards || 0) + 1 }).eq("match_id", match!.id).eq("player_id", picked.id); } try { const pp = autoLive ? pushPatch({ football_away_yellow_cards: n, away_yellow_cards: n }) : null; void persistLiveState({ football_away_yellow_cards: n, away_yellow_cards: n }); await pp; } catch {} } : async () => { const picked = await pick({ title: `Carton jaune — ${awayName}`, players: awayPlayers }); if (picked === undefined) return; const n = awayYellowCards + 1; setAwayYellowCards(n); if (picked?.id) { setAwayPlayers((rows) => rows.map((p) => p.id === picked.id ? { ...p, yellow_cards: (p.yellow_cards || 0) + 1 } : p)); void supabase.from("match_players").update({ yellow_cards: (awayPlayers.find((p) => p.id === picked.id)?.yellow_cards || 0) + 1 }).eq("match_id", match!.id).eq("player_id", picked.id); } try { const pp = autoLive ? pushPatch({ away_yellow_cards: n }) : null; void persistLiveState({ away_yellow_cards: n }); await pp; } catch {} }}
                        onMinus={async () => { if (isRugby) { const n = Math.max(0, rugbyAwayYellowSinBin - 1); const na = Math.max(0, rugbyAwaySinBinActive - 1); setRugbyAwayYellowSinBin(n); setRugbyAwaySinBinActive(na); try { const patch = { rugby_away_yellow_sin_bin: n, rugby_away_sin_bin_active: na }; const p = autoLive ? pushPatch(patch) : null; void persistLiveState(patch); await p; } catch {} } else if (isFootball) { const n = Math.max(0, footballAwayYellows - 1); setFootballAwayYellows(n); try { const p = autoLive ? pushPatch({ football_away_yellow_cards: n, away_yellow_cards: n }) : null; void persistLiveState({ football_away_yellow_cards: n, away_yellow_cards: n }); await p; } catch {} } else { const n = Math.max(0, awayYellowCards - 1); setAwayYellowCards(n); try { const p = autoLive ? pushPatch({ away_yellow_cards: n }) : null; void persistLiveState({ away_yellow_cards: n }); await p; } catch {} } }}
                      />
                      <MiniStat
                        title={`${homeName} • Cartons rouges`}
                        value={isFootball ? footballHomeReds : homeRedCards}
                        onPlus={isRugby ? async () => { const p = await pick({ title: `Carton rouge — ${homeName}`, players: homePlayers }); if (p !== undefined) issueRugbyRed("home", p ? { id: p.id, team_id: "", name: p.name, number: p.number, fouls: 0 } : null); } : isFootball ? async () => { const picked = await pick({ title: `Carton rouge — ${homeName}`, players: homePlayers }); if (picked === undefined) return; const n = footballHomeReds + 1; setFootballHomeReds(n); if (picked?.id) { setHomePlayers((rows) => rows.map((p) => p.id === picked.id ? { ...p, red_cards: (p.red_cards || 0) + 1 } : p)); void supabase.from("match_players").update({ red_cards: (homePlayers.find((p) => p.id === picked.id)?.red_cards || 0) + 1 }).eq("match_id", match!.id).eq("player_id", picked.id); } try { const pp = autoLive ? pushPatch({ football_home_red_cards: n, home_red_cards: n }) : null; void persistLiveState({ football_home_red_cards: n, home_red_cards: n }); await pp; } catch {} } : async () => { const picked = await pick({ title: `Carton rouge — ${homeName}`, players: homePlayers }); if (picked === undefined) return; const n = homeRedCards + 1; setHomeRedCards(n); if (picked?.id) { setHomePlayers((rows) => rows.map((p) => p.id === picked.id ? { ...p, red_cards: (p.red_cards || 0) + 1 } : p)); void supabase.from("match_players").update({ red_cards: (homePlayers.find((p) => p.id === picked.id)?.red_cards || 0) + 1 }).eq("match_id", match!.id).eq("player_id", picked.id); } try { const pp = autoLive ? pushPatch({ home_red_cards: n }) : null; void persistLiveState({ home_red_cards: n }); await pp; } catch {} }}
                        onMinus={async () => { if (isFootball) { const n = Math.max(0, footballHomeReds - 1); setFootballHomeReds(n); try { const p = autoLive ? pushPatch({ football_home_red_cards: n, home_red_cards: n }) : null; void persistLiveState({ football_home_red_cards: n, home_red_cards: n }); await p; } catch {} } else { const n = Math.max(0, homeRedCards - 1); setHomeRedCards(n); try { const p = autoLive ? pushPatch({ home_red_cards: n }) : null; void persistLiveState({ home_red_cards: n }); await p; } catch {} } }}
                      />
                      <MiniStat
                        title={`${awayName} • Cartons rouges`}
                        value={isFootball ? footballAwayReds : awayRedCards}
                        onPlus={isRugby ? async () => { const p = await pick({ title: `Carton rouge — ${awayName}`, players: awayPlayers }); if (p !== undefined) issueRugbyRed("away", p ? { id: p.id, team_id: "", name: p.name, number: p.number, fouls: 0 } : null); } : isFootball ? async () => { const picked = await pick({ title: `Carton rouge — ${awayName}`, players: awayPlayers }); if (picked === undefined) return; const n = footballAwayReds + 1; setFootballAwayReds(n); if (picked?.id) { setAwayPlayers((rows) => rows.map((p) => p.id === picked.id ? { ...p, red_cards: (p.red_cards || 0) + 1 } : p)); void supabase.from("match_players").update({ red_cards: (awayPlayers.find((p) => p.id === picked.id)?.red_cards || 0) + 1 }).eq("match_id", match!.id).eq("player_id", picked.id); } try { const pp = autoLive ? pushPatch({ football_away_red_cards: n, away_red_cards: n }) : null; void persistLiveState({ football_away_red_cards: n, away_red_cards: n }); await pp; } catch {} } : async () => { const picked = await pick({ title: `Carton rouge — ${awayName}`, players: awayPlayers }); if (picked === undefined) return; const n = awayRedCards + 1; setAwayRedCards(n); if (picked?.id) { setAwayPlayers((rows) => rows.map((p) => p.id === picked.id ? { ...p, red_cards: (p.red_cards || 0) + 1 } : p)); void supabase.from("match_players").update({ red_cards: (awayPlayers.find((p) => p.id === picked.id)?.red_cards || 0) + 1 }).eq("match_id", match!.id).eq("player_id", picked.id); } try { const pp = autoLive ? pushPatch({ away_red_cards: n }) : null; void persistLiveState({ away_red_cards: n }); await pp; } catch {} }}
                        onMinus={async () => { if (isFootball) { const n = Math.max(0, footballAwayReds - 1); setFootballAwayReds(n); try { const p = autoLive ? pushPatch({ football_away_red_cards: n, away_red_cards: n }) : null; void persistLiveState({ football_away_red_cards: n, away_red_cards: n }); await p; } catch {} } else { const n = Math.max(0, awayRedCards - 1); setAwayRedCards(n); try { const p = autoLive ? pushPatch({ away_red_cards: n }) : null; void persistLiveState({ away_red_cards: n }); await p; } catch {} } }}
                      />
                    </div>
                  </div>
                ) : null}

                {showBonus ? (
                  <div style={styles.statCard}>
                    <div style={styles.statCardTitle}>Bonus</div>
                    <div style={styles.bonusGrid}>
                      <button onClick={() => toggleBonus("home")} style={homeBonus ? styles.primaryBtn : styles.ghostBtn}>
                        {homeName} : {homeBonus ? "ON" : "OFF"}
                      </button>
                      <button onClick={() => toggleBonus("away")} style={awayBonus ? styles.primaryBtn : styles.ghostBtn}>
                        {awayName} : {awayBonus ? "ON" : "OFF"}
                      </button>
                    </div>
                  </div>
                ) : null}

                {isRugby ? (
                  <div style={styles.statCard}>
                    <div style={styles.statCardTitle}>Détail score rugby</div>
                    <div style={{ display: "grid", gap: 8 }}>
                      <div>{homeName} • E {rugbyHomeTries} • T {rugbyHomeConversions} • P {rugbyHomePenalties} • D {rugbyHomeDrops}</div>
                      <div>{awayName} • E {rugbyAwayTries} • T {rugbyAwayConversions} • P {rugbyAwayPenalties} • D {rugbyAwayDrops}</div>
                    </div>
                  </div>
                ) : null}

                {isHandball ? (
                  <div style={styles.statCard}>
                    <div style={styles.statCardTitle}>Sanctions handball</div>
                    <div style={{ display: "grid", gap: 8 }}>
                      <div>{homeName} • Avert. {handballHomeWarnings} • 2 min {handballHome2Min} • Disq. {handballHomeDisq}</div>
                      <div>{awayName} • Avert. {handballAwayWarnings} • 2 min {handballAway2Min} • Disq. {handballAwayDisq}</div>
                    </div>
                  </div>
                ) : null}

                {isVolleyball ? (
                  <div style={styles.statCard}>
                    <div style={styles.statCardTitle}>Set courant</div>
                    <div style={{ display: "grid", gap: 8 }}>
                      <div>Set {volleyCurrentSet}{volleyIsTiebreak ? " • Tie-break" : ""}</div>
                      <div>{homeName} : {volleyHomeSetPoints} {volleyHomeServing ? "• Service" : ""}</div>
                      <div>{awayName} : {volleyAwaySetPoints} {volleyAwayServing ? "• Service" : ""}</div>
                    </div>
                  </div>
                ) : null}

                {isFootball ? (
                  <div style={styles.statCard}>
                    <div style={styles.statCardTitle}>Tirs au but / temps additionnel</div>
                    <div style={{ display: "grid", gap: 8 }}>
                      <div>TAB : {homeName} {footballHomePens} - {footballAwayPens} {awayName}</div>
                      <div>+ 1MT {footballAdded1} min • + 2MT {footballAdded2} min</div>
                      <div>{footballExtraTime ? "Prolongation activée" : "Pas de prolongation"}</div>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {isRugby && (activeRugbyHome.length > 0 || activeRugbyAway.length > 0) ? (
            <section style={{ ...styles.panel, gridColumn: "1 / -1" }}>
              <div style={styles.sectionTitle}>Exclusions temporaires en cours</div>
              <div style={{ display: "grid", gap: 8 }}>
                {[...activeRugbyHome, ...activeRugbyAway].map((row) => (
                  <div key={row.id} style={styles.eventRow}>
                    <div style={styles.eventMain}>
                      <div style={styles.eventType}>
                        {row.team_side === "home" ? homeName : awayName} • Excl. temporaire active
                      </div>
                      <div style={styles.eventMeta}>
                        {row.player_name_snapshot || "Joueur non renseigné"} {row.shirt_number_snapshot ? `• #${row.shirt_number_snapshot}` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button onClick={() => endRugbySinBin(row)} style={styles.primaryBtnSmall}>Lever l’exclusion</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {isHandball && (activeHandHome.length > 0 || activeHandAway.length > 0) ? (
            <section style={{ ...styles.panel, gridColumn: "1 / -1" }}>
              <div style={styles.sectionTitle}>Exclusions 2 minutes actives</div>
              <div style={{ display: "grid", gap: 8 }}>
                {[...activeHandHome, ...activeHandAway].map((row) => (
                  <div key={row.id} style={styles.eventRow}>
                    <div style={styles.eventMain}>
                      <div style={styles.eventType}>
                        {row.team_side === "home" ? homeName : awayName} • 2 min active
                      </div>
                      <div style={styles.eventMeta}>
                        {row.player_name_snapshot || "Joueur non renseigné"} {row.shirt_number_snapshot ? `• #${row.shirt_number_snapshot}` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button onClick={() => endHandball2Min(row)} style={styles.primaryBtnSmall}>Clôturer</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {showPlayerFouls ? (
            <section style={{ ...styles.panel, gridColumn: "1 / -1" }}>
              <div style={styles.sectionTitle}>Statistiques joueurs</div>

              <div style={styles.playerTablesGrid}>
                <PlayerStatsTable
                  title={homeName}
                  players={homePlayers}
                  maxFouls={sportSettings?.max_player_fouls ?? null}
                  sport={sport}
                  onChange={(playerId, field, delta) => changePlayerStat("home", playerId, field, delta)}
                />
                <PlayerStatsTable
                  title={awayName}
                  players={awayPlayers}
                  maxFouls={sportSettings?.max_player_fouls ?? null}
                  sport={sport}
                  onChange={(playerId, field, delta) => changePlayerStat("away", playerId, field, delta)}
                />
              </div>
            </section>
          ) : null}

          <section style={{ ...styles.panel, gridColumn: "1 / -1" }}>
            <div style={styles.sectionTitle}>Journal des événements</div>
            {events.length === 0 ? (
              <div style={styles.emptyCard}>Aucun événement enregistré.</div>
            ) : (
              <div style={styles.eventList}>
                {events.map((ev) => {
                  const teamLabel = ev.team_side === "home" ? "Dom." : ev.team_side === "away" ? "Ext." : null;
                  const payloadStr = fmtEventPayload(ev.event_type, ev.payload || {});
                  return (
                  <div key={ev.id} style={styles.eventRow}>
                    <div style={styles.eventMain}>
                      <div style={styles.eventType}>{fmtEventType(ev.event_type)}</div>
                      <div style={styles.eventMeta}>
                        {teamLabel ? <span style={{ fontWeight: 700 }}>{teamLabel}</span> : null}
                        {teamLabel ? " • " : null}
                        {fmtClock(ev.game_clock_ms || 0)}
                        {ev.period_index != null ? ` • P${ev.period_index + 1}` : ""}
                        {` • #${ev.seq}`}
                      </div>
                    </div>
                    {payloadStr ? (
                      <div style={{ ...styles.eventPayload, fontSize: 13, opacity: 0.85 }}>{payloadStr}</div>
                    ) : null}
                  </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <ConfirmDialog state={dialogState} onClose={handleClose} />
      <PlayerPickerDialog state={pickerState} onClose={handlePickerClose} />
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

function StatCardScoreGroup({
  title,
  buttons,
}: {
  title: string;
  buttons: Array<{ label: string; onClick: () => void; primary?: boolean }>;
}) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statCardTitle}>{title}</div>
      <div style={styles.scoreActions}>
        {buttons.map((b, i) => (
          <button key={`${b.label}-${i}`} onClick={b.onClick} style={b.primary ? styles.primaryBtnSmall : styles.ghostBtnSmall}>
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatPairCard({
  title,
  leftLabel,
  rightLabel,
  leftValue,
  rightValue,
  onLeftMinus,
  onLeftPlus,
  onRightMinus,
  onRightPlus,
}: {
  title: string;
  leftLabel: string;
  rightLabel: string;
  leftValue: number;
  rightValue: number;
  onLeftMinus: () => void;
  onLeftPlus: () => void;
  onRightMinus: () => void;
  onRightPlus: () => void;
}) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statCardTitle}>{title}</div>
      <div style={styles.statPairGrid}>
        <MiniStat title={leftLabel} value={leftValue} onMinus={onLeftMinus} onPlus={onLeftPlus} />
        <MiniStat title={rightLabel} value={rightValue} onMinus={onRightMinus} onPlus={onRightPlus} />
      </div>
    </div>
  );
}

function MiniStat({
  title,
  value,
  onMinus,
  onPlus,
}: {
  title: string;
  value: number;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <div style={styles.miniStat}>
      <div style={styles.miniStatTitle}>{title}</div>
      <div style={styles.miniStatValue}>{value}</div>
      <div style={styles.scoreActions}>
        <button onClick={onMinus} style={styles.ghostBtnSmall}>-1</button>
        <button onClick={onPlus} style={styles.primaryBtnSmall}>+1</button>
      </div>
    </div>
  );
}

function PlayerStatsTable({
  title,
  players,
  maxFouls,
  sport,
  onChange,
}: {
  title: string;
  players: PlayerStatRow[];
  maxFouls: number | null;
  sport: string;
  onChange: (
    playerId: string,
    field: "fouls" | "points" | "yellow_cards" | "red_cards",
    delta: number,
  ) => void;
}) {
  const normalizedSport = (sport || "").toLowerCase();
  const showPoints = normalizedSport === "basket" || normalizedSport === "rugby" || normalizedSport === "handball";
  const showCards = normalizedSport === "football" || normalizedSport === "rugby" || normalizedSport === "handball";

  return (
    <div style={styles.playerTableCard}>
      <div style={styles.statCardTitle}>{title}</div>
      <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
        {players.map((player) => {
          const isCritical = maxFouls ? (player.fouls || 0) >= maxFouls : false;

          return (
            <div key={player.id} style={styles.playerRowExtended}>
              <div>
                <div style={{ fontWeight: 800 }}>
                  #{player.number} {player.name}
                </div>
              </div>

              <div style={styles.playerStatsGrid}>
                <MiniPlayerStat
                  label="Fautes"
                  value={player.fouls || 0}
                  danger={isCritical}
                  onMinus={() => onChange(player.id, "fouls", -1)}
                  onPlus={() => onChange(player.id, "fouls", 1)}
                />

                {showPoints ? (
                  <MiniPlayerStat
                    label="Points"
                    value={player.points || 0}
                    onMinus={() => onChange(player.id, "points", -1)}
                    onPlus={() => onChange(player.id, "points", 1)}
                  />
                ) : null}

                {showCards ? (
                  <>
                    <MiniPlayerStat
                      label="Jaunes"
                      value={player.yellow_cards || 0}
                      onMinus={() => onChange(player.id, "yellow_cards", -1)}
                      onPlus={() => onChange(player.id, "yellow_cards", 1)}
                    />
                    <MiniPlayerStat
                      label="Rouges"
                      value={player.red_cards || 0}
                      onMinus={() => onChange(player.id, "red_cards", -1)}
                      onPlus={() => onChange(player.id, "red_cards", 1)}
                    />
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniPlayerStat({
  label,
  value,
  onMinus,
  onPlus,
  danger = false,
}: {
  label: string;
  value: number;
  onMinus: () => void;
  onPlus: () => void;
  danger?: boolean;
}) {
  return (
    <div style={styles.playerMiniStat}>
      <div style={{ fontSize: 11, opacity: 0.72 }}>{label}</div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 900,
          color: danger ? "#fca5a5" : "#e7eefc",
          marginTop: 4,
          marginBottom: 8,
        }}
      >
        {value}
      </div>
      <div style={styles.scoreActions}>
        <button onClick={onMinus} style={styles.ghostBtnSmall}>-1</button>
        <button onClick={onPlus} style={styles.primaryBtnSmall}>+1</button>
      </div>
    </div>
  );
}

const styles: Record<string, any> = {
  page: {
    minHeight: "100vh",
    background: "#0b0f14",
    color: "#e7eefc",
    padding: 24,
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
  },
  container: { maxWidth: 1340, margin: "0 auto" },
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
    padding: 14,
    borderRadius: 14,
    background: "rgba(37,99,235,.16)",
    border: "1px solid rgba(37,99,235,.32)",
    color: "#dbeafe",
    fontWeight: 800,
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
  heroActions: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start", justifyContent: "flex-end" },
  switchRow: { display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 22 },
  panel: {
    padding: 16,
    borderRadius: 18,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.08)",
  },
  sectionTitle: { fontSize: 18, fontWeight: 900, marginBottom: 14 },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  input: {
    width: "100%",
    background: "#0f172a",
    color: "#e7eefc",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 12,
    padding: "12px 14px",
    outline: "none",
    boxSizing: "border-box",
  },
  qrGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  qrCard: {
    padding: 14,
    borderRadius: 16,
    background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(255,255,255,.08)",
    textAlign: "center",
  },
  qrTitle: { fontWeight: 900 },
  consoleGrid: { display: "grid", gridTemplateColumns: "1fr .9fr 1fr", gap: 14, alignItems: "stretch" },
  teamCard: {
    padding: 16,
    borderRadius: 16,
    background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(255,255,255,.08)",
    textAlign: "center",
  },
  teamName: {
    fontSize: 18,
    fontWeight: 900,
    minHeight: 48,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  scoreValue: { fontSize: 96, lineHeight: 1, fontWeight: 900, marginTop: 10, marginBottom: 14 },
  scoreActions: { display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" },
  clockCard: {
    padding: 16,
    borderRadius: 16,
    background: "rgba(37,99,235,.10)",
    border: "1px solid rgba(37,99,235,.28)",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  clockLabel: { fontSize: 18, fontWeight: 900, opacity: 0.9 },
  clockValue: { fontSize: 52, lineHeight: 1, fontWeight: 900, marginTop: 10, marginBottom: 10 },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 14,
  },
  modeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 14,
  },
  statCard: {
    padding: 14,
    borderRadius: 16,
    background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(255,255,255,.08)",
  },
  statCardTitle: { fontWeight: 900, marginBottom: 10, fontSize: 16 },
  statPairGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  miniStat: {
    padding: 12,
    borderRadius: 14,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.08)",
    textAlign: "center",
  },
  miniStatTitle: { fontSize: 12, opacity: 0.72, minHeight: 32 },
  miniStatValue: { fontSize: 28, fontWeight: 900, marginTop: 4, marginBottom: 8 },
  bonusGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  cardsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  playerTablesGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  playerTableCard: {
    padding: 14,
    borderRadius: 16,
    background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(255,255,255,.08)",
  },
  playerRowExtended: {
    display: "grid",
    gridTemplateColumns: "220px 1fr",
    gap: 12,
    alignItems: "center",
    padding: 10,
    borderRadius: 12,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.06)",
  },
  playerStatsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: 10,
  },
  playerMiniStat: {
    padding: 10,
    borderRadius: 12,
    background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(255,255,255,.08)",
    textAlign: "center",
  },
  eventList: { display: "grid", gap: 8 },
  eventRow: {
    display: "grid",
    gridTemplateColumns: "260px 1fr",
    gap: 12,
    padding: 10,
    borderRadius: 12,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.06)",
  },
  eventMain: { minWidth: 0 },
  eventType: { fontWeight: 900, fontSize: 14 },
  eventMeta: { fontSize: 12, opacity: 0.72, marginTop: 4 },
  eventPayload: { fontSize: 12, opacity: 0.86, wordBreak: "break-word" },
  primaryBtn: {
    background: "#2563eb",
    color: "white",
    border: "1px solid rgba(255,255,255,.10)",
    borderRadius: 12,
    padding: "12px 16px",
    fontWeight: 800,
    cursor: "pointer",
  },
  primaryBtnSmall: {
    background: "#2563eb",
    color: "white",
    border: "1px solid rgba(255,255,255,.10)",
    borderRadius: 12,
    padding: "9px 12px",
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
  ghostBtnSmall: {
    background: "transparent",
    color: "#e7eefc",
    border: "1px solid rgba(255,255,255,.14)",
    borderRadius: 12,
    padding: "9px 12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  linkBtn: {
    textDecoration: "none",
    background: "#1e3a8a",
    color: "white",
    border: "1px solid rgba(255,255,255,.10)",
    borderRadius: 12,
    padding: "12px 14px",
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
  },
  emptyCard: {
    padding: 16,
    borderRadius: 16,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.08)",
  },
};
