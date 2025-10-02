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
  console.log('🎮 MatchPage - Rendu avec match:', match?.name || 'UNDEFINED');
  
  // État local pour le statut du match (mis à jour en temps réel)
  const [matchStatus, setMatchStatus] = useState<string>(match.status);
  
  const [state, setState] = useState<MatchState | null>(null);
  const [chan, setChan] = useState<any>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('Connexion...');
  const [archiving, setArchiving] = useState(false);
  
  // Clé pour le localStorage
  const storageKey = `match_state_${match.id}`;
  
  console.log('🎮 MatchPage - Score actuel:', state?.score || 'Pas encore chargé');
  
  // Vérification de sécurité
  if (!match || !match.id) {
    console.error('❌ MatchPage - Match invalide ou manquant:', match);
    return (
      <div className="match-page">
        <div className="card">
          <div className="loading">Erreur: Match invalide</div>
          <button onClick={onBack} className="back-button">← Retour</button>
        </div>
      </div>
    );
  }
  
  // Un match est "démarré" s'il a le statut 'live' dans la base de données
  const matchStarted = matchStatus === 'live';

  // URL du display (mémorisée pour éviter les recalculs)
  const displayUrl = useMemo(() => {
    const u = new URL('http://localhost:5174/'); 
    u.searchParams.set('org', match.org_slug || 'org'); 
    u.searchParams.set('match', match.id); 
    u.searchParams.set('token', match.display_token); 
    u.searchParams.set('home', match.home_name);
    u.searchParams.set('away', match.away_name);
    u.searchParams.set('ui', '1'); 
    return u.toString();
  }, [match.id, match.org_slug, match.display_token, match.home_name, match.away_name]);

  // Initialisation du match et du canal (SEULEMENT quand match.id change)
  useEffect(() => {
    console.log('🎮 MatchPage - Initialisation pour match:', match.id);
    
    let initialState: MatchState;
    
    // Pour un match actif, essayer de restaurer l'état depuis localStorage
    if (matchStatus === 'live') {
      try {
        const savedState = localStorage.getItem(storageKey);
        if (savedState) {
          const parsedState = JSON.parse(savedState);
          // Vérifier que l'état sauvegardé correspond au bon match et sport
          if (parsedState.matchId === `${match.org_id}:${match.id}` && parsedState.sport === match.sport) {
            initialState = parsedState;
            initialState.clock.running = true; // S'assurer que le chrono tourne
            console.log('🔄 État restauré depuis localStorage:', initialState);
          } else {
            throw new Error('État sauvegardé invalide');
          }
        } else {
          throw new Error('Pas d\'état sauvegardé');
        }
      } catch (error) {
        console.log('⚠️ Impossible de restaurer l\'état, initialisation par défaut');
        const key = `${match.org_id}:${match.id}`;
        initialState = initMatchState(key, match.sport);
        initialState.clock.running = true;
      }
    } else {
      // Match inactif : initialisation normale
      const key = `${match.org_id}:${match.id}`;
      initialState = initMatchState(key, match.sport);
      // Nettoyer le localStorage pour les matchs inactifs
      localStorage.removeItem(storageKey);
    }
    
    setState(initialState);
    
    // Fermer le canal précédent s'il existe
    if (chan) {
      console.log('🔌 Fermeture du canal précédent');
      chan.close();
    }
    
    // Créer le nouveau canal
    const c = createOperatorChannel(
      match.org_slug || 'org', 
      match.id, 
      match.display_token, 
      () => {
        console.log('🔄 Display demande l\'état - Envoi de l\'état actuel');
        setConnectionStatus('Display connecté');
        // Publier l'état actuel vers le display
        setState(currentState => {
          if (currentState) c.publish(currentState, match);
          return currentState;
        });
      }, 
      () => {
        console.log('🔌 Canal opérateur connecté');
        setConnectionStatus('Canal prêt');
        // Publier l'état initial (restauré ou nouveau)
        setState(currentState => {
          if (currentState) c.publish(currentState, match);
          return currentState;
        });
      }
    );
    
    setChan(c);


    // Cleanup à la fermeture
    return () => {
      console.log('🧹 Nettoyage MatchPage');
      c.close();
    };
  }, [match.id]); // SEULEMENT match.id comme dépendance

  // Sauvegarder l'état dans localStorage à chaque changement (pour les matchs actifs)
  useEffect(() => {
    if (state && matchStatus === 'live') {
      localStorage.setItem(storageKey, JSON.stringify(state));
      console.log('💾 État sauvegardé dans localStorage');
    }
  }, [state, matchStatus, storageKey]);

  // Gestion du tick du chronomètre (SEULEMENT quand state.matchId change)
  useEffect(() => { 
    if (!state?.matchId) return; 
    console.log('⏰ Démarrage du tick pour:', state.matchId);
    const id = setInterval(() => {
      setState(prev => {
        if (!prev) return prev;
        const newState = applyTick(prev);
        // Éviter les re-rendus si rien n'a changé
        if (JSON.stringify(newState) === JSON.stringify(prev)) {
          return prev;
        }
        return newState;
      });
    }, 100); 
    return () => {
      console.log('⏰ Arrêt du tick');
      clearInterval(id);
    }; 
  }, [state?.matchId]); // SEULEMENT state.matchId

  // Fonction d'envoi d'actions (mémorisée pour éviter les re-créations)
  const send = useCallback((type: string, payload?: any) => {
    if (!state || !chan) return;
    
    // Marquer le match comme actif SEULEMENT quand l'horloge démarre
    if (type === 'clock:start') {
      console.log('🔴 Démarrage du match - Marquage comme ACTIF');
      setMatchStatus('live'); // Mise à jour immédiate de l'affichage
      const markAsLive = async () => {
        try {
          await supa.from('matches').update({ 
            status: 'live',
            updated_at: new Date().toISOString()
          }).eq('id', match.id);
          console.log('✅ Match marqué comme ACTIF');
          // Recharger les matchs pour mettre à jour la liste
          const { data: updatedMatches } = await supa
            .from('matches')
            .select('*')
            .eq('org_id', match.org_id)
            .order('scheduled_at', { ascending: true });
          if (updatedMatches) {
            onMatchesUpdate(updatedMatches as any);
          }
        } catch (error) {
          console.error('❌ Erreur marquage live:', error);
        }
      };
      markAsLive();
    }
    
    console.log('🎮 Action envoyée:', type, payload);
    const next = reduce(state, { type, payload });
    console.log('🎮 Nouvel état:', next);
    console.log('🎮 Score après action:', next.score);
    setState(next);
    chan.publish(next, match);
    console.log('📡 État publié vers Display');
  }, [state, chan, match.id, match.org_id, onMatchesUpdate]);
  
  // Fonction de reset du match (mémorisée)
  const resetMatch = useCallback(async () => {
    if (!confirm('Êtes-vous sûr de vouloir remettre ce match à zéro ? Cela arrêtera le chronomètre et remettra les scores à 0.')) {
      return;
    }
    
    try {
      // Mise à jour immédiate de l'affichage
      setMatchStatus('scheduled');
      
      // Remettre le match en "scheduled" dans la base
      const { error } = await supa
        .from('matches')
        .update({ 
          status: 'scheduled',
          updated_at: new Date().toISOString()
        })
        .eq('id', match.id);
      
      if (error) {
        console.error('Erreur lors du reset:', error);
        alert(`Erreur lors du reset: ${error.message}`);
        return;
      }
      
      // Réinitialiser l'état local
      const key = `${match.org_id}:${match.id}`;
      const resetState = initMatchState(key, match.sport);
      setState(resetState);
      
      // Nettoyer le localStorage
      localStorage.removeItem(storageKey);
      
      // Publier le nouvel état
      if (chan) {
        chan.publish(resetState, match);
      }
      
      // Recharger les matchs pour mettre à jour la liste
      const { data: updatedMatches } = await supa
        .from('matches')
        .select('*')
        .eq('org_id', match.org_id)
        .order('scheduled_at', { ascending: true });
      if (updatedMatches) {
        onMatchesUpdate(updatedMatches as any);
      }
      
      console.log('Match remis à zéro avec succès');
      
    } catch (err) {
      console.error('Erreur inattendue:', err);
      alert(`Erreur inattendue: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    }
  }, [match.id, match.org_id, match.sport, chan]);

  // Fonction d'archivage (mémorisée)
  const archiveMatch = useCallback(async () => {
    if (!confirm('Êtes-vous sûr de vouloir archiver ce match ? Il sera déplacé dans la section des matchs archivés.')) {
      return;
    }
    
    setArchiving(true);
    // Mise à jour immédiate de l'affichage
    setMatchStatus('archived');
    
    try {
      const { error } = await supa
        .from('matches')
        .update({ 
          status: 'archived',
          updated_at: new Date().toISOString()
        })
        .eq('id', match.id);
      
      if (error) {
        console.error('Erreur lors de l\'archivage:', error);
        alert(`Erreur lors de l'archivage: ${error.message}`);
      } else {
        console.log('Match archivé avec succès');
        
        // Nettoyer le localStorage
        localStorage.removeItem(storageKey);
        
        // Recharger les matchs pour mettre à jour la liste
        const { data: updatedMatches } = await supa
          .from('matches')
          .select('*')
          .eq('org_id', match.org_id)
          .order('scheduled_at', { ascending: true });
        if (updatedMatches) {
          onMatchesUpdate(updatedMatches as any);
        }
        
        // Fermer le canal avant de retourner
        if (chan) chan.close();
        onBack();
      }
    } catch (err) {
      console.error('Erreur inattendue:', err);
      alert(`Erreur inattendue: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    }
    setArchiving(false);
  }, [match.id, match.org_id, chan, onBack, onMatchesUpdate, storageKey]);

  if (!state) {
    return (
      <div className="match-page">
        <div className="card">
          <div className="loading">Chargement du match...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="match-page">
      <div className="match-header">
        <button onClick={onBack} className="back-button">
          ← Retour à la liste
        </button>
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
                fontWeight: '600',
                marginLeft: '12px'
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
            title={state.clock.running ? "Arrêtez d'abord le chronomètre pour archiver" : "Archiver ce match (le rend inactif)"}
            style={{ 
              background: '#f59e0b', 
              borderColor: '#f59e0b',
              color: 'white',
              minHeight: '40px',
              cursor: state.clock.running ? 'not-allowed' : 'pointer',
              opacity: state.clock.running ? 0.6 : 1
            }}
          >
            {archiving ? '📦 Archivage...' : '📦 Archiver'}
          </button>
          <button 
            onClick={resetMatch}
            disabled={state.clock.running}
            title={state.clock.running ? "Arrêtez d'abord le chronomètre pour faire un reset" : "Remettre le match à zéro (le rend inactif)"}
            style={{ 
              background: '#dc2626', 
              borderColor: '#dc2626',
              color: 'white',
              minHeight: '40px',
              cursor: state.clock.running ? 'not-allowed' : 'pointer',
              opacity: state.clock.running ? 0.6 : 1
            }}
          >
            🔄 Reset
          </button>
        </div>
      </div>

      <div className="match-info">
        <div className="sport-display">
          <strong>Sport actuel:</strong> <span className="sport-badge">{state.sport}</span>
          <div style={{ marginTop: '8px', fontSize: '14px', color: '#9aa0a6' }}>
            <strong>Statut:</strong> {matchStarted ? '🔴 Match actif (temps réel)' : '⏸️ Match sélectionné (prêt)'}
          </div>
        </div>
      </div>

      <div className="match-content">
        <div className="main-score">
          <div className="team-score">
            <div className="team-name">{match.home_name}</div>
            <div className="score-display">
              {state.score.home.toString().padStart(2,'0')}
            </div>
          </div>
          <div className="score-vs">:</div>
          <div className="team-score">
            <div className="team-name">{match.away_name}</div>
            <div className="score-display">
              {state.score.away.toString().padStart(2,'0')}
            </div>
          </div>
        </div>
        
        {state.sport !== 'volleyball' && (
          <div className="time-controls">
            <button 
              className="primary" 
              onClick={() => send('clock:start')}
              title={state.clock.running ? "Le chronomètre tourne déjà" : 
                     (state.clock.remainingMs < state.clock.durationSec * 1000) ? "Reprendre le chronomètre" : 
                     "Démarrer le match (devient actif)"}
              disabled={state.clock.running}
            >
              ▶ {state.clock.running ? 'En cours...' : 
                  (state.clock.remainingMs < state.clock.durationSec * 1000) ? 'Reprendre' : 'Démarrer'}
            </button>
            <button className="danger" onClick={() => send('clock:stop')}>⏸</button>
            <button 
              onClick={() => {
                if (window.confirm('Êtes-vous sûr de vouloir remettre le chronomètre à zéro ?\n\nCela remettra le temps à sa valeur initiale selon le sport sélectionné.')) {
                  send('clock:reset');
                }
              }}
              disabled={state.clock.running}
              title={state.clock.running ? "Arrêtez d'abord le chronomètre pour le remettre à zéro" : "Remettre le chronomètre à sa valeur initiale"}
              style={{
                background: state.clock.running ? '#6b7280' : '#f59e0b',
                borderColor: state.clock.running ? '#6b7280' : '#f59e0b',
                color: 'white',
                cursor: state.clock.running ? 'not-allowed' : 'pointer',
                opacity: state.clock.running ? 0.6 : 1
              }}
            >
              🔄 Reset Chrono
            </button>
            <div className="time-display">
              {Math.floor(state.clock.remainingMs/60000).toString().padStart(2,'0')}:
              {Math.floor((state.clock.remainingMs%60000)/1000).toString().padStart(2,'0')}
            </div>
            <div className="period-display">Période {state.clock.period}</div>
            <button onClick={() => send('period:next')}>Période +1</button>
            <button onClick={() => send('period:prev')}>Période -1</button>
          </div>
        )}
        
        <div className="controls-section">
          <Panel state={state} send={send} />
        </div>

        {displayUrl && (
          <div className="display-link">
            <div className="small">
              <div style={{ marginBottom: '8px' }}>
                <strong>Statut :</strong> <span style={{ color: connectionStatus.includes('connecté') || connectionStatus.includes('prêt') ? '#4ade80' : '#fbbf24' }}>{connectionStatus}</span>
              </div>
              <div style={{ marginBottom: '8px', fontSize: '12px', color: '#9aa0a6' }}>
                {matchStarted ? '🔴 Affichage temps réel actif' : '⏸️ Affichage statique (scores visibles)'}
              </div>
              <strong>Lien Display :</strong> 
              <a href={displayUrl} target="_blank" rel="noopener noreferrer">
                {displayUrl}
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}