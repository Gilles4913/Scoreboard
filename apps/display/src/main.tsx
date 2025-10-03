import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { MatchState } from '@pkg/types';
import { applyTheme, type ThemeName } from './themes';
import './theme.css';
import { Scoreboard } from './components/Scoreboard';
import { connectDisplay } from './realtime';
import { applyTick } from '@pkg/logic';
import { createClient } from '@supabase/supabase-js';

function App(){
  const p = new URLSearchParams(location.search);
  // Extraire le display_token de l'URL : /display/:token ou ?token=xxx
  const urlPath = location.pathname.split('/');
  const displayToken = urlPath[urlPath.length - 1] !== 'display' ? urlPath[urlPath.length - 1] : p.get('token');

  const [currentMatch, setCurrentMatch] = useState<any>(null);
  const [homeName, setHome] = useState('HOME');
  const [awayName, setAway] = useState('AWAY');
  const [homeLogo] = useState<string | null>(p.get('homeLogo'));
  const [awayLogo] = useState<string | null>(p.get('awayLogo'));
  const [theme, setTheme] = useState<ThemeName>((p.get('theme') as ThemeName) || 'neon');
  const [ui] = useState(p.get('ui') === '1');
  const [state, setState] = useState<MatchState|null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('En attente de sélection de match...');
  const [displayConnection, setDisplayConnection] = useState<any>(null);
  const [envError, setEnvError] = useState<string>('');
  const [supa, setSupa] = useState<any>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(()=>{ applyTheme(theme); }, [theme]);
  
  // Vérifier la configuration au démarrage et récupérer l'org_id depuis le display_token
  useEffect(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      setEnvError('Configuration Supabase manquante');
      return;
    }

    if (supabaseUrl.includes('your_supabase') || supabaseKey.includes('your_supabase')) {
      setEnvError('Configuration Supabase invalide');
      return;
    }

    setDebugInfo(`Config OK - URL: ${supabaseUrl.substring(0, 30)}...`);

    // Créer le client Supabase
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });
    setSupa(supabaseClient);

    // Si un display_token est fourni, récupérer l'organisation correspondante
    if (displayToken && displayToken !== 'display') {
      console.log('Display - Token détecté:', displayToken);
      setConnectionStatus(`Identification de l'Espace via token...`);

      supabaseClient
        .from('orgs')
        .select('id, name, slug')
        .eq('display_token', displayToken)
        .single()
        .then(({ data, error }) => {
          if (error || !data) {
            console.error('Display - Erreur token invalide:', error);
            setEnvError(`Token d'affichage invalide. Vérifiez l'URL.`);
            setDebugInfo(`Token invalide: ${displayToken}`);
          } else {
            console.log('Display - Organisation trouvée:', data);
            setOrgId(data.id);
            setDebugInfo(`Espace: ${data.name}`);
            setConnectionStatus(`Connecté à l'Espace: ${data.name}`);
          }
        });
    }
  }, [displayToken]);

  // Écouter les matchs actifs depuis la base de données (sans authentification)
  useEffect(()=>{
    if (envError || !supa) return;

    // Si un display_token est fourni, attendre que l'org_id soit récupéré
    if (displayToken && displayToken !== 'display' && !orgId) {
      console.log('Display - En attente de l\'identification de l\'Espace...');
      return;
    }

    setConnectionStatus('Recherche de match actif...');

    // Vérifier s'il y a un match actif périodiquement
    checkForActiveMatch();
    const interval = setInterval(checkForActiveMatch, 5000); // Vérifier toutes les 5 secondes

    async function checkForActiveMatch() {
      try {
        console.log('Display - Recherche de match actif...');
        setDebugInfo('Recherche de matchs sélectionnés...');

        // Construire la requête de base
        let query = supa
          .from('matches')
          .select('*')
          .eq('public_display', true)
          .in('status', ['live', 'scheduled']);

        // Si un orgId est défini (via display_token), filtrer uniquement les matchs de cet Espace
        if (orgId) {
          console.log('Display - Filtrage par organisation:', orgId);
          query = query.eq('org_id', orgId);
        }

        const { data: matches, error } = await query
          .order('updated_at', { ascending: false })
          .limit(10);
        
        if (error) {
          console.error('Display - Erreur requête:', error);
          setConnectionStatus(`Erreur DB: ${error.message}`);
          setDebugInfo(`Erreur DB: ${error.message}`);
          return;
        }
        
        console.log('Display - Matchs publics trouvés:', matches);
        setDebugInfo(`Matchs trouvés: ${matches?.length || 0}`);

        if (matches && matches.length > 0) {
          // Chercher d'abord un match "live" (actif)
          let match = matches.find(m => m.status === 'live');
          
          // Sinon prendre le plus récemment modifié (sélectionné)
          if (!match) {
            match = matches[0];
          }
          
          // Ne se connecter que si c'est un nouveau match
          if (!currentMatch || currentMatch.id !== match.id) {
            console.log('Display - Nouveau match sélectionné:', match);
            setCurrentMatch(match);
            setDebugInfo(`Match sélectionné: ${match.name} (${match.status})`);
            setHome(match.home_name);
            setAway(match.away_name);
            
            // Créer un état initial basé sur le sport du match
            const initialState: MatchState = {
              matchId: match.id,
              sport: match.sport,
              clock: {
                durationSec: getDefaultDuration(match.sport),
                remainingMs: getDefaultDuration(match.sport) * 1000,
                running: match.status === 'live', // Seulement si le match est actif
                period: 1
              },
              score: { home: 0, away: 0 },
              meta: getDefaultMeta(match.sport)
            };
            
            setState(initialState);
            connectToMatch(match);
            
            // Mettre à jour le statut de connexion
            if (match.status === 'live') {
              setConnectionStatus(`🔴 Match actif: ${match.name}`);
            } else {
              setConnectionStatus(`⏸️ Match sélectionné: ${match.name}`);
            }
          }
        } else {
          console.log('Display - Aucun match public trouvé');
          setConnectionStatus('Aucun match sélectionné');
          setDebugInfo('Aucun match public disponible');
          if (currentMatch) {
            setState(null);
            setCurrentMatch(null);
          }
        }
      } catch (error) {
        console.error('Display - Erreur lors de la recherche de match:', error);
        setConnectionStatus(`Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
        setDebugInfo(`Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
      }
    }

    function connectToMatch(match: any) {
      // Fermer la connexion précédente si elle existe
      if (displayConnection) {
        console.log('Display - Fermeture de la connexion précédente');
        displayConnection.close();
      }

      const statusPrefix = match.status === 'live' ? '🔴' : '⏸️';
      setConnectionStatus(`${statusPrefix} Connexion: ${match.name}...`);
      
      const conn = connectDisplay(
        match.org_slug || 'org',
        match.id, 
        match.display_token, 
        (s: MatchState, info: any) => {
          console.log('Display - État reçu:', s, info);
          const statusPrefix = s.clock.running ? '🔴' : '⏸️';
          setConnectionStatus(`${statusPrefix} Connecté - ${match.name}`);
          setState(s);
          if (info) { 
            setHome(info.home_name || match.home_name); 
            setAway(info.away_name || match.away_name); 
          }
        }
      );
      
      setDisplayConnection(conn);
    }

    return () => {
      clearInterval(interval);
      if (displayConnection) {
        displayConnection.close();
      }
    };
  }, [displayConnection, supa, currentMatch, orgId]);

  // Fonctions utilitaires pour l'initialisation des états
  function getDefaultDuration(sport: string): number {
    switch(sport) {
      case 'football': return 45 * 60; // 45 minutes
      case 'handball': return 30 * 60; // 30 minutes
      case 'basket': return 10 * 60; // 10 minutes
      case 'hockey_ice': return 20 * 60; // 20 minutes
      case 'hockey_field': return 15 * 60; // 15 minutes
      case 'volleyball': return 0; // Pas de temps
      default: return 10 * 60; // 10 minutes par défaut
    }
  }

  function getDefaultMeta(sport: string): any {
    switch(sport) {
      case 'volleyball':
        return {
          currentSet: 1,
          bestOf: 5,
          setsWon: { home: 0, away: 0 },
          pointsToWin: 25,
          tieBreakPoints: 15,
          winBy: 2,
          serve: 'home',
          timeouts: { home: 0, away: 0 },
          maxTimeoutsPerSet: 2
        };
      case 'football':
        return {
          stoppageMin: 0,
          cards: { home: { yellow: 0, red: 0 }, away: { yellow: 0, red: 0 } },
          shootout: { inProgress: false, home: [], away: [] }
        };
      case 'handball':
        return {
          timeouts: { home: 0, away: 0, maxPerTeam: 3 },
          suspensions: { home: [], away: [] }
        };
      case 'basket':
        return {
          foulLimitPerPlayer: 5,
          teamFouls: { home: 0, away: 0 },
          bonusThreshold: 5,
          timeoutsLeft: { home: 5, away: 5 },
          shotClockMs: 24000,
          shotRunning: false,
          roster: {
            home: [
              { num: 4, fouls: 0 }, { num: 5, fouls: 0 }, { num: 6, fouls: 0 },
              { num: 7, fouls: 0 }, { num: 8, fouls: 0 }
            ],
            away: [
              { num: 9, fouls: 0 }, { num: 10, fouls: 0 }, { num: 11, fouls: 0 },
              { num: 12, fouls: 0 }, { num: 13, fouls: 0 }
            ]
          }
        };
      case 'hockey_ice':
        return { penalties: { home: [], away: [] } };
      case 'hockey_field':
        return {
          cards: { home: { green: 0, yellow: 0, red: 0 }, away: { green: 0, yellow: 0, red: 0 } },
          suspensions: { home: [], away: [] }
        };
      default:
        return {};
    }
  }

  // Gestion du tick pour les horloges
  useEffect(() => { 
    if (!state?.matchId) return; 
    const id = setInterval(() => setState(prev => prev ? applyTick(prev) : prev), 100); 
    return () => clearInterval(id); 
  }, [state?.matchId]);

  // Écouter les paramètres URL pour les cas spécifiques
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const org = p.get('org');
    const match = p.get('match');
    const token = p.get('token');
    
    if (org && match && token) {
      console.log('Display - Connexion directe via URL:', { org, match, token });
      setConnectionStatus('Connexion directe...');
      
      if (displayConnection) {
        displayConnection.close();
      }
      
      const conn = connectDisplay(org, match, token, (s: MatchState, info: any) => {
        console.log('Display - État reçu (URL directe):', s, info);
        setConnectionStatus('Connecté - Lien direct');
        setState(s);
        if (info) { 
          setHome(info.home_name || p.get('home') || 'HOME'); 
          setAway(info.away_name || p.get('away') || 'AWAY'); 
        }
      });
      
      setDisplayConnection(conn);
    }
  }, [location.search]);

  function toggleFullscreen(){
    const el: any = document.documentElement;
    if (!document.fullscreenElement) el.requestFullscreen?.(); else document.exitFullscreen?.();
  }

  return (<div className="board">
    {state && <Scoreboard state={state} homeName={homeName} awayName={awayName} homeLogo={homeLogo||undefined} awayLogo={awayLogo||undefined}/>}
    {!state && !envError && currentMatch && (
      <div style={{ 
        position: 'fixed', 
        top: '50%', 
        left: '50%', 
        transform: 'translate(-50%, -50%)', 
        background: 'rgba(0,0,0,0.8)', 
        color: 'white', 
        padding: '30px', 
        borderRadius: '15px',
        textAlign: 'center',
        maxWidth: '400px'
      }}>
        <div style={{ fontSize: '24px', marginBottom: '15px' }}>⚽ Scoreboard Pro</div>
        <div style={{ color: '#9aa0a6', marginBottom: '10px' }}>Statut: {connectionStatus}</div>
        <div style={{ fontSize: '14px', color: '#4ade80', marginTop: '10px' }}>
          Match détecté: {currentMatch.name}
          <br />
          {currentMatch.home_name} vs {currentMatch.away_name}
          <br />
          <span style={{ 
            color: currentMatch.status === 'live' ? '#ff6b6b' : '#fbbf24',
            fontWeight: 'bold'
          }}>
            {currentMatch.status === 'live' ? '🔴 ACTIF' : '⏸️ SÉLECTIONNÉ'}
          </span>
        </div>
        <div style={{ fontSize: '12px', marginTop: '15px', color: '#666' }}>
          Debug: {debugInfo}
        </div>
        <div style={{ fontSize: '12px', marginTop: '15px', color: '#666' }}>
          Le tableau de bord s'affiche automatiquement<br />
          dès qu'un match est sélectionné dans l'Operator
        </div>
      </div>
    )}
    {!state && !envError && !currentMatch && (
      <div className="scoreboard-container">
        {/* Header par défaut */}
        <div className="scoreboard-header">
          <div className="period-info">
            <span className="period-label">PÉRIODE</span>
            <span className="period-number">1</span>
          </div>
          
          <div className="time-info">
            <span className="time-display">00:00</span>
            <div className="time-indicator paused"></div>
          </div>
        </div>

        {/* Score par défaut */}
        <div className="main-scoreboard">
          <div className="team-section home">
            <div className="team-info">
              <div className="team-name">
                <div className="team-logo-inline">
                  <div className="logo-placeholder-inline">🏟</div>
                </div>
                HOME
              </div>
            </div>
            <div className="score-display">0</div>
          </div>

          <div className="vs-separator">
            <div className="vs-text">VS</div>
          <div className="team-section away">
            <div className="team-info">
              <div className="team-name">
                <div className="team-logo-inline">
                  <div className="logo-placeholder-inline">🏟</div>
                </div>
                AWAY
              </div>
            </div>
            <div className="score-display">0</div>
          </div>
        </div>
          </div>
        {/* Message d'attente */}
        <div className="stats-section">
          <div style={{ 
            textAlign: 'center', 
            padding: '40px',
            background: 'rgba(37, 99, 235, 0.1)',
            border: '1px solid rgba(37, 99, 235, 0.3)',
            borderRadius: '12px',
            margin: '20px'
          }}>
            <div style={{ fontSize: '24px', marginBottom: '16px', color: '#2563eb' }}>
              ⚽ Scoreboard Pro
            </div>
            <div style={{ fontSize: '16px', color: '#9aa0a6', marginBottom: '12px' }}>
              En attente de sélection de match
            </div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              Le tableau de bord s'activera automatiquement<br />
              dès qu'un match sera sélectionné dans l'Operator
            </div>
            <div style={{ fontSize: '12px', color: '#4b5563', marginTop: '16px' }}>
              Statut: {connectionStatus}
            </div>
          </div>
        </div>
      </div>
    )}
    {envError && (
      <div style={{ 
        position: 'fixed', 
        top: '50%', 
        left: '50%', 
        transform: 'translate(-50%, -50%)', 
        background: 'rgba(0,0,0,0.9)', 
        color: 'white', 
        padding: '30px', 
        borderRadius: '15px',
        textAlign: 'center',
        maxWidth: '400px'
      }}>
        <div style={{ fontSize: '24px', marginBottom: '15px', color: '#ff6b6b' }}>⚙️ Configuration requise</div>
        <div style={{ color: '#ff6b6b', marginBottom: '10px' }}>{envError}</div>
        <div style={{ fontSize: '12px', marginTop: '15px', color: '#666' }}>
          Veuillez configurer le fichier .env<br />
          avec vos clés Supabase
        </div>
      </div>
    )}
    <div className={ui ? 'toolbar' : 'toolbar hidden'}>
      <select value={theme} onChange={e=>setTheme(e.target.value as ThemeName)}>
        <option value="neon">Neon</option><option value="glass">Glass</option><option value="classic">Classic</option>
      </select>
      <button onClick={()=>toggleFullscreen()}>Plein écran (F)</button>
      <button onClick={() => window.location.reload()}>🔄 Recharger</button>
    </div>
  </div>);
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);