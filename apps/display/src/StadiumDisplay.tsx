import React, { useEffect, useMemo, useRef, useState } from "react";
import "./stadium.css";

type Snapshot = any;

function fmtClock(sec: number | null | undefined) {
  const s = Math.max(0, Math.floor(sec ?? 0));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function nowTs() {
  return Date.now();
}

export default function StadiumDisplay({ snapshot }: { snapshot: Snapshot }) {
  // Flexible mapping: on accepte plusieurs schémas possibles
  const homeName = snapshot?.home_name ?? snapshot?.homeTeam?.name ?? "HOME";
  const awayName = snapshot?.away_name ?? snapshot?.awayTeam?.name ?? "AWAY";
  const homeLogo = snapshot?.home_logo_url ?? snapshot?.homeTeam?.logo_url ?? null;
  const awayLogo = snapshot?.away_logo_url ?? snapshot?.awayTeam?.logo_url ?? null;

  const [homeScore, setHomeScore] = useState<number>(Number(snapshot?.home_score ?? 0));
  const [awayScore, setAwayScore] = useState<number>(Number(snapshot?.away_score ?? 0));

  const [period, setPeriod] = useState<string>(String(snapshot?.period ?? "P1"));
  const [running, setRunning] = useState<boolean>(Boolean(snapshot?.running ?? false));

  // clockSec: état local (tick UI), baseFromEventSec + lastSyncTs pour recalcul
  const [baseClock, setBaseClock] = useState<number>(Number(snapshot?.clock ?? snapshot?.clock_sec ?? 0));
  const lastSyncRef = useRef<number>(nowTs());
  const [clockUi, setClockUi] = useState<number>(baseClock);

  const [ticker, setTicker] = useState<Array<{ msg: string; ts: number }>>([
    { msg: snapshot?.name ? String(snapshot.name) : "SB2 Stadium Mode", ts: nowTs() },
  ]);

  // Moment overlay (GOAL / TRY / 3PTS)
  const [moment, setMoment] = useState<{ title: string; subtitle?: string } | null>(null);
  const momentTimer = useRef<number | null>(null);

  // UI tick (60fps light)
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!running) {
        setClockUi(baseClock);
        return;
      }
      const dt = (nowTs() - lastSyncRef.current) / 1000;
      setClockUi(Math.max(0, baseClock - dt));
    }, 1000 / 30); // 30fps is enough and stable

    return () => window.clearInterval(id);
  }, [running, baseClock]);

  function pushTicker(msg: string) {
    setTicker((prev) => [{ msg, ts: nowTs() }, ...prev].slice(0, 6));
  }

  function showMoment(title: string, subtitle?: string) {
    setMoment({ title, subtitle });
    if (momentTimer.current) window.clearTimeout(momentTimer.current);
    momentTimer.current = window.setTimeout(() => setMoment(null), 2500);
  }

  // Expose imperative API via window for TV events (we’ll call setState externally)
  // This keeps StadiumDisplay dumb and compatible.
  (window as any).__SB2_STADIUM_API__ = {
    scoreSet: (h: number, a: number) => {
      setHomeScore(h); setAwayScore(a);
    },
    timerSet: (sec: number) => {
      setBaseClock(sec);
      lastSyncRef.current = nowTs();
      setClockUi(sec);
    },
    timerStart: () => {
      lastSyncRef.current = nowTs();
      setRunning(true);
      pushTicker("⏱️ Chrono lancé");
    },
    timerPause: () => {
      // freeze current
      const frozen = clockUi;
      setBaseClock(frozen);
      lastSyncRef.current = nowTs();
      setRunning(false);
      pushTicker("⏸️ Chrono en pause");
    },
    periodSet: (p: string) => {
      setPeriod(p);
      pushTicker(`📍 Période: ${p}`);
    },
    moment: (title: string, subtitle?: string) => {
      showMoment(title, subtitle);
      pushTicker(title + (subtitle ? ` — ${subtitle}` : ""));
    },
    patch: (obj: any) => {
      // optional: allow patching known fields
      if (typeof obj?.home_score === "number") setHomeScore(obj.home_score);
      if (typeof obj?.away_score === "number") setAwayScore(obj.away_score);
      if (typeof obj?.clock === "number") {
        setBaseClock(obj.clock);
        lastSyncRef.current = nowTs();
        setClockUi(obj.clock);
      }
      if (typeof obj?.running === "boolean") setRunning(obj.running);
      if (typeof obj?.period === "string") setPeriod(obj.period);
      if (typeof obj?.ticker === "string") pushTicker(obj.ticker);
    },
  };

  const liveBadge = running ? "LIVE" : "PAUSE";

  return (
    <div className="sb2-stadium">
      <div className="sb2-top">
        <div className="sb2-card sb2-hero">
          <div className="team">
            {homeLogo ? <img className="logo" src={homeLogo} alt="home" /> : <div className="logo" />}
            <div style={{ minWidth: 0 }}>
              <div className="name">{homeName}</div>
              <div className="sub">Domicile</div>
            </div>
          </div>

          <div className="center">
            <div className="score">
              <div className="n">{homeScore}</div>
              <div className="sep">—</div>
              <div className="n">{awayScore}</div>
            </div>

            <div className="clockWrap">
              <span className={`badge ${running ? "live" : ""}`}>{liveBadge}</span>
              <span className="clock">{fmtClock(clockUi)}</span>
              <span className="badge">{period}</span>
            </div>
          </div>

          <div className="team right">
            <div style={{ minWidth: 0 }}>
              <div className="name">{awayName}</div>
              <div className="sub">Extérieur</div>
            </div>
            {awayLogo ? <img className="logo" src={awayLogo} alt="away" /> : <div className="logo" />}
          </div>
        </div>

        <div className="sb2-card sb2-side">
          <div className="blockTitle">Match</div>
          <div className="kv">
            <b>Nom</b><span>{snapshot?.name ?? "—"}</span>
          </div>
          <div className="kv">
            <b>Sport</b><span>{snapshot?.sport ?? "—"}</span>
          </div>
          <div className="kv">
            <b>Statut</b><span>{snapshot?.status ?? "—"}</span>
          </div>

          <div className="blockTitle" style={{ marginTop: 6 }}>Hints</div>
          <div className="kv">
            <b>Mode</b><span>Stadium / LED</span>
          </div>
          <div className="kv">
            <b>Updates</b><span>WS Relay</span>
          </div>
        </div>
      </div>

      <div className="sb2-bottom">
        <div className="sb2-card ticker">
          <div className="blockTitle">Live ticker</div>
          {ticker.map((t) => (
            <div className="tickerRow" key={t.ts}>
              <div className="dot" />
              <div className="tickerMsg">{t.msg}</div>
              <div className="tickerMeta">{new Date(t.ts).toLocaleTimeString()}</div>
            </div>
          ))}
        </div>
      </div>

      {moment && (
        <div className="moment">
          <div className="box">
            <h1 className="title">{moment.title}</h1>
            {moment.subtitle ? <div className="subt">{moment.subtitle}</div> : null}
          </div>
        </div>
      )}
    </div>
  );
}
