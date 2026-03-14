import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabase";
import { sendTvBroadcast } from "../realtime";
import { usePlayerPicker, PlayerPickerDialog, PlayerOption } from "../components/PlayerPickerDialog";

/* ─── helpers ──────────────────────────────────────────────────────────────── */
function normalizeSport(v: string | null | undefined) {
  return ((v || "football") + "").toLowerCase().trim();
}
function fmtClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}
function defaultClockMs(sport: string, periodDurationS?: number | null) {
  if (typeof periodDurationS === "number" && periodDurationS >= 0) return periodDurationS * 1000;
  const s = normalizeSport(sport);
  if (s === "basket") return 10 * 60 * 1000;
  if (s === "handball") return 30 * 60 * 1000;
  if (s === "rugby") return 40 * 60 * 1000;
  return 45 * 60 * 1000;
}
function periodOptions(sport: string, periodCount?: number) {
  const s = normalizeSport(sport);
  const count = Math.max(1, Number(periodCount || 2));
  if (s === "basket") {
    const base = Array.from({ length: Math.max(4, count) }, (_, i) => `Q${i + 1}`);
    base.push("OT");
    return base;
  }
  if (s === "volleyball") return Array.from({ length: Math.max(3, count) }, (_, i) => `Set ${i + 1}`);
  return ["1MT", "2MT", "Prolongation"];
}
function recomputeRugbyScore(p: { tries: number; conversions: number; penalties: number; drops: number }) {
  return p.tries * 5 + p.conversions * 2 + p.penalties * 3 + p.drops * 3;
}
function clamp(n: number, min = 0) { return Math.max(min, n); }

/* ─── types ─────────────────────────────────────────────────────────────────── */
interface MatchRow { [key: string]: any }

