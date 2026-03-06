import React, { useEffect, useMemo, useRef, useState } from "react";

type ThemeMode = "dark" | "light";
type SportKey = "football" | "basket" | "handball" | "rugby" | "volleyball" | string;
type MatchStatus = "scheduled" | "live" | "paused" | "finished" | "archived" | string;

type TeamInfo = {
  name?: string | null;
  short_name?: string | null;
  logo_url?: string | null;
};

type SponsorItem = {
  name: string;
  logo_url?: string | null;
};

export type ScoreboardContext = {
  match_id?: string;
  match_name?: string | null;
  venue?: string | null;

  sport?: SportKey;
  status?: MatchStatus;

  home?: TeamInfo;
  away?: TeamInfo;

  home_name?: string | null;
  away_name?: string | null;

  home_score?: number | null;
  away_score?: number | null;

  clock_ms?: number | null;
  clock_running?: boolean | null;

  period_label?: string | null;

  theme?: ThemeMode;
  dual_language?: boolean;
  lang_primary?: "FR" | "EN" | string;
  lang_secondary?: "FR" | "EN" | string;

  show_lower_third?: boolean;
  show_logos?: boolean;

  sponsors?: SponsorItem[];
  sponsor_rotate_s?: number;

  accent?: string;
};

type Props = {
  context: ScoreboardContext;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function safeScore(v?: number | null) {
  if (typeof v !== "number" || !isFinite(v)) return 0;
  return Math.max(0, Math.floor(v));
}

function fmtClock(ms?: number | null) {
  const val = typeof ms === "number" && isFinite(ms) ? Math.max(0, Math.floor(ms)) : 0;
  const s = Math.floor(val / 1000);
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function sportLabel(s?: string) {
  const v = (s || "").toLowerCase();
  if (v === "football") return "FOOTBALL";
  if (v === "basket") return "BASKET";
  if (v === "handball") return "HANDBALL";
  if (v === "rugby") return "RUGBY";
  if (v === "volleyball") return "VOLLEY";
  return (s || "SPORT").toUpperCase();
}

function statusLabel(s?: string) {
  const v = (s || "").toLowerCase();
  if (v === "scheduled") return "À PRÉPARER";
  if (v === "live") return "EN COURS";
  if (v === "paused") return "PAUSE";
  if (v === "finished") return "TERMINÉ";
  if (v === "archived") return "ARCHIVÉ";
  return (s || "LIVE").toUpperCase();
}

function useBumpOnChange(value: number, duration = 280) {
  const prev = useRef(value);
  const [bump, setBump] = useState(false);

  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      setBump(true);
      const t = setTimeout(() => setBump(false), duration);
      return () => clearTimeout(t);
    }
  }, [value, duration]);

  return bump;
}

function useRotatingSponsor(items: SponsorItem[], seconds: number) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const t = setInterval(() => {
      setIdx((p) => (p + 1) % items.length);
    }, clamp(seconds, 3, 60) * 1000);

    return () => clearInterval(t);
  }, [items, seconds]);

  return items.length ? items[idx] : null;
}

function SegmentDigits({
  value,
  theme,
  accent,
  size = 120,
  bump = false,
}: {
  value: string;
  theme: ThemeMode;
  accent: string;
  size?: number;
  bump?: boolean;
}) {
  return (
    <div
      style={{
        fontFamily: `'Courier New', 'Lucida Console', monospace`,
        fontWeight: 900,
        letterSpacing: 6,
        lineHeight: 1,
        fontSize: size,
        color: accent,
        textShadow:
          theme === "dark"
            ? `0 0 10px ${accent}, 0 0 24px ${accent}, 0 0 42px rgba(255,255,255,.16)`
            : `0 0 2px ${accent}`,
        transform: bump ? "scale(1.06)" : "scale(1)",
        transition: "transform 180ms ease",
        userSelect: "none",
      }}
    >
      {value}
    </div>
  );
}

