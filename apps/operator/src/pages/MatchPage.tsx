import React, { useEffect, useState, useCallback, useMemo } from 'react';
import type { MatchInfo, MatchState } from '@pkg/types';
import { initMatchState, reduce } from '../state';
import { Panel } from '../components/Panels';
import { createOperatorChannel } from '../realtime';
import { applyTick } from '@pkg/logic';
import { supa } from '../supabase';

interface MatchPageProps {
  match: MatchInfo;
  onBack: () => void;
  activeMatch: MatchInfo | null;
  onMatchesUpdate: (matches: MatchInfo[]) => void;
}

export function MatchPage({ match, onBack, activeMatch, onMatchesUpdate }: MatchPageProps) {
  const [matchStatus, setMatchStatus] = useState<string>(match.status);
  const [state, setState] = useState<MatchState | null>(null);
  const [chan, setChan] = useState<any>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('Connexion…');
  const [archiving, setArchiving] = useState(false);

  // ✅ org slug sans aller-retour SQL : depuis match ou localStorage
  const orgSlug =
    match.org_slug ||
    (typeof window !== 'undefined' ? localStorage.getItem('currentOrgSlug') : null) ||
    'org';

  const storageKey = `match_state_${match.id}`;
  const matchStarted = matchStatus === 'live';

  // ✅ Lien unique Display (par organisation)
  const displayUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const u = new URL(origin);
    u.pathname = '/display';
    u.searchParams.set('org', orgSlug);
    return u.toString();
  }, [orgSlug]);

  // ---------- Initialisation état + canal ----------
  useEffect(() => {
    let initialState: MatchState;

    if (matchStatus === 'live') {
      try {
        const saved = localStorage.getItem(storageKey);
        if (!saved) throw new Error('no saved state');
        const parsed = JSON.parse(saved);
        if (parsed.matchId !== `${match.org_id}:${match.id}` || parsed.sport !== match.sport) {
          throw new Error('mismatch');
        }
        parsed.clock.running = true;
        initialState = parsed;
      } catch {
        const key = `${match.org_id}:${match.id}`;
        initialState = initMatchState(key, match.sport);
        initialState.clock.running = true;
      }
    } else {
      const key = `${match.org_id}:${match.id}`;
      initialState = initMatchState(key, match.sport);
      localStorage.removeItem(storageKey);
    }

    setState(initialState);

    if (chan) chan.close();
    const c = createOperatorChannel(
      orgSlug,
      match.id,
      match.display_token,
      () => {
        setConnectionStatus('Display connecté');
        setState(cur => {
          if (cur) c.publish(cur, match);
          return cur;
        });
      },
      () => {
        setConnectionStatus('Canal prêt');
        setState(cur => {
          if (cur) c.publish(cur, match);
          return cur;
        });
      }
    );
    setChan(c);

    return () => {
      c.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id]); // re-init uniquement quand on change de match

  // ---------- Persistance locale pendant le live ----------
  useEffect(() => {
    if (state && matchStatus === 'live') {
      localStorage.setItem(storageKey, JSON.stringify(state));
    }
  }, [state, matchStatus, storageKey]);

  // ---------- Tick chrono ----------
  useEffect(() => {
    if (!state?.matchId) return;
    const id = setInterval(() => {
      setState(prev => {
        if (!prev) return prev;
        const next = applyTick(prev);
        return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
      });
    }, 100);
    return () => clearInterval(id);
  }, [state?.matchId]);

  // ---------- Envoi d’actions ----------
  const send = useCallback(
    (type: string, payload?: any) => {
      if (!state || !chan) return;

      if (type === 'clock:start') {
        setMatchStatus('live');
        (async () => {
          try {
            await supa.from('matches').update({
              status: 'live',
              updated_at: new Date().toISOString(),
            }).eq('id', match.id);
            const { data } = await supa
              .from('matches')
              .select('*')
              .eq('org_id', match.org_id)
              .order('scheduled_at', { ascending: true });
            if (data) onMatchesUpdate(data as any);
          } catch (err) {
            console.error('Erreur marquage live:', err);
          }
        })();
      }

      const next = reduce(state, { type, payload });
      setState(next);
      chan.publish(next, match);
    },
    [state, chan, match.id, match.org_id, onMatchesUpdate]
  );

  // ---------- Reset ----------
  const resetMatch = useCallback(async () => {
    if (!confirm('Remettre ce match à zéro ?')) return;
    setMatchStatus('scheduled');
    await supa.from('matches').update({
      status: 'scheduled',
      updated_at: new Date().toISOString(),
    }).eq('id', match.id);

    const key = `${match.org_id}:${match.id}`;
    const reset = initMatchState(key, match.sport);
    setState(reset);
    localStorage.removeItem(storageKey);
    if (chan) chan.publish(reset, match);

    const { data } = await supa
      .from('matches')
      .select('*')
      .eq('org_id', match.org_id)
      .order('scheduled_at', { ascending: true });
    if (data) onMatchesUpdate(data as any);
  }, [match.id, match.org_id, match.sport, chan]);

  // ---------- Archivage ----------
  const archiveMatch = useCallback(async () => {
    if (!confirm('Archiver ce match ?')) return;
    setArchiving(true);
    setMatchStatus('archived');

    await supa.from('matches').update({
      status: 'archived',
      updated_at: new Date().toISOString(),
    }).eq('id', match.id);

    localStorage.removeItem(storageKey);

    const { data } = await supa
      .from('matches')
      .select('*')
      .eq('org_id', match.org_id)
      .order('scheduled_at', { ascending: true });
    if (data) onMatchesUpdate(data as any);

    if (chan) chan.close();
    onBack();
    setArchiving(false);
  }, [match.id, match.org_id, chan, onBack, onMatchesUpdate, storageKey]);

  if (!state) {
    return (
      <div className="match-page">
        <div className="card">
          <div className="loading">Chargement du match…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="match-page">
      <div className="match-header">
        <button onClick={onBack} className="back-button">← Retour</button>
        <div className="match-title-section">
          <h1 className="match-title">{match.name}</h1>
          <div className="match-subtitle">
            {match.home_name} vs {match.away_name}
            {matchStarted && (
              <span style={{
                background: '#dc2626',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                marginLeft: '12px',
              }}>
                🔴 MATCH ACTIF
              </span>
            )}
          </div>
        </div>
        <div className="match-actions">
          <div className="sport-selector">
            <label>Sport:</label>
            <select
              value={state.sport}
              onChange={e => send('sport:set', { sport: e.target.value })}
            >
              <option value="basic">Basic</option>
              <option value="football">Football</option>
              <option value="handball">Handball</option>
              <option value="basket">Basketball</option>
              <option value="hockey_ice">Hockey sur glace</option>
              <option value="hockey_field">Hockey sur gazon</option>
              <option value="volleyball">Volleyball</option>
            </select>
          </div>
          <button
            onClick={archiveMatch}
            disabled={archiving || state.clock.running}
            title={state.clock.running ? "Arrêtez d'abord le chrono" : "Archiver le match"}
            style={{
              background: '#f59e0b',
              borderColor: '#f59e0b',
              color: 'white',
              minHeight: 40,
              cursor: state.clock.running ? 'not-allowed' : 'pointer',
              opacity: state.clock.running ? 0.6 : 1,
            }}
          >
            {archiving ? '📦 Archivage…' : '📦 Archiver'}
          </button>
          <button
            onClick={resetMatch}
            disabled={state.clock.running}
            title={state.clock.running ? "Arrêtez d'abord le chrono" : "Reset du match"}
            style={{
              background: '#dc2626',
              borderColor: '#dc2626',
              color: 'white',
              minHeight: 40,
              cursor: state.clock.running ? 'not-allowed' : 'pointer',
              opacity: state.clock.running ? 0.6 : 1,
            }}
          >
            🔄 Reset
          </button>
        </div>
      </div>

      <div className="match-info">
        <div className="sport-display">
          <strong>Sport actuel:</strong> <span className="sport-badge">{state.sport}</span>
          <div style={{ marginTop: 8, fontSize: 14, color: '#9aa0a6' }}>
            <strong>Statut:</strong> {matchStarted ? '🔴 Actif' : '⏸️ Prêt'}
          </div>
        </div>
      </div>

      <div className="match-content">
        <div className="main-score">
          <div className="team-score">
            <div className="team-name">{match.home_name}</div>
            <div className="score-display">{state.score.home.toString().padStart(2, '0')}</div>
          </div>
          <div className="score-vs">:</div>
          <div className="team-score">
            <div className="team-name">{match.away_name}</div>
            <div className="score-display">{state.score.away.toString().padStart(2, '0')}</div>
          </div>
        </div>

        {state.sport !== 'volleyball' && (
          <div className="time-controls">
            <button className="primary" onClick={() => send('clock:start')} disabled={state.clock.running}>
              ▶ {state.clock.running ? 'En cours…' : 'Démarrer'}
            </button>
            <button className="danger" onClick={() => send('clock:stop')}>⏸</button>
            <div className="time-display">
              {Math.floor(state.clock.remainingMs / 60000).toString().padStart(2, '0')}:
              {Math.floor((state.clock.remainingMs % 60000) / 1000).toString().padStart(2, '0')}
            </div>
            <div className="period-display">Période {state.clock.period}</div>
            <button onClick={() => send('period:next')}>Période +1</button>
            <button onClick={() => send('period:prev')}>Période -1</button>
          </div>
        )}

        <div className="controls-section">
          <Panel state={state} send={send} />
        </div>

        <div className="display-link">
          <div className="small">
            <div style={{ marginBottom: 8 }}>
              <strong>Statut :</strong>{' '}
              <span style={{ color: connectionStatus.includes('connecté') || connectionStatus.includes('prêt') ? '#4ade80' : '#fbbf24' }}>
                {connectionStatus}
              </span>
            </div>
            <div style={{ marginBottom: 8, fontSize: 12, color: '#9aa0a6' }}>
              {matchStarted ? '🔴 Affichage temps réel actif' : '⏸️ Affichage statique'}
            </div>
            <strong>Lien Display :</strong>{' '}
            <a href={displayUrl} target="_blank" rel="noopener noreferrer">
              {displayUrl}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
