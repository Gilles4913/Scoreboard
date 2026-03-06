import React, { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "../supabase";
import { sendTvBroadcast } from "../realtime";

const LS_ACTIVE_ORG_ID = "scoreDisplay.activeOrgId";
const LS_ACTIVE_ORG_SLUG = "scoreDisplay.activeOrgSlug";

type MatchStatus = "scheduled" | "live" | "finished" | "archived" | string;

type MatchRow = {
  id: string;
  name: string | null;
  status: MatchStatus | null;
  scheduled_at: string | null;
  public_display: boolean | null;
  display_token: string | null;
  home_name: string | null;
  away_name: string | null;
};

type OrgRow = {
  id: string;
  slug: string;
  name: string;
  status?: string | null;
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

function matchTitle(m: MatchRow) {
  return m.name || `${m.home_name || "Équipe A"} vs ${m.away_name || "Équipe B"}`;
}

function statusBadge(status: MatchStatus) {
  const s = normalizeStatus(status);

  if (s === "scheduled") return { label: "À préparer", color: "#2563eb", bg: "rgba(37,99,235,.12)" };
  if (s === "live") return { label: "En cours", color: "#dc2626", bg: "rgba(220,38,38,.12)" };
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

function periodHintsBySport(sport: string) {
  const v = (sport || "").toLowerCase();
  if (v === "basket") return "Q1 • Q2 • Q3 • Q4";
  if (v === "handball") return "1MT • 2MT";
  if (v === "rugby") return "1MT • 2MT";
  if (v === "volleyball") return "Set 1 • Set 2 • Set 3 • Set 4 • Set 5";
  return "1MT • 2MT";
}

export default function MatchPage() {
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<OrgRow | null>(null);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [err, setErr] = useState("");
  const [copyMsg, setCopyMsg] = useState("");
  const [selectedQr, setSelectedQr] = useState<string>("");

  const activeOrgId = useMemo(() => (localStorage.getItem(LS_ACTIVE_ORG_ID) || "").trim(), []);
  const activeOrgSlug = useMemo(() => (localStorage.getItem(LS_ACTIVE_ORG_SLUG) || "").trim(), []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setErr("");
      setCopyMsg("");
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

      const orgQuery = supabase.from("orgs").select("id, slug, name, status");
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
        .select("id, name, status, scheduled_at, public_display, display_token, home_name, away_name")
        .eq("org_id", (orgRow as OrgRow).id)
        .order("scheduled_at", { ascending: true, nullsFirst: true });

      if (cancelled) return;

      if (mErr) {
        setErr(mErr.message);
        setMatches([]);
      } else {
        setMatches(((ms as MatchRow[]) || []).sort((a, b) => {
          const da = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
          const db = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
          return da - db;
        }));
      }

      setLoading(false);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [activeOrgId, activeOrgSlug]);

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
      setCopyMsg(`Lien copié pour "${matchTitle(m)}"`);
      setTimeout(() => setCopyMsg(""), 2500);
    } catch {
      setCopyMsg("Impossible de copier le lien.");
      setTimeout(() => setCopyMsg(""), 2500);
    }
  }

  async function pushDemoBroadcast(m: MatchRow) {
    try {
      await sendTvBroadcast(m.id, {
        match_id: m.id,
        match_name: matchTitle(m),
        status: normalizeStatus(m.status),
        home_name: m.home_name,
        away_name: m.away_name,
        venue: org?.name || "",
        sponsors: org
          ? [
              { name: org.name, logo_url: null },
              { name: "scoreDisplay", logo_url: null },
            ]
          : undefined,
      });

      setCopyMsg(`Broadcast démo envoyé pour "${matchTitle(m)}"`);
      setTimeout(() => setCopyMsg(""), 2500);
    } catch (e: any) {
      setCopyMsg(e?.message || "Erreur broadcast");
      setTimeout(() => setCopyMsg(""), 2500);
    }
  }

  const upcomingMatches = useMemo(() => {
    return matches.filter((m) => {
      const s = normalizeStatus(m.status);
      return s === "scheduled" || s === "live";
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
              slug: <b>{org.slug}</b>
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
              Prépare les matchs, ouvre le Display public, teste le broadcast TV temps réel, et pilote une démonstration complète club / ville.
            </div>
            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.78 }}>
              Règles sport fines : {periodHintsBySport(org.slug.includes("basket") ? "basket" : "football")}
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

        {copyMsg ? <div style={styles.copyInfo}>{copyMsg}</div> : null}

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
                  Scanne ce QR code pour ouvrir directement le Display public du match sur un téléphone, une borne ou un écran TV.
                </div>
                <div style={{ marginTop: 10, wordBreak: "break-all", fontSize: 12, opacity: 0.72 }}>{selectedQr}</div>
              </div>
            </div>
          </div>
        ) : null}

        <section style={{ marginTop: 22 }}>
          <div style={styles.sectionTitle}>Matchs à préparer</div>

          {upcomingMatches.length === 0 ? (
            <div style={styles.emptyCard}>Aucun match à préparer.</div>
          ) : (
            <div style={styles.listCompact}>
              {upcomingMatches.map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  link={displayLink(m)}
                  onCopy={() => copyDisplayLink(m)}
                  onShowQr={() => setSelectedQr(displayLink(m))}
                  onBroadcast={() => pushDemoBroadcast(m)}
                />
              ))}
            </div>
          )}
        </section>

        <section style={{ marginTop: 28 }}>
          <div style={styles.sectionTitle}>Archives / Matchs joués</div>

          {archivedMatches.length === 0 ? (
            <div style={styles.emptyCard}>Aucun match archivé.</div>
          ) : (
            <div style={styles.listCompact}>
              {archivedMatches.map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  link={displayLink(m)}
                  onCopy={() => copyDisplayLink(m)}
                  onShowQr={() => setSelectedQr(displayLink(m))}
                  onBroadcast={() => pushDemoBroadcast(m)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function MatchCard({
  match,
  link,
  onCopy,
  onShowQr,
  onBroadcast,
}: {
  match: MatchRow;
  link: string;
  onCopy: () => void;
  onShowQr: () => void;
  onBroadcast: () => void;
}) {
  const sb = statusBadge(match.status || "scheduled");

  return (
    <div style={styles.compactCard}>
      <div style={{ minWidth: 0 }}>
        <div style={styles.matchTitle}>{matchTitle(match)}</div>
        <div style={styles.matchMeta}>
          {fmtDate(match.scheduled_at)} • Display: <b>{match.public_display ? "public" : "privé"}</b> • Token:{" "}
          <b>{match.display_token ? "OK" : "—"}</b>
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

        {link ? (
          <>
            <a href={link} target="_blank" rel="noreferrer" style={styles.linkBtn}>
              Display
            </a>
            <button onClick={onCopy} style={styles.ghostBtnSmall}>
              Copier
            </button>
            <button onClick={onShowQr} style={styles.ghostBtnSmall}>
              QR
            </button>
          </>
        ) : null}

        <button onClick={onBroadcast} style={styles.primaryBtnSmall}>
          Broadcast
        </button>
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
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
  },
  container: {
    maxWidth: 1120,
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
    background: "linear-gradient(180deg, rgba(59,130,246,.12), rgba(255,255,255,.02))",
    border: "1px solid rgba(255,255,255,.08)",
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: 900,
  },
  heroText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 1.55,
    opacity: 0.84,
  },
  kpis: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 10,
  },
  kpiCard: {
    padding: 14,
    borderRadius: 14,
    background: "rgba(255,255,255,.05)",
    border: "1px solid rgba(255,255,255,.08)",
  },
  kpiLabel: {
    fontSize: 12,
    opacity: 0.75,
  },
  kpiValue: {
    marginTop: 6,
    fontSize: 28,
    fontWeight: 900,
    letterSpacing: -0.6,
  },
  copyInfo: {
    marginTop: 14,
    padding: 10,
    borderRadius: 12,
    background: "rgba(37,99,235,.14)",
    border: "1px solid rgba(37,99,235,.28)",
    color: "#cfe2ff",
    fontSize: 13,
  },
  qrPanel: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    background: "rgba(255,255,255,.05)",
    border: "1px solid rgba(255,255,255,.08)",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 900,
    marginBottom: 12,
  },
  emptyCard: {
    padding: 14,
    borderRadius: 14,
    background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(255,255,255,.08)",
    opacity: 0.84,
  },
  listCompact: {
    display: "grid",
    gap: 10,
  },
  compactCard: {
    padding: 12,
    borderRadius: 14,
    background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(255,255,255,.08)",
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 12,
    alignItems: "center",
  },
  matchTitle: {
    fontSize: 15,
    fontWeight: 800,
  },
  matchMeta: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.72,
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    border: "1px solid rgba(255,255,255,.12)",
  },
  primaryBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(59,130,246,.35)",
    background: "rgba(59,130,246,.18)",
    color: "#e7eefc",
    cursor: "pointer",
    fontWeight: 800,
  },
  primaryBtnSmall: {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid rgba(59,130,246,.35)",
    background: "rgba(59,130,246,.18)",
    color: "#e7eefc",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 13,
  },
  ghostBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.12)",
    background: "transparent",
    color: "#e7eefc",
    cursor: "pointer",
    fontWeight: 700,
  },
  ghostBtnSmall: {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,.12)",
    background: "transparent",
    color: "#e7eefc",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
  },
  linkBtn: {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid rgba(59,130,246,.35)",
    background: "rgba(59,130,246,.18)",
    color: "#e7eefc",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 13,
  },
};

