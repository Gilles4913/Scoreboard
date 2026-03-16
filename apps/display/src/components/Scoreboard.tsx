import React, { useEffect, useMemo, useRef, useState } from "react";
import LiveOverlayBanner, { LiveOverlay } from "./LiveOverlayBanner";

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

type ActiveSinBin = {
  id: string;
  team_side: string;
  player_name_snapshot?: string | null;
  shirt_number_snapshot?: string | null;
  started_game_clock_ms: number;
  duration_s: number;
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

  show_substitution_banner?: boolean;
  show_live_badge?: boolean;

  // Sport profile matrix fields
  show_live_overlays?: boolean;
  show_substitutions?: boolean;
  show_sin_bin?: boolean;
  show_rugby_score_breakdown?: boolean;
  show_rugby_tries?: boolean;
  show_rugby_conversions?: boolean;
  show_rugby_penalties?: boolean;
  show_rugby_drop_goals?: boolean;
  show_added_time?: boolean;
  show_penalty_shootout?: boolean;
  show_match_phase?: boolean;
  show_two_min_suspensions?: boolean;
  show_disqualifications?: boolean;
  show_warnings?: boolean;
  show_sin_bin_timer?: boolean;
  clock_direction?: string;
  clock_limit_s?: number | null;
  clock_overrun_mode?: string;
  clock_ms_unclamped?: number | null;
  overlay_position?: "top" | "bottom";
  overlay_duration_ms?: number;
  density_mode?: "low" | "medium" | "high";
  team_name_mode?: "full" | "short" | "code";
  home_active_sin_bins?: ActiveSinBin[];
  away_active_sin_bins?: ActiveSinBin[];
};

