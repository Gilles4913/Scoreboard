import React, { useEffect, useMemo, useRef, useState } from "react";

type Team = {
  id?: string;
  name: string;
  short_name?: string | null;
  logo_url?: string | null;
};

type SponsorItem = {
  id: string;
  label: string;
  logo_url?: string | null;
  url?: string | null;
};

export type DisplaySettings = {
  // global
  theme?: "light" | "dark";
  mode?: "standard" | "stadium"; // stadium = LED
  language?: "fr" | "en" | "de" | "es";
  dual_language?: boolean;
  second_language?: "fr" | "en" | "de" | "es";

  // widgets
  show_logos?: boolean;
  show_lower_third?: boolean;
  show_sponsors?: boolean;
  sponsor_rotation_ms?: number; // ex 10000

  // animations
  score_bump?: boolean;

  // layout sizing (stadium)
  stadium_scale?: number; // 1 = normal; 1.2 / 1.4 bigger
};

export type MatchDisplayContext = {
  match_id: string;
  sport: "football" | "basket" | "volleyball" | "handball" | "rugby";
  status?: "scheduled" | "live" | "ended" | "archived" | string;

  home: Team;
  away: Team;

  // score
  home_score: number;
  away_score: number;

  // clock
  clock_ms?: number; // remaining or elapsed depending on your logic
  clock_label?: string | null; // e.g. "1ère mi-temps"
  clock_running?: boolean;

  // meta
  title?: string | null; // match name
  venue?: string | null;
  competition?: string | null;

  // sponsors
  sponsors?: SponsorItem[];

  // display settings (merged org/team/match)
  display?: DisplaySettings;
};

type Props = {
  ctx: MatchDisplayContext;
};

const I18N: Record<string, Record<string, string>> = {
  fr: { vs: "vs", time: "Temps", live: "EN COURS", scheduled: "À VENIR", ended: "TERMINÉ" },
  en: { vs: "vs", time: "Time", live: "LIVE", scheduled: "UPCOMING", ended: "FINISHED" },
  de: { vs: "vs", time: "Zeit", live: "LIVE", scheduled: "KOMMEND", ended: "BEENDET" },
  es: { vs: "vs", time: "Tiempo", live: "EN VIVO", scheduled: "PRÓXIMO", ended: "FINALIZADO" },
};

