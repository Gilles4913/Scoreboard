import React, { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabase";

type MatchRow = {
  id: string;
  org_id: string;
  team_id: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  name: string | null;
  status: string | null;
  scheduled_at: string | null;
  home_name: string | null;
  away_name: string | null;
  home_score: number | null;
  away_score: number | null;
  period_label: string | null;
  clock_ms: number | null;
  clock_running: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type OrgRow = {
  id: string;
  slug: string | null;
  name: string;
  sport: string | null;
};

type TeamRow = {
  id: string;
  org_id: string;
  slug: string | null;
  name: string;
  category: string | null;
  code: string | null;
};

function getEnv(name: string): string {
  const v = (import.meta as any).env?.[name];
  return typeof v === "string" ? v : "";
}

const DISPLAY_URL =
  getEnv("VITE_DISPLAY_APP_URL") ||
  getEnv("VITE_DISPLAY_URL") ||
  "";

function normalizeStatus(status: string | null | undefined) {
  return ((status || "scheduled") + "").toLowerCase();
}

function fmtDate(input: string | null | undefined) {
  if (!input) return "Date non définie";
  try {
    return new Date(input).toLocaleString();
  } catch {
    return input;
  }
}

function fmtClock(ms: number | null | undefined) {
  const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function badgeForStatus(status: string | null | undefined) {
  const s = normalizeStatus(status);
  if (s === "scheduled") return { label: "À préparer", fg: "#2563eb", bg: "rgba(37,99,235,.12)" };
  if (s === "live") return { label: "En cours", fg: "#dc2626", bg: "rgba(220,38,38,.12)" };
  if (s === "paused") return { label: "Pause", fg: "#d97706", bg: "rgba(217,119,6,.12)" };
  if (s === "finished") return { label: "Terminé", fg: "#16a34a", bg: "rgba(22,163,74,.12)" };
  if (s === "archived") return { label: "Archivé", fg: "#94a3b8", bg: "rgba(148,163,184,.12)" };
  return { label: s || "—", fg: "#94a3b8", bg: "rgba(148,163,184,.12)" };
}

function matchTitle(m: MatchRow) {
  return m.name || `${m.home_name || "Domicile"} vs ${m.away_name || "Extérieur"}`;
}

export default function MatchPage() {
  const nav = useNavigate();
  const { matchId = "" } = useParams();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  const [match, setMatch] = useState<MatchRow | null>(null);
  const [org, setOrg] = useState<OrgRow | null>(null);
  const [team, setTeam] = useState<TeamRow | null>(null);

  const [selectedQr, setSelectedQr] = useState("");
  const [selectedQrTitle, setSelectedQrTitle] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setErr("");

      const { data: matchRow, error: matchErr } = await supabase
        .from("matches")
        .select(`
          id,
          org_id,
          team_id,
          home_team_id,
          away_team_id,
          name,
          status,
          scheduled_at,
          home_name,
          away_name,
          home_score,
          away_score,
          period_label,
          clock_ms,
          clock_running,
          created_at,
          updated_at
        `)
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

      const [{ data: orgRow, error: orgErr }, { data: teamRow, error: teamErr }] = await Promise.all([
        supabase
          .from("orgs")
          .select("id, slug, name, sport")
          .eq("id", currentMatch.org_id)
          .maybeSingle(),
        currentMatch.team_id
          ? supabase
              .from("teams")
              .select("id, org_id, slug, name, category, code")
              .eq("id", currentMatch.team_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (cancelled) return;

      if (orgErr || !orgRow) {
        setErr(orgErr?.message || "Organisation introuvable.");
        setLoading(false);
        return;
      }

      if (teamErr) {
        setErr(teamErr.message);
        setLoading(false);
        return;
      }

      setOrg(orgRow as OrgRow);
      setTeam((teamRow as TeamRow) || null);
      setLoading(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  function flash(message: string) {
    setInfo(message);
    window.setTimeout(() => setInfo(""), 2400);
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      flash("Lien copié.");
    } catch {
      flash("Copie impossible.");
    }
  }

  function controlHref() {
    return `${window.location.origin}/matches/${encodeURIComponent(matchId)}/control`;
  }

  function rosterHref() {
    return `${window.location.origin}/matches/${encodeURIComponent(matchId)}/roster`;
  }

  function stableDisplayHref() {
    if (!DISPLAY_URL) return "";
    const base = DISPLAY_URL.replace(/\/$/, "");
    if (team?.slug) return `${base}/?teamSlug=${encodeURIComponent(team.slug)}`;
    if (team?.id) return `${base}/?teamId=${encodeURIComponent(team.id)}`;
    return "";
  }

  async function updateStatus(nextStatus: "scheduled" | "live" | "paused" | "finished" | "archived") {
    if (!match) return;

    const { error } = await supabase
      .from("matches")
      .update({ status: nextStatus })
      .eq("id", match.id);

    if (error) {
      flash(`Erreur mise à jour statut : ${error.message}`);
      return;
    }

    setMatch((prev) => (prev ? { ...prev, status: nextStatus } : prev));
    flash("Statut mis à jour.");
  }

  async function archiveMatch() {
    if (!match) return;
    const ok = window.confirm("Archiver ce match ?");
    if (!ok) return;
    await updateStatus("archived");
  }

  async function deleteMatch() {
    if (!match) return;

    const safeStatus = normalizeStatus(match.status);
    if (safeStatus !== "scheduled") {
      flash("Suppression autorisée uniquement sur un match à préparer.");
      return;
    }

    const ok = window.confirm("Supprimer définitivement ce match ?");
    if (!ok) return;

    const { error } = await supabase
      .from("matches")
      .delete()
      .eq("id", match.id);

    if (error) {
      flash(`Erreur suppression : ${error.message}`);
      return;
    }

    if (team?.id) {
      nav(`/teams/${team.id}/matches`);
      return;
    }

    nav("/teams");
  }

  const statusBadge = useMemo(() => badgeForStatus(match?.status), [match?.status]);
  const publicHref = stableDisplayHref();

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.centerBox}>Chargement du match…</div>
      </div>
    );
  }

  if (err || !match) {
    return (
      <div style={styles.page}>
        <div style={styles.errorBox}>{err || "Match introuvable."}</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.topbar}>
          <div>
            <div style={styles.title}>{matchTitle(match)}</div>
            <div style={styles.subtitle}>
              {org?.name || "Organisation"} {team?.name ? `• ${team.name}` : ""} {org?.sport ? `• ${org.sport}` : ""}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => nav(team?.id ? `/teams/${team.id}/matches` : "/teams")}
              style={styles.ghostBtn}
            >
              Retour
            </button>

            <button
              onClick={() => nav(`/matches/${match.id}/control`)}
              style={styles.primaryBtn}
            >
              Ouvrir la régie
            </button>

            <button
              onClick={() => nav(`/matches/${match.id}/roster`)}
              style={styles.ghostBtn}
            >
              Feuille de match
            </button>

            {publicHref ? (
              <a href={publicHref} target="_blank" rel="noreferrer" style={styles.linkBtn}>
                Écran public stable
              </a>
            ) : null}
          </div>
        </div>

        {info ? <div style={styles.infoBox}>{info}</div> : null}

        {selectedQr ? (
          <div style={styles.qrPanel}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div style={{ fontWeight: 900 }}>{selectedQrTitle}</div>
              <button onClick={() => setSelectedQr("")} style={styles.ghostBtnSmall}>
                Fermer
              </button>
            </div>

            <div style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
              <div style={{ background: "white", padding: 10, borderRadius: 12 }}>
                <QRCodeSVG value={selectedQr} size={180} />
              </div>
              <div style={{ maxWidth: 520 }}>
                <div style={{ fontSize: 13, opacity: 0.82, lineHeight: 1.6, wordBreak: "break-all" }}>
                  {selectedQr}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div style={styles.hero}>
          <div>
            <div style={styles.heroTitle}>Résumé</div>
            <div style={styles.heroText}>
              Cette page ne gère plus aucun lien public par token. Le seul lien public normalisé est l’écran stable par équipe.
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
              <span
                style={{
                  ...styles.badge,
                  color: statusBadge.fg,
                  background: statusBadge.bg,
                  borderColor: `${statusBadge.fg}33`,
                }}
              >
                {statusBadge.label}
              </span>
            </div>
          </div>

          <div style={styles.heroActions}>
            <button onClick={() => updateStatus("scheduled")} style={styles.ghostBtn}>
              À préparer
            </button>
            <button onClick={() => updateStatus("live")} style={styles.primaryBtn}>
              En cours
            </button>
            <button onClick={() => updateStatus("paused")} style={styles.ghostBtn}>
              Pause
            </button>
            <button onClick={() => updateStatus("finished")} style={styles.ghostBtn}>
              Terminé
            </button>
            <button onClick={archiveMatch} style={styles.ghostBtn}>
              Archiver
            </button>
            <button onClick={deleteMatch} style={styles.dangerBtn}>
              Supprimer
            </button>
          </div>
        </div>

        <div style={styles.grid}>
          <section style={styles.panel}>
            <div style={styles.sectionTitle}>Informations match</div>

            <div style={styles.infoGrid}>
              <InfoItem label="Nom" value={matchTitle(match)} />
              <InfoItem label="Organisation" value={org?.name || "—"} />
              <InfoItem label="Équipe support" value={team?.name || "—"} />
              <InfoItem label="Sport" value={org?.sport || "—"} />
              <InfoItem label="Programmation" value={fmtDate(match.scheduled_at)} />
              <InfoItem label="Statut" value={statusBadge.label} />
              <InfoItem label="Domicile" value={match.home_name || "Domicile"} />
              <InfoItem label="Extérieur" value={match.away_name || "Extérieur"} />
            </div>
          </section>

          <section style={styles.panel}>
            <div style={styles.sectionTitle}>État live</div>

            <div style={styles.liveGrid}>
              <LiveCard title={match.home_name || "Domicile"} value={String(match.home_score ?? 0)} />
              <LiveCard title="Horloge" value={fmtClock(match.clock_ms)} sub={match.clock_running ? "RUN" : "STOP"} />
              <LiveCard title={match.away_name || "Extérieur"} value={String(match.away_score ?? 0)} />
              <LiveCard title="Période" value={match.period_label || "—"} />
            </div>
          </section>

          <section style={{ ...styles.panel, gridColumn: "1 / -1" }}>
            <div style={styles.sectionTitle}>Liens & QR</div>

            <div style={styles.linkGrid}>
              <LinkCard
                title="Régie live"
                url={controlHref()}
                onCopy={() => copyText(controlHref())}
                onQr={() => {
                  setSelectedQr(controlHref());
                  setSelectedQrTitle("QR régie live");
                }}
              />

              <LinkCard
                title="Feuille de match"
                url={rosterHref()}
                onCopy={() => copyText(rosterHref())}
                onQr={() => {
                  setSelectedQr(rosterHref());
                  setSelectedQrTitle("QR feuille de match");
                }}
              />

              <LinkCard
                title="Écran public stable équipe"
                url={publicHref || "Indisponible : équipe sans slug / id exploitable"}
                onCopy={publicHref ? () => copyText(publicHref) : undefined}
                onQr={
                  publicHref
                    ? () => {
                        setSelectedQr(publicHref);
                        setSelectedQrTitle("QR écran public stable équipe");
                      }
                    : undefined
                }
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.infoItem}>
      <div style={styles.infoLabel}>{label}</div>
      <div style={styles.infoValue}>{value}</div>
    </div>
  );
}

function LiveCard({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div style={styles.liveCard}>
      <div style={styles.liveTitle}>{title}</div>
      <div style={styles.liveValue}>{value}</div>
      {sub ? <div style={styles.liveSub}>{sub}</div> : null}
    </div>
  );
}

function LinkCard({
  title,
  url,
  onCopy,
  onQr,
}: {
  title: string;
  url: string;
  onCopy?: () => void;
  onQr?: () => void;
}) {
  return (
    <div style={styles.linkCard}>
      <div style={styles.linkCardTitle}>{title}</div>
      <div style={styles.linkCardUrl}>{url}</div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
        {onCopy ? (
          <button onClick={onCopy} style={styles.primaryBtnSmall}>
            Copier
          </button>
        ) : null}
        {onQr ? (
          <button onClick={onQr} style={styles.ghostBtnSmall}>
            QR
          </button>
        ) : null}
      </div>
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
  container: { maxWidth: 1220, margin: "0 auto" },
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
    padding: 14,
    borderRadius: 14,
    background: "rgba(37,99,235,.16)",
    border: "1px solid rgba(37,99,235,.32)",
    color: "#dbeafe",
    fontWeight: 800,
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
    marginBottom: 22,
  },
  heroTitle: { fontSize: 22, fontWeight: 900 },
  heroText: { marginTop: 8, lineHeight: 1.6, opacity: 0.9 },
  heroActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "flex-end",
  },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 },
  panel: {
    padding: 16,
    borderRadius: 18,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.08)",
  },
  sectionTitle: { fontSize: 18, fontWeight: 900, marginBottom: 14 },
  infoGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  infoItem: {
    padding: 12,
    borderRadius: 14,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.08)",
  },
  infoLabel: { fontSize: 12, opacity: 0.7, marginBottom: 6 },
  infoValue: { fontSize: 15, fontWeight: 800 },
  liveGrid: { display: "grid", gridTemplateColumns: "1fr .8fr 1fr 1fr", gap: 12 },
  liveCard: {
    padding: 14,
    borderRadius: 16,
    background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(255,255,255,.08)",
    textAlign: "center",
  },
  liveTitle: { fontSize: 13, opacity: 0.72, marginBottom: 8 },
  liveValue: { fontSize: 36, fontWeight: 900 },
  liveSub: { marginTop: 8, fontSize: 12, opacity: 0.72 },
  qrPanel: {
    marginBottom: 18,
    padding: 16,
    borderRadius: 18,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.08)",
  },
  linkGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 },
  linkCard: {
    padding: 14,
    borderRadius: 16,
    background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(255,255,255,.08)",
  },
  linkCardTitle: { fontWeight: 900, marginBottom: 10 },
  linkCardUrl: {
    fontSize: 13,
    lineHeight: 1.6,
    wordBreak: "break-all",
    opacity: 0.86,
  },
  badge: {
    borderWidth: 1,
    borderStyle: "solid",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 800,
  },
  primaryBtn: {
    background: "#2563eb",
    color: "white",
    border: "1px solid rgba(255,255,255,.10)",
    borderRadius: 12,
    padding: "12px 16px",
    fontWeight: 800,
    cursor: "pointer",
    textDecoration: "none",
  },
  primaryBtnSmall: {
    background: "#2563eb",
    color: "white",
    border: "1px solid rgba(255,255,255,.10)",
    borderRadius: 12,
    padding: "9px 12px",
    fontWeight: 800,
    cursor: "pointer",
    textDecoration: "none",
  },
  ghostBtn: {
    background: "transparent",
    color: "#e7eefc",
    border: "1px solid rgba(255,255,255,.14)",
    borderRadius: 12,
    padding: "12px 16px",
    fontWeight: 700,
    cursor: "pointer",
    textDecoration: "none",
  },
  ghostBtnSmall: {
    background: "transparent",
    color: "#e7eefc",
    border: "1px solid rgba(255,255,255,.14)",
    borderRadius: 12,
    padding: "9px 12px",
    fontWeight: 700,
    cursor: "pointer",
    textDecoration: "none",
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
  dangerBtn: {
    background: "rgba(220,38,38,.16)",
    color: "#fecaca",
    border: "1px solid rgba(220,38,38,.35)",
    borderRadius: 12,
    padding: "12px 16px",
    fontWeight: 800,
    cursor: "pointer",
  },
};