function TeamName({
  name,
  logo,
  align,
  theme,
  dual,
  altName,
  showLogo,
}: {
  name: string;
  altName?: string;
  logo?: string | null;
  align: "left" | "right";
  theme: ThemeMode;
  dual: boolean;
  showLogo: boolean;
}) {
  const textColor = theme === "dark" ? "#edf2ff" : "#0f172a";
  const subColor = theme === "dark" ? "rgba(237,242,255,.72)" : "rgba(15,23,42,.68)";

  const block = (
    <div style={{ textAlign: align }}>
      <div
        style={{
          fontWeight: 900,
          fontSize: 34,
          lineHeight: 1.05,
          color: textColor,
          textTransform: "uppercase",
          letterSpacing: 0.8,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: 360,
        }}
        title={name}
      >
        {name}
      </div>
      {dual && altName ? (
        <div
          style={{
            marginTop: 6,
            color: subColor,
            fontSize: 14,
            fontWeight: 700,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: 360,
          }}
          title={altName}
        >
          {altName}
        </div>
      ) : null}
    </div>
  );

  const logoEl =
    showLogo && logo ? (
      <img
        src={logo}
        alt=""
        style={{
          width: 62,
          height: 62,
          objectFit: "contain",
          filter: theme === "dark" ? "drop-shadow(0 8px 22px rgba(0,0,0,.55))" : "drop-shadow(0 6px 16px rgba(0,0,0,.18))",
        }}
      />
    ) : null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: align === "left" ? "flex-start" : "flex-end",
        gap: 14,
      }}
    >
      {align === "right" ? logoEl : null}
      {block}
      {align === "left" ? logoEl : null}
    </div>
  );
}

