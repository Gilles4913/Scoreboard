import React, { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useNavigate, useParams } from "react-router-dom";
import { sendTvBroadcast } from "../realtime";
import { supabase } from "../supabase";

type MatchRow = {
  id: string;
  org_id: string;
  team_id: string | null;
  name: string | null;
  status: string | null;
  scheduled_at: string | null;
  public_display: boolean | null;
  display_token: string | null;
  home_name: string | null;
  away_name: string | null;
  home_score: number | null;
  away_score: number | null;
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

type PlayerRow = {
  id: string;
  name: string;
  number: string;
  team_id: string;
};

type PlayerFoulsRow = {
  id: string;
  name: string;
  number: string;
  fouls: number;
};

function getEnv(name: string): string {
  const v = (import.meta as any).env?.[name];
  return typeof v === "string" ? v : "";
}

const DISPLAY_URL = getEnv("VITE_DISPLAY_URL") || "";

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

  if (count === 2) return ["1MT", "2MT", "Prolongation"];

  return Array.from({ length: count }, (_, i) => `P${i + 1}`);
}

function scoreStepOptionsBySport(sport: string) {
  const s = normalizeSport(sport);
  if (s === "basket") return [1, 2, 3];
  if (s === "rugby") return [3, 5, 7];
  return [1];
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

function toPlayerFoulRows(players: PlayerRow[]) {
  return players.map((p) => ({
    id: p.id,
    name: p.name,
    number: p.number,
    fouls: 0,
  }));
}

export default function ControlPage() {
  const nav = useNavigate();
  const { matchId = "" } = useParams();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  const [match, setMatch] = useState<MatchRow | null>(null);
  const [org, setOrg] = useState<OrgRow | null>(null);
  const [team, setTeam] = useState<TeamRow | null>(null);
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings | null>(null);
  const [sportSettings, setSportSettings] = useState<SportSettings | null>(null);

  const [matchName, setMatchName] = useState("");
  const [homeName, setHomeName] = useState("");
  const [awayName, setAwayName] = useState("");
  const [status, setStatus] = useState("scheduled");
  const [periodLabel, setPeriodLabel] = useState("1MT");
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

  const [homePlayers, setHomePlayers] = useState<PlayerFoulsRow[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<PlayerFoulsRow[]>([]);

  const timerRef = useRef<number | null>(null);

  const sport = normalizeSport(org?.sport);
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
        .select("id, org_id, team_id, name, status, scheduled_at, public_display, display_token, home_name, away_name, home_score, away_score")
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

      const [{ data: orgRow }, { data: teamRow }, { data: dsRow }, { data: ssRow }] =
        await Promise.all([
          supabase.from("orgs").select("id, slug, name, sport").eq("id", currentMatch.org_id).maybeSingle(),
          currentMatch.team_id
            ? supabase.from("teams").select("id, name").eq("id", currentMatch.team_id).maybeSingle()
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
        ]);

      if (cancelled) return;

      setOrg((orgRow as OrgRow) || null);
      setTeam((teamRow as TeamRow) || null);
      setDisplaySettings((dsRow as DisplaySettings) || null);
      setSportSettings((ssRow as SportSettings) || null);

      const sportValue = normalizeSport((orgRow as OrgRow | null)?.sport);
      const ss = (ssRow as SportSettings | null) || null;

      setMatchName(
        currentMatch.name ||
          `${currentMatch.home_name || "Domicile"} vs ${currentMatch.away_name || "Extérieur"}`,
      );
      setHomeName(currentMatch.home_name || "Domicile");
      setAwayName(currentMatch.away_name || "Extérieur");
      setStatus((currentMatch.status || "scheduled").toLowerCase());
      setPeriodLabel(periodOptionsBySport(sportValue, ss?.period_count)[0] || "1MT");
      setHomeScore(Number(currentMatch.home_score || 0));
      setAwayScore(Number(currentMatch.away_score || 0));
      setClockMs(defaultClockMsBySport(sportValue, ss?.period_duration_s));
      setClockRunning(false);

      setHomeTeamFouls(0);
      setAwayTeamFouls(0);
      setHomeTimeouts(0);
      setAwayTimeouts(0);
      setHomeBonus(false);
      setAwayBonus(false);
      setShotClockS(Number(ss?.shot_clock_s || 24));
      setHomeSetsWon(0);
      setAwaySetsWon(0);
      setHomeYellowCards(0);
      setAwayYellowCards(0);
      setHomeRedCards(0);
      setAwayRedCards(0);

      if (currentMatch.team_id) {
        const { data: playersData, error: playersErr } = await supabase
          .from("players")
          .select("id, name, number, team_id")
          .eq("team_id", currentMatch.team_id)
          .eq("is_active", true)
          .order("number", { ascending: true });

        if (!cancelled && !playersErr) {
          const basePlayers = (playersData as PlayerRow[]) || [];
          setHomePlayers(toPlayerFoulRows(basePlayers));
          setAwayPlayers(toPlayerFoulRows(basePlayers));
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
      setClockMs((prev) => {
        if (prev <= 250) {
          setClockRunning(false);
          return 0;
        }
        return Math.max(0, prev - 250);
      });
    }, 250);

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [clockRunning]);

  function displayLink() {
    if (!match || !DISPLAY_URL) return "";
    const base = DISPLAY_URL.replace(/\/$/, "");
    if (match.display_token) return `${base}/?token=${encodeURIComponent(match.display_token)}`;
    return `${base}/?matchId=${encodeURIComponent(match.id)}`;
  }

  function controlLink() {
    return window.location.href;
  }

  function flash(message: string) {
    setInfo(message);
    window.setTimeout(() => setInfo(""), 2600);
  }

  async function pushPatch(patch: Record<string, any>) {
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
      clock_ms: clockMs,
      clock_running: clockRunning,
      period_label: periodLabel,
      show_score: displaySettings?.show_score ?? true,
      show_clock: displaySettings?.show_clock ?? true,
      show_period: displaySettings?.show_period ?? true,
      show_status: displaySettings?.show_status ?? true,
      show_lower_third: displaySettings?.show_lower_third ?? true,
      show_logos: displaySettings?.show_logos ?? true,
      show_sponsors: displaySettings?.show_sponsors ?? true,
      layout_mode: displaySettings?.layout_mode ?? "stadium",
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
      home_players: homePlayers,
      away_players: awayPlayers,
      ...patch,
    };

    await sendTvBroadcast(match.id, payload);
  }

  async function saveMatch() {
    if (!match) return;

    const payload = {
      name: matchName.trim() || `${homeName.trim() || "Domicile"} vs ${awayName.trim() || "Extérieur"}`,
      home_name: homeName.trim() || "Domicile",
      away_name: awayName.trim() || "Extérieur",
      status,
      home_score: homeScore,
      away_score: awayScore,
    };

    console.log("[control] saveMatch payload:", payload);

    const { data, error } = await supabase
      .from("matches")
      .update(payload)
      .eq("id", match.id)
      .select("id, name, home_name, away_name, status, home_score, away_score")
      .maybeSingle();

    if (error) {
      console.error("[control] saveMatch error:", error);
      flash(`Erreur sauvegarde : ${error.message}`);
      return;
    }

    console.log("[control] saveMatch success:", data);

    setMatch((prev) => (prev ? { ...prev, ...payload } : prev));
    flash("Match sauvegardé avec succès.");
  }

  async function syncNow() {
    try {
      await pushPatch({});
      flash("État envoyé au Display.");
    } catch (e: any) {
      flash(e?.message || "Erreur broadcast.");
    }
  }

  async function changeScore(side: "home" | "away", delta: number) {
    const nextHome = side === "home" ? Math.max(0, homeScore + delta) : homeScore;
    const nextAway = side === "away" ? Math.max(0, awayScore + delta) : awayScore;
    setHomeScore(nextHome);
    setAwayScore(nextAway);

    if (autoLive) {
      try {
        await pushPatch({ home_score: nextHome, away_score: nextAway });
      } catch (e: any) {
        flash(e?.message || "Erreur broadcast.");
      }
    }
  }

  async function changePeriod(next: string) {
    setPeriodLabel(next);
    if (autoLive) {
      try {
        await pushPatch({ period_label: next });
      } catch (e: any) {
        flash(e?.message || "Erreur broadcast.");
      }
    }
  }

  async function startClock() {
    setClockRunning(true);
    setStatus("live");
    if (autoLive) {
      try {
        await pushPatch({ clock_running: true, status: "live" });
      } catch (e: any) {
        flash(e?.message || "Erreur broadcast.");
      }
    }
  }

  async function pauseClock() {
    setClockRunning(false);
    setStatus("paused");
    if (autoLive) {
      try {
        await pushPatch({ clock_running: false, status: "paused" });
      } catch (e: any) {
        flash(e?.message || "Erreur broadcast.");
      }
    }
  }

  async function resetClock() {
    const next = defaultClockMsBySport(sport, sportSettings?.period_duration_s);
    setClockMs(next);
    setClockRunning(false);
    if (autoLive) {
      try {
        await pushPatch({ clock_ms: next, clock_running: false });
      } catch (e: any) {
        flash(e?.message || "Erreur broadcast.");
      }
    }
  }

  async function changeTeamStat(
    setter: React.Dispatch<React.SetStateAction<number>>,
    currentValue: number,
    delta: number,
    patchName: string,
  ) {
    const next = clampMin(currentValue + delta);
    setter(next);

    if (autoLive) {
      try {
        await pushPatch({ [patchName]: next });
      } catch (e: any) {
        flash(e?.message || "Erreur broadcast.");
      }
    }
  }

  async function toggleBoolStat(
    setter: React.Dispatch<React.SetStateAction<boolean>>,
    currentValue: boolean,
    patchName: string,
  ) {
    const next = !currentValue;
    setter(next);

    if (autoLive) {
      try {
        await pushPatch({ [patchName]: next });
      } catch (e: any) {
        flash(e?.message || "Erreur broadcast.");
      }
    }
  }

  async function changePlayerFoul(side: "home" | "away", playerId: string, delta: number) {
    const source = side === "home" ? homePlayers : awayPlayers;
    const next = source.map((p) =>
      p.id === playerId ? { ...p, fouls: clampMin(p.fouls + delta) } : p,
    );

    if (side === "home") setHomePlayers(next);
    else setAwayPlayers(next);

    if (autoLive) {
      try {
        await pushPatch({
          [side === "home" ? "home_players" : "away_players"]: next,
        });
      } catch (e: any) {
        flash(e?.message || "Erreur broadcast.");
      }
    }
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
  const showSets = !!sportSettings?.show_sets;
  const showCards = !!sportSettings?.show_cards;
  const showShotClock = !!sportSettings?.show_shot_clock;

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
            <button onClick={openFullscreen} style={styles.ghostBtn}>
              Plein écran
            </button>
            <button onClick={() => nav("/display-settings")} style={styles.ghostBtn}>
              Paramètres Display
            </button>
          </div>
        </div>

        {info ? <div style={styles.infoBox}>{info}</div> : null}

        <div style={styles.hero}>
          <div>
            <div style={styles.heroTitle}>{matchName}</div>
            <div style={styles.heroText}>
              Cette régie pilote le match courant. En mode <b>Auto live</b>, chaque action part immédiatement vers l’écran public.
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
            <button onClick={syncNow} style={styles.ghostBtn}>
              Envoyer au Display
            </button>
            {displayHref ? (
              <a href={displayHref} target="_blank" rel="noreferrer" style={styles.linkBtn}>
                Ouvrir écran public
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
                <select value={status} onChange={(e) => setStatus(e.target.value)} style={styles.input}>
                  <option value="scheduled">À préparer</option>
                  <option value="live">En cours</option>
                  <option value="paused">Pause</option>
                  <option value="finished">Terminé</option>
                </select>
              </Field>

              <Field label="Équipe domicile">
                <input value={homeName} onChange={(e) => setHomeName(e.target.value)} style={styles.input} />
              </Field>

              <Field label="Équipe extérieure">
                <input value={awayName} onChange={(e) => setAwayName(e.target.value)} style={styles.input} />
              </Field>

              <Field label="Période">
                <select value={periodLabel} onChange={(e) => changePeriod(e.target.value)} style={styles.input}>
                  {periodOptions.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Sport">
                <input readOnly value={sport} style={{ ...styles.input, opacity: 0.82 }} />
              </Field>
            </div>
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
                <div style={styles.qrTitle}>QR écran public</div>
                {displayHref ? (
                  <div style={{ background: "white", padding: 8, borderRadius: 10, marginTop: 10, display: "inline-block" }}>
                    <QRCodeSVG value={displayHref} size={160} />
                  </div>
                ) : (
                  <div style={{ marginTop: 12, opacity: 0.7 }}>Lien écran indisponible.</div>
                )}
              </div>
            </div>
          </section>

          <section style={{ ...styles.panel, gridColumn: "1 / -1" }}>
            <div style={styles.sectionTitle}>Console live</div>

            <div style={styles.consoleGrid}>
              <div style={styles.teamCard}>
                <div style={styles.teamName}>{homeName || "Domicile"}</div>
                <div style={styles.scoreValue}>{homeScore}</div>
                <div style={styles.scoreActions}>
                  {scoreSteps.map((step) => (
                    <React.Fragment key={`home-${step}`}>
                      <button onClick={() => changeScore("home", -step)} style={styles.ghostBtnSmall}>
                        -{step}
                      </button>
                      <button onClick={() => changeScore("home", step)} style={styles.primaryBtnSmall}>
                        +{step}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <div style={styles.clockCard}>
                <div style={styles.clockLabel}>{periodLabel}</div>
                <div style={styles.clockValue}>{fmtClock(clockMs)}</div>
                <div style={{ opacity: 0.75, marginBottom: 12 }}>
                  {clockRunning ? "Chrono actif" : "Chrono arrêté"}
                </div>

                <div style={styles.scoreActions}>
                  <button onClick={startClock} style={styles.primaryBtnSmall}>Start</button>
                  <button onClick={pauseClock} style={styles.ghostBtnSmall}>Pause</button>
                  <button onClick={resetClock} style={styles.ghostBtnSmall}>Reset</button>
                </div>

                <div style={{ ...styles.scoreActions, marginTop: 12 }}>
                  <button onClick={() => setClockMs((v) => Math.max(0, v - 60_000))} style={styles.ghostBtnSmall}>-1 min</button>
                  <button onClick={() => setClockMs((v) => v + 60_000)} style={styles.ghostBtnSmall}>+1 min</button>
                  <button onClick={() => setClockMs((v) => Math.max(0, v - 1000))} style={styles.ghostBtnSmall}>-1 sec</button>
                  <button onClick={() => setClockMs((v) => v + 1000)} style={styles.ghostBtnSmall}>+1 sec</button>
                </div>

                {showShotClock ? (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 12, opacity: 0.72 }}>Shot clock</div>
                    <div style={{ fontSize: 28, fontWeight: 900, marginTop: 4 }}>{shotClockS}s</div>
                    <div style={{ ...styles.scoreActions, marginTop: 8 }}>
                      <button
                        onClick={() => {
                          const next = Math.max(0, shotClockS - 1);
                          setShotClockS(next);
                          if (autoLive) pushPatch({ shot_clock_s: next }).catch((e: any) => flash(e?.message || "Erreur broadcast."));
                        }}
                        style={styles.ghostBtnSmall}
                      >
                        -1
                      </button>
                      <button
                        onClick={() => {
                          const next = shotClockS + 1;
                          setShotClockS(next);
                          if (autoLive) pushPatch({ shot_clock_s: next }).catch((e: any) => flash(e?.message || "Erreur broadcast."));
                        }}
                        style={styles.primaryBtnSmall}
                      >
                        +1
                      </button>
                      <button
                        onClick={() => {
                          const next = Number(sportSettings?.shot_clock_s || 24);
                          setShotClockS(next);
                          if (autoLive) pushPatch({ shot_clock_s: next }).catch((e: any) => flash(e?.message || "Erreur broadcast."));
                        }}
                        style={styles.ghostBtnSmall}
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div style={styles.teamCard}>
                <div style={styles.teamName}>{awayName || "Extérieur"}</div>
                <div style={styles.scoreValue}>{awayScore}</div>
                <div style={styles.scoreActions}>
                  {scoreSteps.map((step) => (
                    <React.Fragment key={`away-${step}`}>
                      <button onClick={() => changeScore("away", -step)} style={styles.ghostBtnSmall}>
                        -{step}
                      </button>
                      <button onClick={() => changeScore("away", step)} style={styles.primaryBtnSmall}>
                        +{step}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          </section>

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
                    onLeftMinus={() => changeTeamStat(setHomeTeamFouls, homeTeamFouls, -1, "home_team_fouls")}
                    onLeftPlus={() => changeTeamStat(setHomeTeamFouls, homeTeamFouls, 1, "home_team_fouls")}
                    onRightMinus={() => changeTeamStat(setAwayTeamFouls, awayTeamFouls, -1, "away_team_fouls")}
                    onRightPlus={() => changeTeamStat(setAwayTeamFouls, awayTeamFouls, 1, "away_team_fouls")}
                  />
                ) : null}

                {showTimeouts ? (
                  <StatPairCard
                    title="Temps morts"
                    leftValue={homeTimeouts}
                    rightValue={awayTimeouts}
                    leftLabel={homeName}
                    rightLabel={awayName}
                    onLeftMinus={() => changeTeamStat(setHomeTimeouts, homeTimeouts, -1, "home_timeouts")}
                    onLeftPlus={() => changeTeamStat(setHomeTimeouts, homeTimeouts, 1, "home_timeouts")}
                    onRightMinus={() => changeTeamStat(setAwayTimeouts, awayTimeouts, -1, "away_timeouts")}
                    onRightPlus={() => changeTeamStat(setAwayTimeouts, awayTimeouts, 1, "away_timeouts")}
                  />
                ) : null}

                {showSets ? (
                  <StatPairCard
                    title="Sets gagnés"
                    leftValue={homeSetsWon}
                    rightValue={awaySetsWon}
                    leftLabel={homeName}
                    rightLabel={awayName}
                    onLeftMinus={() => changeTeamStat(setHomeSetsWon, homeSetsWon, -1, "home_sets_won")}
                    onLeftPlus={() => changeTeamStat(setHomeSetsWon, homeSetsWon, 1, "home_sets_won")}
                    onRightMinus={() => changeTeamStat(setAwaySetsWon, awaySetsWon, -1, "away_sets_won")}
                    onRightPlus={() => changeTeamStat(setAwaySetsWon, awaySetsWon, 1, "away_sets_won")}
                  />
                ) : null}

                {showCards ? (
                  <div style={styles.statCard}>
                    <div style={styles.statCardTitle}>Cartons</div>

                    <div style={styles.cardsGrid}>
                      <MiniStat
                        title={`${homeName} • Jaunes`}
                        value={homeYellowCards}
                        onMinus={() => changeTeamStat(setHomeYellowCards, homeYellowCards, -1, "home_yellow_cards")}
                        onPlus={() => changeTeamStat(setHomeYellowCards, homeYellowCards, 1, "home_yellow_cards")}
                      />
                      <MiniStat
                        title={`${awayName} • Jaunes`}
                        value={awayYellowCards}
                        onMinus={() => changeTeamStat(setAwayYellowCards, awayYellowCards, -1, "away_yellow_cards")}
                        onPlus={() => changeTeamStat(setAwayYellowCards, awayYellowCards, 1, "away_yellow_cards")}
                      />
                      <MiniStat
                        title={`${homeName} • Rouges`}
                        value={homeRedCards}
                        onMinus={() => changeTeamStat(setHomeRedCards, homeRedCards, -1, "home_red_cards")}
                        onPlus={() => changeTeamStat(setHomeRedCards, homeRedCards, 1, "home_red_cards")}
                      />
                      <MiniStat
                        title={`${awayName} • Rouges`}
                        value={awayRedCards}
                        onMinus={() => changeTeamStat(setAwayRedCards, awayRedCards, -1, "away_red_cards")}
                        onPlus={() => changeTeamStat(setAwayRedCards, awayRedCards, 1, "away_red_cards")}
                      />
                    </div>
                  </div>
                ) : null}

                {showBonus ? (
                  <div style={styles.statCard}>
                    <div style={styles.statCardTitle}>Bonus</div>
                    <div style={styles.bonusGrid}>
                      <button
                        onClick={() => toggleBoolStat(setHomeBonus, homeBonus, "home_bonus")}
                        style={homeBonus ? styles.primaryBtn : styles.ghostBtn}
                      >
                        {homeName} : {homeBonus ? "ON" : "OFF"}
                      </button>
                      <button
                        onClick={() => toggleBoolStat(setAwayBonus, awayBonus, "away_bonus")}
                        style={awayBonus ? styles.primaryBtn : styles.ghostBtn}
                      >
                        {awayName} : {awayBonus ? "ON" : "OFF"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {showPlayerFouls ? (
            <section style={{ ...styles.panel, gridColumn: "1 / -1" }}>
              <div style={styles.sectionTitle}>Fautes joueurs</div>

              <div style={styles.playerTablesGrid}>
                <PlayerFoulsTable
                  title={homeName}
                  players={homePlayers}
                  maxFouls={sportSettings?.max_player_fouls ?? null}
                  onChange={(playerId, delta) => changePlayerFoul("home", playerId, delta)}
                />

                <PlayerFoulsTable
                  title={awayName}
                  players={awayPlayers}
                  maxFouls={sportSettings?.max_player_fouls ?? null}
                  onChange={(playerId, delta) => changePlayerFoul("away", playerId, delta)}
                />
              </div>
            </section>
          ) : null}
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

function PlayerFoulsTable({
  title,
  players,
  maxFouls,
  onChange,
}: {
  title: string;
  players: PlayerFoulsRow[];
  maxFouls: number | null;
  onChange: (playerId: string, delta: number) => void;
}) {
  return (
    <div style={styles.playerTableCard}>
      <div style={styles.statCardTitle}>{title}</div>
      <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
        {players.map((player) => {
          const isCritical = maxFouls ? player.fouls >= maxFouls : false;

          return (
            <div key={player.id} style={styles.playerRow}>
              <div>
                <div style={{ fontWeight: 800 }}>
                  #{player.number} {player.name}
                </div>
                <div style={{ fontSize: 12, opacity: 0.72 }}>
                  Fautes : <b style={{ color: isCritical ? "#fca5a5" : "#e7eefc" }}>{player.fouls}</b>
                </div>
              </div>

              <div style={styles.scoreActions}>
                <button onClick={() => onChange(player.id, -1)} style={styles.ghostBtnSmall}>-1</button>
                <button onClick={() => onChange(player.id, 1)} style={styles.primaryBtnSmall}>+1</button>
              </div>
            </div>
          );
        })}
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
    background: "rgba(255,255,255,.05)",
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
  scoreValue: { fontSize: 56, lineHeight: 1, fontWeight: 900, marginTop: 10, marginBottom: 14 },
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
  playerRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    padding: 10,
    borderRadius: 12,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.06)",
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
};