/* ─── component ──────────────────────────────────────────────────────────────── */
export default function MobileControlPage() {
  const { matchId = "" } = useParams();
  const nav = useNavigate();
  const { pick, pickerState, handlePickerClose } = usePlayerPicker();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [match, setMatch] = useState<MatchRow | null>(null);
  const [matchName, setMatchName] = useState("");
  const [homeName, setHomeName] = useState("Domicile");
  const [awayName, setAwayName] = useState("Extérieur");
  const [sport, setSport] = useState("football");
  const [periodDurationS, setPeriodDurationS] = useState<number | null>(null);
  const [periodCount, setPeriodCount] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState("scheduled");
  const [periodLabel, setPeriodLabel] = useState("1MT");

  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [clockMs, setClockMs] = useState(0);
  const [clockRunning, setClockRunning] = useState(false);

  const [homeYellow, setHomeYellow] = useState(0);
  const [awayYellow, setAwayYellow] = useState(0);
  const [homeRed, setHomeRed] = useState(0);
  const [awayRed, setAwayRed] = useState(0);

  const [homePlayers, setHomePlayers] = useState<PlayerOption[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<PlayerOption[]>([]);

  /* rugby detail */
  const [rugbyHome, setRugbyHome] = useState({ tries: 0, conversions: 0, penalties: 0, drops: 0 });
  const [rugbyAway, setRugbyAway] = useState({ tries: 0, conversions: 0, penalties: 0, drops: 0 });
  const [rugbyHomeYellow, setRugbyHomeYellow] = useState(0);
  const [rugbyAwayYellow, setRugbyAwayYellow] = useState(0);

  const clockMsRef = useRef(0);
  const clockRunningRef = useRef(false);
  const clockAnchorRef = useRef<{ epoch: number; ms: number }>({ epoch: Date.now(), ms: 0 });
  const timerRef = useRef<number | null>(null);
  const liveSeqRef = useRef(0);

  const isRugby = normalizeSport(sport) === "rugby";
  const canScore = status === "live";

  /* ── load match ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!matchId) { setErr("matchId manquant"); setLoading(false); return; }
    let cancelled = false;
    async function load() {
      const { data: m, error: mErr } = await supabase.from("matches").select("*").eq("id", matchId).maybeSingle();
      if (cancelled) return;
      if (mErr || !m) { setErr(mErr?.message || "Match introuvable."); setLoading(false); return; }
      setMatch(m);

      const sportVal = normalizeSport(m.home_name ? (m.sport || null) : null);
      const [{ data: orgRow }, { data: ssRow }, { data: mpData }] = await Promise.all([
        supabase.from("orgs").select("sport").eq("id", m.org_id).maybeSingle(),
        supabase.from("org_sport_settings").select("sport, period_count, period_duration_s").eq("org_id", m.org_id).maybeSingle(),
        supabase.from("match_players").select(`player_id, team_id, shirt_number, player:players(id, name, number)`).eq("match_id", m.id),
      ]);
      if (cancelled) return;

      const detectedSport = normalizeSport((orgRow as any)?.sport || sportVal);
      setSport(detectedSport);
      const pdS = (ssRow as any)?.period_duration_s ?? null;
      const pCnt = (ssRow as any)?.period_count ?? undefined;
      setPeriodDurationS(pdS);
      setPeriodCount(pCnt);

      setMatchName(m.name || `${m.home_name || "Domicile"} vs ${m.away_name || "Extérieur"}`);
      setHomeName(m.home_name || "Domicile");
      setAwayName(m.away_name || "Extérieur");
      setStatus((m.status || "scheduled").toLowerCase());
      setPeriodLabel(m.period_label || periodOptions(detectedSport, pCnt)[0] || "1MT");
      setHomeScore(Number(m.home_score || 0));
      setAwayScore(Number(m.away_score || 0));
      setHomeYellow(Number(m.home_yellow_cards || 0));
      setAwayYellow(Number(m.away_yellow_cards || 0));
      setHomeRed(Number(m.home_red_cards || 0));
      setAwayRed(Number(m.away_red_cards || 0));
      setRugbyHome({
        tries: Number(m.rugby_home_tries || 0),
        conversions: Number(m.rugby_home_conversions || 0),
        penalties: Number(m.rugby_home_penalties || 0),
        drops: Number(m.rugby_home_drop_goals || 0),
      });
      setRugbyAway({
        tries: Number(m.rugby_away_tries || 0),
        conversions: Number(m.rugby_away_conversions || 0),
        penalties: Number(m.rugby_away_penalties || 0),
        drops: Number(m.rugby_away_drop_goals || 0),
      });
      setRugbyHomeYellow(Number(m.rugby_home_yellow_sin_bin || 0));
      setRugbyAwayYellow(Number(m.rugby_away_yellow_sin_bin || 0));

      const initMs = typeof m.clock_ms === "number" ? m.clock_ms : defaultClockMs(detectedSport, pdS);
      const initRunning = !!m.clock_running;
      clockMsRef.current = initMs;
      clockRunningRef.current = initRunning;
      clockAnchorRef.current = { epoch: Date.now(), ms: initMs };
      setClockMs(initMs);
      setClockRunning(initRunning);

      /* players */
      const mp = (mpData || []) as any[];
      const homeTeamId = m.home_team_id || m.team_id || null;
      const awayTeamId = m.away_team_id || null;
      const toOpt = (row: any): PlayerOption => ({
        id: row.player_id,
        name: row.player?.name || "Joueur",
        number: row.shirt_number || row.player?.number || "?",
      });
      setHomePlayers(mp.filter((p) => !homeTeamId || p.team_id === homeTeamId).map(toOpt));
      setAwayPlayers(awayTeamId ? mp.filter((p) => p.team_id === awayTeamId).map(toOpt) : []);

      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [matchId]);

  /* ── clock tick ──────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!clockRunning) return;
    timerRef.current = window.setInterval(() => {
      const { epoch, ms } = clockAnchorRef.current;
      const computed = Math.max(0, ms - (Date.now() - epoch));
      clockMsRef.current = computed;
      setClockMs(computed);
      if (computed === 0) { clockRunningRef.current = false; setClockRunning(false); }
    }, 100);
    return () => { if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; } };
  }, [clockRunning]);

  /* ── helpers ─────────────────────────────────────────────────────────────── */
  function nextSeq() { liveSeqRef.current += 1; return liveSeqRef.current; }

  const push = useCallback(async (patch: Record<string, any>) => {
    if (!matchId) return;
    const seq = nextSeq();
    void sendTvBroadcast(matchId, { ...patch, match_id: matchId, live_seq: seq, emitted_at: Date.now() });
  }, [matchId]);

  const persist = useCallback(async (patch: Record<string, any>) => {
    if (!matchId) return;
    await supabase.from("matches").update(patch).eq("id", matchId);
  }, [matchId]);

  /* ── clock controls ──────────────────────────────────────────────────────── */
  async function startClock() {
    const ms = clockMsRef.current > 0 ? clockMsRef.current : defaultClockMs(sport, periodDurationS);
    clockMsRef.current = ms;
    clockRunningRef.current = true;
    clockAnchorRef.current = { epoch: Date.now(), ms };
    setClockMs(ms);
    setClockRunning(true);
    setStatus("live");
    try {
      void push({ clock_ms: ms, clock_running: true, status: "live" });
      void persist({ clock_ms: ms, clock_running: true, status: "live" });
    } catch {}
  }

  async function pauseClock() {
    const ms = clockMsRef.current;
    clockRunningRef.current = false;
    setClockRunning(false);
    setStatus("paused");
    try {
      void push({ clock_running: false, status: "paused", clock_ms: ms });
      void persist({ clock_running: false, status: "paused", clock_ms: ms });
    } catch {}
  }

  /* ── score ───────────────────────────────────────────────────────────────── */
  async function changeScore(side: "home" | "away", delta: number) {
    if (!canScore) return;
    const nextHome = side === "home" ? clamp(homeScore + delta) : homeScore;
    const nextAway = side === "away" ? clamp(awayScore + delta) : awayScore;
    setHomeScore(nextHome);
    setAwayScore(nextAway);
    try {
      void push({ home_score: nextHome, away_score: nextAway });
      void persist({ home_score: nextHome, away_score: nextAway });
    } catch {}
  }

  async function rugbyScore(side: "home" | "away", field: "tries" | "conversions" | "penalties" | "drops", delta: number) {
    if (!canScore) return;
    const nextHome = side === "home" ? { ...rugbyHome, [field]: clamp(rugbyHome[field] + delta) } : { ...rugbyHome };
    const nextAway = side === "away" ? { ...rugbyAway, [field]: clamp(rugbyAway[field] + delta) } : { ...rugbyAway };
    setRugbyHome(nextHome);
    setRugbyAway(nextAway);
    const hs = recomputeRugbyScore(nextHome);
    const as_ = recomputeRugbyScore(nextAway);
    setHomeScore(hs);
    setAwayScore(as_);
    const patch = {
      home_score: hs, away_score: as_,
      rugby_home_tries: nextHome.tries, rugby_home_conversions: nextHome.conversions,
      rugby_home_penalties: nextHome.penalties, rugby_home_drop_goals: nextHome.drops,
      rugby_away_tries: nextAway.tries, rugby_away_conversions: nextAway.conversions,
      rugby_away_penalties: nextAway.penalties, rugby_away_drop_goals: nextAway.drops,
    };
    try { void push(patch); void persist(patch); } catch {}
  }

  /* ── period ──────────────────────────────────────────────────────────────── */
  async function setPeriod(label: string) {
    setPeriodLabel(label);
    try { void push({ period_label: label }); void persist({ period_label: label }); } catch {}
  }

  /* ── cards ───────────────────────────────────────────────────────────────── */
  async function issueCard(side: "home" | "away", color: "yellow" | "red") {
    const players = side === "home" ? homePlayers : awayPlayers;
    const teamName = side === "home" ? homeName : awayName;
    const label = color === "yellow" ? "Carton jaune" : "Carton rouge";
    const picked = await pick({ title: `${label} — ${teamName}`, players });
    if (picked === undefined) return;

    if (color === "yellow") {
      if (isRugby) {
        const n = (side === "home" ? rugbyHomeYellow : rugbyAwayYellow) + 1;
        if (side === "home") setRugbyHomeYellow(n); else setRugbyAwayYellow(n);
        const patch: Record<string, any> = side === "home"
          ? { rugby_home_yellow_sin_bin: n, home_yellow_cards: n }
          : { rugby_away_yellow_sin_bin: n, away_yellow_cards: n };
        try { void push(patch); void persist(patch); } catch {}
      } else {
        const n = (side === "home" ? homeYellow : awayYellow) + 1;
        if (side === "home") setHomeYellow(n); else setAwayYellow(n);
        const patch: Record<string, any> = side === "home" ? { home_yellow_cards: n } : { away_yellow_cards: n };
        try { void push(patch); void persist(patch); } catch {}
      }
    } else {
      const n = (side === "home" ? homeRed : awayRed) + 1;
      if (side === "home") setHomeRed(n); else setAwayRed(n);
      const patch: Record<string, any> = side === "home" ? { home_red_cards: n } : { away_red_cards: n };
      try { void push(patch); void persist(patch); } catch {}
    }

  }

  /* ─── styles ─────────────────────────────────────────────────────────────── */
  const s = {
    page: { minHeight: "100vh", background: "#0f1117", color: "#e2e8f0", fontFamily: "system-ui, sans-serif", padding: "12px 10px 40px" } as React.CSSProperties,
    header: { display: "flex", alignItems: "center", gap: 10, marginBottom: 16 } as React.CSSProperties,
    backBtn: { background: "transparent", border: "1px solid #334155", borderRadius: 8, color: "#94a3b8", padding: "6px 14px", cursor: "pointer", fontSize: 13, flexShrink: 0 } as React.CSSProperties,
    matchName: { fontSize: 13, fontWeight: 700, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
    badge: (st: string): React.CSSProperties => ({
      display: "inline-block", borderRadius: 6, padding: "2px 10px", fontSize: 11, fontWeight: 700, letterSpacing: 0.8,
      background: st === "live" ? "#16a34a" : st === "paused" ? "#d97706" : st === "finished" ? "#3b82f6" : "#475569",
      color: "#fff", marginLeft: 8, flexShrink: 0,
    }),
    card: { background: "#1e293b", border: "1px solid #334155", borderRadius: 14, padding: "16px 14px", marginBottom: 12 } as React.CSSProperties,
    sectionTitle: { fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase" as const, color: "#64748b", marginBottom: 12 },
    scoreRow: { display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 10 } as React.CSSProperties,
    teamBlock: { display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 8 },
    teamName: { fontSize: 13, fontWeight: 700, color: "#94a3b8", textAlign: "center" as const, lineHeight: 1.2 },
    scoreNum: { fontSize: 56, fontWeight: 900, color: "#f1f5f9", lineHeight: 1 },
    scoreSep: { fontSize: 32, fontWeight: 300, color: "#475569" },
    scoreActions: { display: "flex", gap: 8, justifyContent: "center" } as React.CSSProperties,
    bigBtn: (color?: string): React.CSSProperties => ({
      minWidth: 58, height: 52, borderRadius: 10, border: "none", fontSize: 22, fontWeight: 700,
      cursor: "pointer", background: color || "#1e3a5f", color: "#fff",
    }),
    disabledBigBtn: { minWidth: 58, height: 52, borderRadius: 10, border: "none", fontSize: 22, fontWeight: 700, cursor: "not-allowed", background: "#1e293b", color: "#475569" } as React.CSSProperties,
    clockDisplay: { textAlign: "center" as const, fontSize: 48, fontWeight: 900, fontVariantNumeric: "tabular-nums", letterSpacing: 2, color: "#f1f5f9", marginBottom: 14 },
    clockActions: { display: "flex", gap: 10, justifyContent: "center" } as React.CSSProperties,
    clockBtn: (active: boolean): React.CSSProperties => ({
      flex: 1, height: 56, borderRadius: 12, border: "none", fontSize: 18, fontWeight: 700, cursor: "pointer",
      background: active ? "#b91c1c" : "#16a34a", color: "#fff",
    }),
    periodBtns: { display: "flex", gap: 8, flexWrap: "wrap" as const },
    periodBtn: (active: boolean): React.CSSProperties => ({
      padding: "8px 14px", borderRadius: 8, border: `1px solid ${active ? "#2563eb" : "#334155"}`,
      background: active ? "#2563eb" : "transparent", color: active ? "#fff" : "#94a3b8",
      fontSize: 13, fontWeight: 700, cursor: "pointer",
    }),
    cardGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } as React.CSSProperties,
    cardTeamBlock: { display: "flex", flexDirection: "column" as const, gap: 8 },
    cardTeamName: { fontSize: 12, fontWeight: 700, color: "#94a3b8", textAlign: "center" as const },
    cardBtns: { display: "flex", gap: 6, justifyContent: "center" } as React.CSSProperties,
    yellowBtn: { flex: 1, height: 48, borderRadius: 10, border: "none", fontSize: 22, cursor: "pointer", background: "#ca8a04", fontWeight: 700 } as React.CSSProperties,
    redBtn: { flex: 1, height: 48, borderRadius: 10, border: "none", fontSize: 22, cursor: "pointer", background: "#dc2626", fontWeight: 700 } as React.CSSProperties,
    cardCount: { fontSize: 13, textAlign: "center" as const, color: "#94a3b8" },
    rugbyGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } as React.CSSProperties,
    rugbyBtn: (color: string): React.CSSProperties => ({
      height: 48, borderRadius: 10, border: "none", cursor: canScore ? "pointer" : "not-allowed",
      background: canScore ? color : "#1e293b", color: canScore ? "#fff" : "#475569",
      fontSize: 12, fontWeight: 700, padding: "0 6px",
    }),
    fullRegieLink: { display: "block", textAlign: "center" as const, marginTop: 20, color: "#3b82f6", fontSize: 13, textDecoration: "underline", cursor: "pointer", background: "none", border: "none" },
  };

  /* ─── render ─────────────────────────────────────────────────────────────── */
  if (loading) return <div style={{ ...s.page, display: "flex", alignItems: "center", justifyContent: "center" }}>Chargement…</div>;
  if (err) return <div style={{ ...s.page, color: "#f87171", padding: 24 }}>Erreur : {err}</div>;

  const periods = periodOptions(sport, periodCount);

  return (
    <div style={s.page}>
      {/* header */}
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => nav(-1)}>← Retour</button>
        <span style={s.matchName}>{matchName}</span>
        <span style={s.badge(status)}>{status === "live" ? "LIVE" : status === "paused" ? "PAUSE" : status === "finished" ? "TERMINÉ" : "PRÉPA"}</span>
      </div>

      {/* score */}
      <div style={s.card}>
        <div style={s.sectionTitle}>Score</div>
        <div style={s.scoreRow}>
          <div style={s.teamBlock}>
            <div style={s.teamName}>{homeName}</div>
            <div style={s.scoreNum}>{homeScore}</div>
            <div style={s.scoreActions}>
              <button style={canScore ? s.bigBtn("#b91c1c") : s.disabledBigBtn} onClick={() => changeScore("home", -1)} disabled={!canScore}>−</button>
              <button style={canScore ? s.bigBtn("#16a34a") : s.disabledBigBtn} onClick={() => changeScore("home", 1)} disabled={!canScore}>+</button>
            </div>
          </div>
          <div style={s.scoreSep}>:</div>
          <div style={s.teamBlock}>
            <div style={s.teamName}>{awayName}</div>
            <div style={s.scoreNum}>{awayScore}</div>
            <div style={s.scoreActions}>
              <button style={canScore ? s.bigBtn("#b91c1c") : s.disabledBigBtn} onClick={() => changeScore("away", -1)} disabled={!canScore}>−</button>
              <button style={canScore ? s.bigBtn("#16a34a") : s.disabledBigBtn} onClick={() => changeScore("away", 1)} disabled={!canScore}>+</button>
            </div>
          </div>
        </div>
      </div>

      {/* rugby scoring */}
      {isRugby && (
        <div style={s.card}>
          <div style={s.sectionTitle}>Marquage rugby</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(["tries", "conversions", "penalties", "drops"] as const).map((f) => {
                const labels = { tries: "Essai +5", conversions: "Transfo +2", penalties: "Pénalité +3", drops: "Drop +3" };
                const colors = { tries: "#15803d", conversions: "#0369a1", penalties: "#7c3aed", drops: "#c2410c" };
                return (
                  <button key={f} style={s.rugbyBtn(colors[f])} onClick={() => rugbyScore("home", f, 1)}>
                    {labels[f]}
                  </button>
                );
              })}
            </div>
            <div style={{ color: "#475569", fontSize: 20, alignSelf: "center" }}>|</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(["tries", "conversions", "penalties", "drops"] as const).map((f) => {
                const labels = { tries: "Essai +5", conversions: "Transfo +2", penalties: "Pénalité +3", drops: "Drop +3" };
                const colors = { tries: "#15803d", conversions: "#0369a1", penalties: "#7c3aed", drops: "#c2410c" };
                return (
                  <button key={f} style={s.rugbyBtn(colors[f])} onClick={() => rugbyScore("away", f, 1)}>
                    {labels[f]}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>{homeName}</span>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>{awayName}</span>
          </div>
        </div>
      )}

      {/* chrono */}
      <div style={s.card}>
        <div style={s.sectionTitle}>Chronomètre</div>
        <div style={s.clockDisplay}>{fmtClock(clockMs)}</div>
        <div style={s.clockActions}>
          {clockRunning
            ? <button style={s.clockBtn(true)} onClick={pauseClock}>⏸ Pause</button>
            : <button style={s.clockBtn(false)} onClick={startClock}>▶ {status === "scheduled" ? "Démarrer" : "Reprendre"}</button>
          }
        </div>
      </div>

      {/* période */}
      <div style={s.card}>
        <div style={s.sectionTitle}>Période actuelle : {periodLabel}</div>
        <div style={s.periodBtns}>
          {periods.map((p) => (
            <button key={p} style={s.periodBtn(p === periodLabel)} onClick={() => setPeriod(p)}>{p}</button>
          ))}
        </div>
      </div>

      {/* cartons */}
      <div style={s.card}>
        <div style={s.sectionTitle}>Cartons / sanctions</div>
        <div style={s.cardGrid}>
          {(["home", "away"] as const).map((side) => {
            const yellow = isRugby ? (side === "home" ? rugbyHomeYellow : rugbyAwayYellow) : (side === "home" ? homeYellow : awayYellow);
            const red = side === "home" ? homeRed : awayRed;
            const name = side === "home" ? homeName : awayName;
            return (
              <div key={side} style={s.cardTeamBlock}>
                <div style={s.cardTeamName}>{name}</div>
                <div style={s.cardBtns}>
                  <button style={s.yellowBtn} onClick={() => issueCard(side, "yellow")}>🟨</button>
                  <button style={s.redBtn} onClick={() => issueCard(side, "red")}>🟥</button>
                </div>
                <div style={s.cardCount}>
                  🟨 {yellow} &nbsp; 🟥 {red}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* link to full régie */}
      <button style={s.fullRegieLink} onClick={() => nav(`/matches/${matchId}/control`)}>
        Ouvrir la régie complète →
      </button>

      <PlayerPickerDialog state={pickerState} onClose={handlePickerClose} />
    </div>
  );
}
