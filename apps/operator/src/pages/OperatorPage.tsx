import React, { useEffect, useState } from 'react';
import { supa } from '../supabase';

type Org = { id: string; name: string; slug: string };
type Match = {
  id: string;
  org_id: string;
  name: string;
  sport: string;
  home_name: string;
  away_name: string;
  status?: string | null;
  updated_at?: string | null;
};

function getSelectedOrgId(): string | null {
  return localStorage.getItem('currentOrgId');
}
function setSelectedOrgId(orgId: string | null) {
  if (!orgId) localStorage.removeItem('currentOrgId');
  else localStorage.setItem('currentOrgId', orgId);
}
function setSelectedOrgSlug(slug: string | null) {
  if (!slug) localStorage.removeItem('currentOrgSlug');
  else localStorage.setItem('currentOrgSlug', slug);
}
function getSelectedOrgSlug(): string | null {
  return localStorage.getItem('currentOrgSlug');
}

export default function OperatorPage() {
  const [me, setMe] = useState<any>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(getSelectedOrgId());
  const [form, setForm] = useState({
    name: '',
    sport: 'football',
    home_name: 'Équipe A',
    away_name: 'Équipe B',
  });
  const [matches, setMatches] = useState<Match[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supa.auth.getSession();
      setMe(session?.user ?? null);
    })();
  }, []);

  // Charger les organisations
  useEffect(() => {
    (async () => {
      const { data } = await supa
        .from('orgs')
        .select('id, name, slug')
        .order('created_at', { ascending: false });
      const list = data || [];
      setOrgs(list);

      // Pré-sélection si vide
      if (!currentOrgId && list.length) {
        setCurrentOrgId(list[0].id);
        setSelectedOrgId(list[0].id);
        setSelectedOrgSlug(list[0].slug);
      } else if (currentOrgId && !getSelectedOrgSlug()) {
        // Si on a un orgId mémorisé mais pas le slug, le remplir
        const org = list.find(o => o.id === currentOrgId);
        if (org) setSelectedOrgSlug(org.slug);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Charger les matches de l'org
  useEffect(() => {
    (async () => {
      if (!currentOrgId) return;
      const { data } = await supa
        .from('matches')
        .select('id, org_id, name, sport, home_name, away_name, status, updated_at')
        .eq('org_id', currentOrgId)
        .order('updated_at', { ascending: false });
      setMatches(data || []);
    })();
  }, [currentOrgId]);

  const onLogout = async () => {
    await supa.auth.signOut();
    window.location.href = '/login';
  };

  const changeOrg = (id: string) => {
    setCurrentOrgId(id);
    setSelectedOrgId(id);
    const org = orgs.find(o => o.id === id);
    if (org) setSelectedOrgSlug(org.slug);
  };

  const createMatch = async () => {
    setBusy(true); setMsg(null);
    try {
      if (!currentOrgId) { setMsg('Sélectionne une organisation'); return; }
      const payload = { ...form, org_id: currentOrgId, status: 'scheduled' };
      const { data, error } = await supa.from('matches').insert(payload).select().single();
      if (error) { setMsg(error.message); return; }
      setMatches(prev => [data as Match, ...prev]);
      setForm({ name: '', sport: 'football', home_name: 'Équipe A', away_name: 'Équipe B' });
      setMsg('Match créé ✅');
    } catch (e: any) {
      setMsg(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const deleteMatch = async (id: string) => {
    setBusy(true); setMsg(null);
    try {
      await supa.from('matches').delete().eq('id', id);
      setMatches(prev => prev.filter(m => m.id !== id));
      setMsg('Match supprimé ✅');
    } catch (e: any) {
      setMsg(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  // Lien unique Display par org (utilise le slug mémorisé)
  const displayOrgSlug = getSelectedOrgSlug();
  const displayUrl = displayOrgSlug
    ? `${window.location.origin}/display?org=${encodeURIComponent(displayOrgSlug)}`
    : '';

  return (
    <div className="space-page">
      <div className="space-header">
        <h1>Operator — Gestion des matches</h1>
        <div className="row">
          <span>{me?.email}</span>
          <button className="secondary" onClick={onLogout}>Déconnexion</button>
        </div>
      </div>

      {msg && <div className="form-message" style={{ marginBottom: 12 }}>{msg}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-row">
          <label>Organisation</label>
          <select value={currentOrgId ?? ''} onChange={e => changeOrg(e.target.value)}>
            {orgs.map(o => <option key={o.id} value={o.id}>{o.name} ({o.slug})</option>)}
          </select>
        </div>
        {displayUrl && (
          <div className="display-link" style={{ marginTop: 12 }}>
            <span className="small">Lien Display (unique pour l’organisation)&nbsp;:</span>{' '}
            <a href={displayUrl} target="_blank" rel="noreferrer">{displayUrl}</a>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 className="h1">Créer un match</h2>
        <div className="form-grid">
          <div className="form-row-split">
            <div className="form-field">
              <label>Nom</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Match name" />
            </div>
            <div className="form-field">
              <label>Sport</label>
              <input value={form.sport} onChange={e => setForm(f => ({ ...f, sport: e.target.value }))} placeholder="football" />
            </div>
          </div>
          <div className="form-row-split">
            <div className="form-field">
              <label>Équipe domicile</label>
              <input value={form.home_name} onChange={e => setForm(f => ({ ...f, home_name: e.target.value }))} />
            </div>
            <div className="form-field">
              <label>Équipe visiteur</label>
              <input value={form.away_name} onChange={e => setForm(f => ({ ...f, away_name: e.target.value }))} />
            </div>
          </div>
          <button className="primary" disabled={busy} onClick={createMatch}>Créer</button>
        </div>
      </div>

      <div className="card">
        <h2 className="h1">Matches</h2>
        <div className="matches-list" style={{ marginTop: 12 }}>
          {matches.length === 0 ? (
            <div className="empty-list">Aucun match.</div>
          ) : matches.map(m => (
            <div className="match-row" key={m.id}>
              <div className="match-details">
                <div className="match-name">{m.name} — {m.sport}</div>
                <div className="match-teams">{m.home_name} vs {m.away_name} — {m.status ?? '—'}</div>
              </div>
              <div className="match-actions">
                <button className="danger" disabled={busy} onClick={() => deleteMatch(m.id)}>Supprimer</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
