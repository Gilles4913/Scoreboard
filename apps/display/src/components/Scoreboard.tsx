import React, { useEffect, useMemo, useRef, useState } from "react";
import "../theme.css";

type Sponsor = { name: string; logoUrl?: string };

type DisplayContext = {
  match: {
    id: string;
    name: string;
    status: string;
    scheduled_at: string | null;
    home_name: string;
    away_name: string;
    home_score: number;
    away_score: number;
    clock_ms: number;
    period_label?: string | null;
    sport?: string | null;
    venue?: string | null;
  };
  org: {
    id: string;
    slug: string;
    name?: string | null;
    status?: string | null;
    sport?: string | null;
  };
  display: {
    stadium_mode?: boolean;
    lower_third?: boolean;
    dual_language?: boolean;
    lang_primary?: "fr" | "en";
    lang_secondary?: "fr" | "en";
    sponsors?: Sponsor[];
  };
};

export default function Scoreboard({ context }: { context: DisplayContext }) {
  const { match, display, org } = context;

  const stadium = !!display?.stadium_mode;
  const showLowerThird = display?.lower_third !== false; // default ON
  const dual = !!display?.dual_language;
  const primary = display?.lang_primary || "fr";
  const secondary = display?.lang_secondary || "en";

  // sponsor rotation
  const sponsors = display?.sponsors || [];
  const [sponsorIdx, setSponsorIdx] = useState(0);

  useEffect(() => {
    if (sponsors.length <= 1) return;
    const t = setInterval(() => setSponsorIdx((i) => (i + 1) % sponsors.length), 10000);
    return () => clearInterval(t);
  }, [sponsors.length]);

  const sponsor = sponsors.length ? sponsors[sponsorIdx % sponsors.length] : null;

  // score bump animation
  const prevScore = useRef({ h: match.home_score, a: match.away_score });
  const [bumpHome, setBumpHome] = useState(false);
  const [bumpAway, setBumpAway] = useState(false);

  useEffect(() => {
    const p = prevScore.current;
    if (match.home_score !== p.h) {
      setBumpHome(true);
      setTimeout(() => setBumpHome(false), 550);
    }
    if (match.away_score !== p.a) {
      setBumpAway(true);
      setTimeout(() => setBumpAway(false), 550);
    }
    prevScore.current = { h: match.home_score, a: match.away_score };
  }, [match.home_score, match.away_score]);

  const clock = useMemo(() => fmt(match.clock_ms || 0), [match.clock_ms]);
  const status = (match.status || "scheduled").toLowerCase();
  const sport = match.sport || org.sport || "";
  const venue = match.venue || "";

  const labels = useMemo(() => {
    const dict: any = {
      fr: { scheduled: "Prévu", live: "En cours", finished: "Terminé", archived: "Archivé", sport: "Sport", status: "Statut" },
      en: { scheduled: "Scheduled", live: "Live", finished: "Final", archived: "Archived", sport: "Sport", status: "Status" },
    };
    const p = dict[primary] || dict.fr;
    const s = dict[secondary] || dict.en;
    return { p, s };
  }, [primary, secondary]);

  const statusTextPrimary = labels.p[status] || status;
  const statusTextSecondary = labels.s[status] || status;

  return (
    <div style={wrap(stadium)}>
      <style>{css}</style>

      {/* MAIN SCORE */}
      <div style={mainGrid(stadium)}>
        <TeamBlock name={match.home_name} score={match.home_score} bump={bumpHome} align="left" stadium={stadium} />
        <CenterBlock clock={clock} period={match.period_label || ""} stadium={stadium} />
        <TeamBlock name={match.away_name} score={match.away_score} bump={bumpAway} align="right" stadium={stadium} />
      </div>

      {/* Sponsor bar */}
      {sponsor ? (
        <div style={sponsorBar(stadium)}>
          {sponsor.logoUrl ? <img src={sponsor.logoUrl} alt={sponsor.name} style={{ height: stadium ? 48 : 32, objectFit: "contain" }} /> : null}
          <div style={{ fontWeight: 900, fontSize: stadium ? 22 : 14 }}>
            {dual ? (
              <span>
                {primary.toUpperCase()}: {sponsor.name} • {secondary.toUpperCase()}: {sponsor.name}
              </span>
            ) : (
              sponsor.name
            )}
          </div>
        </div>
      ) : null}

      {/* Lower third */}
      {showLowerThird ? (
        <div style={lowerThird(stadium)}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
            <b style={{ fontSize: stadium ? 22 : 14 }}>{match.name || `${match.home_name} vs ${match.away_name}`}</b>
            {venue ? <span style={{ opacity: 0.85 }}>• {venue}</span> : null}
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" }}>
            <span style={tag()}>
              {labels.p.sport}: <b>{sport || "—"}</b>
            </span>
            <span style={tag()}>
              {labels.p.status}: <b>{statusTextPrimary}</b>
              {dual ? (
                <span style={{ opacity: 0.85 }}>
                  {" "}
                  • {labels.s.status}: <b>{statusTextSecondary}</b>
                </span>
              ) : null}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TeamBlock({
  name,
  score,
  bump,
  align,
  stadium,
}: {
  name: string;
  score: number;
  bump: boolean;
  align: "left" | "right";
  stadium: boolean;
}) {
  return (
    <div style={team(align)}>
      <div style={{ fontSize: stadium ? 44 : 24, fontWeight: 950, lineHeight: 1.05 }}>{name}</div>
      <div style={scoreBox(stadium, bump)}>{score}</div>
    </div>
  );
}

function CenterBlock({ clock, period, stadium }: { clock: string; period: string; stadium: boolean }) {
  return (
    <div style={center()}>
      <div style={{ fontSize: stadium ? 64 : 34, fontWeight: 950, letterSpacing: 1 }}>{clock}</div>
      {period ? <div style={{ opacity: 0.85, fontSize: stadium ? 22 : 14 }}>{period}</div> : null}
    </div>
  );
}

/* styles */
function wrap(stadium: boolean): React.CSSProperties {
  return { minHeight: "100vh", padding: stadium ? 22 : 16, display: "grid", gridTemplateRows: "1fr auto auto", gap: stadium ? 16 : 12 };
}
function mainGrid(stadium: boolean): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: stadium ? 18 : 12, alignItems: "center" };
}
function team(align: "left" | "right"): React.CSSProperties {
  return { display: "grid", gap: 10, justifyItems: align === "left" ? "start" : "end" };
}
function center(): React.CSSProperties {
  return { display: "grid", gap: 8, justifyItems: "center", textAlign: "center" };
}
function scoreBox(stadium: boolean, bump: boolean): React.CSSProperties {
  return {
    width: stadium ? 160 : 100,
    height: stadium ? 160 : 100,
    borderRadius: 22,
    border: "2px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.06)",
    display: "grid",
    placeItems: "center",
    fontSize: stadium ? 90 : 54,
    fontWeight: 950,
    transform: bump ? "scale(1.08)" : "scale(1)",
    transition: "transform 180ms ease",
    boxShadow: bump ? "0 0 0 8px rgba(96,165,250,.15)" : "none",
  };
}
function sponsorBar(stadium: boolean): React.CSSProperties {
  return { display: "flex", gap: 12, alignItems: "center", justifyContent: "center", borderRadius: 14, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.05)", padding: stadium ? "14px 16px" : "10px 12px" };
}
function lowerThird(stadium: boolean): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "center",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(0,0,0,.30)",
    padding: stadium ? "14px 16px" : "10px 12px",
  };
}
function tag(): React.CSSProperties {
  return { border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.06)", padding: "6px 10px", borderRadius: 999, fontSize: 12 };
}

const css = `
  :root{ color-scheme: dark; }
`;

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}
