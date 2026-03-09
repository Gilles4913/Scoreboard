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

function getEnv(name: string): string {
  const v = (import.meta as any).env?.[name];
  return typeof v === "string" ? v : "";
}

const DISPLAY_URL = getEnv("VITE_DISPLAY_URL") || "";

function normalizeSport(v: string | null | undefined) {
  return ((v || "football") + "").toLowerCase().trim();
}

function defaultClockMsBySport(sport: string) {
  const s = normalizeSport(sport);
  if (s === "basket") return 10 * 60 * 1000;
  if (s === "handball") return 30 * 60 * 1000;
  if (s === "rugby") return 40 * 60 * 1000;
  if (s === "volleyball") return 0;
  return 45 * 60 * 1000;
}

function periodOptionsBySport(sport: string) {
  const s = normalizeSport(sport);
  if (s === "basket") return ["Q1", "Q2", "Q3", "Q4", "OT"];
  if (s === "volleyball") return ["Set 1", "Set 2", "Set 3", "Set 4", "Set 5"];
  if (s === "handball") return ["1MT", "2MT", "Prolongation"];
  if (s === "rugby") return ["1MT", "2MT", "Prolongation"];
  return ["1MT", "2MT", "Prolongation"];
}

function scoreStepOptionsBySport(sport: string) {
  const s = normalizeSport(sport);
  if (s === "basket") return [1, 2, 3];
  return [1];
}

function fmtClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
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

  const timerRef = useRef<number | null>(null);

  const sport = normalizeSport(org?.sport);
  const periodOptions = useMemo(() => periodOptionsBySport(sport), [sport]);
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

      const [{ data: orgRow }, { data: teamRow }, { data: dsRow }] = await Promise.all([
        supabase.from("orgs").select("id, slug, name, sport").eq("id", currentMatch.org_id).maybeSingle(),
        currentMatch.team_id
          ? supabase.from("teams").select("id, name, category").eq("id", currentMatch.team_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from("org_display_settings")
          .select("theme, layout_mode, show_score, show_clock, show_period, show_status, show_lower_third, show_logos, show_sponsors, dual_language, lang_primary, lang_secondary, sponsor_rotate_s")
          .eq("org_id", currentMatch.org_id)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      setOrg((orgRow as OrgRow) || null);
      setTeam((teamRow as TeamRow) || null);
      setDisplaySettings((dsRow as DisplaySettings) || null);

      const sportValue = normalizeSport((orgRow as OrgRow | null)?.sport);

      setMatchName(currentMatch.name || `${currentMatch.home_name || "Domicile"} vs ${currentMatch.away_name || "Extérieur"}`);
      setHomeName(currentMatch.home_name || "Domicile");
      setAwayName(currentMatch.away_name || "Extérieur");
      setStatus((currentMatch.status || "scheduled").toLowerCase());
      setPeriodLabel(periodOptionsBySport(sportValue)[0] || "1MT");
      setHomeScore(Number(currentMatch.home_score || 0));
      setAwayScore(Number(currentMatch.away_score || 0));
      setClockMs(defaultClockMsBySport(sportValue));
      setClockRunning(false);

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
    window.setTimeout(() => setInfo(""), 2400);
  }

  async function pushPatch(patch: Record<string, any>) {
    if (!match) return;
    await sendTvBroadcast(match.id, {
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
      ...patch,
    });
  }

  async function saveMatch() {
    if (!match) return;

    const payload = {
      name: matchName,
      home_name: homeName,
      away_name: awayName,
      status,
      home_score: homeScore,
      away_score: awayScore,
    };

    const { error } = await supabase.from("matches").update(payload).eq("id", match.id);
    if (error) {
      flash(error.message);
      return;
    }

    flash("Match sauvegardé.");
  }

  async function syncNow() {
    try {
      await pushPatch({});
      flash("État envoyé au Display.");
    } catch (e: any) {
      flash(e?.message || "Erreur broadcast.");
    }
  }

  async function onLiveAction(updater: () => void, patchBuilder: () => Record<string, any>) {
    updater();
    if (!autoLive) return;

    try {
      await pushPatch(patchBuilder());
    } catch (e: any) {
      flash(e?.message || "Erreur broadcast.");
    }
  }

  function setNextScore(side: "home" | "away", next: number) {
    if (side === "home") setHomeScore(Math.max(0, next));
    else setAwayScore(Math.max(0, next));
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
    const next = defaultClockMsBySport(sport);
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

  async function openFullscreen() {
    const el = document.documentElement as any;
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
      return;
    }
    await el.requestFullscreen?.().catch(() => {});
  }

  if (loading) {
    return <div style={styles.page}><div style={styles.centerBox}>Chargement de la régie…</div></div>;
  }

  if (err || !match) {
    return <div style={styles.page}><div style={styles.errorBox}>{err || "Match introuvable."}</div></div>;
  }

  const displayHref = displayLink();
  const controlHref = controlLink();

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
            <button onClick={() => nav(team?.id ? `/teams/${team.id}/matches` : "/teams")} style={styles.ghostBtn}>Retour</button>
            <button onClick={openFullscreen} style={styles.ghostBtn}>Plein écran</button>
            <button onClick={() => nav("/display-settings")} style={styles.ghostBtn}>Paramètres Display</button>
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

              <label style={styles.switchRow}>
                <input
                  type="checkbox"
                  checked={displaySettings?.show_score ?? true}
                  onChange={() => {}}
                  disabled
                />
                <span>Score affiché</span>
              </label>
            </div>
          </div>

          <div style={styles.heroActions}>
            <button onClick={saveMatch} style={styles.primaryBtn}>Sauvegarder</button>
            <button onClick={syncNow} style={styles.ghostBtn}>Envoyer au Display</button>
            {displayHref ? <a href={displayHref} target="_blank" rel="noreferrer" style={styles.linkBtn}>Ouvrir écran public</a> : null}
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
                  {periodOptions.map((p) => <option key={p} value={p}>{p}</option>)}
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
                      <button onClick={() => changeScore("home", -step)} style={styles.ghostBtnSmall}>-{step}</button>
                      <button onClick={() => changeScore("home", step)} style={styles.primaryBtnSmall}>+{step}</button>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <div style={styles.clockCard}>
                <div style={styles.clockLabel}>{periodLabel}</div>
                <div style={styles.clockValue}>{fmtClock(clockMs)}</div>
                <div style={{ opacity: 0.75, marginBottom: 12 }}>{clockRunning ? "Chrono actif" : "Chrono arrêté"}</div>

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
              </div>

              <div style={styles.teamCard}>
                <div style={styles.teamName}>{awayName || "Extérieur"}</div>
                <div style={styles.scoreValue}>{awayScore}</div>
                <div style={styles.scoreActions}>
                  {scoreSteps.map((step) => (
                    <React.Fragment key={`away-${step}`}>
                      <button onClick={() => changeScore("away", -step)} style={styles.ghostBtnSmall}>-{step}</button>
                      <button onClick={() => changeScore("away", step)} style={styles.primaryBtnSmall}>+{step}</button>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section style={{ ...styles.panel, gridColumn: "1 / -1" }}>
            <div style={styles.sectionTitle}>Paramètres d’affichage hérités</div>
            <div style={styles.flagsGrid}>
              <Flag label="Score" value={displaySettings?.show_score ?? true} />
              <Flag label="Horloge" value={displaySettings?.show_clock ?? true} />
              <Flag label="Période" value={displaySettings?.show_period ?? true} />
              <Flag label="Statut" value={displaySettings?.show_status ?? true} />
              <Flag label="Lower third" value={displaySettings?.show_lower_third ?? true} />
              <Flag label="Sponsors" value={displaySettings?.show_sponsors ?? true} />
              <Flag label="Logos" value={displaySettings?.show_logos ?? true} />
            </div>
          </section>
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

function Flag({ label, value }: { label: string; value: boolean }) {
  return (
    <div style={{
      padding: 12,
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,.08)",
      background: "rgba(255,255,255,.04)",
    }}>
      <div style={{ fontSize: 13, opacity: 0.72 }}>{label}</div>
      <div style={{ marginTop: 4, fontWeight: 900 }}>{value ? "Affiché" : "Masqué"}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
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
    padding: 12,
    borderRadius: 12,
    background: "rgba(37,99,235,.12)",
    border: "1px solid rgba(37,99,235,.28)",
    color: "#dbeafe",
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
  flagsGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 },
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
