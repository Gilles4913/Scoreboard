import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

const LS_ACTIVE_ORG_ID = "scoreDisplay.activeOrgId";
const LS_ACTIVE_ORG_SLUG = "scoreDisplay.activeOrgSlug";

type OrgRow = {
  id: string;
  slug: string;
  name: string;
  sport: string | null;
};

type SettingsRow = {
  org_id: string;
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

function normalizeSport(v: string | null | undefined) {
  return ((v || "football") + "").toLowerCase().trim();
}

function presetForSport(sport: string): Partial<SettingsRow> {
  const s = normalizeSport(sport);

  if (s === "basket") {
    return {
      layout_mode: "arena",
      show_score: true,
      show_clock: true,
      show_period: true,
      show_status: true,
      show_lower_third: true,
      show_logos: true,
      show_sponsors: true,
    };
  }

  if (s === "volleyball") {
    return {
      layout_mode: "volley",
      show_score: true,
      show_clock: false,
      show_period: true,
      show_status: true,
      show_lower_third: true,
      show_logos: true,
      show_sponsors: true,
    };
  }

  return {
    layout_mode: "stadium",
    show_score: true,
    show_clock: true,
    show_period: true,
    show_status: true,
    show_lower_third: true,
    show_logos: true,
    show_sponsors: true,
  };
}

export default function DisplaySettingsPage() {
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [org, setOrg] = useState<OrgRow | null>(null);
  const [form, setForm] = useState<SettingsRow | null>(null);

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

      const currentOrg = orgRow as OrgRow;
      setOrg(currentOrg);

      const { data: settingsRow, error: settingsErr } = await supabase
        .from("org_display_settings")
        .select("org_id, theme, layout_mode, show_score, show_clock, show_period, show_status, show_lower_third, show_logos, show_sponsors, dual_language, lang_primary, lang_secondary, sponsor_rotate_s")
        .eq("org_id", currentOrg.id)
        .maybeSingle();

      if (cancelled) return;

      if (settingsErr) {
        setErr(settingsErr.message);
        setLoading(false);
        return;
      }

      if (settingsRow) {
        setForm(settingsRow as SettingsRow);
      } else {
        setForm({
          org_id: currentOrg.id,
          theme: "dark",
          layout_mode: "stadium",
          show_score: true,
          show_clock: true,
          show_period: true,
          show_status: true,
          show_lower_third: true,
          show_logos: true,
          show_sponsors: true,
          dual_language: true,
          lang_primary: "FR",
          lang_secondary: "EN",
          sponsor_rotate_s: 10,
        });
      }

      setLoading(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [activeOrgId, activeOrgSlug]);

  function flash(message: string) {
    setInfo(message);
    window.setTimeout(() => setInfo(""), 2200);
  }

  async function save() {
    if (!form) return;

    setSaving(true);
    const { error } = await supabase.from("org_display_settings").upsert(form, { onConflict: "org_id" });
    setSaving(false);

    if (error) {
      flash(error.message);
      return;
    }

    flash("Paramètres Display sauvegardés.");
  }

  function patch(next: Partial<SettingsRow>) {
    setForm((prev) => (prev ? { ...prev, ...next } : prev));
  }

  function applySportPreset() {
    if (!org || !form) return;
    patch(presetForSport(org.sport || "football"));
    flash(`Preset ${normalizeSport(org.sport)} appliqué.`);
  }

  if (loading || !form) {
    return <div style={styles.page}><div style={styles.centerBox}>Chargement des paramètres…</div></div>;
  }

  if (err) {
    return <div style={styles.page}><div style={styles.errorBox}>{err}</div></div>;
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.topbar}>
          <div>
            <div style={styles.title}>Paramètres Display</div>
            <div style={styles.subtitle}>{org?.name} • sport : <b>{org?.sport || "football"}</b></div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => nav("/teams")} style={styles.ghostBtn}>Retour équipes</button>
            <button onClick={applySportPreset} style={styles.ghostBtn}>Appliquer preset sport</button>
            <button onClick={save} style={styles.primaryBtn}>{saving ? "Sauvegarde..." : "Sauvegarder"}</button>
          </div>
        </div>

        {info ? <div style={styles.infoBox}>{info}</div> : null}

        <div style={styles.grid}>
          <section style={styles.panel}>
            <div style={styles.sectionTitle}>Mise en page</div>

            <div style={styles.formGrid}>
              <Field label="Thème">
                <select value={form.theme} onChange={(e) => patch({ theme: e.target.value })} style={styles.input}>
                  <option value="dark">dark</option>
                  <option value="light">light</option>
                </select>
              </Field>

              <Field label="Mode d’affichage">
                <select value={form.layout_mode} onChange={(e) => patch({ layout_mode: e.target.value })} style={styles.input}>
                  <option value="stadium">stadium</option>
                  <option value="arena">arena</option>
                  <option value="compact">compact</option>
                  <option value="volley">volley</option>
                </select>
              </Field>

              <Field label="Langue primaire">
                <input value={form.lang_primary} onChange={(e) => patch({ lang_primary: e.target.value })} style={styles.input} />
              </Field>

              <Field label="Langue secondaire">
                <input value={form.lang_secondary} onChange={(e) => patch({ lang_secondary: e.target.value })} style={styles.input} />
              </Field>

              <Field label="Rotation sponsors (s)">
                <input
                  type="number"
                  min={1}
                  value={form.sponsor_rotate_s}
                  onChange={(e) => patch({ sponsor_rotate_s: Math.max(1, Number(e.target.value || 1)) })}
                  style={styles.input}
                />
              </Field>
            </div>
          </section>

          <section style={styles.panel}>
            <div style={styles.sectionTitle}>Afficher / masquer</div>

            <div style={styles.flagsGrid}>
              <Toggle label="Afficher score" value={form.show_score} onChange={(v) => patch({ show_score: v })} />
              <Toggle label="Afficher horloge" value={form.show_clock} onChange={(v) => patch({ show_clock: v })} />
              <Toggle label="Afficher période" value={form.show_period} onChange={(v) => patch({ show_period: v })} />
              <Toggle label="Afficher statut" value={form.show_status} onChange={(v) => patch({ show_status: v })} />
              <Toggle label="Afficher lower third" value={form.show_lower_third} onChange={(v) => patch({ show_lower_third: v })} />
              <Toggle label="Afficher logos" value={form.show_logos} onChange={(v) => patch({ show_logos: v })} />
              <Toggle label="Afficher sponsors" value={form.show_sponsors} onChange={(v) => patch({ show_sponsors: v })} />
              <Toggle label="Mode bilingue" value={form.dual_language} onChange={(v) => patch({ dual_language: v })} />
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

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={styles.toggleCard}>
      <div style={{ fontWeight: 700 }}>{label}</div>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

const styles: Record<string, any> = {
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
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 18 },
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
  flagsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  toggleCard: {
    padding: 14,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,.08)",
    background: "rgba(255,255,255,.04)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
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
