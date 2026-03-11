import React, { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabase";

const LS_ACTIVE_ORG_ID = "scoreDisplay.activeOrgId";
const LS_ACTIVE_ORG_SLUG = "scoreDisplay.activeOrgSlug";

type OrgRow = {
  id: string;
  slug: string;
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

type MatchRow = {
  id: string;
  team_id: string | null;
  name: string | null;
  status: string | null;
  scheduled_at: string | null;
  home_name: string | null;
  away_name: string | null;
};

function getEnv(name: string): string {
  const v = (import.meta as any).env?.[name];
  return typeof v === "string" ? v : "";
}

const DISPLAY_URL =
  getEnv("VITE_DISPLAY_APP_URL") ||
  getEnv("VITE_DISPLAY_URL") ||
  "";

function fmtDate(input: string | null) {
  if (!input) return "Date non définie";
  try {
    return new Date(input).toLocaleString();
  } catch {
    return input;
  }
}

function normalizeStatus(status: string | null | undefined) {
  return ((status || "scheduled") + "").toLowerCase();
}

function matchTitle(m: MatchRow) {
  return m.name || `${m.home_name || "Domicile"} vs ${m.away_name || "Extérieur"}`;
}

function statusBadge(status: string | null | undefined) {
  const s = normalizeStatus(status);
  if (s === "scheduled") return { label: "À préparer", color: "#2563eb", bg: "rgba(37,99,235,.12)" };
  if (s === "live") return { label: "En cours", color: "#dc2626", bg: "rgba(220,38,38,.12)" };
  if (s === "paused") return { label: "Pause", color: "#d97706", bg: "rgba(217,119,6,.12)" };
  if (s === "finished") return { label: "Terminé", color: "#16a34a", bg: "rgba(22,163,74,.12)" };
  if (s === "archived") return { label: "Archivé", color: "#94a3b8", bg: "rgba(148,163,184,.12)" };
  return { label: s || "—", color: "#94a3b8", bg: "rgba(148,163,184,.12)" };
}

export default function TeamMatchesPage() {
  const nav = useNavigate();
  const { teamId = "" } = useParams();

  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<OrgRow | null>(null);
  const [team, setTeam] = useState<TeamRow | null>(null);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [selectedQr, setSelectedQr] = useState("");
  const [selectedQrTitle, setSelectedQrTitle] = useState("");

  const activeOrgId = useMemo(() => (localStorage.getItem(LS_ACTIVE_ORG_ID) || "").trim(), []);
  const activeOrgSlug = useMemo(() => (localStorage.getItem(LS_ACTIVE_ORG_SLUG) || "").trim(), []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setErr("");

      const orgQuery = supabase.from("orgs").select("id, slug, name, sport");
      const { data: orgRow, error: orgErr } = activeOrgId
        ? await orgQuery.eq("id", activeOrgId).maybeSingle()
        : await orgQuery.eq("slug", activeOrgSlug).maybeSingle();

      if (cancelled) return;

      if (orgErr || !orgRow) {
        setErr(orgErr?.message || "Organisation introuvable.");
        setLoading(false);
        return;
      }

      setOrg(orgRow as OrgRow);

      const [{ data: teamRow, error: teamErr }, { data: matchRows, error: matchErr }] = await Promise.all([
        supabase.from("teams").select("id, org_id, slug, name, category, code").eq("id", teamId).maybeSingle(),
        supabase
          .from("matches")
          .select("id, team_id, name, status, scheduled_at, home_name, away_name")
          .eq("org_id", (orgRow as OrgRow).id)
          .eq("team_id", teamId)
          .order("scheduled_at", { ascending: true, nullsFirst: true }),
      ]);

      if (cancelled) return;

      if (teamErr || !teamRow) {
        setErr(teamErr?.message || "Équipe introuvable.");
        setLoading(false);
        return;
      }

      if (matchErr) {
        setErr(matchErr.message);
        setLoading(false);
        return;
      }

      setTeam(teamRow as TeamRow);
      setMatches((matchRows as MatchRow[]) || []);
      setLoading(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [activeOrgId, activeOrgSlug, teamId]);

  function flash(message: string) {
    setInfo(message);
    window.setTimeout(() => setInfo(""), 2600);
  }

  function controlLink(m: MatchRow) {
    return `${window.location.origin}/matches/${encodeURIComponent(m.id)}/control`;
  }

  function stableTeamDisplayLink() {
    if (!DISPLAY_URL) return "";
    const base = DISPLAY_URL.replace(/\/$/, "");
    if (team?.slug) return `${base}/?teamSlug=${encodeURIComponent(team.slug)}`;
    if (team?.id) return `${base}/?teamId=${encodeURIComponent(team.id)}`;
    return "";
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      flash("Lien copié.");
    } catch {
      flash("Copie impossible.");
    }
  }

  async function deleteMatch(matchId: string) {
    const ok = window.confirm("Supprimer ce match ? Cette action est réservée aux matchs non joués.");
    if (!ok) return;

    const { error } = await supabase.from("matches").delete().eq("id", matchId);

    if (error) {
      flash(`Erreur suppression : ${error.message}`);
      return;
    }

    setMatches((prev) => prev.filter((m) => m.id !== matchId));
    flash("Match supprimé.");
  }

  async function archiveMatch(matchId: string) {
    const ok = window.confirm("Archiver ce match ?");
    if (!ok) return;

    const { error } = await supabase
      .from("matches")
      .update({ status: "archived" })
      .eq("id", matchId);

    if (error) {
      flash(`Erreur archivage : ${error.message}`);
      return;
    }

    setMatches((prev) =>
      prev.map((m) => (m.id === matchId ? { ...m, status: "archived" } : m)),
    );
    flash("Match archivé.");
  }

  const activeMatches = matches.filter((m) => ["scheduled", "live", "paused"].includes(normalizeStatus(m.status)));
  const archivedMatches = matches.filter((m) => ["finished", "archived"].includes(normalizeStatus(m.status)));
  const stableLink = stableTeamDisplayLink();

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
        <div style={styles.errorBox}>{err}</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.topbar}>
          <div>
            <div style={styles.title}>{team?.name || "Équipe"}</div>
            <div style={styles.subtitle}>
              {org?.name} {team?.category ? `• ${team.category}` : ""} {team?.code ? `• ${team.code}` : ""}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => nav("/teams")} style={styles.ghostBtn}>Retour équipes</button>
            <button onClick={() => nav(`/teams/${teamId}/matches/new`)} style={styles.primaryBtn}>Préparer un match</button>
            <button onClick={() => nav(`/teams/${teamId}/players`)} style={styles.ghostBtn}>Joueurs</button>
            <button onClick={() => nav(`/teams/${teamId}/branding`)} style={styles.ghostBtn}>Branding</button>
            <button onClick={() => nav("/display-settings")} style={styles.ghostBtn}>Paramètres Display</button>
            {stableLink ? (
              <a href={stableLink} target="_blank" rel="noreferrer" style={styles.linkBtn}>
                Écran stable équipe
              </a>
            ) : null}
            {stableLink ? (
              <button
                onClick={() => {
                  setSelectedQr(stableLink);
                  setSelectedQrTitle(`QR écran stable — ${team?.name || "Équipe"}`);
                }}
                style={styles.ghostBtn}
              >
                QR écran stable
              </button>
            ) : null}
          </div>
        </div>

        {info ? <div style={styles.infoBox}>{info}</div> : null}

        {selectedQr ? (
          <div style={styles.qrPanel}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div style={{ fontWeight: 900 }}>{selectedQrTitle}</div>
              <button onClick={() => setSelectedQr("")} style={styles.ghostBtnSmall}>Fermer</button>
            </div>

            <div style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
              <div style={{ background: "white", padding: 10, borderRadius: 12 }}>
                <QRCodeSVG value={selectedQr} size={180} />
              </div>
              <div style={{ maxWidth: 520 }}>
                <div style={{ fontSize: 13, opacity: 0.82, lineHeight: 1.6, wordBreak: "break-all" }}>{selectedQr}</div>
              </div>
            </div>
          </div>
        ) : null}

        <section style={styles.panel}>
          <div style={styles.sectionTitle}>Écran public stable</div>
          <div style={styles.sectionText}>
            Cette URL est pensée pour un panneau LED ou un écran fixe affecté à cette équipe. Elle charge automatiquement le match en cours, ou sinon le prochain match prévu.
          </div>

          <div style={styles.stableLinkBox}>
            <div style={styles.stableLinkLabel}>URL stable équipe</div>
            <div style={styles.stableLinkValue}>
              {stableLink || "Aucun slug d’équipe disponible."}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
              {stableLink ? (
                <>
                  <button onClick={() => copyText(stableLink)} style={styles.primaryBtn}>Copier l’URL stable</button>
                  <button
                    onClick={() => {
                      setSelectedQr(stableLink);
                      setSelectedQrTitle(`QR écran stable — ${team?.name || "Équipe"}`);
                    }}
                    style={styles.ghostBtn}
                  >
                    Afficher le QR stable
                  </button>
                </>
              ) : (
                <div style={{ fontSize: 13, opacity: 0.75 }}>
                  Ajoute un slug public sur cette équipe pour activer l’URL stable.
                </div>
              )}
            </div>
          </div>
        </section>

        <Section title="Matchs à venir / en cours">
          {activeMatches.length === 0 ? (
            <div style={styles.emptyCard}>Aucun match actif ou planifié pour cette équipe.</div>
          ) : (
            <div style={styles.list}>
              {activeMatches.map((m) => {
                const badge = statusBadge(m.status);
                const cLink = controlLink(m);
                const status = normalizeStatus(m.status);

                return (
                  <div key={m.id} style={styles.card}>
                    <div style={styles.cardHeader}>
                      <div>
                        <div style={styles.cardTitle}>{matchTitle(m)}</div>
                        <div style={styles.cardMeta}>{fmtDate(m.scheduled_at)}</div>
                      </div>
                      <span
                        style={{
                          ...styles.badge,
                          color: badge.color,
                          background: badge.bg,
                          borderColor: `${badge.color}33`,
                        }}
                      >
                        {badge.label}
                      </span>
                    </div>

                    <div style={styles.actionRow}>
                      <button onClick={() => nav(`/matches/${m.id}/control`)} style={styles.primaryBtn}>
                        Éditer / régie
                      </button>
                      <button onClick={() => nav(`/matches/${m.id}/roster`)} style={styles.ghostBtnSmall}>
                        Feuille de match
                      </button>
                      <button onClick={() => copyText(cLink)} style={styles.ghostBtnSmall}>
                        Copier lien régie
                      </button>
                      <button
                        onClick={() => {
                          setSelectedQr(cLink);
                          setSelectedQrTitle(`QR régie — ${matchTitle(m)}`);
                        }}
                        style={styles.ghostBtnSmall}
                      >
                        QR régie
                      </button>
                      {stableLink ? (
                        <button onClick={() => copyText(stableLink)} style={styles.ghostBtnSmall}>
                          Copier lien écran stable
                        </button>
                      ) : null}
                      {status === "scheduled" ? (
                        <button onClick={() => deleteMatch(m.id)} style={styles.dangerBtn}>
                          Supprimer
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        <Section title="Historique / fin de vie">
          {archivedMatches.length === 0 ? (
            <div style={styles.emptyCard}>Aucun match terminé ou archivé.</div>
          ) : (
            <div style={styles.list}>
              {archivedMatches.map((m) => {
                const badge = statusBadge(m.status);
                const status = normalizeStatus(m.status);

                return (
                  <div key={m.id} style={styles.card}>
                    <div style={styles.cardHeader}>
                      <div>
                        <div style={styles.cardTitle}>{matchTitle(m)}</div>
                        <div style={styles.cardMeta}>{fmtDate(m.scheduled_at)}</div>
                      </div>
                      <span
                        style={{
                          ...styles.badge,
                          color: badge.color,
                          background: badge.bg,
                          borderColor: `${badge.color}33`,
                        }}
                      >
                        {badge.label}
                      </span>
                    </div>

                    <div style={styles.actionRow}>
                      <button onClick={() => nav(`/matches/${m.id}/control`)} style={styles.ghostBtn}>
                        Ouvrir
                      </button>
                      <button onClick={() => nav(`/matches/${m.id}/roster`)} style={styles.ghostBtn}>
                        Feuille de match
                      </button>
                      {status === "finished" ? (
                        <button onClick={() => archiveMatch(m.id)} style={styles.ghostBtn}>
                          Archiver
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 22 }}>
      <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 12 }}>{title}</div>
      {children}
    </section>
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
  container: { maxWidth: 1180, margin: "0 auto" },
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
  panel: {
    padding: 16,
    borderRadius: 18,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.08)",
  },
  sectionTitle: { fontSize: 18, fontWeight: 900, marginBottom: 10 },
  sectionText: { fontSize: 14, lineHeight: 1.65, opacity: 0.86, marginBottom: 14 },
  stableLinkBox: {
    padding: 16,
    borderRadius: 16,
    background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(255,255,255,.08)",
  },
  stableLinkLabel: { fontSize: 13, opacity: 0.7, marginBottom: 8 },
  stableLinkValue: {
    wordBreak: "break-all",
    fontSize: 14,
    lineHeight: 1.6,
    padding: 12,
    borderRadius: 12,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.08)",
  },
  qrPanel: {
    marginBottom: 18,
    padding: 16,
    borderRadius: 18,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.08)",
  },
  list: { display: "grid", gap: 12 },
  card: {
    padding: 16,
    borderRadius: 16,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.08)",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  cardTitle: { fontSize: 18, fontWeight: 900 },
  cardMeta: { marginTop: 4, fontSize: 13, opacity: 0.72 },
  badge: {
    borderWidth: 1,
    borderStyle: "solid",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 800,
  },
  actionRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 14,
  },
  emptyCard: {
    padding: 16,
    borderRadius: 16,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.08)",
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
    padding: "9px 12px",
    fontWeight: 800,
    cursor: "pointer",
  },
};
