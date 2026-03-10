import React, { useEffect, useMemo, useRef, useState } from "react";

type ThemeMode = "dark" | "light";
type SportKey = "football" | "basket" | "handball" | "rugby" | "volleyball" | string;
type MatchStatus = "scheduled" | "live" | "paused" | "finished" | "archived" | string;

type TeamInfo = {
  name?: string | null;
  short_name?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
};

type SponsorItem = {
  name: string;
  logo_url?: string | null;
};

type PlayerStatRow = {
  id?: string;
  name?: string;
  number?: string;
  fouls?: number;
  points?: number;
  yellow_cards?: number;
  red_cards?: number;
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
  lang_primary?: string;
  lang_secondary?: string;

  show_lower_third?: boolean;
  show_logos?: boolean;
  show_score?: boolean;
  show_clock?: boolean;
  show_period?: boolean;
  show_status?: boolean;
  show_sponsors?: boolean;

  show_team_fouls?: boolean;
  show_player_fouls?: boolean;
  show_timeouts?: boolean;
  show_bonus?: boolean;
  show_sets?: boolean;
  show_cards?: boolean;
  show_shot_clock?: boolean;

  sponsors?: SponsorItem[];
  sponsor_rotate_s?: number;
  layout_mode?: string;
  accent?: string;

  home_team_fouls?: number;
  away_team_fouls?: number;
  home_timeouts?: number;
  away_timeouts?: number;
  home_bonus?: boolean;
  away_bonus?: boolean;
  shot_clock_s?: number;
  possession_arrow?: "home" | "away" | string;

  home_sets_won?: number;
  away_sets_won?: number;

  home_yellow_cards?: number;
  away_yellow_cards?: number;
  home_red_cards?: number;
  away_red_cards?: number;

  home_players?: PlayerStatRow[];
  away_players?: PlayerStatRow[];

  rugby_home_tries?: number;
  rugby_away_tries?: number;
  rugby_home_conversions?: number;
  rugby_away_conversions?: number;
  rugby_home_penalties?: number;
  rugby_away_penalties?: number;
  rugby_home_drop_goals?: number;
  rugby_away_drop_goals?: number;
  rugby_home_sin_bin_active?: number;
  rugby_away_sin_bin_active?: number;

  handball_home_2min_active?: number;
  handball_away_2min_active?: number;
  handball_home_warnings?: number;
  handball_away_warnings?: number;
  handball_home_disqualifications?: number;
  handball_away_disqualifications?: number;

  volleyball_home_set_points?: number;
  volleyball_away_set_points?: number;
  volleyball_home_serving?: boolean;
  volleyball_away_serving?: boolean;
  volleyball_current_set?: number;
  volleyball_is_tiebreak?: boolean;

  football_home_penalty_shootout?: number;
  football_away_penalty_shootout?: number;
  football_added_time_first_half?: number;
  football_added_time_second_half?: number;
  football_added_time_extra_1?: number;
  football_added_time_extra_2?: number;
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

function safeNum(v?: number | null) {
  if (typeof v !== "number" || !isFinite(v)) return 0;
  return Math.max(0, Math.floor(v));
}

function fmtClock(ms?: number | null) {
  const val = typeof ms === "number" && isFinite(ms) ? Math.max(0, Math.floor(ms)) : 0;
  const s = Math.floor(val / 1000);
  const mm = Math.floor(s / 60).toString().padStart(2, "0");
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
  altName,
  showLogo,
}: {
  name: string;
  altName?: string;
  logo?: string | null;
  align: "left" | "right";
  theme: ThemeMode;
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
      {altName ? (
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

function StatChip({
  label,
  value,
  theme,
  compact = false,
}: {
  label: string;
  value: string | number | boolean;
  theme: ThemeMode;
  compact?: boolean;
}) {
  const panel = theme === "dark" ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.05)";
  const border = theme === "dark" ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.10)";
  const sub = theme === "dark" ? "rgba(237,242,255,.72)" : "rgba(15,23,42,.68)";
  const text = theme === "dark" ? "#edf2ff" : "#0f172a";

  return (
    <div
      style={{
        padding: compact ? "6px 8px" : "8px 10px",
        borderRadius: 12,
        background: panel,
        border: `1px solid ${border}`,
        minWidth: compact ? 68 : 84,
      }}
    >
      <div style={{ fontSize: compact ? 10 : 11, fontWeight: 800, color: sub }}>{label}</div>
      <div style={{ marginTop: 2, fontSize: compact ? 14 : 16, fontWeight: 900, color: text }}>{String(value)}</div>
    </div>
  );
}

function PlayerStatsMini({
  title,
  players,
  theme,
  sport,
}: {
  title: string;
  players: PlayerStatRow[];
  theme: ThemeMode;
  sport: string;
}) {
  if (!players.length) return null;

  const panel = theme === "dark" ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.04)";
  const border = theme === "dark" ? "rgba(255,255,255,.10)" : "rgba(0,0,0,.10)";
  const sub = theme === "dark" ? "rgba(237,242,255,.72)" : "rgba(15,23,42,.68)";
  const text = theme === "dark" ? "#edf2ff" : "#0f172a";

  const normalizedSport = (sport || "").toLowerCase();
  const showPoints = normalizedSport === "basket" || normalizedSport === "rugby" || normalizedSport === "handball";
  const showCards = normalizedSport === "football" || normalizedSport === "rugby" || normalizedSport === "handball";

  const sorted = [...players].sort((a, b) => {
    const pa = safeNum(a.points);
    const pb = safeNum(b.points);
    if (pb !== pa) return pb - pa;
    return safeNum(b.fouls) - safeNum(a.fouls);
  });

  return (
    <div
      style={{
        borderRadius: 16,
        background: panel,
        border: `1px solid ${border}`,
        padding: 12,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 900, color: text, marginBottom: 8 }}>{title}</div>
      <div style={{ display: "grid", gap: 6 }}>
        {sorted.slice(0, 5).map((p, idx) => (
          <div
            key={p.id || `${p.number || ""}-${idx}`}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto auto auto",
              gap: 10,
              alignItems: "center",
              fontSize: 12,
              color: text,
            }}
          >
            <span style={{ color: sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              #{p.number || "?"} {p.name || "Joueur"}
            </span>
            <span style={{ fontWeight: 900 }}>F {safeNum(p.fouls)}</span>
            {showPoints ? <span style={{ fontWeight: 900 }}>P {safeNum(p.points)}</span> : <span />}
            {showCards ? (
              <span style={{ fontWeight: 900 }}>
                J {safeNum(p.yellow_cards)} / R {safeNum(p.red_cards)}
              </span>
            ) : (
              <span />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Scoreboard({ context }: Props) {
  const theme: ThemeMode = context.theme === "light" ? "light" : "dark";
  const accent = context.home?.primary_color?.trim?.() || (context.accent || "#00d9ff").trim();

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

  const showBand = context.show_lower_third !== false;
  const showLogos = context.show_logos !== false;
  const showScore = context.show_score !== false;
  const showClock = context.show_clock !== false;
  const showPeriod = context.show_period !== false;
  const showStatus = context.show_status !== false;
  const showSponsors = context.show_sponsors !== false;

  const showTeamFouls = !!context.show_team_fouls;
  const showPlayerFouls = !!context.show_player_fouls;
  const showTimeouts = !!context.show_timeouts;
  const showBonus = !!context.show_bonus;
  const showSets = !!context.show_sets;
  const showCards = !!context.show_cards;
  const showShotClock = !!context.show_shot_clock;

  const sponsor = useRotatingSponsor(context.sponsors || [], context.sponsor_rotate_s || 10);

  const bg = theme === "dark" ? "#04070a" : "#f7f8fb";
  const panel = theme === "dark" ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)";
  const border = theme === "dark" ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.10)";
  const text = theme === "dark" ? "#edf2ff" : "#0f172a";
  const sub = theme === "dark" ? "rgba(237,242,255,.72)" : "rgba(15,23,42,.68)";

  const sport = sportLabel(context.sport);
  const rawSport = (context.sport || "").toLowerCase();
  const isBasket = rawSport === "basket";
  const isRugby = rawSport === "rugby";
  const isHandball = rawSport === "handball";
  const isVolleyball = rawSport === "volleyball";
  const isFootball = rawSport === "football";

  const status = statusLabel(context.status);
  const period = (context.period_label || "").trim();
  const venue = (context.venue || "").trim();
  const matchName = (context.match_name || `${homeName} vs ${awayName}`).trim();
  const clockText = fmtClock(context.clock_ms);
  const layout = (context.layout_mode || "stadium").toLowerCase();

  const homeStats: Array<{ label: string; value: string | number | boolean }> = [];
  const awayStats: Array<{ label: string; value: string | number | boolean }> = [];

  if (showTeamFouls && !isVolleyball && !isFootball) {
    homeStats.push({ label: "Fautes", value: safeNum(context.home_team_fouls) });
    awayStats.push({ label: "Fautes", value: safeNum(context.away_team_fouls) });
  }

  if (showTimeouts) {
    homeStats.push({ label: "TM", value: safeNum(context.home_timeouts) });
    awayStats.push({ label: "TM", value: safeNum(context.away_timeouts) });
  }

  if (showSets || isVolleyball) {
    homeStats.push({ label: "Sets", value: safeNum(context.home_sets_won) });
    awayStats.push({ label: "Sets", value: safeNum(context.away_sets_won) });
  }

  if (showBonus && isBasket) {
    homeStats.push({ label: "Bonus", value: context.home_bonus ? "ON" : "OFF" });
    awayStats.push({ label: "Bonus", value: context.away_bonus ? "ON" : "OFF" });
  }

  if (showCards || isFootball || isRugby || isHandball) {
    homeStats.push({ label: "J", value: safeNum(context.home_yellow_cards) });
    awayStats.push({ label: "J", value: safeNum(context.away_yellow_cards) });
    homeStats.push({ label: "R", value: safeNum(context.home_red_cards) });
    awayStats.push({ label: "R", value: safeNum(context.away_red_cards) });
  }

  if (isBasket && showShotClock) {
    homeStats.push({ label: "SC", value: `${safeNum(context.shot_clock_s)}s` });
  }

  if (isVolleyball) {
    homeStats.push({ label: "Pts set", value: safeNum(context.volleyball_home_set_points) });
    awayStats.push({ label: "Pts set", value: safeNum(context.volleyball_away_set_points) });
    if (context.volleyball_home_serving) homeStats.push({ label: "Service", value: "ON" });
    if (context.volleyball_away_serving) awayStats.push({ label: "Service", value: "ON" });
  }

  if (isRugby) {
    homeStats.push({ label: "E", value: safeNum(context.rugby_home_tries) });
    awayStats.push({ label: "E", value: safeNum(context.rugby_away_tries) });
    homeStats.push({ label: "T", value: safeNum(context.rugby_home_conversions) });
    awayStats.push({ label: "T", value: safeNum(context.rugby_away_conversions) });
    homeStats.push({ label: "P", value: safeNum(context.rugby_home_penalties) });
    awayStats.push({ label: "P", value: safeNum(context.rugby_away_penalties) });
    homeStats.push({ label: "D", value: safeNum(context.rugby_home_drop_goals) });
    awayStats.push({ label: "D", value: safeNum(context.rugby_away_drop_goals) });
    homeStats.push({ label: "Sin bin", value: safeNum(context.rugby_home_sin_bin_active) });
    awayStats.push({ label: "Sin bin", value: safeNum(context.rugby_away_sin_bin_active) });
  }

  if (isHandball) {
    homeStats.push({ label: "2 min", value: safeNum(context.handball_home_2min_active) });
    awayStats.push({ label: "2 min", value: safeNum(context.handball_away_2min_active) });
    homeStats.push({ label: "Avert.", value: safeNum(context.handball_home_warnings) });
    awayStats.push({ label: "Avert.", value: safeNum(context.handball_away_warnings) });
    homeStats.push({ label: "Disq.", value: safeNum(context.handball_home_disqualifications) });
    awayStats.push({ label: "Disq.", value: safeNum(context.handball_away_disqualifications) });
  }

  if (isFootball) {
    homeStats.push({ label: "TAB", value: safeNum(context.football_home_penalty_shootout) });
    awayStats.push({ label: "TAB", value: safeNum(context.football_away_penalty_shootout) });
  }

  const isDetailedMode = showPlayerFouls;
  const hasMidStats =
    homeStats.length > 0 ||
    awayStats.length > 0 ||
    (isBasket && showShotClock) ||
    !!context.possession_arrow;

  const extraBottomSpace = isDetailedMode ? 250 : hasMidStats ? 170 : showBand ? 110 : 20;
  const boardHeight = `calc(100vh - ${extraBottomSpace + 70}px)`;

  const bottomSummary = useMemo(() => {
    if (isFootball) {
      const extra =
        period === "1MT"
          ? safeNum(context.football_added_time_first_half)
          : period === "2MT"
          ? safeNum(context.football_added_time_second_half)
          : 0;
      return `${sport}${showStatus ? ` • ${status}` : ""}${showPeriod && period ? ` • ${period}` : ""}${extra ? ` • +${extra} min` : ""}`;
    }

    if (isVolleyball) {
      return `${sport}${showStatus ? ` • ${status}` : ""} • Set ${safeNum(context.volleyball_current_set || 1)}${context.volleyball_is_tiebreak ? " • Tie-break" : ""}`;
    }

    return `${sport}${showStatus ? ` • ${status}` : ""}${showPeriod && period ? ` • ${period}` : ""}`;
  }, [
    context.football_added_time_first_half,
    context.football_added_time_second_half,
    context.volleyball_current_set,
    context.volleyball_is_tiebreak,
    isFootball,
    isVolleyball,
    period,
    showPeriod,
    showStatus,
    sport,
    status,
  ]);

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
          altName={context.dual_language ? homeAlt : ""}
          logo={homeLogo}
          align="left"
          theme={theme}
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
            {sport}
            {showPeriod && period ? ` • ${period}` : ""}
            {!showPeriod && showStatus ? ` • ${status}` : ""}
          </div>

          {showSponsors && sponsor ? (
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
          altName={context.dual_language ? awayAlt : ""}
          logo={awayLogo}
          align="right"
          theme={theme}
          showLogo={showLogos}
        />
      </div>

      <div
        style={{
          margin: "0 24px",
          height: boardHeight,
          minHeight: 380,
          borderRadius: 26,
          background: panel,
          border: `1px solid ${border}`,
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: 16,
          padding: "22px 26px",
          boxShadow:
            theme === "dark" ? "0 30px 80px rgba(0,0,0,.45)" : "0 20px 60px rgba(0,0,0,.08)",
        }}
      >
        <div style={{ display: "grid", justifyItems: "center", gap: 12, width: "100%" }}>
          <div style={{ color: sub, fontWeight: 900, letterSpacing: 1.1 }}>DOM</div>

          {showScore ? (
            <SegmentDigits
              value={String(homeScore)}
              theme={theme}
              accent={accent}
              size={layout === "compact" ? 130 : isBasket ? 170 : 180}
              bump={homeBump}
            />
          ) : (
            <div style={{ height: 180 }} />
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            {homeStats.map((item, idx) => (
              <StatChip key={`home-${item.label}-${idx}`} label={item.label} value={item.value} theme={theme} />
            ))}
          </div>
        </div>

        <div style={{ display: "grid", justifyItems: "center", gap: 18, minWidth: isBasket ? 320 : 260 }}>
          {showScore ? (
            <div style={{ color: sub, fontWeight: 900, fontSize: 54, lineHeight: 1 }}>
              :
            </div>
          ) : null}

          {(showClock || showPeriod || showStatus) ? (
            <div
              style={{
                padding: "14px 20px",
                borderRadius: 20,
                border: `1px solid ${border}`,
                background: theme === "dark" ? "rgba(0,0,0,.22)" : "rgba(255,255,255,.6)",
                boxShadow:
                  theme === "dark"
                    ? "0 16px 42px rgba(0,0,0,.48)"
                    : "0 12px 32px rgba(0,0,0,.10)",
                display: "grid",
                justifyItems: "center",
                gap: 8,
                minWidth: isBasket ? 300 : 220,
              }}
            >
              {showClock ? (
                <>
                  <div style={{ color: sub, fontSize: 12, fontWeight: 900, letterSpacing: 1.6 }}>TEMPS</div>
                  <SegmentDigits value={clockText} theme={theme} accent={accent} size={86} />
                </>
              ) : null}

              {showPeriod && period ? (
                <div
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    background: panel,
                    border: `1px solid ${border}`,
                    fontSize: 13,
                    fontWeight: 900,
                    letterSpacing: 1,
                  }}
                >
                  {period}
                </div>
              ) : null}

              {showStatus ? (
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
                  {context.clock_running !== undefined ? (context.clock_running ? " • RUN" : " • STOP") : ""}
                </div>
              ) : null}

              {isBasket && showShotClock ? (
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: 12,
                    background: panel,
                    border: `1px solid ${border}`,
                    fontSize: 15,
                    fontWeight: 900,
                  }}
                >
                  Shot clock {safeNum(context.shot_clock_s)}s
                </div>
              ) : null}

              {isBasket && context.possession_arrow ? (
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: 12,
                    background: panel,
                    border: `1px solid ${border}`,
                    fontSize: 15,
                    fontWeight: 900,
                  }}
                >
                  {context.possession_arrow === "away" ? "→ EXT" : "← DOM"}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div style={{ display: "grid", justifyItems: "center", gap: 12, width: "100%" }}>
          <div style={{ color: sub, fontWeight: 900, letterSpacing: 1.1 }}>EXT</div>

          {showScore ? (
            <SegmentDigits
              value={String(awayScore)}
              theme={theme}
              accent={accent}
              size={layout === "compact" ? 130 : isBasket ? 170 : 180}
              bump={awayBump}
            />
          ) : (
            <div style={{ height: 180 }} />
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            {awayStats.map((item, idx) => (
              <StatChip key={`away-${item.label}-${idx}`} label={item.label} value={item.value} theme={theme} />
            ))}
          </div>
        </div>
      </div>

      {showPlayerFouls && (context.home_players?.length || context.away_players?.length) ? (
        <div
          style={{
            position: "fixed",
            left: 24,
            right: 24,
            bottom: showBand ? 112 : 20,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
          }}
        >
          <PlayerStatsMini title={`${homeName} • joueurs`} players={context.home_players || []} theme={theme} sport={rawSport} />
          <PlayerStatsMini title={`${awayName} • joueurs`} players={context.away_players || []} theme={theme} sport={rawSport} />
        </div>
      ) : null}

      {showBand ? (
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
              {bottomSummary}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {context.dual_language ? (
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
              {layout.toUpperCase()}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
