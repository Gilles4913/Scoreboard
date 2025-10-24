import React, { useEffect, useMemo, useState } from 'react';
import { supa } from '../supabase';

type MatchRow = {
  id: string;
  org_id: string;
  name: string;
  sport: string;
  home_name: string;
  away_name: string;
  status: string | null;
  updated_at: string | null;
  display_token?: string | null;
};

export default function DisplayPage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const orgSlug = params.get('org') || '';
  const explicitMatchId = params.get('match') || ''; // on ne l’utilise pas si on veut un lien unique par org
  const [error, setError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [loading, setLoading] = useState(true);

  // 1) Résoudre l’ID d’orga depuis son slug
  useEffect(() => {
    (async () => {
      try {
        if (!orgSlug) {
          setError('Paramètre "org" manquant dans l’URL.');
          setLoading(false);
          return;
        }
        const { data, error } = await supa
          .from('orgs')
          .select('id, slug, name')
          .eq('slug', orgSlug)
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          setError(`Organisation introuvable : ${orgSlug}`);
          setLoading(false);
          return;
        }
        setOrgId(data.id);
      } catch (e: any) {
        setError(e?.message || String(e));
        setLoading(false);
      }
    })();
  }, [orgSlug]);

  // 2) Récupérer le match à afficher (si non spécifié : dernier "live")
  useEffect(() => {
    (async () => {
      if (!orgId) return;

      try {
        setLoading(true);
        if (explicitMatchId) {
          const { data, error } = await supa
            .from('matches')
            .select('id, org_id, name, sport, home_name, away_name, status, updated_at, display_token')
            .eq('id', explicitMatchId)
            .maybeSingle();
          if (error) throw error;
          if (!data) {
            setError('Match introuvable.');
            setLoading(false);
            return;
          }
          setMatch(data);
          setLoading(false);
          return;
        }

        // Lien unique par org : prendre le plus récent en "live"
        const { data, error } = await supa
          .from('matches')
          .select('id, org_id, name, sport, home_name, away_name, status, updated_at, display_token')
          .eq('org_id', orgId)
          .eq('status', 'live')
          .order('updated_at', { ascending: false })
          .limit(1);
        if (error) throw error;
        if (!data || data.length === 0) {
          setError('Aucun match actif pour cette organisation.');
          setLoading(false);
          return;
        }
        setMatch(data[0]);
        setLoading(false);
      } catch (e: any) {
        setError(e?.message || String(e));
        setLoading(false);
      }
    })();
  }, [orgId, explicitMatchId]);

  if (loading) {
    return (
      <div className="preview">
        <div className="loading">Chargement de l’affichage…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="preview" style={{ color: '#fca5a5' }}>
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <h1 className="h1">Erreur d’affichage</h1>
          <p style={{ marginTop: 8 }}>{error}</p>
          <div className="small" style={{ marginTop: 8, color: '#9aa0a6' }}>
            URL: /display?org=<strong>{orgSlug}</strong>
            {explicitMatchId ? `&match=${explicitMatchId}` : ''}
          </div>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="preview">
        <div className="loading">Aucun match à afficher…</div>
      </div>
    );
  }

  // ⚠️ Ici tu peux brancher ton rendu “temps réel” (canal) basé sur orgSlug + match.id + (match.display_token)
  return (
    <div className="preview">
      <div className="card" style={{ textAlign:'center', padding:24 }}>
        <div className="small" style={{ marginBottom: 8 }}>Organisation : <strong>{orgSlug}</strong></div>
        <h1 className="h1" style={{ fontSize: 24, marginBottom: 16 }}>{match.name}</h1>
        <div className="main-score" style={{ marginTop: 8 }}>
          <div className="team-score">
            <div className="team-name">{match.home_name}</div>
            <div className="score-display">—</div>
          </div>
          <div className="score-vs">:</div>
          <div className="team-score">
            <div className="team-name">{match.away_name}</div>
            <div className="score-display">—</div>
          </div>
        </div>
        <div className="small" style={{ marginTop: 12, color:'#9aa0a6' }}>
          (Affichage Display — brancher le temps réel si besoin)
        </div>
      </div>
    </div>
  );
}