function t(lang: string, key: string) {
  return (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
}

function fmtClock(ms?: number) {
  if (ms == null) return "00:00";
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function pickTeamLabel(team: Team) {
  return team.short_name && team.short_name.trim().length > 0 ? team.short_name : team.name;
}

function useInterval(callback: () => void, delay: number | null) {
  const savedRef = useRef(callback);
  useEffect(() => {
    savedRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay == null) return;
    const id = setInterval(() => savedRef.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

export default function Scoreboard({ ctx }: Props) {
  const display = ctx.display || {};
  const theme = display.theme || "dark";
  const mode = display.mode || "standard";
  const stadiumScale = clamp(display.stadium_scale ?? (mode === "stadium" ? 1.25 : 1), 0.8, 2.0);

  const lang1 = display.language || "fr";
  const dual = Boolean(display.dual_language);
  const lang2 = display.second_language || "en";

  const showLogos = display.show_logos !== false;
  const showLowerThird = Boolean(display.show_lower_third);
  const showSponsors = Boolean(display.show_sponsors);
  const sponsorRotationMs = clamp(display.sponsor_rotation_ms ?? 10000, 3000, 60000);

  const scoreBump = display.score_bump !== false;

  // Sponsor rotation
  const sponsors = ctx.sponsors || [];
  const [sponsorIndex, setSponsorIndex] = useState(0);
  useInterval(
    () => {
      if (!showSponsors || sponsors.length <= 1) return;
      setSponsorIndex((i) => (i + 1) % sponsors.length);
    },
    showSponsors && sponsors.length > 1 ? sponsorRotationMs : null
  );

  // Score bump animation
  const prevScoreRef = useRef({ h: ctx.home_score, a: ctx.away_score });
  const [bump, setBump] = useState<{ home: boolean; away: boolean }>({ home: false, away: false });

  useEffect(() => {
    const prev = prevScoreRef.current;
    const homeChanged = ctx.home_score !== prev.h;
    const awayChanged = ctx.away_score !== prev.a;

    if (scoreBump && (homeChanged || awayChanged)) {
      setBump({ home: homeChanged, away: awayChanged });
      const id = setTimeout(() => setBump({ home: false, away: false }), 450);
      prevScoreRef.current = { h: ctx.home_score, a: ctx.away_score };
      return () => clearTimeout(id);
    }

    prevScoreRef.current = { h: ctx.home_score, a: ctx.away_score };
  }, [ctx.home_score, ctx.away_score, scoreBump]);

  // Styles
  const styles = useMemo(() => {
    const dark = theme === "dark";
    const bg = dark ? "#06070a" : "#f6f7fb";
    const panel = dark ? "#0b0d12" : "#ffffff";
    const text = dark ? "#e5e7eb" : "#111827";
    const muted = dark ? "#a7b0bf" : "#6b7280";
    const border = dark ? "#1f2a3a" : "#e5e7eb";

    const accent = ctx.sport === "basket" ? "#f59e0b" : ctx.sport === "volleyball" ? "#22c55e" : ctx.sport === "handball" ? "#3b82f6" : ctx.sport === "rugby" ? "#a855f7" : "#ef4444";

    // Stadium typographic scale
    const base = mode === "stadium" ? 18 : 14;
    const scale = stadiumScale;

    return {
      root: {
        width: "100%",
        height: "100vh",
        background: bg,
        color: text,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "system-ui",
      } as React.CSSProperties,

      // Main body: centered scoreboard
      body: {
        flex: 1,
        display: "grid",
        placeItems: "center",
        padding: 18,
      } as React.CSSProperties,

      board: {
        width: "min(1400px, 96vw)",
        background: panel,
        border: `1px solid ${border}`,
        borderRadius: 22,
        padding: 18,
        boxShadow: dark ? "0 20px 60px rgba(0,0,0,.55)" : "0 20px 60px rgba(17,24,39,.12)",
        transform: `scale(${scale})`,
        transformOrigin: "center",
      } as React.CSSProperties,

      header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        marginBottom: 10,
      } as React.CSSProperties,

      pill: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontWeight: 900,
        fontSize: base * 0.95,
        padding: "8px 12px",
        borderRadius: 999,
        border: `1px solid ${border}`,
        background: dark ? "rgba(255,255,255,.04)" : "rgba(17,24,39,.04)",
        letterSpacing: 0.3,
      } as React.CSSProperties,

      dot: {
        width: 10,
        height: 10,
        borderRadius: 999,
        background: accent,
        boxShadow: `0 0 0 4px ${dark ? "rgba(255,255,255,.05)" : "rgba(17,24,39,.05)"}`,
      } as React.CSSProperties,

      clock: {
        textAlign: "right",
      } as React.CSSProperties,
      clockTime: {
        fontSize: base * 2.4,
        fontWeight: 1000,
        letterSpacing: 1,
        lineHeight: 1,
      } as React.CSSProperties,
      clockMeta: {
        fontSize: base * 0.95,
        color: muted,
        marginTop: 4,
        fontWeight: 800,
      } as React.CSSProperties,

      grid: {
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        gap: 14,
      } as React.CSSProperties,

      team: {
        display: "flex",
        alignItems: "center",
        gap: 14,
        minWidth: 0,
      } as React.CSSProperties,
      teamRight: {
        justifyContent: "flex-end",
        textAlign: "right",
      } as React.CSSProperties,

      logo: {
        width: base * 3.2,
        height: base * 3.2,
        borderRadius: 14,
        border: `1px solid ${border}`,
        objectFit: "contain",
        background: dark ? "rgba(255,255,255,.03)" : "#fff",
        padding: 6,
      } as React.CSSProperties,

      teamName: {
        fontSize: base * 1.45,
        fontWeight: 1000,
        letterSpacing: 0.2,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxWidth: "520px",
      } as React.CSSProperties,

      scoreBox: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        borderRadius: 18,
        border: `1px solid ${border}`,
        background: dark ? "rgba(255,255,255,.04)" : "rgba(17,24,39,.04)",
      } as React.CSSProperties,

      score: {
        fontSize: base * 4.0,
        fontWeight: 1100,
        lineHeight: 1,
        letterSpacing: 1,
        minWidth: base * 3.1,
        textAlign: "center",
        transition: "transform 120ms ease",
      } as React.CSSProperties,

      bump: {
        transform: "scale(1.18)",
      } as React.CSSProperties,

      dash: {
        fontSize: base * 2.6,
        fontWeight: 1000,
        opacity: 0.8,
        padding: "0 6px",
      } as React.CSSProperties,

      // Lower third
      lowerThirdWrap: {
        borderTop: `1px solid ${border}`,
        background: dark ? "rgba(255,255,255,.03)" : "rgba(17,24,39,.03)",
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        justifyContent: "space-between",
      } as React.CSSProperties,
      lowerTitle: {
        fontWeight: 1000,
        fontSize: base * 1.1,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        maxWidth: "70%",
      } as React.CSSProperties,
      lowerMeta: {
        color: muted,
        fontWeight: 800,
        fontSize: base * 0.95,
        textAlign: "right",
        whiteSpace: "nowrap",
      } as React.CSSProperties,

      // Sponsor
      sponsor: {
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        borderRadius: 999,
        border: `1px solid ${border}`,
        background: dark ? "rgba(255,255,255,.04)" : "rgba(17,24,39,.04)",
        fontWeight: 900,
        fontSize: base * 0.95,
      } as React.CSSProperties,
      sponsorLogo: {
        width: base * 2.0,
        height: base * 2.0,
        objectFit: "contain",
        borderRadius: 10,
        background: "#fff",
        padding: 4,
        border: `1px solid ${border}`,
      } as React.CSSProperties,
    };
  }, [theme, mode, stadiumScale, ctx.sport]);

  const statusLabel = useMemo(() => {
    const st = (ctx.status || "").toLowerCase();
    if (st === "live") return t(lang1, "live");
    if (st === "scheduled") return t(lang1, "scheduled");
    if (st === "ended" || st === "archived") return t(lang1, "ended");
    return st ? st.toUpperCase() : t(lang1, "live");
  }, [ctx.status, lang1]);

  const headerLeft = useMemo(() => {
    const l1 = `${ctx.sport.toUpperCase()} • ${statusLabel}`;
    if (!dual) return l1;
    const l2 = `${ctx.sport.toUpperCase()} • ${t(lang2, (ctx.status || "live").toLowerCase())}`;
    return `${l1}  |  ${l2}`;
  }, [ctx.sport, ctx.status, statusLabel, dual, lang2, lang1]);

  const homeLabel = pickTeamLabel(ctx.home);
  const awayLabel = pickTeamLabel(ctx.away);

  const sponsor = sponsors.length > 0 ? sponsors[sponsorIndex % sponsors.length] : null;

 const lowerThirdText = useMemo(() => {
  const title = ctx.title || `${ctx.home.name} ${t(lang1, "vs")} ${ctx.away.name}`;
  const comp = ctx.competition ? ctx.competition : "";
  const venue = ctx.venue ? ctx.venue : "";
  const sportStatus = `${ctx.sport.toUpperCase()} • ${statusLabel}`;
  return {
    title,
    meta: [sportStatus, comp, venue].filter(Boolean).join(" • ") || " ",
  };
}, [ctx.title, ctx.home.name, ctx.away.name, ctx.competition, ctx.venue, ctx.sport, statusLabel, lang1]);

  const clockTime = fmtClock(ctx.clock_ms);
  const clockMeta = ctx.clock_label || (ctx.clock_running ? "⏱" : "");

  return (
    <div style={styles.root}>
      <div style={styles.body}>
        <div style={styles.board}>
          {/* Header */}
          <div style={styles.header}>
            <div style={styles.pill}>
              <span style={styles.dot} />
              <span>{headerLeft}</span>
              {showSponsors && sponsor ? (
                <span style={styles.sponsor}>
                  {sponsor.logo_url ? <img src={sponsor.logo_url} alt={sponsor.label} style={styles.sponsorLogo} /> : null}
                  <span>{sponsor.label}</span>
                </span>
              ) : null}
            </div>

            <div style={styles.clock}>
              <div style={styles.clockTime}>{clockTime}</div>
              <div style={styles.clockMeta}>
                {clockMeta}
                {dual ? `  |  ${t(lang2, "time")}` : ""}
              </div>
            </div>
          </div>

          {/* Teams + Score */}
          <div style={styles.grid}>
            <div style={styles.team}>
              {showLogos && ctx.home.logo_url ? <img src={ctx.home.logo_url} alt={ctx.home.name} style={styles.logo} /> : null}
              <div style={styles.teamName} title={ctx.home.name}>
                {homeLabel}
              </div>
            </div>

            <div style={styles.scoreBox}>
              <div style={{ ...styles.score, ...(bump.home ? styles.bump : {}) }}>{ctx.home_score}</div>
              <div style={styles.dash}>—</div>
              <div style={{ ...styles.score, ...(bump.away ? styles.bump : {}) }}>{ctx.away_score}</div>
            </div>

            <div style={{ ...styles.team, ...styles.teamRight }}>
              <div style={styles.teamName} title={ctx.away.name}>
                {awayLabel}
              </div>
              {showLogos && ctx.away.logo_url ? <img src={ctx.away.logo_url} alt={ctx.away.name} style={styles.logo} /> : null}
            </div>
          </div>

          {/* Lower third */}
          {showLowerThird ? (
            <div style={styles.lowerThirdWrap}>
              <div style={styles.lowerTitle} title={lowerThirdText.title}>
                {lowerThirdText.title}
              </div>
              <div style={styles.lowerMeta} title={lowerThirdText.meta}>
                {lowerThirdText.meta}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
