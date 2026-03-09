import React, { useEffect, useMemo, useState } from "react";
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
  short_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
};

export default function TeamBrandingPage() {
  const nav = useNavigate();
  const { teamId = "" } = useParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  const [org, setOrg] = useState<OrgRow | null>(null);
  const [team, setTeam] = useState<TeamRow | null>(null);

  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#2563eb");
  const [secondaryColor, setSecondaryColor] = useState("#0f172a");

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

      const { data: teamRow, error: teamErr } = await supabase
        .from("teams")
        .select("id, org_id, slug, name, category, code, short_name, logo_url, primary_color, secondary_color")
        .eq("id", teamId)
        .maybeSingle();

      if (cancelled) return;

      if (teamErr || !teamRow) {
        setErr(teamErr?.message || "Équipe introuvable.");
        setLoading(false);
        return;
      }

      const currentOrg = orgRow as OrgRow;
      const currentTeam = teamRow as TeamRow;

      setOrg(currentOrg);
      setTeam(currentTeam);

      setName(currentTeam.name || "");
      setShortName(currentTeam.short_name || "");
      setLogoUrl(currentTeam.logo_url || "");
      setPrimaryColor(currentTeam.primary_color || "#2563eb");
      setSecondaryColor(currentTeam.secondary_color || "#0f172a");

      setLoading(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [activeOrgId, activeOrgSlug, teamId]);

  function flash(message: string) {
    setInfo(message);
    window.setTimeout(() => setInfo(""), 2400);
  }

  async function saveBranding() {
    if (!team) return;

    setSaving(true);

    const payload = {
      name: name.trim() || team.name,
      short_name: shortName.trim() || null,
      logo_url: logoUrl.trim() || null,
      primary_color: primaryColor.trim() || null,
      secondary_color: secondaryColor.trim() || null,
    };

    const { error } = await supabase.from("teams").update(payload).eq("id", team.id);

    setSaving(false);

    if (error) {
      flash(`Erreur sauvegarde : ${error.message}`);
      return;
    }

    setTeam((prev) => (prev ? { ...prev, ...payload } : prev));
    flash("Branding équipe sauvegardé.");
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.centerBox}>Chargement branding équipe…</div>
      </div>
    );
  }

  if (err || !org || !team) {
    return (
      <div style={styles.page}>
        <div style={styles.errorBox}>{err || "Contexte introuvable."}</div>
      </div>
    );
  }

  const previewName = shortName.trim() || name.trim() || team.name;
  const previewBg = primaryColor || "#2563eb";
  const previewAccent = secondaryColor || "#0f172a";

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.topbar}>
          <div>
            <div style={styles.title}>Branding équipe</div>
            <div style={styles.subtitle}>
              {org.name} • {team.name} {team.category ? `• ${team.category}` : ""} {team.code ? `• ${team.code}` : ""}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => nav(`/teams/${team.id}/matches`)} style={styles.ghostBtn}>
              Retour matchs
            </button>
            <button onClick={() => nav(`/teams/${team.id}/players`)} style={styles.ghostBtn}>
              Joueurs
            </button>
            <button onClick={saveBranding} style={styles.primaryBtn} disabled={saving}>
              {saving ? "Sauvegarde..." : "Sauvegarder"}
            </button>
          </div>
        </div>

        {info ? <div style={styles.infoBox}>{info}</div> : null}

        <div style={styles.grid}>
          <section style={styles.panel}>
            <div style={styles.sectionTitle}>Paramètres branding</div>

            <div style={styles.formGrid}>
              <Field label="Nom équipe">
                <input value={name} onChange={(e) => setName(e.target.value)} style={styles.input} />
              </Field>

              <Field label="Nom court">
                <input value={shortName} onChange={(e) => setShortName(e.target.value)} style={styles.input} />
              </Field>

              <Field label="Logo URL">
                <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} style={styles.input} />
              </Field>

              <Field label="Couleur principale">
                <div style={styles.colorRow}>
                  <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} style={styles.colorInput} />
                  <input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} style={styles.input} />
                </div>
              </Field>

              <Field label="Couleur secondaire">
                <div style={styles.colorRow}>
                  <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} style={styles.colorInput} />
                  <input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} style={styles.input} />
                </div>
              </Field>
            </div>
          </section>

          <section style={styles.panel}>
            <div style={styles.sectionTitle}>Aperçu</div>

            <div
              style={{
                ...styles.previewCard,
                background: `linear-gradient(135deg, ${previewBg}, ${previewAccent})`,
              }}
            >
              <div style={styles.previewTop}>SCORE DISPLAY</div>

              <div style={styles.previewCenter}>
                {logoUrl ? (
                  <img src={logoUrl} alt="" style={styles.previewLogo} />
                ) : (
                  <div style={styles.previewLogoPlaceholder}>LOGO</div>
                )}

                <div>
                  <div style={styles.previewName}>{previewName || "ÉQUIPE"}</div>
                  <div style={styles.previewSub}>{name || team.name}</div>
                </div>
              </div>

              <div style={styles.previewBottom}>
                <span style={styles.previewBadge}>DOM</span>
                <span style={styles.previewScore}>72</span>
                <span style={styles.previewVs}>:</span>
                <span style={styles.previewScore}>68</span>
                <span style={styles.previewBadge}>EXT</span>
              </div>
            </div>

            <div style={styles.helpText}>
              Cet aperçu est indicatif. Le Display utilisera ensuite ces informations pour afficher le nom court, le logo et les couleurs.
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
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 18,
  },
  panel: {
    padding: 16,
    borderRadius: 18,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.08)",
  },
  sectionTitle: { fontSize: 18, fontWeight: 900, marginBottom: 14 },
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
  colorRow: {
    display: "grid",
    gridTemplateColumns: "60px 1fr",
    gap: 10,
    alignItems: "center",
  },
  colorInput: {
    width: 60,
    height: 44,
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 10,
    background: "transparent",
    padding: 4,
  },
  previewCard: {
    borderRadius: 20,
    padding: 20,
    minHeight: 280,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    boxShadow: "0 20px 60px rgba(0,0,0,.25)",
  },
  previewTop: {
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 1.4,
    opacity: 0.9,
  },
  previewCenter: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  previewLogo: {
    width: 84,
    height: 84,
    objectFit: "contain",
    background: "rgba(255,255,255,.92)",
    borderRadius: 16,
    padding: 10,
  },
  previewLogoPlaceholder: {
    width: 84,
    height: 84,
    borderRadius: 16,
    background: "rgba(255,255,255,.18)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
  },
  previewName: {
    fontSize: 28,
    fontWeight: 900,
    lineHeight: 1.05,
  },
  previewSub: {
    marginTop: 6,
    opacity: 0.85,
    fontSize: 14,
  },
  previewBottom: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    fontWeight: 900,
  },
  previewBadge: {
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,.18)",
    fontSize: 12,
  },
  previewScore: {
    fontSize: 40,
    lineHeight: 1,
  },
  previewVs: {
    fontSize: 26,
    opacity: 0.9,
  },
  helpText: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 1.65,
    opacity: 0.82,
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
  ghostBtn: {
    background: "transparent",
    color: "#e7eefc",
    border: "1px solid rgba(255,255,255,.14)",
    borderRadius: 12,
    padding: "12px 16px",
    fontWeight: 700,
    cursor: "pointer",
  },
};
