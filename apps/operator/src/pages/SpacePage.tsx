import React, { useMemo, useState } from "react";
import type { MatchInfo } from "@pkg/types";
import { MatchDisplayModal } from "../components/MatchDisplayModal";
import { supa } from "../supabase";

type Props = {
  user: any;
  org: any;
  matches: MatchInfo[];
  onMatchSelect: (m: MatchInfo) => void;
  onMatchesUpdate: (next: MatchInfo[]) => void;
};

function normStatus(s: any): string {
  return String(s ?? "").toLowerCase().trim();
}

function isPastByDate(scheduledAt: any, hours: number) {
  if (!scheduledAt) return false;
  const t = new Date(scheduledAt).getTime();
  if (Number.isNaN(t)) return false;
  const now = Date.now();
  return t < now - hours * 60 * 60 * 1000;
}

function fmtDate(iso: any) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

export function SpacePage({ user, org, matches, onMatchSelect, onMatchesUpdate }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // modal display (QR)
  const [displayOpen, setDisplayOpen] = useState(false);
  const [displayMatch, setDisplayMatch] = useState<any>(null);

  const { upcoming, live, archived } = useMemo(() => {
    const upcoming: MatchInfo[] = [];
    const live: MatchInfo[] = [];
    const archived: MatchInfo[] = [];

    for (const m of matches ?? []) {
      const st = normStatus((m as any).status);
      const scheduledAt = (m as any).scheduled_at ?? (m as any).scheduledAt;

      const isLive = st === "live" || st === "in_progress";
      const isArchived =
        st === "archived" || st === "finished" || st === "completed" || isPastByDate(scheduledAt, 12);
      const isUpcoming =
        st === "scheduled" || st === "ready" || st === "preparing" || st === "draft" || (!isLive && !isArchived);

      if (isLive) live.push(m);
      else if (isArchived) archived.push(m);
      else if (isUpcoming) upcoming.push(m);
      else upcoming.push(m);
    }

    // tri par date
    const byDateAsc = (a: any, b: any) =>
      new Date(a.scheduled_at ?? a.scheduledAt ?? 0).getTime() - new Date(b.scheduled_at ?? b.scheduledAt ?? 0).getTime();
    const byDateDesc = (a: any, b: any) => -byDateAsc(a, b);

    upcoming.sort(byDateAsc);
    live.sort(byDateAsc);
    archived.sort(byDateDesc);

    return { upcoming, live, archived };
  }, [matches]);

  function openDisplay(m: any) {
    setDisplayMatch(m);
    setDisplayOpen(true);
  }

  function closeDisplay() {
    setDisplayOpen(false);
    setDisplayMatch(null);
  }

  async function refreshMatches() {
    try {
      setLoading(true);
      setError("");

      // IMPORTANT: Operator est authenticated, donc SELECT matches passe par RLS (matches_member_select)
      // On filtre sur org_id (dev-friendly)
      const { data, error } = await supa
        .from("matches")
        .select("id,org_id,name,home_name,away_name,scheduled_at,status,public_display,display_token,created_at,updated_at,home_team_id,away_team_id")
        .eq("org_id", org?.id)
        .order("scheduled_at", { ascending: true });

      if (error) throw error;
      onMatchesUpdate((data ?? []) as any);
    } catch (e: any) {
      setError(e?.message ?? "Erreur refresh matches");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 18, color: "#e5e7eb" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Matches</div>
          <div style={{ fontSize: 12, color: "#9aa0a6" }}>
            Org: <strong>{org?.name ?? org?.slug ?? "—"}</strong>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={refreshMatches}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #2a2d33", background: "#14161a", color: "#e5e7eb" }}
            disabled={loading}
          >
            {loading ? "…" : "🔄 Rafraîchir"}
          </button>
        </div>
      </div>

      {error ? (
        <div style={{ marginTop: 12, background: "#1a0f10", border: "1px solid #3a1c1f", padding: 12, borderRadius: 12 }}>
          ❌ {error}
        </div>
      ) : null}

      <Section
        title="🔴 En cours"
        subtitle="Match(s) live / in_progress"
        items={live}
        onMatchSelect={onMatchSelect}
        onDisplay={openDisplay}
      />

      <Section
        title="🗓️ À venir"
        subtitle="Préparation (scheduled/ready/preparing/draft)"
        items={upcoming}
        onMatchSelect={onMatchSelect}
        onDisplay={openDisplay}
      />

      <Section
        title="📦 Archivés"
        subtitle="finished/completed/archived (ou passé > 12h si status non mis à jour)"
        items={archived}
        onMatchSelect={onMatchSelect}
        onDisplay={openDisplay}
      />

      <MatchDisplayModal open={displayOpen} onClose={closeDisplay} match={displayMatch} />
    </div>
  );
}

function Section({
  title,
  subtitle,
  items,
  onMatchSelect,
  onDisplay,
}: {
  title: string;
  subtitle: string;
  items: any[];
  onMatchSelect: (m: any) => void;
  onDisplay: (m: any) => void;
}) {
  return (
    <div style={{ marginTop: 16, border: "1px solid #2a2d33", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ background: "#0f1114", padding: 12, borderBottom: "1px solid #2a2d33" }}>
        <div style={{ fontWeight: 900 }}>{title}</div>
        <div style={{ fontSize: 12, color: "#9aa0a6" }}>{subtitle}</div>
      </div>

      {items.length === 0 ? (
        <div style={{ padding: 12, color: "#9aa0a6" }}>Aucun match.</div>
      ) : (
        <div>
          {items.map((m) => (
            <div
              key={m.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                padding: 12,
                borderTop: "1px solid #1f232a",
                flexWrap: "wrap",
              }}
            >
              <div style={{ minWidth: 260 }}>
                <div style={{ fontWeight: 900 }}>{m.name ?? "Match"}</div>
                <div style={{ fontSize: 12, color: "#9aa0a6" }}>
                  {(m.home_name ?? "HOME")} vs {(m.away_name ?? "AWAY")}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  {fmtDate(m.scheduled_at)} • status: <code>{String(m.status ?? "")}</code>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  onClick={() => onMatchSelect(m)}
                  style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #2a2d33", background: "#14161a", color: "#e5e7eb" }}
                >
                  Ouvrir
                </button>

                <button
                  onClick={() => onDisplay(m)}
                  disabled={!m.display_token}
                  title={!m.display_token ? "display_token manquant" : "Lien + QR code Display"}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid #2a2d33",
                    background: !m.display_token ? "#0f1114" : "#14161a",
                    color: !m.display_token ? "#6b7280" : "#e5e7eb",
                    cursor: !m.display_token ? "not-allowed" : "pointer",
                  }}
                >
                  📺 Display
                </button>

                <div style={{ fontSize: 12, color: m.public_display ? "#4ade80" : "#fbbf24" }}>
                  public: {m.public_display ? "ON" : "OFF"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
