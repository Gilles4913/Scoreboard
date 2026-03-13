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
};

type PlayerRow = {
  id: string;
  org_id: string;
  team_id: string;
  number: string;
  name: string;
  position: string | null;
  is_active: boolean;
};

export default function PlayersPage() {
  const nav = useNavigate();
  const { teamId = "" } = useParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  const [org, setOrg] = useState<OrgRow | null>(null);
  const [team, setTeam] = useState<TeamRow | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);

  const [playerName, setPlayerName] = useState("");
  const [playerNumber, setPlayerNumber] = useState("");
  const [playerPosition, setPlayerPosition] = useState("");

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

      const [{ data: teamRow, error: teamErr }, { data: playersRows, error: playersErr }] =
        await Promise.all([
          supabase.from("teams").select("id, org_id, slug, name, category, code").eq("id", teamId).maybeSingle(),
          supabase
            .from("players")
            .select("id, org_id, team_id, number, name, position, is_active")
            .eq("team_id", teamId)
            .order("number", { ascending: true }),
        ]);

      if (cancelled) return;

      if (teamErr || !teamRow) {
        setErr(teamErr?.message || "Équipe introuvable.");
        setLoading(false);
        return;
      }

      if (playersErr) {
        setErr(playersErr.message);
        setLoading(false);
        return;
      }

      setTeam(teamRow as TeamRow);
      setPlayers((playersRows as PlayerRow[]) || []);
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

  async function createPlayer() {
    if (!org || !team) return;
    if (!playerName.trim() || !playerNumber.trim()) {
      flash("Renseigne au minimum le nom et le numéro.");
      return;
    }

    setSaving(true);

    const payload = {
      org_id: org.id,
      team_id: team.id,
      number: playerNumber.trim(),
      name: playerName.trim(),
      position: playerPosition.trim() || null,
      is_active: true,
    };

    const { data, error } = await supabase
      .from("players")
      .insert(payload)
      .select("id, org_id, team_id, number, name, position, is_active")
      .maybeSingle();

    setSaving(false);

    if (error || !data) {
      flash(error?.message || "Impossible d’ajouter le joueur.");
      return;
    }

    setPlayers((prev) =>
      [...prev, data as PlayerRow].sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })),
    );

    setPlayerName("");
    setPlayerNumber("");
    setPlayerPosition("");
    flash("Joueur ajouté.");
  }

  async function updatePlayer(playerId: string, patch: Partial<PlayerRow>) {
    const { error } = await supabase.from("players").update(patch).eq("id", playerId);

    if (error) {
      flash(`Erreur mise à jour : ${error.message}`);
      return;
    }

    setPlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, ...patch } : p)),
    );
    flash("Joueur mis à jour.");
  }

  async function toggleActive(player: PlayerRow) {
    await updatePlayer(player.id, { is_active: !player.is_active });
  }

  async function deletePlayer(playerId: string) {
    const ok = window.confirm("Supprimer ce joueur de l’équipe ?");
    if (!ok) return;

    const { error } = await supabase.from("players").delete().eq("id", playerId);

    if (error) {
      flash(`Erreur suppression : ${error.message}`);
      return;
    }

    setPlayers((prev) => prev.filter((p) => p.id !== playerId));
    flash("Joueur supprimé.");
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.centerBox}>Chargement des joueurs…</div>
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

  const activePlayers = players.filter((p) => p.is_active);
  const inactivePlayers = players.filter((p) => !p.is_active);

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.topbar}>
          <div>
            <div style={styles.title}>Joueurs</div>
            <div style={styles.subtitle}>
              {org.name} • {team.name} {team.category ? `• ${team.category}` : ""} {team.code ? `• ${team.code}` : ""}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => nav(`/teams/${team.id}/matches`)} style={styles.ghostBtn}>Retour matchs</button>
          </div>
        </div>

        {info ? <div style={styles.infoBox}>{info}</div> : null}

        <section style={styles.panel}>
          <div style={styles.sectionTitle}>Ajouter un joueur</div>

          <div style={styles.formGrid}>
            <Field label="Numéro">
              <input value={playerNumber} onChange={(e) => setPlayerNumber(e.target.value)} style={styles.input} />
            </Field>

            <Field label="Nom">
              <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} style={styles.input} />
            </Field>

            <Field label="Poste">
              <input value={playerPosition} onChange={(e) => setPlayerPosition(e.target.value)} style={styles.input} />
            </Field>
          </div>

          <div style={{ marginTop: 16 }}>
            <button onClick={createPlayer} style={styles.primaryBtn} disabled={saving}>
              {saving ? "Ajout..." : "Ajouter le joueur"}
            </button>
          </div>
        </section>

        <Section title={`Joueurs actifs (${activePlayers.length})`}>
          {activePlayers.length === 0 ? (
            <div style={styles.emptyCard}>Aucun joueur actif.</div>
          ) : (
            <div style={styles.list}>
              {activePlayers.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  onUpdate={updatePlayer}
                  onToggleActive={toggleActive}
                  onDelete={deletePlayer}
                />
              ))}
            </div>
          )}
        </Section>

        <Section title={`Joueurs inactifs (${inactivePlayers.length})`}>
          {inactivePlayers.length === 0 ? (
            <div style={styles.emptyCard}>Aucun joueur inactif.</div>
          ) : (
            <div style={styles.list}>
              {inactivePlayers.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  onUpdate={updatePlayer}
                  onToggleActive={toggleActive}
                  onDelete={deletePlayer}
                />
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function PlayerCard({
  player,
  onUpdate,
  onToggleActive,
  onDelete,
}: {
  player: PlayerRow;
  onUpdate: (playerId: string, patch: Partial<PlayerRow>) => Promise<void>;
  onToggleActive: (player: PlayerRow) => Promise<void>;
  onDelete: (playerId: string) => Promise<void>;
}) {
  const [number, setNumber] = useState(player.number);
  const [name, setName] = useState(player.name);
  const [position, setPosition] = useState(player.position || "");

  return (
    <div style={styles.row}>
      <input
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        style={styles.inputSm}
        placeholder="#"
        title="Numéro"
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ ...styles.inputSm, flex: 2 }}
        placeholder="Nom"
        title="Nom"
      />
      <input
        value={position}
        onChange={(e) => setPosition(e.target.value)}
        style={styles.inputSm}
        placeholder="Poste"
        title="Poste"
      />
      <button
        onClick={() =>
          onUpdate(player.id, {
            number: number.trim(),
            name: name.trim(),
            position: position.trim() || null,
          })
        }
        style={styles.btnSm}
        title="Enregistrer"
      >
        ✓
      </button>
      <button
        onClick={() => onToggleActive(player)}
        style={styles.btnSmGhost}
        title={player.is_active ? "Désactiver" : "Réactiver"}
      >
        {player.is_active ? "Désactiver" : "Réactiver"}
      </button>
      <button
        onClick={() => onDelete(player.id)}
        style={styles.btnSmDanger}
        title="Supprimer"
      >
        ✕
      </button>
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
  panel: {
    padding: 16,
    borderRadius: 18,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.08)",
  },
  sectionTitle: { fontSize: 18, fontWeight: 900, marginBottom: 14 },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 },
  list: { display: "flex", flexDirection: "column", gap: 4 },
  card: {
    padding: 16,
    borderRadius: 16,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.08)",
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    borderRadius: 10,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.07)",
  },
  cardGrid: { display: "grid", gridTemplateColumns: "1fr 2fr 1fr 1fr", gap: 14 },
  actionRow: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 },
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
  inputSm: {
    flex: 1,
    minWidth: 0,
    background: "rgba(255,255,255,.05)",
    color: "#e7eefc",
    border: "1px solid rgba(255,255,255,.10)",
    borderRadius: 8,
    padding: "5px 9px",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
  } as React.CSSProperties,
  primaryBtn: {
    background: "#2563eb",
    color: "white",
    border: "1px solid rgba(255,255,255,.10)",
    borderRadius: 12,
    padding: "10px 14px",
    fontWeight: 800,
    cursor: "pointer",
  },
  ghostBtn: {
    background: "transparent",
    color: "#e7eefc",
    border: "1px solid rgba(255,255,255,.14)",
    borderRadius: 12,
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  dangerBtn: {
    background: "rgba(220,38,38,.16)",
    color: "#fecaca",
    border: "1px solid rgba(220,38,38,.35)",
    borderRadius: 12,
    padding: "10px 14px",
    fontWeight: 800,
    cursor: "pointer",
  },
  btnSm: {
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: 8,
    padding: "5px 10px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    flexShrink: 0,
  },
  btnSmGhost: {
    background: "transparent",
    color: "#a0aec0",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 8,
    padding: "4px 10px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    flexShrink: 0,
  },
  btnSmDanger: {
    background: "transparent",
    color: "#f87171",
    border: "1px solid rgba(220,38,38,.3)",
    borderRadius: 8,
    padding: "5px 10px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    flexShrink: 0,
  },
  emptyCard: {
    padding: 16,
    borderRadius: 16,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.08)",
  },
};
