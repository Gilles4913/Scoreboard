import React, { useEffect, useMemo, useRef, useState } from "react";

type ThemeMode = "light" | "dark";
type SportKey = "football" | "basket" | "volleyball" | "handball" | "rugby" | string;
type MatchStatus = "scheduled" | "live" | "paused" | "finished" | "archived" | string;

type Team = {
  name?: string | null;
  name_alt?: string | null; // dual-language (optionnel)
  logo_url?: string | null;
};

type Sponsor = {
  name: string;
  logo_url?: string | null;
};

export type DisplayContext = {
  // match identity / metadata
  match_id?: string;
  match_name?: string | null;
  venue?: string | null;

  // sport + status
  sport?: SportKey;
  status?: MatchStatus;

  // teams
  home?: Team;
  away?: Team;

  // score + time
  home_score?: number | null;
  away_score?: number | null;

  // clock in ms remaining or elapsed depending on sport rules; for stadium we just display mm:ss
  clock_ms?: number | null;
  clock_running?: boolean | null;

  // extra
  period_label?: string | null; // e.g. "MT", "2ème", "Q3", "1ère mi-temps"
  show_logos?: boolean;
  show_lower_third?: boolean;

  // stadium enhancements
  theme?: ThemeMode;
  dual_language?: boolean;
  lang_primary?: "FR" | "EN" | "DE" | "ES" | string;
  lang_secondary?: "FR" | "EN" | "DE" | "ES" | string;

  sponsors?: Sponsor[];
  sponsor_rotate_s?: number; // default 10

  // “pro” display settings (optional)
  accent?: string; // e.g. "#00D1FF"
};

type Props = {
  context: DisplayContext;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function fmtClock(ms?: number | null) {
  const mss = typeof ms === "number" && isFinite(ms) ? Math.max(0, Math.floor(ms)) : 0;
  const s = Math.floor(mss / 1000);
  const mm = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function pickText(primary?: string | null, fallback?: string | null) {
  const a = (primary || "").trim();
  if (a) return a;
  const b = (fallback || "").trim();
  if (b) return b;
  return "";
}

function sportLabel(sport?: string) {
  const k = (sport || "").toLowerCase();
  if (k === "football") return "Football";
  if (k === "basket") return "Basket";
  if (k === "volleyball") return "Volley";
  if (k === "handball") return "Hand";
  if (k === "rugby") return "Rugby";
  return sport || "";
}

function statusLabel(status?: string) {
  const k = (status || "").toLowerCase();
  if (k === "scheduled") return "Préparation";
  if (k === "live") return "En cours";
  if (k === "paused") return "Pause";
  if (k === "finished") return "Terminé";
  if (k === "archived") return "Archivé";
  return status || "";
}

function safeScore(v?: number | null) {
  if (typeof v !== "number" || !isFinite(v)) return 0;
  return Math.max(0, Math.floor(v));
}

function useBumpOnChange(value: number, durationMs = 320) {
  const [bump, setBump] = useState(false);
  const prevRef = useRef<number>(value);

  useEffect(() => {
    if (prevRef.current !== value) {
      prevRef.current = value;
      setBump(true);
      const t = setTimeout(() => setBump(false), durationMs);
      return () => clearTimeout(t);
    }
  }, [value, durationMs]);

  return bump;
}

function TeamBlock({
  side,
  team,
  dual,
  showLogos,
  theme,
}: {
  side: "home" | "away";
  team: Team | undefined;
  dual: boolean;
  showLogos: boolean;
  theme: ThemeMode;
}) {
  const name = pickText(team?.name, side === "home" ? "DOM" : "EXT");
  const nameAlt = pickText(team?.name_alt, "");
  const logo = (team?.logo_url || "").trim();

  const textColor = theme === "dark" ? "#F5F7FA" : "#0C1116";
  const subColor = theme === "dark" ? "rgba(245,247,250,0.75)" : "rgba(12,17,22,0.70)";

  return (
    <div
      style={{
        display: "grid",
        gridAutoFlow: "column",
        alignItems: "center",
        gap: 14,
        justifyContent: side === "home" ? "start" : "end",
      }}
    >
      {side === "away" && showLogos && logo ? (
        <img
          src={logo}
          alt=""
          style={{
            width: 56,
            height: 56,
            objectFit: "contain",
            filter: theme === "dark" ? "drop-shadow(0 6px 18px rgba(0,0,0,0.55))" : "drop-shadow(0 6px 18px rgba(0,0,0,0.25))",
          }}
        />
      ) : null}

      <div style={{ textAlign: side === "home" ? "left" : "right", lineHeight: 1.05 }}>
        <div
          style={{
            fontWeight: 900,
            letterSpacing: 0.6,
            fontSize: 34,
            color: textColor,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: 420,
          }}
          title={name}
        >
          {name}
        </div>

        {dual && nameAlt ? (
          <div
            style={{
              marginTop: 6,
              fontWeight: 700,
              fontSize: 16,
              color: subColor,
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: 420,
            }}
            title={nameAlt}
          >
            {nameAlt}
          </div>
        ) : null}
      </div>

      {side === "home" && showLogos && logo ? (
        <img
          src={logo}
          alt=""
          style={{
            width: 56,
            height: 56,
            objectFit: "contain",
            filter: theme === "dark" ? "drop-shadow(0 6px 18px rgba(0,0,0,0.55))" : "drop-shadow(0 6px 18px rgba(0,0,0,0.25))",
          }}
        />
      ) : null}
    </div>
  );
}

function SponsorStrip({
  sponsors,
  rotateS,
  theme,
}: {
  sponsors: Sponsor[];
  rotateS: number;
  theme: ThemeMode;
}) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!sponsors.length) return;
    const ms = clamp(Math.floor(rotateS * 1000), 2000, 60000);
    const t = setInterval(() => setIdx((p) => (p + 1) % sponsors.length), ms);
    return () => clearInterval(t);
  }, [sponsors.length, rotateS]);

  if (!sponsors.length) return null;
  const s = sponsors[idx];

  const bg = theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)";
  const bd = theme === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)";
  const tx = theme === "dark" ? "#F5F7FA" : "#0C1116";

  return (
    <div
      style={{
        display: "grid",
        gridAutoFlow: "column",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        borderRadius: 999,
        background: bg,
        border: `1px solid ${bd}`,
        maxWidth: 560,
        justifyContent: "center",
      }}
      title={s.name}
    >
      {s.logo_url ? (
        <img src={s.logo_url} alt="" style={{ width: 34, height: 34, objectFit: "contain" }} />
      ) : null}
      <div style={{ color: tx, fontWeight: 900, letterSpacing: 0.6, textTransform: "uppercase", fontSize: 14 }}>
        {s.name}
      </div>
    </div>
  );
}