export default function Scoreboard({ context }: Props) {
  const theme: ThemeMode = context.theme === "light" ? "light" : "dark";
  const accent = (context.accent || "#00d9ff").trim();

  const homeName = context.home?.name || context.home_name || "DOMICILE";
  const awayName = context.away?.name || context.away_name || "EXTÉRIEUR";

  const homeAlt = context.home?.short_name || "";
  const awayAlt = context.away?.short_name || "";

  const homeLogo = context.home?.logo_url || null;
  const awayLogo = context.away?.logo_url || null;

  const homeScore = safeScore(context.home_score);
  const awayScore = safeScore(context.away_score);

  const homeBump = useBumpOnChange(homeScore);
  const awayBump = useBumpOnChange(awayScore);

  const dual = !!context.dual_language;
  const showLowerThird = context.show_lower_third !== false;
  const showLogos = context.show_logos !== false;

  const sponsor = useRotatingSponsor(context.sponsors || [], context.sponsor_rotate_s || 10);

  const bg = theme === "dark" ? "#04070a" : "#f7f8fb";
  const panel = theme === "dark" ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)";
  const border = theme === "dark" ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.10)";
  const text = theme === "dark" ? "#edf2ff" : "#0f172a";
  const sub = theme === "dark" ? "rgba(237,242,255,.72)" : "rgba(15,23,42,.68)";

  const sport = sportLabel(context.sport);
  const status = statusLabel(context.status);
  const period = (context.period_label || "").trim();
  const venue = (context.venue || "").trim();
  const matchName = (context.match_name || `${homeName} vs ${awayName}`).trim();

  const scoreSeparator = context.sport === "rugby" ? "-" : ":";
  const clockText = fmtClock(context.clock_ms);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: bg,
        color: text,
        overflow: "hidden",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          padding: "18px 24px 12px",
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: 18,
        }}
      >
        <TeamName
          name={homeName}
          altName={homeAlt}
          logo={homeLogo}
          align="left"
          theme={theme}
          dual={dual}
          showLogo={showLogos}
        />

        <div style={{ display: "grid", justifyItems: "center", gap: 10 }}>
          <div
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              background: panel,
              border: `1px solid ${border}`,
              fontSize: 15,
              fontWeight: 900,
              letterSpacing: 1.1,
            }}
          >
            {sport} • {period || status}
          </div>

          {sponsor ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 14px",
                borderRadius: 999,
                background: panel,
                border: `1px solid ${border}`,
              }}
            >
              {sponsor.logo_url ? (
                <img src={sponsor.logo_url} alt="" style={{ width: 26, height: 26, objectFit: "contain" }} />
              ) : null}
              <span style={{ fontSize: 13, fontWeight: 800, color: sub }}>{sponsor.name}</span>
            </div>
          ) : null}
        </div>

        <TeamName
          name={awayName}
          altName={awayAlt}
          logo={awayLogo}
          align="right"
          theme={theme}
          dual={dual}
          showLogo={showLogos}
        />
      </div>

      {/* Main board */}
      <div
        style={{
          margin: "0 24px",
          height: "calc(100vh - 190px)",
          minHeight: 420,
          borderRadius: 26,
          background: panel,
          border: `1px solid ${border}`,
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: 16,
          padding: "22px 26px",
          boxShadow: theme === "dark" ? "0 30px 80px rgba(0,0,0,.45)" : "0 20px 60px rgba(0,0,0,.08)",
        }}
      >
        {/* Home */}
        <div style={{ display: "grid", justifyItems: "center", gap: 12 }}>
          <div style={{ color: sub, fontWeight: 900, letterSpacing: 1.1 }}>DOM</div>
          <SegmentDigits value={String(homeScore)} theme={theme} accent={accent} size={180} bump={homeBump} />
        </div>

        {/* Center */}
        <div style={{ display: "grid", justifyItems: "center", gap: 18, minWidth: 260 }}>
          <div style={{ color: sub, fontWeight: 900, fontSize: 54, lineHeight: 1 }}>
            {scoreSeparator}
          </div>

          <div
            style={{
              padding: "14px 20px",
              borderRadius: 20,
              border: `1px solid ${border}`,
              background: theme === "dark" ? "rgba(0,0,0,.22)" : "rgba(255,255,255,.6)",
              boxShadow: theme === "dark" ? "0 16px 42px rgba(0,0,0,.48)" : "0 12px 32px rgba(0,0,0,.10)",
              display: "grid",
              justifyItems: "center",
              gap: 8,
            }}
          >
            <div style={{ color: sub, fontSize: 12, fontWeight: 900, letterSpacing: 1.6 }}>TEMPS</div>
            <SegmentDigits value={clockText} theme={theme} accent={accent} size={86} />
          </div>

          <div
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: `1px solid ${border}`,
              background: panel,
              fontSize: 13,
              fontWeight: 900,
              letterSpacing: 1.1,
            }}
          >
            {status}
            {context.clock_running ? " • RUN" : " • STOP"}
          </div>
        </div>

        {/* Away */}
        <div style={{ display: "grid", justifyItems: "center", gap: 12 }}>
          <div style={{ color: sub, fontWeight: 900, letterSpacing: 1.1 }}>EXT</div>
          <SegmentDigits value={String(awayScore)} theme={theme} accent={accent} size={180} bump={awayBump} />
        </div>
      </div>

      {/* Lower third */}
      {showLowerThird ? (
        <div
          style={{
            position: "fixed",
            left: 18,
            right: 18,
            bottom: 18,
            borderRadius: 18,
            background: theme === "dark" ? "rgba(0,0,0,.44)" : "rgba(255,255,255,.72)",
            border: `1px solid ${border}`,
            backdropFilter: "blur(10px)",
            display: "grid",
            gridTemplateColumns: "1fr auto",
            alignItems: "center",
            gap: 16,
            padding: "14px 16px",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 900,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={matchName}
            >
              {matchName}
            </div>
            <div style={{ marginTop: 4, color: sub, fontSize: 13 }}>
              {venue ? `📍 ${venue} • ` : ""}
              {sport} • {status}
              {period ? ` • ${period}` : ""}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {dual ? (
              <span
                style={{
                  padding: "7px 10px",
                  borderRadius: 999,
                  background: panel,
                  border: `1px solid ${border}`,
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                {(context.lang_primary || "FR") + "/" + (context.lang_secondary || "EN")}
              </span>
            ) : null}

            <span
              style={{
                padding: "7px 10px",
                borderRadius: 999,
                background: panel,
                border: `1px solid ${border}`,
                fontSize: 12,
                fontWeight: 900,
              }}
            >
              LED STADIUM
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
