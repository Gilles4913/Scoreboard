import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { sendTvBroadcast } from "../realtime";

const LS_ACTIVE_ORG_ID = "scoreDisplay.activeOrgId";
const LS_ACTIVE_ORG_SLUG = "scoreDisplay.activeOrgSlug";

type OrgRow = {
  id: string;
  slug: string;
  name: string;
  sport: string | null;
};

type DisplaySettingsRow = {
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

type SportSettingsRow = {
  org_id: string;
  sport: string;
  period_count: number;
  period_duration_s: number;
  extra_time_enabled: boolean;
  penalties_enabled: boolean;
  show_team_fouls: boolean;
  show_player_fouls: boolean;
  show_timeouts: boolean;
  show_bonus: boolean;
  show_sets: boolean;
  show_cards: boolean;
  show_shot_clock: boolean;
  max_team_fouls: number | null;
  max_player_fouls: number | null;
  max_timeouts: number | null;
  shot_clock_s: number | null;
};

type ThemeCardDef = {
  id: string;
  title: string;
  subtitle: string;
  recommendedFor: string[];
  theme: string;
  layout_mode: string;
};

function normalizeSport(v: string | null | undefined) {
  return ((v || "football") + "").toLowerCase().trim();
}

function presetDisplayForSport(sport: string): Partial<DisplaySettingsRow> {
  const s = normalizeSport(sport);

  if (s === "basket") {
    return {
      theme: "dark",
      layout_mode: "arena",
      show_score: true,
      show_clock: true,
      show_period: true,
      show_status: true,
      show_lower_third: true,
      show_logos: true,
      show_sponsors: true,
      dual_language: false,
      lang_primary: "FR",
      lang_secondary: "EN",
      sponsor_rotate_s: 10,
    };
  }

  if (s === "volleyball") {
    return {
      theme: "dark",
      layout_mode: "volley",
      show_score: true,
      show_clock: false,
      show_period: true,
      show_status: true,
      show_lower_third: true,
      show_logos: true,
      show_sponsors: true,
      dual_language: false,
      lang_primary: "FR",
      lang_secondary: "EN",
      sponsor_rotate_s: 10,
    };
  }

  if (s === "handball") {
    return {
      theme: "dark",
      layout_mode: "arena",
      show_score: true,
      show_clock: true,
      show_period: true,
      show_status: true,
      show_lower_third: true,
      show_logos: true,
      show_sponsors: true,
      dual_language: false,
      lang_primary: "FR",
      lang_secondary: "EN",
      sponsor_rotate_s: 10,
    };
  }

  if (s === "rugby") {
    return {
      theme: "dark",
      layout_mode: "rugby_stade",
      show_score: true,
      show_clock: true,
      show_period: true,
      show_status: true,
      show_lower_third: true,
      show_logos: true,
      show_sponsors: true,
      dual_language: false,
      lang_primary: "FR",
      lang_secondary: "EN",
      sponsor_rotate_s: 10,
    };
  }

  return {
    theme: "dark",
    layout_mode: "stadium",
    show_score: true,
    show_clock: true,
    show_period: true,
    show_status: true,
    show_lower_third: true,
    show_logos: true,
    show_sponsors: true,
    dual_language: false,
    lang_primary: "FR",
    lang_secondary: "EN",
    sponsor_rotate_s: 10,
  };
}

function presetSportSettingsForSport(sport: string): Partial<SportSettingsRow> {
  const s = normalizeSport(sport);

  if (s === "basket") {
    return {
      sport: "basket",
      period_count: 4,
      period_duration_s: 600,
      extra_time_enabled: true,
      penalties_enabled: false,
      show_team_fouls: true,
      show_player_fouls: true,
      show_timeouts: true,
      show_bonus: true,
      show_sets: false,
      show_cards: false,
      show_shot_clock: true,
      max_team_fouls: 5,
      max_player_fouls: 5,
      max_timeouts: 5,
      shot_clock_s: 24,
    };
  }

  if (s === "volleyball") {
    return {
      sport: "volleyball",
      period_count: 5,
      period_duration_s: 0,
      extra_time_enabled: false,
      penalties_enabled: false,
      show_team_fouls: false,
      show_player_fouls: false,
      show_timeouts: true,
      show_bonus: false,
      show_sets: true,
      show_cards: false,
      show_shot_clock: false,
      max_team_fouls: null,
      max_player_fouls: null,
      max_timeouts: 2,
      shot_clock_s: null,
    };
  }

  if (s === "handball") {
    return {
      sport: "handball",
      period_count: 2,
      period_duration_s: 1800,
      extra_time_enabled: true,
      penalties_enabled: false,
      show_team_fouls: false,
      show_player_fouls: false,
      show_timeouts: true,
      show_bonus: false,
      show_sets: false,
      show_cards: false,
      show_shot_clock: false,
      max_team_fouls: null,
      max_player_fouls: null,
      max_timeouts: 3,
      shot_clock_s: null,
    };
  }

  if (s === "rugby") {
    return {
      sport: "rugby",
      period_count: 2,
      period_duration_s: 2400,
      extra_time_enabled: true,
      penalties_enabled: false,
      show_team_fouls: false,
      show_player_fouls: false,
      show_timeouts: false,
      show_bonus: false,
      show_sets: false,
      show_cards: true,
      show_shot_clock: false,
      max_team_fouls: null,
      max_player_fouls: null,
      max_timeouts: null,
      shot_clock_s: null,
    };
  }

  return {
    sport: "football",
    period_count: 2,
    period_duration_s: 2700,
    extra_time_enabled: true,
    penalties_enabled: true,
    show_team_fouls: false,
    show_player_fouls: false,
    show_timeouts: false,
    show_bonus: false,
    show_sets: false,
    show_cards: true,
    show_shot_clock: false,
    max_team_fouls: null,
    max_player_fouls: null,
    max_timeouts: null,
    shot_clock_s: null,
  };
}

const THEME_CARDS: ThemeCardDef[] = [
  {
    id: 'rugby_stade',
    title: 'Rugby LED Stade',
    subtitle: 'Score maximaliste, cartons et chrono. Optimise pour panneaux LED et TV de stade.',
    recommendedFor: ['rugby'],
    theme: 'dark',
    layout_mode: 'rugby_stade',
  },
  {
    id: 'rugby_expert',
    title: 'Rugby Expert',
    subtitle: 'Score + détail complet : essais, transformations, pénalités, drops, exclusions temporaires.',
    recommendedFor: ['rugby'],
    theme: 'dark',
    layout_mode: 'rugby_expert',
  },
  {
    id: 'stadium',
    title: 'Stade classique',
    subtitle: 'Tres lisible, ideal gymnase, LED ou panneau sportif.',
    recommendedFor: ['football', 'rugby', 'handball'],
    theme: 'dark',
    layout_mode: 'stadium',
  },
  {
    id: 'arena',
    title: 'Arena premium',
    subtitle: 'Score et chrono tres mis en avant.',
    recommendedFor: ['basket', 'handball'],
    theme: 'dark',
    layout_mode: 'arena',
  },
  {
    id: 'compact',
    title: 'Compact',
    subtitle: 'Peu elements, tres efficace sur petits ecrans.',
    recommendedFor: ['football', 'basket', 'rugby', 'handball', 'volleyball'],
    theme: 'dark',
    layout_mode: 'compact',
  },
  {
    id: 'volley',
    title: 'Volley sets',
    subtitle: 'Accent sur les sets et le score.',
    recommendedFor: ['volleyball'],
    theme: 'dark',
    layout_mode: 'volley',
  },
  {
    id: 'tv-light',
    title: 'TV clair',
    subtitle: 'Style editorial pour ecran interieur ou diffusion.',
    recommendedFor: ['football', 'basket', 'volleyball'],
    theme: 'light',
    layout_mode: 'arena',
  },
];

export default function DisplaySettingsPage() {
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [org, setOrg] = useState<OrgRow | null>(null);
  const [displayForm, setDisplayForm] = useState<DisplaySettingsRow | null>(null);
  const [sportForm, setSportForm] = useState<SportSettingsRow | null>(null);

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

      const [{ data: displaySettingsRow, error: displayErr }, { data: sportSettingsRow, error: sportErr }] =
        await Promise.all([
          supabase
            .from("org_display_settings")
            .select("org_id, theme, layout_mode, show_score, show_clock, show_period, show_status, show_lower_third, show_logos, show_sponsors, dual_language, lang_primary, lang_secondary, sponsor_rotate_s")
            .eq("org_id", currentOrg.id)
            .maybeSingle(),
          supabase
            .from("org_sport_settings")
            .select("org_id, sport, period_count, period_duration_s, extra_time_enabled, penalties_enabled, show_team_fouls, show_player_fouls, show_timeouts, show_bonus, show_sets, show_cards, show_shot_clock, max_team_fouls, max_player_fouls, max_timeouts, shot_clock_s")
            .eq("org_id", currentOrg.id)
            .maybeSingle(),
        ]);

      if (cancelled) return;

      if (displayErr) {
        setErr(displayErr.message);
        setLoading(false);
        return;
      }

      if (sportErr) {
        setErr(sportErr.message);
        setLoading(false);
        return;
      }

      const sport = normalizeSport(currentOrg.sport);

      setDisplayForm(
        (displaySettingsRow as DisplaySettingsRow) || {
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
          dual_language: false,
          lang_primary: "FR",
          lang_secondary: "EN",
          sponsor_rotate_s: 10,
        },
      );

      setSportForm(
        (sportSettingsRow as SportSettingsRow) || {
          org_id: currentOrg.id,
          sport,
          period_count: 2,
          period_duration_s: 2700,
          extra_time_enabled: true,
          penalties_enabled: true,
          show_team_fouls: false,
          show_player_fouls: false,
          show_timeouts: false,
          show_bonus: false,
          show_sets: false,
          show_cards: true,
          show_shot_clock: false,
          max_team_fouls: null,
          max_player_fouls: null,
          max_timeouts: null,
          shot_clock_s: null,
        },
      );

      setLoading(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [activeOrgId, activeOrgSlug]);

  function flash(message: string) {
    setInfo(message);
    window.setTimeout(() => setInfo(""), 2400);
  }

  function patchDisplay(next: Partial<DisplaySettingsRow>) {
    setDisplayForm((prev) => (prev ? { ...prev, ...next } : prev));
  }

  function patchSport(next: Partial<SportSettingsRow>) {
    setSportForm((prev) => (prev ? { ...prev, ...next } : prev));
  }

  function applySportPreset() {
    if (!org) return;
    patchDisplay(presetDisplayForSport(org.sport || "football"));
    patchSport(presetSportSettingsForSport(org.sport || "football"));
    flash(`Preset ${normalizeSport(org.sport)} appliqué.`);
  }

  function selectThemeCard(card: ThemeCardDef) {
    patchDisplay({
      theme: card.theme,
      layout_mode: card.layout_mode,
    });
    flash(`Modèle "${card.title}" sélectionné.`);
  }

  async function save() {
    if (!displayForm || !sportForm) return;

    setSaving(true);

    const [displayRes, sportRes] = await Promise.all([
      supabase.from("org_display_settings").upsert(displayForm, { onConflict: "org_id" }),
      supabase.from("org_sport_settings").upsert(sportForm, { onConflict: "org_id" }),
    ]);

    setSaving(false);

    if (displayRes.error) {
      flash(displayRes.error.message);
      return;
    }

    if (sportRes.error) {
      flash(sportRes.error.message);
      return;
    }

    flash("Paramètres sauvegardés.");

    // Broadcast new settings to the display immediately (fire-and-forget)
    if (org?.id) {
      const { data: matchRow } = await supabase
        .from("matches")
        .select("id")
        .eq("org_id", org.id)
        .in("status", ["live", "scheduled", "paused"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (matchRow?.id) {
        void sendTvBroadcast(matchRow.id, {
          show_score:       displayForm.show_score,
          show_clock:       displayForm.show_clock,
          show_period:      displayForm.show_period,
          show_status:      displayForm.show_status,
          show_lower_third: displayForm.show_lower_third,
          show_logos:       displayForm.show_logos,
          show_sponsors:    displayForm.show_sponsors,
          layout_mode:      displayForm.layout_mode,
          show_team_fouls:  sportForm.show_team_fouls,
          show_player_fouls: sportForm.show_player_fouls,
          show_timeouts:    sportForm.show_timeouts,
          show_bonus:       sportForm.show_bonus,
          show_sets:        sportForm.show_sets,
          show_cards:       sportForm.show_cards,
          show_shot_clock:  sportForm.show_shot_clock,
        });
      }
    }
  }

  if (loading || !displayForm || !sportForm) {
    return (
      <div style={styles.page}>
        <div style={styles.centerBox}>Chargement des paramètres…</div>
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

  const currentSport = normalizeSport(org?.sport);
  const activeThemeId = `${displayForm.theme}:${displayForm.layout_mode}`;

  const recommendedThemes = THEME_CARDS.filter((card) => card.recommendedFor.includes(currentSport));
  const otherThemes = THEME_CARDS.filter((card) => !card.recommendedFor.includes(currentSport));

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.topbar}>
          <div>
            <div style={styles.title}>Paramètres Display</div>
            <div style={styles.subtitle}>
              {org?.name} • sport : <b>{org?.sport || "football"}</b>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => nav("/teams")} style={styles.ghostBtn}>
              Retour équipes
            </button>
            <button onClick={applySportPreset} style={styles.ghostBtn}>
              Appliquer preset sport
            </button>
            <button onClick={save} style={styles.primaryBtn}>
              {saving ? "Sauvegarde..." : "Sauvegarder"}
            </button>
          </div>
        </div>

        {info ? <div style={styles.infoBox}>{info}</div> : null}

        <section style={styles.panel}>
          <div style={styles.sectionTitle}>Modèles d’affichage recommandés</div>
          <div style={styles.sectionText}>
            Ces modèles sont les plus adaptés au sport de cette organisation.
          </div>

          <div style={styles.themeGrid}>
            {recommendedThemes.map((card) => {
              const isActive = activeThemeId === `${card.theme}:${card.layout_mode}`;

              return (
                <button
                  key={card.id}
                  onClick={() => selectThemeCard(card)}
                  style={{
                    ...styles.themeCard,
                    border: isActive
                      ? "1px solid rgba(59,130,246,.55)"
                      : "1px solid rgba(255,255,255,.10)",
                    boxShadow: isActive ? "0 0 0 1px rgba(59,130,246,.22) inset" : "none",
                  }}
                >
                  <ThemePreview
                    theme={card.theme}
                    layout={card.layout_mode}
                    showClock={displayForm.show_clock}
                    showPeriod={displayForm.show_period}
                  />

                  <div style={styles.themeHeader}>
                    <div>
                      <div style={styles.themeTitle}>{card.title}</div>
                      <div style={styles.themeSubtitle}>{card.subtitle}</div>
                    </div>
                    <span style={styles.recommendedBadge}>Recommandé</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {otherThemes.length > 0 ? (
          <section style={{ ...styles.panel, marginTop: 18 }}>
            <div style={styles.sectionTitle}>Autres modèles</div>
            <div style={styles.themeGrid}>
              {otherThemes.map((card) => {
                const isActive = activeThemeId === `${card.theme}:${card.layout_mode}`;

                return (
                  <button
                    key={card.id}
                    onClick={() => selectThemeCard(card)}
                    style={{
                      ...styles.themeCard,
                      border: isActive
                        ? "1px solid rgba(59,130,246,.55)"
                        : "1px solid rgba(255,255,255,.10)",
                      boxShadow: isActive ? "0 0 0 1px rgba(59,130,246,.22) inset" : "none",
                    }}
                  >
                    <ThemePreview
                      theme={card.theme}
                      layout={card.layout_mode}
                      showClock={displayForm.show_clock}
                      showPeriod={displayForm.show_period}
                    />

                    <div style={styles.themeHeader}>
                      <div>
                        <div style={styles.themeTitle}>{card.title}</div>
                        <div style={styles.themeSubtitle}>{card.subtitle}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        <div style={styles.grid}>
          <section style={styles.panel}>
            <div style={styles.sectionTitle}>Apparence de l’écran</div>
            <div style={styles.sectionText}>
              Ces options contrôlent l’habillage visuel et les éléments visibles sur le Display.
            </div>

            <div style={styles.formGrid}>
              <Field label="Thème">
                <select
                  value={displayForm.theme}
                  onChange={(e) => patchDisplay({ theme: e.target.value })}
                  style={styles.input}
                >
                  <option value="dark">dark</option>
                  <option value="light">light</option>
                </select>
              </Field>

              <Field label="Mode d’affichage">
                <select
                  value={displayForm.layout_mode}
                  onChange={(e) => patchDisplay({ layout_mode: e.target.value })}
                  style={styles.input}
                >
                  <option value="stadium">stadium</option>
                  <option value="arena">arena</option>
                  <option value="compact">compact</option>
                  <option value="volley">volley</option>
                </select>
              </Field>

              <Field label="Langue principale">
                <input
                  value={displayForm.lang_primary}
                  onChange={(e) => patchDisplay({ lang_primary: e.target.value })}
                  style={styles.input}
                />
              </Field>

              <Field label="Seconde langue">
                <input
                  value={displayForm.lang_secondary}
                  onChange={(e) => patchDisplay({ lang_secondary: e.target.value })}
                  style={styles.input}
                />
              </Field>
            </div>

            <div style={styles.flagsGrid}>
              <Toggle label="Afficher score" value={displayForm.show_score} onChange={(v) => patchDisplay({ show_score: v })} />
              <Toggle label="Afficher horloge" value={displayForm.show_clock} onChange={(v) => patchDisplay({ show_clock: v })} />
              <Toggle label="Afficher période" value={displayForm.show_period} onChange={(v) => patchDisplay({ show_period: v })} />
              <Toggle label="Afficher statut" value={displayForm.show_status} onChange={(v) => patchDisplay({ show_status: v })} />
              <Toggle label="Afficher bandeau bas d’écran" value={displayForm.show_lower_third} onChange={(v) => patchDisplay({ show_lower_third: v })} />
              <Toggle label="Afficher logos club" value={displayForm.show_logos} onChange={(v) => patchDisplay({ show_logos: v })} />
              <Toggle label="Afficher une seconde langue" value={displayForm.dual_language} onChange={(v) => patchDisplay({ dual_language: v })} />
            </div>
          </section>

          <section style={styles.panel}>
            <div style={styles.sectionTitle}>Paramètres sport</div>
            <div style={styles.sectionText}>
              Ces options définissent les informations métier exploitables pour ce sport.
            </div>

            <div style={styles.formGrid}>
              <Field label="Sport">
                <input readOnly value={sportForm.sport} style={{ ...styles.input, opacity: 0.82 }} />
              </Field>

              <Field label="Nombre de périodes / sets">
                <input
                  type="number"
                  min={1}
                  value={sportForm.period_count}
                  onChange={(e) => patchSport({ period_count: Math.max(1, Number(e.target.value || 1)) })}
                  style={styles.input}
                />
              </Field>

              <Field label="Durée d’une période (secondes)">
                <input
                  type="number"
                  min={0}
                  value={sportForm.period_duration_s}
                  onChange={(e) => patchSport({ period_duration_s: Math.max(0, Number(e.target.value || 0)) })}
                  style={styles.input}
                />
              </Field>

              <Field label="Temps morts max">
                <input
                  type="number"
                  min={0}
                  value={sportForm.max_timeouts ?? 0}
                  onChange={(e) => patchSport({ max_timeouts: Math.max(0, Number(e.target.value || 0)) })}
                  style={styles.input}
                />
              </Field>

              <Field label="Fautes équipe max">
                <input
                  type="number"
                  min={0}
                  value={sportForm.max_team_fouls ?? 0}
                  onChange={(e) => patchSport({ max_team_fouls: Math.max(0, Number(e.target.value || 0)) })}
                  style={styles.input}
                />
              </Field>

              <Field label="Fautes joueur max">
                <input
                  type="number"
                  min={0}
                  value={sportForm.max_player_fouls ?? 0}
                  onChange={(e) => patchSport({ max_player_fouls: Math.max(0, Number(e.target.value || 0)) })}
                  style={styles.input}
                />
              </Field>

              <Field label="Shot clock (secondes)">
                <input
                  type="number"
                  min={0}
                  value={sportForm.shot_clock_s ?? 0}
                  onChange={(e) => patchSport({ shot_clock_s: Math.max(0, Number(e.target.value || 0)) })}
                  style={styles.input}
                />
              </Field>
            </div>

            <div style={styles.flagsGrid}>
              <Toggle label="Prolongation" value={sportForm.extra_time_enabled} onChange={(v) => patchSport({ extra_time_enabled: v })} />
              <Toggle label="Tirs au but / pénalités" value={sportForm.penalties_enabled} onChange={(v) => patchSport({ penalties_enabled: v })} />
              <Toggle label="Afficher fautes équipe" value={sportForm.show_team_fouls} onChange={(v) => patchSport({ show_team_fouls: v })} />
              <Toggle label="Afficher fautes joueur" value={sportForm.show_player_fouls} onChange={(v) => patchSport({ show_player_fouls: v })} />
              <Toggle label="Afficher temps morts" value={sportForm.show_timeouts} onChange={(v) => patchSport({ show_timeouts: v })} />
              <Toggle label="Afficher bonus" value={sportForm.show_bonus} onChange={(v) => patchSport({ show_bonus: v })} />
              <Toggle label="Afficher sets" value={sportForm.show_sets} onChange={(v) => patchSport({ show_sets: v })} />
              <Toggle label="Afficher cartons" value={sportForm.show_cards} onChange={(v) => patchSport({ show_cards: v })} />
              <Toggle label="Afficher shot clock" value={sportForm.show_shot_clock} onChange={(v) => patchSport({ show_shot_clock: v })} />
            </div>
          </section>

          <section style={{ ...styles.panel, gridColumn: "1 / -1" }}>
            <div style={styles.sectionTitle}>Sponsors</div>
            <div style={styles.sectionText}>
              Cette section regroupe uniquement les éléments liés aux sponsors sur l’écran public.
            </div>

            <div style={styles.formGrid}>
              <Field label="Rotation des sponsors (secondes)">
                <input
                  type="number"
                  min={1}
                  value={displayForm.sponsor_rotate_s}
                  onChange={(e) =>
                    patchDisplay({
                      sponsor_rotate_s: Math.max(1, Number(e.target.value || 1)),
                    })
                  }
                  style={styles.input}
                />
              </Field>
            </div>

            <div style={styles.flagsGrid}>
              <Toggle label="Afficher sponsors" value={displayForm.show_sponsors} onChange={(v) => patchDisplay({ show_sponsors: v })} />
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

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label style={styles.toggleCard}>
      <div style={{ fontWeight: 700 }}>{label}</div>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function ThemePreview({
  theme,
  layout,
  showClock,
  showPeriod,
}: {
  theme: string;
  layout: string;
  showClock: boolean;
  showPeriod: boolean;
}) {
  const dark = theme === "dark";
  const bg = dark ? "#0f172a" : "#e5eefb";
  const fg = dark ? "#eff6ff" : "#0f172a";
  const soft = dark ? "rgba(255,255,255,.08)" : "rgba(15,23,42,.10)";
  const softBorder = dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.10)";

  if (layout === "rugby_stade") {
    const accentH = "#00d9ff";
    const accentA = "#ff6b35";
    return (
      <div style={{ borderRadius: 16, padding: 14, background: bg, color: fg, border: `1px solid ${softBorder}`, minHeight: 150 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 800, opacity: 0.55, letterSpacing: 1 }}>RUGBY LED STADE</div>
          <div style={{ fontSize: 10, fontWeight: 700, background: "rgba(234,179,8,.18)", color: "#fbbf24", borderRadius: 6, padding: "2px 7px" }}>1ère MT</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: accentH, textTransform: "uppercase", opacity: 0.85 }}>DOM</div>
            <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1, color: accentH }}>14</div>
            <div style={{ marginTop: 5, display: "flex", gap: 3, justifyContent: "center" }}>
              <div style={{ width: 10, height: 14, borderRadius: 2, background: "#fbbf24", opacity: 0.9 }} title="Carton jaune" />
              <div style={{ width: 10, height: 14, borderRadius: 2, background: "rgba(255,255,255,.15)" }} />
            </div>
          </div>
          <div style={{ padding: "8px 10px", borderRadius: 10, background: "rgba(255,255,255,.06)", border: `1px solid ${softBorder}`, textAlign: "center", minWidth: 60 }}>
            <div style={{ fontSize: 16, fontWeight: 900 }}>34:22</div>
            <div style={{ fontSize: 9, opacity: 0.6, marginTop: 1 }}>EN JEU</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: accentA, textTransform: "uppercase", opacity: 0.85 }}>EXT</div>
            <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1, color: accentA }}>7</div>
            <div style={{ marginTop: 5, display: "flex", gap: 3, justifyContent: "center" }}>
              <div style={{ width: 10, height: 14, borderRadius: 2, background: "#ef4444", opacity: 0.9 }} title="Carton rouge" />
              <div style={{ width: 10, height: 14, borderRadius: 2, background: "rgba(255,255,255,.15)" }} />
            </div>
          </div>
        </div>
        <div style={{ marginTop: 10, height: 18, borderRadius: 8, background: soft, display: "flex", alignItems: "center", padding: "0 8px", fontSize: 9, fontWeight: 700, opacity: 0.7 }}>
          EXCL. TEMP. DOM • 02:15
        </div>
      </div>
    );
  }

  if (layout === "rugby_expert") {
    const accentH = "#00d9ff";
    const accentA = "#ff6b35";
    return (
      <div style={{ borderRadius: 16, padding: 14, background: bg, color: fg, border: `1px solid ${softBorder}`, minHeight: 150 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 800, opacity: 0.55, letterSpacing: 1 }}>RUGBY EXPERT</div>
          <div style={{ fontSize: 10, fontWeight: 700, background: "rgba(234,179,8,.18)", color: "#fbbf24", borderRadius: 6, padding: "2px 7px" }}>2ème MT</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 6, alignItems: "start" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: accentH, opacity: 0.85 }}>DOM</div>
            <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.1, color: accentH }}>21</div>
            <div style={{ marginTop: 4, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
              {[["ESS","3"],["TRF","2"],["PÉN","1"],["DRP","0"]].map(([l,v]) => (
                <div key={l} style={{ fontSize: 8, background: soft, borderRadius: 3, padding: "1px 3px", textAlign: "center", opacity: 0.85 }}><span style={{opacity:0.6}}>{l}</span> <b>{v}</b></div>
              ))}
            </div>
          </div>
          <div style={{ padding: "6px 8px", borderRadius: 8, background: "rgba(255,255,255,.06)", border: `1px solid ${softBorder}`, textAlign: "center", minWidth: 50 }}>
            <div style={{ fontSize: 14, fontWeight: 900 }}>62:10</div>
            <div style={{ fontSize: 8, opacity: 0.55, marginTop: 1 }}>EN JEU</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: accentA, opacity: 0.85 }}>EXT</div>
            <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.1, color: accentA }}>14</div>
            <div style={{ marginTop: 4, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
              {[["ESS","2"],["TRF","2"],["PÉN","0"],["DRP","0"]].map(([l,v]) => (
                <div key={l} style={{ fontSize: 8, background: soft, borderRadius: 3, padding: "1px 3px", textAlign: "center", opacity: 0.85 }}><span style={{opacity:0.6}}>{l}</span> <b>{v}</b></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const accent = layout === "volley" ? "#7c3aed" : layout === "arena" ? "#2563eb" : layout === "stadium" ? "#16a34a" : layout === "compact" ? "#0ea5e9" : "#16a34a";
  const homeScore = layout === "volley" ? "2" : layout === "compact" ? "3" : "72";
  const awayScore = layout === "volley" ? "1" : layout === "compact" ? "1" : "68";
  const clockDisplay = layout === "compact" ? "45+2" : "08:42";
  const periodDisplay = layout === "volley" ? "SET 3" : layout === "compact" ? "2èMT" : "Q3";

  return (
    <div
      style={{
        borderRadius: 16,
        padding: 14,
        background: bg,
        color: fg,
        border: `1px solid ${softBorder}`,
        minHeight: 150,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.82 }}>{layout.toUpperCase()}</div>
        <div style={{ display: "flex", gap: 6 }}>
          <div style={{ width: 24, height: 8, borderRadius: 999, background: soft }} />
          <div style={{ width: 24, height: 8, borderRadius: 999, background: soft }} />
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          gap: 10,
          alignItems: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, opacity: 0.72 }}>HOME</div>
          <div style={{ fontSize: 28, fontWeight: 900 }}>{homeScore}</div>
        </div>

        <div
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            background: accent,
            color: "white",
            minWidth: 70,
            textAlign: "center",
          }}
        >
          {showClock ? <div style={{ fontSize: 18, fontWeight: 900 }}>{clockDisplay}</div> : <div style={{ fontSize: 18, fontWeight: 900 }}>VS</div>}
          {showPeriod ? <div style={{ fontSize: 11, opacity: 0.9 }}>{periodDisplay}</div> : null}
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, opacity: 0.72 }}>AWAY</div>
          <div style={{ fontSize: 28, fontWeight: 900 }}>{awayScore}</div>
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          height: 24,
          borderRadius: 10,
          background: soft,
          display: "flex",
          alignItems: "center",
          padding: "0 10px",
          fontSize: 11,
          fontWeight: 700,
          opacity: 0.82,
        }}
      >
        BANDEAU BAS • INFO MATCH • SPONSOR
      </div>
    </div>
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
  container: { maxWidth: 1280, margin: "0 auto" },
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
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 18,
    marginTop: 18,
  },
  panel: {
    padding: 16,
    borderRadius: 18,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.08)",
  },
  sectionTitle: { fontSize: 18, fontWeight: 900, marginBottom: 10 },
  sectionText: { fontSize: 14, lineHeight: 1.65, opacity: 0.86, marginBottom: 14 },
  themeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 14,
  },
  themeCard: {
    background: "rgba(255,255,255,.03)",
    borderRadius: 18,
    padding: 12,
    cursor: "pointer",
    textAlign: "left",
  },
  themeHeader: {
    marginTop: 12,
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  themeTitle: { fontSize: 16, fontWeight: 900 },
  themeSubtitle: { marginTop: 4, fontSize: 12, opacity: 0.72, lineHeight: 1.45 },
  recommendedBadge: {
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 11,
    fontWeight: 800,
    background: "rgba(37,99,235,.16)",
    color: "#93c5fd",
    border: "1px solid rgba(37,99,235,.30)",
    whiteSpace: "nowrap",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
    marginBottom: 14,
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
  flagsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
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