export default function Scoreboard({ context }: Props) {
  const theme: ThemeMode = (context.theme || "dark") as ThemeMode;
  const accent = (context.accent || "#00D1FF").trim();

  const sport = (context.sport || "football") as SportKey;
  const status = (context.status || "scheduled") as MatchStatus;

  const showLogos = context.show_logos !== false;
  const showLowerThird = context.show_lower_third !== false;

  const dual = !!context.dual_language;

  const homeScore = safeScore(context.home_score);
  const awayScore = safeScore(context.away_score);

  const bumpHome = useBumpOnChange(homeScore);
  const bumpAway = useBumpOnChange(awayScore);

  const clockStr = useMemo(() => fmtClock(context.clock_ms), [context.clock_ms]);
  const period = (context.period_label || "").trim();

  const matchTitle = pickText(context.match_name, "Match");
  const venue = pickText(context.venue, "");

  const sponsors = Array.isArray(context.sponsors) ? context.sponsors : [];
  const rotateS = typeof context.sponsor_rotate_s === "number" ? context.sponsor_rotate_s : 10;

  // Layout colors
  const bg = theme === "dark" ? "#05070A" : "#F7F9FC";
  const panel = theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)";
  const border = theme === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)";
  const text = theme === "dark" ? "#F5F7FA" : "#0C1116";
  const sub = theme === "dark" ? "rgba(245,247,250,0.78)" : "rgba(12,17,22,0.70)";

  // Sport-specific “feel”
  const scoreSeparator = sport.toLowerCase() === "rugby" ? " - " : " : ";
  const clockLabel =
    sport.toLowerCase() === "basket"
      ? "TEMPS"
      : sport.toLowerCase() === "volleyball"
      ? "TEMPS"
      : sport.toLowerCase() === "handball"
      ? "TEMPS"
      : "TEMPS";

  const statusChipBg = theme === "dark" ? "rgba(0,209,255,0.14)" : "rgba(0,140,200,0.12)";
  const statusChipBd = theme === "dark" ? "rgba(0,209,255,0.32)" : "rgba(0,140,200,0.22)";

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: bg,
        color: text,
        overflow: "hidden",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji"',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          padding: "18px 28px 12px 28px",
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: 16,
        }}
      >
        <TeamBlock side="home" team={context.home} dual={dual} showLogos={showLogos} theme={theme} />

        {/* Center mini-info */}
        <div style={{ display: "grid", justifyItems: "center", gap: 8 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 14px",
              borderRadius: 999,
              background: panel,
              border: `1px solid ${border}`,
            }}
          >
            <span style={{ fontWeight: 900, letterSpacing: 0.8, textTransform: "uppercase" }}>{sportLabel(sport)}</span>
            <span style={{ opacity: 0.55 }}>•</span>
            <span style={{ fontWeight: 800, color: sub }}>{period || statusLabel(status)}</span>
          </div>

          {sponsors.length ? <SponsorStrip sponsors={sponsors} rotateS={rotateS} theme={theme} /> : null}
        </div>

        <TeamBlock side="away" team={context.away} dual={dual} showLogos={showLogos} theme={theme} />
      </div>

      {/* Main score panel */}
      <div
        style={{
          margin: "0 28px",
          padding: "26px 28px",
          borderRadius: 22,
          background: panel,
          border: `1px solid ${border}`,
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: 24,
          height: "calc(100vh - 220px)",
          minHeight: 360,
        }}
      >
        {/* Home score */}
        <div style={{ display: "grid", justifyItems: "center", gap: 16 }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 900,
              letterSpacing: 1.0,
              textTransform: "uppercase",
              color: sub,
            }}
          >
            DOM
          </div>
          <div
            style={{
              fontSize: 180,
              fontWeight: 950,
              lineHeight: 0.95,
              letterSpacing: 1.5,
              transform: bumpHome ? "scale(1.06)" : "scale(1)",
              transition: "transform 220ms ease",
              textShadow: theme === "dark" ? "0 22px 60px rgba(0,0,0,0.65)" : "0 18px 50px rgba(0,0,0,0.20)",
            }}
          >
            {homeScore}
          </div>
        </div>

        {/* Center: separator + clock */}
        <div style={{ display: "grid", justifyItems: "center", gap: 18 }}>
          <div
            style={{
              fontSize: 64,
              fontWeight: 900,
              color: sub,
              lineHeight: 1,
              letterSpacing: 1.4,
            }}
          >
            {scoreSeparator.trim()}
          </div>

          <div style={{ display: "grid", justifyItems: "center", gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: 1.2, color: sub, textTransform: "uppercase" }}>
              {clockLabel}
            </div>

            <div
              style={{
                fontSize: 76,
                fontWeight: 950,
                letterSpacing: 2.0,
                padding: "8px 18px",
                borderRadius: 18,
                border: `1px solid ${theme === "dark" ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.10)"}`,
                background: theme === "dark" ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.55)",
                boxShadow: theme === "dark" ? "0 18px 50px rgba(0,0,0,0.55)" : "0 14px 40px rgba(0,0,0,0.12)",
              }}
            >
              {clockStr}
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 14px",
                borderRadius: 999,
                border: `1px solid ${statusChipBd}`,
                background: statusChipBg,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: accent,
                  boxShadow: `0 0 18px ${accent}`,
                }}
              />
              <span style={{ fontWeight: 900, textTransform: "uppercase", letterSpacing: 1.0 }}>
                {statusLabel(status)}
              </span>
              {context.clock_running ? (
                <span style={{ fontSize: 12, opacity: 0.75 }}>(RUN)</span>
              ) : (
                <span style={{ fontSize: 12, opacity: 0.75 }}>(STOP)</span>
              )}
            </div>
          </div>
        </div>

        {/* Away score */}
        <div style={{ display: "grid", justifyItems: "center", gap: 16 }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 900,
              letterSpacing: 1.0,
              textTransform: "uppercase",
              color: sub,
            }}
          >
            EXT
          </div>
          <div
            style={{
              fontSize: 180,
              fontWeight: 950,
              lineHeight: 0.95,
              letterSpacing: 1.5,
              transform: bumpAway ? "scale(1.06)" : "scale(1)",
              transition: "transform 220ms ease",
              textShadow: theme === "dark" ? "0 22px 60px rgba(0,0,0,0.65)" : "0 18px 50px rgba(0,0,0,0.20)",
            }}
          >
            {awayScore}
          </div>
        </div>
      </div>

      {/* Lower-third */}
      {showLowerThird ? (
        <div
          style={{
            position: "fixed",
            left: 18,
            right: 18,
            bottom: 18,
            display: "grid",
            gridTemplateColumns: "1fr auto",
            alignItems: "center",
            gap: 14,
            padding: "14px 16px",
            borderRadius: 18,
            background: theme === "dark" ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.70)",
            border: `1px solid ${theme === "dark" ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.10)"}`,
            backdropFilter: "blur(10px)",
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 950,
                letterSpacing: 0.4,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={matchTitle}
            >
              {matchTitle}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", color: sub, fontSize: 13 }}>
              {venue ? <span>📍 {venue}</span> : null}
              <span style={{ opacity: 0.55 }}>•</span>
              <span>{sportLabel(sport)}</span>
              <span style={{ opacity: 0.55 }}>•</span>
              <span>{statusLabel(status)}</span>
              {period ? (
                <>
                  <span style={{ opacity: 0.55 }}>•</span>
                  <span>{period}</span>
                </>
              ) : null}
            </div>
          </div>

          {/* right chips */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "end", flexWrap: "wrap" }}>
            {dual ? (
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: 999,
                  border: `1px solid ${border}`,
                  background: panel,
                  fontWeight: 900,
                  letterSpacing: 1.0,
                  textTransform: "uppercase",
                  fontSize: 12,
                }}
              >
                {(context.lang_primary || "FR") + "/" + (context.lang_secondary || "EN")}
              </div>
            ) : null}
            <div
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                border: `1px solid ${border}`,
                background: panel,
                fontWeight: 900,
                letterSpacing: 1.0,
                textTransform: "uppercase",
                fontSize: 12,
              }}
            >
              Stadium Mode
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