type Props = {
  context: ScoreboardContext;
  activeOverlay?: LiveOverlay | null;
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

function fmtMs(ms: number): string {
  const val = Math.max(0, Math.floor(ms));
  const s = Math.floor(val / 1000);
  const mm = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function computeClockDisplay(ctx: ScoreboardContext): { text: string; isOverrun: boolean } {
  const direction = ctx.clock_direction ?? "count_down";
  const limitMs = typeof ctx.clock_limit_s === "number" ? ctx.clock_limit_s * 1000 : null;
  const overrunMode = ctx.clock_overrun_mode ?? "stop_at_limit";

  // rawMs: counts DOWN from limitMs → 0 → negative (overtime). Unclamped by main.tsx.
  const rawMs = ctx.clock_ms_unclamped ?? ctx.clock_ms ?? 0;

  if (direction === "count_up") {
    if (limitMs === null) {
      // No period limit configured — just display clock_ms as-is (shouldn't normally happen)
      return { text: fmtMs(ctx.clock_ms ?? 0), isOverrun: false };
    }

    // elapsedMs: 0 at kick-off → limitMs at end of regulation → > limitMs in overtime
    const elapsedMs = limitMs - rawMs;
    const isOverrun = elapsedMs > limitMs;

    if (!isOverrun) {
      return { text: fmtMs(Math.max(0, elapsedMs)), isOverrun: false };
    }

    // Overtime
    if (overrunMode === "stop_at_limit") {
      return { text: fmtMs(limitMs), isOverrun: false };
    }
    if (overrunMode === "continue_with_plus") {
      const overtimeMs = elapsedMs - limitMs;
      return { text: "+" + fmtMs(overtimeMs), isOverrun: true };
    }
    // continue_red: keep counting past limit, show in red
    return { text: fmtMs(elapsedMs), isOverrun: true };
  }

  // count_down: normal display using clamped clock_ms
  return { text: fmtClock(ctx.clock_ms), isOverrun: false };
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

function CardBadge({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "16px 36px",
        borderRadius: 20,
        background: `${color}22`,
        border: `2px solid ${color}`,
      }}
    >
      <span style={{ fontSize: "clamp(28px,4.2vw,54px)", fontWeight: 900, color }}>{label}</span>
      {count > 1 && (
        <span style={{ fontSize: "clamp(24px,3.6vw,44px)", fontWeight: 900, color }}>×{count}</span>
      )}
    </div>
  );
}

function BreakdownChip({
  label,
  value,
  color,
  theme,
}: {
  label: string;
  value: number;
  color: string;
  theme: ThemeMode;
}) {
  const panel = theme === "dark" ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)";
  const border = theme === "dark" ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.10)";
  const text = theme === "dark" ? "#edf2ff" : "#0f172a";
  return (
    <div
      style={{
        padding: "14px 24px",
        borderRadius: 18,
        background: panel,
        border: `1px solid ${border}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        minWidth: 110,
      }}
    >
      <div style={{ fontSize: "clamp(16px,2vw,26px)", fontWeight: 800, opacity: 0.65, color: text }}>{label}</div>
      <div
        style={{
          fontSize: "clamp(36px,6vw,80px)",
          fontWeight: 900,
          color,
          lineHeight: 1,
          marginTop: 4,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SinBinTimer({
  sinBins,
  clockMs,
  theme,
}: {
  sinBins: ActiveSinBin[];
  clockMs: number;
  theme: ThemeMode;
}) {
  if (!sinBins || sinBins.length === 0) return null;

  const withRemaining = sinBins
    .map((sb) => {
      const endClock = sb.started_game_clock_ms - sb.duration_s * 1000;
      return { ...sb, remaining: Math.max(0, clockMs - endClock) };
    })
    .sort((a, b) => a.remaining - b.remaining);

  const mostUrgent = withRemaining[0];
  const count = sinBins.length;
  const totalS = Math.ceil(mostUrgent.remaining / 1000);
  const m = Math.floor(totalS / 60);
  const s = totalS % 60;
  const timeStr = `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  const label = count > 1 ? `Excl. temp. ${count} • ${timeStr}` : `Excl. temp. • ${timeStr}`;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 12px",
        borderRadius: 8,
        background: "rgba(245,158,11,0.12)",
        border: "1px solid rgba(245,158,11,0.35)",
        marginTop: 4,
      }}
    >
      <span
        style={{
          fontSize: "clamp(11px,1.5vw,16px)",
          fontWeight: 700,
          color: "#f59e0b",
          letterSpacing: "0.03em",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function RugbyStadeLayout({ context, activeOverlay }: Props) {
  const theme: ThemeMode = context.theme === "light" ? "light" : "dark";
  const bg = theme === "dark" ? "#04070a" : "#f7f8fb";
  const text = theme === "dark" ? "#edf2ff" : "#0f172a";
  const sub = theme === "dark" ? "rgba(237,242,255,.65)" : "rgba(15,23,42,.6)";
  const panel = theme === "dark" ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)";
  const border = theme === "dark" ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.10)";

  const accentHome = (context.home?.primary_color || "").trim() || "#00d9ff";
  const accentAway = (context.away?.primary_color || "").trim() || "#ff6b35";

  const homeName =
    context.home_name || context.home?.name || context.home?.short_name || "DOM";
  const awayName =
    context.away_name || context.away?.name || context.away?.short_name || "EXT";

  const homeScore = safeScore(context.home_score);
  const awayScore = safeScore(context.away_score);
  const homeBump = useBumpOnChange(homeScore);
  const awayBump = useBumpOnChange(awayScore);

  const { text: clockText, isOverrun: clockIsOverrun } = computeClockDisplay(context);
  const period = (context.period_label || "").trim();
  const status = statusLabel(context.status);
  const isRunning = !!context.clock_running;
  const isPaused = context.status === "paused" || (!context.clock_running && context.status === "live");

  const homeYellow = safeNum(context.home_yellow_cards);
  const awayYellow = safeNum(context.away_yellow_cards);
  const homeRed = safeNum(context.home_red_cards);
  const awayRed = safeNum(context.away_red_cards);
  const homeSinBin = safeNum(context.rugby_home_sin_bin_active);
  const awaySinBin = safeNum(context.rugby_away_sin_bin_active);

  const showCards = context.show_cards !== false;
  const showSinBin = context.show_sin_bin !== false;
  const hasCards =
    (showCards && (homeYellow > 0 || awayYellow > 0 || homeRed > 0 || awayRed > 0)) ||
    (showSinBin && (homeSinBin > 0 || awaySinBin > 0));

  const sponsor = useRotatingSponsor(context.sponsors || [], context.sponsor_rotate_s || 10);
  const showSponsors = context.show_sponsors !== false;

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: bg,
        color: text,
        overflow: "hidden",
        display: "grid",
        gridTemplateRows: "auto 1fr auto auto",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
      }}
    >
      <div
        style={{
          padding: "28px 40px 0",
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: 24,
        }}
      >
        <div
          style={{
            fontWeight: 900,
            fontSize: "clamp(26px,5vw,64px)",
            textTransform: "uppercase",
            letterSpacing: 2,
            lineHeight: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: accentHome,
          }}
        >
          {homeName}
        </div>

        <div
          style={{
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              padding: "8px 20px",
              borderRadius: 999,
              background: panel,
              border: `1px solid ${border}`,
              fontSize: "clamp(13px,1.8vw,22px)",
              fontWeight: 900,
              letterSpacing: 1.5,
              textTransform: "uppercase",
            }}
          >
            RUGBY{period ? ` • ${period}` : ""}
            {isPaused ? " • PAUSE" : ""}
          </div>
          {showSponsors && sponsor ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 16px",
                borderRadius: 999,
                background: panel,
                border: `1px solid ${border}`,
                fontSize: 13,
                fontWeight: 700,
                color: sub,
              }}
            >
              {sponsor.logo_url ? (
                <img
                  src={sponsor.logo_url}
                  alt=""
                  style={{ width: 22, height: 22, objectFit: "contain" }}
                />
              ) : null}
              {sponsor.name}
            </div>
          ) : null}
        </div>

        <div
          style={{
            fontWeight: 900,
            fontSize: "clamp(26px,5vw,64px)",
            textTransform: "uppercase",
            letterSpacing: 2,
            lineHeight: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            textAlign: "right",
            color: accentAway,
          }}
        >
          {awayName}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: 24,
          padding: "0 40px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div
            style={{
              fontFamily: "'Courier New','Lucida Console',monospace",
              fontWeight: 900,
              fontSize: "clamp(140px,28vw,380px)",
              lineHeight: 1,
              color: accentHome,
              textShadow: `0 0 18px ${accentHome}88, 0 0 48px ${accentHome}44`,
              transform: homeBump ? "scale(1.07)" : "scale(1)",
              transition: "transform 180ms ease",
              userSelect: "none",
              letterSpacing: 8,
            }}
          >
            {homeScore}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              fontFamily: "'Courier New','Lucida Console',monospace",
              fontWeight: 900,
              fontSize: "clamp(80px,14vw,190px)",
              lineHeight: 1,
              color: clockIsOverrun ? "#ef4444" : isRunning ? "#22d3ee" : isPaused ? "#f59e0b" : text,
              letterSpacing: 4,
              textShadow: clockIsOverrun ? "0 0 28px #ef444488" : isRunning ? "0 0 28px #22d3ee88" : "none",
            }}
          >
            {clockText}
          </div>
          {context.show_live_badge && ["live", "paused"].includes(context.status || "") ? (
            <div
              style={{
                fontSize: "clamp(11px,1.2vw,16px)",
                fontWeight: 800,
                opacity: 0.6,
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            >
              {status}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <div
            style={{
              fontFamily: "'Courier New','Lucida Console',monospace",
              fontWeight: 900,
              fontSize: "clamp(140px,28vw,380px)",
              lineHeight: 1,
              color: accentAway,
              textShadow: `0 0 18px ${accentAway}88, 0 0 48px ${accentAway}44`,
              transform: awayBump ? "scale(1.07)" : "scale(1)",
              transition: "transform 180ms ease",
              userSelect: "none",
              letterSpacing: 8,
            }}
          >
            {awayScore}
          </div>
        </div>
      </div>

      <div style={{ overflow: "hidden" }}>
        {activeOverlay && context.show_substitution_banner !== false && context.show_live_overlays !== false && (
          <LiveOverlayBanner overlay={activeOverlay} />
        )}
      </div>

      {(context.show_rugby_score_breakdown !== false || context.show_sin_bin !== false || context.show_cards !== false) && (
        <div
          style={{
            padding: "0 40px 28px",
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            gap: 24,
            alignItems: "flex-start",
          }}
        >
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {context.show_rugby_score_breakdown !== false && (
              <>
                {context.show_rugby_tries !== false && <BreakdownChip label="Essais" value={safeNum(context.rugby_home_tries)} color={accentHome} theme={theme} />}
                {context.show_rugby_conversions !== false && <BreakdownChip label="Transfo" value={safeNum(context.rugby_home_conversions)} color={accentHome} theme={theme} />}
                {context.show_rugby_penalties !== false && <BreakdownChip label="Pén" value={safeNum(context.rugby_home_penalties)} color={accentHome} theme={theme} />}
                {context.show_rugby_drop_goals !== false && <BreakdownChip label="Drop" value={safeNum(context.rugby_home_drop_goals)} color={accentHome} theme={theme} />}
              </>
            )}
            {showSinBin && homeSinBin > 0 && !context.show_sin_bin_timer && (
              <BreakdownChip label="Excl. temp." value={homeSinBin} color="#f59e0b" theme={theme} />
            )}
            {context.show_sin_bin_timer && (
              <SinBinTimer sinBins={context.home_active_sin_bins ?? []} clockMs={safeNum(context.clock_ms)} theme={theme} />
            )}
            {showCards && homeYellow > 0 && (
              <BreakdownChip label="J" value={homeYellow} color="#eab308" theme={theme} />
            )}
            {showCards && homeRed > 0 && (
              <BreakdownChip label="R" value={homeRed} color="#ef4444" theme={theme} />
            )}
          </div>

          <div
            style={{
              width: 2,
              height: 48,
              background: `${text}22`,
              borderRadius: 2,
              alignSelf: "center",
            }}
          />

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {context.show_rugby_score_breakdown !== false && (
              <>
                {context.show_rugby_tries !== false && <BreakdownChip label="Essais" value={safeNum(context.rugby_away_tries)} color={accentAway} theme={theme} />}
                {context.show_rugby_conversions !== false && <BreakdownChip label="Transfo" value={safeNum(context.rugby_away_conversions)} color={accentAway} theme={theme} />}
                {context.show_rugby_penalties !== false && <BreakdownChip label="Pén" value={safeNum(context.rugby_away_penalties)} color={accentAway} theme={theme} />}
                {context.show_rugby_drop_goals !== false && <BreakdownChip label="Drop" value={safeNum(context.rugby_away_drop_goals)} color={accentAway} theme={theme} />}
              </>
            )}
            {showSinBin && awaySinBin > 0 && !context.show_sin_bin_timer && (
              <BreakdownChip label="Excl. temp." value={awaySinBin} color="#f59e0b" theme={theme} />
            )}
            {context.show_sin_bin_timer && (
              <SinBinTimer sinBins={context.away_active_sin_bins ?? []} clockMs={safeNum(context.clock_ms)} theme={theme} />
            )}
            {showCards && awayYellow > 0 && (
              <BreakdownChip label="J" value={awayYellow} color="#eab308" theme={theme} />
            )}
            {showCards && awayRed > 0 && (
              <BreakdownChip label="R" value={awayRed} color="#ef4444" theme={theme} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RugbyExpertLayout({ context, activeOverlay }: Props) {
  const theme: ThemeMode = context.theme === "light" ? "light" : "dark";
  const bg = theme === "dark" ? "#04070a" : "#f7f8fb";
  const text = theme === "dark" ? "#edf2ff" : "#0f172a";
  const sub = theme === "dark" ? "rgba(237,242,255,.65)" : "rgba(15,23,42,.6)";
  const panel = theme === "dark" ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)";
  const border = theme === "dark" ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.10)";

  const accentHome = (context.home?.primary_color || "").trim() || "#00d9ff";
  const accentAway = (context.away?.primary_color || "").trim() || "#ff6b35";

  const homeName =
    context.home_name || context.home?.name || context.home?.short_name || "DOM";
  const awayName =
    context.away_name || context.away?.name || context.away?.short_name || "EXT";

  const homeScore = safeScore(context.home_score);
  const awayScore = safeScore(context.away_score);
  const homeBump = useBumpOnChange(homeScore);
  const awayBump = useBumpOnChange(awayScore);

  const { text: clockText, isOverrun: clockIsOverrun } = computeClockDisplay(context);
  const period = (context.period_label || "").trim();
  const status = statusLabel(context.status);
  const isRunning = !!context.clock_running;
  const isPaused = context.status === "paused" || (!context.clock_running && context.status === "live");

  const homeYellow = safeNum(context.home_yellow_cards);
  const awayYellow = safeNum(context.away_yellow_cards);
  const homeRed = safeNum(context.home_red_cards);
  const awayRed = safeNum(context.away_red_cards);
  const homeSinBin = safeNum(context.rugby_home_sin_bin_active);
  const awaySinBin = safeNum(context.rugby_away_sin_bin_active);

  const sponsor = useRotatingSponsor(context.sponsors || [], context.sponsor_rotate_s || 10);
  const showSponsors = context.show_sponsors !== false;

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: bg,
        color: text,
        overflow: "hidden",
        display: "grid",
        gridTemplateRows: "auto 1fr auto auto",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
      }}
    >
      <div
        style={{
          padding: "20px 40px 0",
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: 24,
        }}
      >
        <div
          style={{
            fontWeight: 900,
            fontSize: "clamp(20px,4vw,52px)",
            textTransform: "uppercase",
            letterSpacing: 2,
            lineHeight: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: accentHome,
          }}
        >
          {homeName}
        </div>

        <div
          style={{
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
          }}
        >
          <div
            style={{
              padding: "6px 18px",
              borderRadius: 999,
              background: panel,
              border: `1px solid ${border}`,
              fontSize: "clamp(12px,1.5vw,18px)",
              fontWeight: 900,
              letterSpacing: 1.5,
              textTransform: "uppercase",
            }}
          >
            RUGBY{period ? ` • ${period}` : ""}
            {isPaused ? " • PAUSE" : ""}
          </div>
          {showSponsors && sponsor ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 12px",
                borderRadius: 999,
                background: panel,
                border: `1px solid ${border}`,
                fontSize: 12,
                fontWeight: 700,
                color: sub,
              }}
            >
              {sponsor.logo_url ? (
                <img
                  src={sponsor.logo_url}
                  alt=""
                  style={{ width: 18, height: 18, objectFit: "contain" }}
                />
              ) : null}
              {sponsor.name}
            </div>
          ) : null}
        </div>

        <div
          style={{
            fontWeight: 900,
            fontSize: "clamp(20px,4vw,52px)",
            textTransform: "uppercase",
            letterSpacing: 2,
            lineHeight: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            textAlign: "right",
            color: accentAway,
          }}
        >
          {awayName}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: 24,
          padding: "0 40px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div
            style={{
              fontFamily: "'Courier New',monospace",
              fontWeight: 900,
              fontSize: "clamp(130px,26vw,360px)",
              lineHeight: 1,
              color: accentHome,
              textShadow: `0 0 16px ${accentHome}88`,
              transform: homeBump ? "scale(1.06)" : "scale(1)",
              transition: "transform 180ms ease",
              userSelect: "none",
              letterSpacing: 6,
            }}
          >
            {homeScore}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              fontFamily: "'Courier New',monospace",
              fontWeight: 900,
              fontSize: "clamp(72px,12vw,160px)",
              lineHeight: 1,
              color: clockIsOverrun ? "#ef4444" : isRunning ? "#22d3ee" : isPaused ? "#f59e0b" : text,
              letterSpacing: 4,
              textShadow: clockIsOverrun ? "0 0 20px #ef444488" : isRunning ? "0 0 20px #22d3ee88" : "none",
            }}
          >
            {clockText}
          </div>
          {context.show_live_badge && ["live", "paused"].includes(context.status || "") ? (
            <div
              style={{
                fontSize: "clamp(10px,1vw,14px)",
                fontWeight: 800,
                opacity: 0.6,
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            >
              {status}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <div
            style={{
              fontFamily: "'Courier New',monospace",
              fontWeight: 900,
              fontSize: "clamp(130px,26vw,360px)",
              lineHeight: 1,
              color: accentAway,
              textShadow: `0 0 16px ${accentAway}88`,
              transform: awayBump ? "scale(1.06)" : "scale(1)",
              transition: "transform 180ms ease",
              userSelect: "none",
              letterSpacing: 6,
            }}
          >
            {awayScore}
          </div>
        </div>
      </div>

      <div style={{ overflow: "hidden" }}>
        {activeOverlay && context.show_substitution_banner !== false && context.show_live_overlays !== false && (
          <LiveOverlayBanner overlay={activeOverlay} />
        )}
      </div>

      {(context.show_rugby_score_breakdown !== false || context.show_sin_bin !== false || context.show_cards !== false) && (
        <div
          style={{
            padding: "0 40px 20px",
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            gap: 24,
            alignItems: "flex-start",
          }}
        >
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {context.show_rugby_score_breakdown !== false && (
              <>
                {context.show_rugby_tries !== false && <BreakdownChip label="Essais" value={safeNum(context.rugby_home_tries)} color={accentHome} theme={theme} />}
                {context.show_rugby_conversions !== false && <BreakdownChip label="Transfo" value={safeNum(context.rugby_home_conversions)} color={accentHome} theme={theme} />}
                {context.show_rugby_penalties !== false && <BreakdownChip label="Pén" value={safeNum(context.rugby_home_penalties)} color={accentHome} theme={theme} />}
                {context.show_rugby_drop_goals !== false && <BreakdownChip label="Drop" value={safeNum(context.rugby_home_drop_goals)} color={accentHome} theme={theme} />}
              </>
            )}
            {context.show_sin_bin !== false && homeSinBin > 0 && !context.show_sin_bin_timer && (
              <BreakdownChip label="Excl. temp." value={homeSinBin} color="#f59e0b" theme={theme} />
            )}
            {context.show_sin_bin_timer && (
              <SinBinTimer sinBins={context.home_active_sin_bins ?? []} clockMs={safeNum(context.clock_ms)} theme={theme} />
            )}
            {context.show_cards !== false && homeYellow > 0 && (
              <BreakdownChip label="J" value={homeYellow} color="#eab308" theme={theme} />
            )}
            {context.show_cards !== false && homeRed > 0 && (
              <BreakdownChip label="R" value={homeRed} color="#ef4444" theme={theme} />
            )}
          </div>

          <div
            style={{
              width: 2,
              height: 48,
              background: `${text}22`,
              borderRadius: 2,
              alignSelf: "center",
            }}
          />

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {context.show_rugby_score_breakdown !== false && (
              <>
                {context.show_rugby_tries !== false && <BreakdownChip label="Essais" value={safeNum(context.rugby_away_tries)} color={accentAway} theme={theme} />}
                {context.show_rugby_conversions !== false && <BreakdownChip label="Transfo" value={safeNum(context.rugby_away_conversions)} color={accentAway} theme={theme} />}
                {context.show_rugby_penalties !== false && <BreakdownChip label="Pén" value={safeNum(context.rugby_away_penalties)} color={accentAway} theme={theme} />}
                {context.show_rugby_drop_goals !== false && <BreakdownChip label="Drop" value={safeNum(context.rugby_away_drop_goals)} color={accentAway} theme={theme} />}
              </>
            )}
            {context.show_sin_bin !== false && awaySinBin > 0 && !context.show_sin_bin_timer && (
              <BreakdownChip label="Excl. temp." value={awaySinBin} color="#f59e0b" theme={theme} />
            )}
            {context.show_sin_bin_timer && (
              <SinBinTimer sinBins={context.away_active_sin_bins ?? []} clockMs={safeNum(context.clock_ms)} theme={theme} />
            )}
            {context.show_cards !== false && awayYellow > 0 && (
              <BreakdownChip label="J" value={awayYellow} color="#eab308" theme={theme} />
            )}
            {context.show_cards !== false && awayRed > 0 && (
              <BreakdownChip label="R" value={awayRed} color="#ef4444" theme={theme} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Scoreboard({ context, activeOverlay }: Props) {
  const layout = (context.layout_mode || "stadium").toLowerCase();
  const rawSportCheck = (context.sport || "").toLowerCase();

  if (rawSportCheck === "rugby" && layout === "rugby_stade") {
    return <RugbyStadeLayout context={context} activeOverlay={activeOverlay} />;
  }
  if (rawSportCheck === "rugby" && layout === "rugby_expert") {
    return <RugbyExpertLayout context={context} activeOverlay={activeOverlay} />;
  }
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
  const showLiveBadge = !!context.show_live_badge;
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
  const { text: clockText, isOverrun: clockIsOverrun } = computeClockDisplay(context);

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
    homeStats.push({ label: "Excl. temp.", value: safeNum(context.rugby_home_sin_bin_active) });
    awayStats.push({ label: "Excl. temp.", value: safeNum(context.rugby_away_sin_bin_active) });
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
        position: "relative",
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
                  <SegmentDigits value={clockText} theme={theme} accent={clockIsOverrun ? "#ef4444" : accent} size={86} />
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

              {showStatus && showLiveBadge && ["live", "paused"].includes(context.status || "") ? (
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

      {activeOverlay && context.show_substitution_banner !== false && context.show_live_overlays !== false && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
          <LiveOverlayBanner overlay={activeOverlay} />
        </div>
      )}
    </div>
  );
}
