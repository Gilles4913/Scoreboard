import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { MatchDisplayModal } from "../components/MatchDisplayModal";

type MatchRow = {
  id: string;
  name: string | null;
  status: string;
  scheduled_at: string | null;
  display_token: string;
  public_display: boolean;
  home_name: string | null;
  away_name: string | null;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function MatchesPage() {
  const supa = useMemo(() => createClient(SUPABASE_URL, SUPABASE_ANON_KEY), []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [matches, setMatches] = useState<MatchRow[]>([]);

  // modal state
  const [displayOpen, setDisplayOpen] = useState(false);
  const [displayMatch, setDisplayMatch] = useState<MatchRow | null>(null);

  function openDisplay(m: MatchRow) {
    setDisplayMatch(m);
    setDisplayOpen(true);
  }

  function closeDisplay() {
    setDisplayOpen(false);
    setDisplayMatch(null);
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      // 🔧 Adapte la requête si tu as une vue canon (matches_v / matches_canon)
      // Ici on lit "matches" (authenticated) : ça marche pour Operator connecté.
      const { data, error } = await supa
        .from("matches")
        .select("id,name,status,scheduled_at,display_token,public_display,home_name,away_name")
        .order("scheduled_at", { ascending: true });

      if (error) throw error;
      setMatches((data ?? []) as MatchRow[]);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load matches");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ padding: 18, color: "#e5e7eb" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Matches</h2>
        <button onClick={load} style={{ padding: "8px 12px", borderRadius: 10 }}>
          🔄 Rafraîchir
        </button>
      </div>

      {loading ? <div style={{ marginTop: 12, color: "#9aa0a6" }}>Chargement…</div> : null}
      {error ? (
        <div style={{ marginTop: 12, background: "#1a0f10", border: "1px solid #3a1c1f", padding: 12, borderRadius: 12 }}>
          ❌ {error}
        </div>
      ) : null}

      <div style={{ marginTop: 14, border: "1px solid #2a2d33", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 130px 120px 140px", gap: 0, background: "#0f1114" }}>
          <div style={{ padding: 10, fontWeight: 800, borderBottom: "1px solid #2a2d33" }}>Date</div>
          <div style={{ padding: 10, fontWeight: 800, borderBottom: "1px solid #2a2d33" }}>Match</div>
          <div style={{ padding: 10, fontWeight: 800, borderBottom: "1px solid #2a2d33" }}>Statut</div>
          <div style={{ padding: 10, fontWeight: 800, borderBottom: "1px solid #2a2d33" }}>Public</div>
          <div style={{ padding: 10, fontWeight: 800, borderBottom: "1px solid #2a2d33" }}>Actions</div>

          {matches.map((m) => (
            <Row key={m.id}>
              <Cell>{fmtDate(m.scheduled_at)}</Cell>
              <Cell>
                <div style={{ fontWeight: 800 }}>{m.name ?? "Match"}</div>
                <div style={{ fontSize: 12, color: "#9aa0a6" }}>
                  {(m.home_name ?? "HOME")} vs {(m.away_name ?? "AWAY")}
                </div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>
                  token: <code style={{ userSelect: "all" }}>{m.display_token}</code>
                </div>
              </Cell>
              <Cell>{m.status}</Cell>
              <Cell>{m.public_display ? "✅" : "—"}</Cell>
              <Cell>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={() => openDisplay(m)}
                    disabled={!m.display_token}
                    style={{ padding: "8px 10px", borderRadius: 10 }}
                    title="Voir lien + QR code"
                  >
                    📺 Display
                  </button>

                  {/* Tu peux ajouter ici: Edit / Start / Archive etc */}
                </div>
              </Cell>
            </Row>
          ))}
        </div>
      </div>

      <MatchDisplayModal open={displayOpen} onClose={closeDisplay} match={displayMatch} />
    </div>
  );
}

function Row({ children }: { children: any }) {
  return <>{children}</>;
}

function Cell({ children }: { children: any }) {
  return (
    <div style={{ padding: 10, borderBottom: "1px solid #1f232a", minHeight: 56, display: "flex", alignItems: "center" }}>
      {children}
    </div>
  );
}
