import React, { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "../supabase";
import { sendTvBroadcast } from "../realtime";

const LS_ACTIVE_ORG_ID = "scoreDisplay.activeOrgId";
const LS_ACTIVE_ORG_SLUG = "scoreDisplay.activeOrgSlug";

type MatchStatus = "scheduled" | "live" | "paused" | "finished" | "archived" | string;

type MatchRow = {
  id: string;
  name: string | null;
  status: MatchStatus | null;
  scheduled_at: string | null;
  public_display: boolean | null;
  display_token: string | null;
  home_name: string | null;
  away_name: string | null;
  home_score?: number | null;
  away_score?: number | null;
};

type OrgRow = {
  id: string;
  slug: string;
  name: string;
  status?: string | null;
  sport?: string | null;
};

function getEnv(name: string): string {
  const v = (import.meta as any).env?.[name];
  return typeof v === "string" ? v : "";
}

const HOME_URL = getEnv("VITE_HOME_URL") || "https://scoreboard-home.vercel.app";
const DISPLAY_URL = getEnv("VITE_DISPLAY_URL") || "";

function fmtDate(input: string | null) {
  if (!input) return "Date non définie";
  try {
    return new Date(input).toLocaleString();
  } catch {
    return input;
  }
}

function normalizeStatus(status: string | null | undefined): MatchStatus {
  return ((status || "scheduled") + "").toLowerCase();
}

function safeInt(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : fallback;
}

function matchTitle(m: MatchRow) {
  return m.name || `${m.home_name || "Équipe domicile"} vs ${m.away_name || "Équipe extérieur"}`;
}

function statusBadge(status: MatchStatus) {
  const s = normalizeStatus(status);

  if (s === "scheduled") return { label: "À préparer", color: "#2563eb", bg: "rgba(37,99,235,.12)" };
  if (s === "live") return { label: "En cours", color: "#dc2626", bg: "rgba(220,38,38,.12)" };
  if (s === "paused") return { label: "Pause", color: "#d97706", bg: "rgba(217,119,6,.12)" };
  if (s === "finished") return { label: "Terminé", color: "#16a34a", bg: "rgba(22,163,74,.12)" };
  if (s === "archived") return { label: "Archivé", color: "#6b7280", bg: "rgba(107,114,128,.12)" };

  return { label: s, color: "#6b7280", bg: "rgba(107,114,128,.12)" };
}

function orgStatusBadge(status: string | null | undefined) {
  const s = ((status || "active") + "").toLowerCase();

  if (s === "active") return { label: "Active", color: "#16a34a", bg: "rgba(22,163,74,.12)" };
  if (s === "suspended") return { label: "Suspendue", color: "#d97706", bg: "rgba(217,119,6,.12)" };
  if (s === "archived") return { label: "Archivée", color: "#6b7280", bg: "rgba(107,114,128,.12)" };

  return { label: s, color: "#6b7280", bg: "rgba(107,114,128,.12)" };
}

function normalizeSport(sport: string | null | undefined) {
  return ((sport || "football") + "").trim().toLowerCase();
}

function periodHintsBySport(sport: string) {
  const v = normalizeSport(sport);
  if (v === "basket") return "Q1 • Q2 • Q3 • Q4";
  if (v === "handball") return "1MT • 2MT";
  if (v === "rugby") return "1MT • 2MT";
  if (v === "volleyball") return "Set 1 • Set 2 • Set 3 • Set 4 • Set 5";
  return "1MT • 2MT";
}

function periodOptionsBySport(sport: string) {
  const v = normalizeSport(sport);
  if (v === "basket") return ["Q1", "Q2", "Q3", "Q4", "OT"];
  if (v === "volleyball") return ["Set 1", "Set 2", "Set 3", "Set 4", "Set 5"];
  if (v === "handball") return ["1MT", "2MT", "Prolongation"];
  if (v === "rugby") return ["1MT", "2MT", "Prolongation"];
  return ["1MT", "2MT", "Prolongation"];
}

function defaultClockMsBySport(sport: string) {
  const v = normalizeSport(sport);
  if (v === "basket") return 10 * 60 * 1000;
  if (v === "handball") return 30 * 60 * 1000;
  if (v === "rugby") return 40 * 60 * 1000;
  if (v === "volleyball") return 0;
  return 45 * 60 * 1000;
}

function fmtClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function MatchPage() {
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<OrgRow | null>(null);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [err, setErr] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [selectedQr, setSelectedQr] = useState("");

  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [homeName, setHomeName] = useState("");
  const [awayName, setAwayName] = useState("");
  const [matchName, setMatchName] = useState("");
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [status, setStatus] = useState<MatchStatus>("scheduled");
  const [periodLabel, setPeriodLabel] = useState("1MT");
  const [clockMs, setClockMs] = useState(45 * 60 * 1000);
  const [clockRunning, setClockRunning] = useState(false);
  const [saving, setSaving] = useState(false);

  const tickerRef = useRef<number | null>(null);

  const activeOrgId = useMemo(() => (localStorage.getItem(LS_ACTIVE_ORG_ID) || "").trim(), []);
  const activeOrgSlug = useMemo(() => (localStorage.getItem(LS_ACTIVE_ORG_SLUG) || "").trim(), []);

  const sport = normalizeSport(org?.sport);
  const periodOptions = useMemo(() => periodOptionsBySport(sport), [sport]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setErr("");
      setInfoMsg("");
      setLoading(true);

      const { data: sess } = await supabase.auth.getSession();
      if (cancelled) return;

      if (!sess.session?.user) {
        setErr("Non connecté. Reviens sur Home pour te connecter.");
        setLoading(false);
        return;
      }

      if (!activeOrgId && !activeOrgSlug) {
        setErr("Aucune organisation sélectionnée. Reviens sur Home puis clique sur Ouvrir.");
        setLoading(false);
        return;
      }

      const orgQuery = supabase.from("orgs").select("id, slug, name, status, sport");
      const { data: orgRow, error: orgErr } = activeOrgId
        ? await orgQuery.eq("id", activeOrgId).maybeSingle()
        : await orgQuery.eq("slug", activeOrgSlug).maybeSingle();

      if (cancelled) return;

      if (orgErr || !orgRow) {
        setErr(orgErr?.message || "Organisation introuvable.");
        setOrg(null);
        setMatches([]);
        setLoading(false);
        return;
      }

      setOrg(orgRow as OrgRow);

      const { data: ms, error: mErr } = await supabase
        .from("matches")
        .select("id, name, status, scheduled_at, public_display, display_token, home_name, away_name, home_score, away_score")
        .eq("org_id", (orgRow as OrgRow).id)
        .order("scheduled_at", { ascending: true, nullsFirst: true });

      if (cancelled) return;

      if (mErr) {
        setErr(mErr.message);
        setMatches([]);
      } else {
        const next = ((ms as MatchRow[]) || []).sort((a, b) => {
          const da = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
          const db = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
          return da - db;
        });

        setMatches(next);

        const first = next[0];
        if (first) {
          hydrateEditor(first, normalizeSport((orgRow as OrgRow).sport));
        }
      }

      setLoading(false);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [activeOrgId, activeOrgSlug]);

  useEffect(() => {
    if (!clockRunning) return;

    tickerRef.current = window.setInterval(() => {
      setClockMs((prev) => {
        if (prev <= 250) {
          setClockRunning(false);
          return 0;
        }
        return Math.max(0, prev - 250);
      });
    }, 250);

    return () => {
      if (tickerRef.current) {
        window.clearInterval(tickerRef.current);
        tickerRef.current = null;
      }
    };
  }, [clockRunning]);

  function hydrateEditor(m: MatchRow, orgSport: string) {
    setSelectedMatchId(m.id);
    setHomeName(m.home_name || "Équipe domicile");
    setAwayName(m.away_name || "Équipe extérieur");
    setMatchName(m.name || `${m.home_name || "Équipe domicile"} vs ${m.away_name || "Équipe extérieur"}`);
    setHomeScore(safeInt(m.home_score, 0));
    setAwayScore(safeInt(m.away_score, 0));
    setStatus(normalizeStatus(m.status));
    setPeriodLabel(periodOptionsBySport(orgSport)[0] || "1MT");
    setClockMs(defaultClockMsBySport(orgSport));
    setClockRunning(false);
  }

  const selectedMatch = useMemo(() => {
    return matches.find((m) => m.id === selectedMatchId) || matches[0] || null;
  }, [matches, selectedMatchId]);

  useEffect(() => {
    if (!selectedMatch && matches.length > 0 && org) {
      hydrateEditor(matches[0], normalizeSport(org.sport));
    }
  }, [selectedMatch, matches, org]);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = `${HOME_URL.replace(/\/$/, "")}/?forceLogin=1`;
  }

  function backHome() {
    window.location.href = HOME_URL;
  }

  function displayLink(m: MatchRow) {
    if (!DISPLAY_URL) return "";
    const base = DISPLAY_URL.replace(/\/$/, "");
    if (m.display_token) return `${base}/?token=${encodeURIComponent(m.display_token)}`;
    return `${base}/?matchId=${encodeURIComponent(m.id)}`;
  }

  async function copyDisplayLink(m: MatchRow) {
    const link = displayLink(m);
    if (!link) return;

    try {
      await navigator.clipboard.writeText(link);
      flash(`Lien copié pour "${matchTitle(m)}"`);
    } catch {
      flash("Impossible de copier le lien.");
    }
  }

  function flash(message: string) {
    setInfoMsg(message);
    window.setTimeout(() => setInfoMsg(""), 2500);
  }

  async function savePreparation() {
    if (!selectedMatch || !org) return;

    setSaving(true);
    try {
      const payload = {
        name: matchName.trim() || `${homeName.trim() || "Équipe domicile"} vs ${awayName.trim() || "Équipe extérieur"}`,
        home_name: homeName.trim() || "Équipe domicile",
        away_name: awayName.trim() || "Équipe extérieur",
        home_score: safeInt(homeScore),
        away_score: safeInt(awayScore),
        status: status || "scheduled",
      };

      const { error } = await supabase.from("matches").update(payload).eq("id", selectedMatch.id);
      if (error) throw error;

      setMatches((prev) =>
        prev.map((m) => (m.id === selectedMatch.id ? { ...m, ...payload } : m))
      );

      flash("Préparation du match sauvegardée.");
    } catch (e: any) {
      flash(e?.message || "Erreur de sauvegarde.");
    } finally {
      setSaving(false);
    }
  }

  async function pushPatch(custom?: Partial<any>) {
    if (!selectedMatch || !org) return;

    const patch = {
      match_id: selectedMatch.id,
      match_name: matchName.trim() || matchTitle(selectedMatch),
      venue: org.name,
      sport,
      status,
      home_name: homeName.trim() || "Équipe domicile",
      away_name: awayName.trim() || "Équipe extérieur",
      home_score: safeInt(homeScore),
      away_score: safeInt(awayScore),
      clock_ms: Math.max(0, clockMs),
      clock_running: clockRunning,
      period_label: periodLabel,
      sponsors: [
        { name: org.name, logo_url: null },
        { name: "scoreDisplay", logo_url: null },
      ],
      ...(custom || {}),
    };

    await sendTvBroadcast(selectedMatch.id, patch);
  }

  async function pushDemoBroadcast() {
    try {
      await pushPatch();
      flash(`Broadcast envoyé pour "${matchName || matchTitle(selectedMatch!)}"`);
    } catch (e: any) {
      flash(e?.message || "Erreur broadcast");
    }
  }

  async function setLive() {
    setStatus("live");
    try {
      await pushPatch({ status: "live" });
      flash("Match passé en mode live.");
    } catch (e: any) {
      flash(e?.message || "Erreur broadcast");
    }
  }

  async function setPaused() {
    setClockRunning(false);
    setStatus("paused");
    try {
      await pushPatch({ status: "paused", clock_running: false });
      flash("Chrono mis en pause.");
    } catch (e: any) {
      flash(e?.message || "Erreur broadcast");
    }
  }

  async function startClock() {
    setClockRunning(true);
    setStatus("live");
    try {
      await pushPatch({ status: "live", clock_running: true });
      flash("Chrono démarré.");
    } catch (e: any) {
      flash(e?.message || "Erreur broadcast");
    }
  }

  async function resetClock() {
    const reset = defaultClockMsBySport(sport);
    setClockMs(reset);
    setClockRunning(false);
    try {
      await pushPatch({ clock_ms: reset, clock_running: false });
      flash("Chrono réinitialisé.");
    } catch (e: any) {
      flash(e?.message || "Erreur broadcast");
    }
  }

  async function changeScore(side: "home" | "away", delta: number) {
    const nextHome = side === "home" ? Math.max(0, homeScore + delta) : homeScore;
    const nextAway = side === "away" ? Math.max(0, awayScore + delta) : awayScore;

    setHomeScore(nextHome);
    setAwayScore(nextAway);

    try {
      await pushPatch({
        home_score: nextHome,
        away_score: nextAway,
      });
    } catch (e: any) {
      flash(e?.message || "Erreur broadcast");
    }
  }

  async function changePeriod(next: string) {
    setPeriodLabel(next);
    try {
      await pushPatch({ period_label: next });
      flash(`Période envoyée : ${next}`);
    } catch (e: any) {
      flash(e?.message || "Erreur broadcast");
    }
  }

  const upcomingMatches = useMemo(() => {
    return matches.filter((m) => {
      const s = normalizeStatus(m.status);
      return s === "scheduled" || s === "live" || s === "paused";
    });
  }, [matches]);

  const archivedMatches = useMemo(() => {
    return matches.filter((m) => {
      const s = normalizeStatus(m.status);
      return s === "finished" || s === "archived";
    });
  }, [matches]);

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.centerBox}>Chargement des matchs…</div>
      </div>
    );
  }

  if (err) {
    return (
      <div style={styles.page}>
        <div style={styles.errorBox}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Erreur</div>
          <div style={{ marginTop: 8 }}>{err}</div>

          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            <button onClick={backHome} style={styles.primaryBtn}>
              Retour Home
            </button>
            <button onClick={logout} style={styles.ghostBtn}>
              Se déconnecter
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!org) {
    return (
      <div style={styles.page}>
        <div style={styles.errorBox}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Organisation non définie</div>
          <div style={{ marginTop: 8 }}>Reviens sur Home et sélectionne une organisation.</div>

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={backHome} style={styles.primaryBtn}>
              Retour Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const orgBadge = orgStatusBadge(org.status);

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.topbar}>
          <div>
            <div style={styles.title}>{org.name}</div>
            <div style={styles.subtitle}>
              slug: <b>{org.slug}</b> • sport: <b>{sport}</b>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span
              style={{
                ...styles.badge,
                color: orgBadge.color,
                background: orgBadge.bg,
                borderColor: `${orgBadge.color}33`,
              }}
            >
              {orgBadge.label}
            </span>

            <button onClick={backHome} style={styles.ghostBtn}>
              Home
            </button>

            <button onClick={logout} style={styles.ghostBtn}>
              Déconnexion
            </button>
          </div>
        </div>

        <div style={styles.hero}>
          <div>
            <div style={styles.heroTitle}>Espace Operator</div>
            <div style={styles.heroText}>
              Prépare les matchs, ouvre le Display public, pilote le score, le chrono et la période, puis diffuse en direct vers l’écran.
            </div>
            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.78 }}>
              Règles sport fines : {periodHintsBySport(sport)}
            </div>
          </div>

          <div style={styles.kpis}>
            <div style={styles.kpiCard}>
              <div style={styles.kpiLabel}>À préparer</div>
              <div style={styles.kpiValue}>{upcomingMatches.length}</div>
            </div>
            <div style={styles.kpiCard}>
              <div style={styles.kpiLabel}>Archives</div>
              <div style={styles.kpiValue}>{archivedMatches.length}</div>
            </div>
            <div style={styles.kpiCard}>
              <div style={styles.kpiLabel}>Total matchs</div>
              <div style={styles.kpiValue}>{matches.length}</div>
            </div>
          </div>
        </div>

        <div style={styles.noticeCard}>
          <div style={styles.noticeTitle}>Notice rapide</div>
          <div style={styles.noticeText}>
            1. Sélectionne un match dans la liste.<br />
            2. Prépare les équipes et sauvegarde.<br />
            3. Ouvre le Display ou copie le lien public.<br />
            4. Utilise la console live pour le score, le chrono et la période.<br />
            5. Clique sur Broadcast pour pousser l’état courant vers l’écran public.
          </div>
        </div>

        {infoMsg ? <div style={styles.copyInfo}>{infoMsg}</div> : null}

        {selectedQr ? (
          <div style={styles.qrPanel}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div style={{ fontWeight: 900 }}>QR code Display</div>
              <button onClick={() => setSelectedQr("")} style={styles.ghostBtnSmall}>
                Fermer
              </button>
            </div>

            <div style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
              <div style={{ background: "white", padding: 10, borderRadius: 12 }}>
                <QRCodeSVG value={selectedQr} size={180} />
              </div>
              <div style={{ maxWidth: 420 }}>
                <div style={{ fontSize: 13, opacity: 0.82, lineHeight: 1.6 }}>
                  Scanne ce QR code pour ouvrir directement le Display public du match.
                </div>
                <div style={{ marginTop: 10, wordBreak: "break-all", fontSize: 12, opacity: 0.72 }}>{selectedQr}</div>
              </div>
            </div>
          </div>
        ) : null}

        <div style={styles.grid}>
          <section style={styles.panel}>
            <div style={styles.sectionTitle}>Matchs</div>

            <div style={styles.listCompact}>
              {matches.map((m) => {
                const sb = statusBadge(m.status || "scheduled");
                const isActive = m.id === selectedMatch?.id;
                const link = displayLink(m);

                return (
                  <div
                    key={m.id}
                    style={{
                      ...styles.compactCard,
                      border: isActive ? "1px solid rgba(59,130,246,.45)" : "1px solid rgba(255,255,255,.08)",
                      boxShadow: isActive ? "0 0 0 1px rgba(59,130,246,.18) inset" : "none",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={styles.matchTitle}>{matchTitle(m)}</div>
                      <div style={styles.matchMeta}>
                        {fmtDate(m.scheduled_at)} • Display: <b>{m.public_display ? "public" : "privé"}</b> • Token:{" "}
                        <b>{m.display_token ? "OK" : "—"}</b>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <span
                        style={{
                          ...styles.badge,
                          color: sb.color,
                          background: sb.bg,
                          borderColor: `${sb.color}33`,
                        }}
                      >
                        {sb.label}
                      </span>

                      <button
                        onClick={() => hydrateEditor(m, sport)}
                        style={isActive ? styles.primaryBtnSmall : styles.ghostBtnSmall}
                      >
                        Sélectionner
                      </button>

                      {link ? (
                        <>
                          <a href={link} target="_blank" rel="noreferrer" style={styles.linkBtn}>
                            Display
                          </a>
                          <button onClick={() => copyDisplayLink(m)} style={styles.ghostBtnSmall}>
                            Copier
                          </button>
                          <button onClick={() => setSelectedQr(link)} style={styles.ghostBtnSmall}>
                            QR
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section style={styles.panel}>
            <div style={styles.sectionTitle}>Préparation match</div>

            {!selectedMatch ? (
              <div style={styles.emptyCard}>Aucun match sélectionné.</div>
            ) : (
              <>
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
                      <option value="archived">Archivé</option>
                    </select>
                  </Field>

                  <Field label="Équipe domicile">
                    <input value={homeName} onChange={(e) => setHomeName(e.target.value)} style={styles.input} />
                  </Field>

                  <Field label="Équipe extérieur">
                    <input value={awayName} onChange={(e) => setAwayName(e.target.value)} style={styles.input} />
                  </Field>

                  <Field label="Sport">
                    <input value={sport} readOnly style={{ ...styles.input, opacity: 0.8 }} />
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
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
                  <button onClick={savePreparation} style={styles.primaryBtn} disabled={saving}>
                    {saving ? "Sauvegarde..." : "Sauvegarder"}
                  </button>

                  <button onClick={setLive} style={styles.ghostBtn}>
                    Passer en live
                  </button>

                  <button onClick={pushDemoBroadcast} style={styles.ghostBtn}>
                    Broadcast
                  </button>
                </div>
              </>
            )}
          </section>

          <section style={styles.panel}>
            <div style={styles.sectionTitle}>Console live</div>

            {!selectedMatch ? (
              <div style={styles.emptyCard}>Sélectionne un match pour piloter le live.</div>
            ) : (
              <>
                <div style={styles.scoreGrid}>
                  <div style={styles.teamCard}>
                    <div style={styles.teamName}>{homeName || "Équipe domicile"}</div>
                    <div style={styles.scoreValue}>{homeScore}</div>
                    <div style={styles.scoreActions}>
                      <button onClick={() => changeScore("home", -1)} style={styles.ghostBtnSmall}>-1</button>
                      <button onClick={() => changeScore("home", 1)} style={styles.primaryBtnSmall}>+1</button>
                    </div>
                  </div>

                  <div style={styles.clockCard}>
                    <div style={styles.clockLabel}>{periodLabel}</div>
                    <div style={styles.clockValue}>{fmtClock(clockMs)}</div>
                    <div style={{ fontSize: 13, opacity: 0.72 }}>{clockRunning ? "Chrono en cours" : "Chrono arrêté"}</div>

                    <div style={styles.scoreActions}>
                      <button onClick={startClock} style={styles.primaryBtnSmall}>Start</button>
                      <button onClick={setPaused} style={styles.ghostBtnSmall}>Pause</button>
                      <button onClick={resetClock} style={styles.ghostBtnSmall}>Reset</button>
                    </div>
                  </div>

                  <div style={styles.teamCard}>
                    <div style={styles.teamName}>{awayName || "Équipe extérieur"}</div>
                    <div style={styles.scoreValue}>{awayScore}</div>
                    <div style={styles.scoreActions}>
                      <button onClick={() => changeScore("away", -1)} style={styles.ghostBtnSmall}>-1</button>
                      <button onClick={() => changeScore("away", 1)} style={styles.primaryBtnSmall}>+1</button>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
                  <button onClick={() => setClockMs((v) => Math.max(0, v - 60_000))} style={styles.ghostBtnSmall}>
                    -1 min
                  </button>
                  <button onClick={() => setClockMs((v) => v + 60_000)} style={styles.ghostBtnSmall}>
                    +1 min
                  </button>
                  <button onClick={() => setClockMs((v) => Math.max(0, v - 1000))} style={styles.ghostBtnSmall}>
                    -1 sec
                  </button>
                  <button onClick={() => setClockMs((v) => v + 1000)} style={styles.ghostBtnSmall}>
                    +1 sec
                  </button>
                  <button onClick={pushDemoBroadcast} style={styles.primaryBtn}>
                    Envoyer l’état courant
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 13, opacity: 0.78, marginBottom: 6 }}>{label}</div>
      {children}
    </label>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#0b0f14",
    color: "#e7eefc",
    padding: 24,
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
  },
  container: {
    maxWidth: 1280,
    margin: "0 auto",
  },
  centerBox: {
    maxWidth: 500,
    margin: "60px auto",
    padding: 18,
    borderRadius: 16,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
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
  topbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 18,
  },
  title: {
    fontSize: 30,
    fontWeight: 900,
    letterSpacing: -0.6,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    opacity: 0.72,
  },
  hero: {
    display: "grid",
    gridTemplateColumns: "1.3fr .9fr",
    gap: 16,
    padding: 18,
    borderRadius: 18,
    background: "linear-gradient(180deg, rgba(37,99,235,.10), rgba(255,255,255,.03))",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: 900,
  },
  heroText: {
    marginTop: 8,
    lineHeight: 1.6,
    opacity: 0.9,
    maxWidth: 720,
  },
  kpis: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
  },
  kpiCard: {
    padding: 16,
    borderRadius: 16,
    background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(255,255,255,.08)",
  },
  kpiLabel: {
    fontSize: 13,
    opacity: 0.74,
  },
  kpiValue: {
    fontSize: 28,
    fontWeight: 900,
    marginTop: 6,
  },
  noticeCard: {
    marginTop: 14,
    padding: 16,
    borderRadius: 16,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  noticeTitle: {
    fontWeight: 900,
    fontSize: 16,
    marginBottom: 8,
  },
  noticeText: {
    fontSize: 14,
    lineHeight: 1.7,
    opacity: 0.9,
  },
  copyInfo: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    background: "rgba(37,99,235,.12)",
    border: "1px solid rgba(37,99,235,.28)",
    color: "#dbeafe",
  },
  qrPanel: {
    marginTop: 14,
    padding: 16,
    borderRadius: 16,
    background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(255,255,255,.08)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 18,
    marginTop: 22,
  },
  panel: {
    padding: 16,
    borderRadius: 18,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.08)",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 900,
    marginBottom: 14,
  },
  listCompact: {
    display: "grid",
    gap: 12,
  },
  compactCard: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    background: "rgba(255,255,255,.03)",
  },
  matchTitle: {
    fontSize: 17,
    fontWeight: 800,
    lineHeight: 1.25,
  },
  matchMeta: {
    marginTop: 6,
    fontSize: 13,
    opacity: 0.72,
  },
  badge: {
    border: "1px solid transparent",
    borderRadius: 999,
    padding: "7px 12px",
    fontSize: 13,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  emptyCard: {
    padding: 16,
    borderRadius: 14,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.08)",
    opacity: 0.8,
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
    padding: "9px 12px",
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
  },
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
  scoreGrid: {
    display: "grid",
    gridTemplateColumns: "1fr .9fr 1fr",
    gap: 14,
    alignItems: "stretch",
  },
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
  scoreValue: {
    fontSize: 56,
    lineHeight: 1,
    fontWeight: 900,
    marginTop: 10,
    marginBottom: 14,
  },
  scoreActions: {
    display: "flex",
    gap: 8,
    justifyContent: "center",
    flexWrap: "wrap",
  },
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
  clockLabel: {
    fontSize: 18,
    fontWeight: 900,
    opacity: 0.9,
  },
  clockValue: {
    fontSize: 52,
    lineHeight: 1,
    fontWeight: 900,
    marginTop: 10,
    marginBottom: 10,
  },
};
