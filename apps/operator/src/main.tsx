import React, { useEffect, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { supa } from './supabase';
import { SpacePage } from './pages/SpacePage';
import { MatchPage } from './pages/MatchPage';
import type { MatchInfo } from '@pkg/types';
import './theme.css';

console.log('🚀 Operator - Démarrage de l\'application');

function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<'super_admin' | 'operator' | null>(null);
  const [org, setOrg] = useState<any>(null);
  const [matches, setMatches] = useState<MatchInfo[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchInfo | null>(null);
  const [error, setError] = useState<string>('');
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [authLoading, setAuthLoading] = useState(false);

  // Un match est actif seulement s'il a le statut 'live' (chronomètre démarré)
  const activeMatch = matches.find(m => m.status === 'live') || null;

  // Vérifier la session au démarrage et écouter les changements d'état
  useEffect(() => {
    console.log('🔐 Auth - Vérification de la session');
    checkSession();

    // Timeout de sécurité : si après 10s on est toujours en chargement, on affiche la page de connexion
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('⚠️ Auth - Timeout de la vérification de session, affichage de la page de connexion');
        setLoading(false);
      }
    }, 10000);

    // Écouter les changements d'état d'authentification
    const { data: { subscription } } = supa.auth.onAuthStateChange((event, session) => {
      (async () => {
        console.log('🔄 Auth - Changement d\'état:', event);

        if (event === 'SIGNED_OUT') {
          console.log('👋 Auth - Déconnexion détectée');
          setUser(null);
          setOrg(null);
          setMatches([]);
          setSelectedMatch(null);
          setError('');
          setLoading(false);
        } else if (event === 'SIGNED_IN' && session?.user) {
          console.log('✅ Auth - Connexion détectée');
          setUser(session.user);
          await loadUserData(session.user);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          console.log('🔄 Auth - Token rafraîchi');
          setUser(session.user);
        }
      })();
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  async function checkSession() {
    try {
      console.log('🔄 Auth - Appel getSession()...');
      const { data: { session }, error } = await supa.auth.getSession();
      console.log('📦 Auth - Réponse getSession:', { session: !!session, error: !!error });

      if (error) {
        console.error('❌ Auth - Erreur session:', error);
        setError(`Erreur de session: ${error.message}`);
        setLoading(false);
        return;
      }

      if (session?.user) {
        console.log('✅ Auth - Session trouvée:', session.user.email);
        setUser(session.user);
        await loadUserData(session.user);
      } else {
        console.log('ℹ️ Auth - Aucune session active, affichage de la page de connexion');
        setLoading(false);
      }
    } catch (err) {
      console.error('💥 Auth - Erreur inattendue:', err);
      setError(`Erreur inattendue: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
      setLoading(false);
    }
  }

  async function loadUserData(user: any) {
    try {
      console.log('👤 User - Chargement des données pour:', user.email);
      
      // Charger les organisations de l'utilisateur
      const { data: orgMembers, error: orgError } = await supa
        .from('org_members_with_org')
        .select('*')
        .eq('user_id', user.id);

      if (orgError) {
        console.error('❌ Orgs - Erreur:', orgError);
        setError(`Erreur organisations: ${orgError.message}`);
        setLoading(false);
        return;
      }

      console.log('🏢 Orgs - Trouvées:', orgMembers?.length || 0);

      if (!orgMembers || orgMembers.length === 0) {
        setError('Aucune organisation trouvée pour cet utilisateur. Contactez un administrateur.');
        setLoading(false);
        return;
      }

      // Prendre la première organisation et détecter le rôle
      const firstOrg = orgMembers[0];
      const role = firstOrg.role as 'super_admin' | 'operator';

      console.log('👤 User - Rôle détecté:', role);
      setUserRole(role);

      const orgData = {
        id: firstOrg.org_id,
        slug: firstOrg.org_slug,
        name: firstOrg.org_name,
        display_token: firstOrg.org_display_token
      };

      console.log('🏢 Org - Sélectionnée:', orgData.name);
      console.log('🔗 Display URL:', `/display/${orgData.display_token}`);
      setOrg(orgData);

      // Charger les matchs de cette organisation
      await loadMatches(orgData.id);

      setLoading(false);
    } catch (err) {
      console.error('💥 User - Erreur inattendue:', err);
      setError(`Erreur chargement utilisateur: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
      setLoading(false);
    }
  }

  async function loadMatches(orgId: string) {
    try {
      console.log('⚽ Matches - Chargement pour org:', orgId);
      
      const { data, error } = await supa
        .from('matches')
        .select('*')
        .eq('org_id', orgId)
        .order('scheduled_at', { ascending: true });

      if (error) {
        console.error('❌ Matches - Erreur:', error);
        setError(`Erreur matchs: ${error.message}`);
        return;
      }

      console.log('📋 Matches - Chargés:', data?.length || 0);
      setMatches((data as any) || []);
    } catch (err) {
      console.error('💥 Matches - Erreur inattendue:', err);
      setError(`Erreur chargement matchs: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    }
  }

  async function handleAuth() {
    if (!credentials.email || !credentials.password) {
      setError('Email et mot de passe requis');
      return;
    }

    setAuthLoading(true);
    setError('');

    try {
      console.log('🔐 Auth - Tentative de connexion:', credentials.email);
      const result = await supa.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password
      });

      if (result.error) {
        console.error('❌ Auth - Erreur:', result.error);
        setError(result.error.message);
        setAuthLoading(false);
        return;
      }

      if (result.data.user) {
        console.log('✅ Auth - Succès:', result.data.user.email);
        setUser(result.data.user);
        await loadUserData(result.data.user);
      }
    } catch (err) {
      console.error('💥 Auth - Erreur inattendue:', err);
      setError(`Erreur authentification: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    }
    
    setAuthLoading(false);
  }

  // Fonction simple pour sélectionner un match
  const handleMatchSelect = useCallback((match: MatchInfo) => {
    console.log('🎯 Sélection du match:', match.name);
    console.log('🎯 Main - Avant setSelectedMatch, selectedMatch actuel:', selectedMatch?.name || 'null');
    
    // Empêcher la sélection d'un autre match si un match est déjà actif
    if (activeMatch && activeMatch.id !== match.id) {
      console.log('❌ Impossible de sélectionner un autre match - Match actif:', activeMatch.name);
      alert(`Impossible de sélectionner un autre match.\nLe match "${activeMatch.name}" est actuellement actif.\n\nVeuillez d'abord l'arrêter ou le remettre à zéro.`);
      return;
    }
    
    setSelectedMatch(match);
    console.log('🎯 Main - Après setSelectedMatch');
  }, [selectedMatch, activeMatch]);

  // Fonction simple pour retourner à la liste
  const handleBackToList = useCallback(() => {
    console.log('🔙 Retour à la liste des matchs');
    console.log('🔙 Main - Avant setSelectedMatch(null), selectedMatch actuel:', selectedMatch?.name || 'null');
    
    // Si un match est actif, on peut revenir à la liste mais on garde le match sélectionné
    if (activeMatch) {
      console.log('ℹ️ Match actif détecté - Retour à la liste mais match reste sélectionnable');
    }
    
    setSelectedMatch(null);
    console.log('🔙 Main - Après setSelectedMatch(null)');
  }, [selectedMatch, activeMatch]);

  // Fonction pour mettre à jour la liste des matchs
  const handleMatchesUpdate = useCallback((updatedMatches: MatchInfo[]) => {
    console.log('📋 Mise à jour des matchs:', updatedMatches.length);
    setMatches(updatedMatches);
  }, []);

  // Écran de chargement
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#0b0b0c',
        color: '#eaeaea',
        fontFamily: 'Inter, ui-sans-serif, system-ui'
      }}>
        <div style={{
          background: '#111214',
          border: '1px solid #1b1c1f',
          borderRadius: '14px',
          padding: '40px',
          textAlign: 'center',
          maxWidth: '400px'
        }}>
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>⚽</div>
          <div style={{ fontSize: '18px', marginBottom: '8px' }}>Chargement...</div>
          <div style={{ fontSize: '14px', color: '#9aa0a6' }}>
            Vérification de la session
          </div>
        </div>
      </div>
    );
  }

  // Écran d'authentification
  if (!user) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#0b0b0c',
        color: '#eaeaea',
        fontFamily: 'Inter, ui-sans-serif, system-ui'
      }}>
        <div style={{
          background: '#111214',
          border: '1px solid #1b1c1f',
          borderRadius: '14px',
          padding: '40px',
          width: '100%',
          maxWidth: '400px'
        }}>
          <h1 style={{ 
            fontSize: '28px', 
            margin: '0 0 24px 0',
            textAlign: 'center',
            background: 'linear-gradient(135deg, #36ffb5, #2563eb)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            ⚽ Scoreboard Pro
          </h1>
          
          <div style={{ marginBottom: '24px' }}>
            <div style={{ 
              textAlign: 'center', 
              marginBottom: '16px',
              padding: '12px',
              background: 'rgba(37, 99, 235, 0.1)',
              border: '1px solid rgba(37, 99, 235, 0.3)',
              borderRadius: '8px',
              fontSize: '14px',
              color: '#9aa0a6'
            }}>
              🔐 Connexion réservée aux utilisateurs autorisés
              <br />
              <span style={{ fontSize: '12px', color: '#6b7280' }}>
                Les comptes sont créés par l'administrateur système
              </span>
            </div>
            
            <input
              type="email"
              placeholder="Email"
              value={credentials.email}
              onChange={e => setCredentials(prev => ({ ...prev, email: e.target.value }))}
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '12px',
                background: '#121316',
                border: '1px solid #202327',
                borderRadius: '8px',
                color: '#eaeaea',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
              disabled={authLoading}
            />
            
            <input
              type="password"
              placeholder="Mot de passe"
              value={credentials.password}
              onChange={e => setCredentials(prev => ({ ...prev, password: e.target.value }))}
              onKeyPress={e => e.key === 'Enter' && handleAuth()}
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '16px',
                background: '#121316',
                border: '1px solid #202327',
                borderRadius: '8px',
                color: '#eaeaea',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
              disabled={authLoading}
            />
            
            <button
              onClick={handleAuth}
              disabled={authLoading || !credentials.email || !credentials.password}
              style={{
                width: '100%',
                padding: '12px',
                background: authLoading ? '#6b7280' : '#2563eb',
                border: `1px solid ${authLoading ? '#6b7280' : '#2563eb'}`,
                color: 'white',
                borderRadius: '8px',
                cursor: authLoading ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: '500'
              }}
            >
              {authLoading ? 'Connexion en cours...' : 'Se connecter'}
            </button>
          </div>
          
          {error && (
            <div style={{
              background: 'rgba(255, 107, 107, 0.1)',
              border: '1px solid rgba(255, 107, 107, 0.3)',
              color: '#ff6b6b',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '14px',
              marginTop: '16px'
            }}>
              {error}
            </div>
          )}
          
          <div style={{
            fontSize: '12px',
            color: '#6b7280',
            textAlign: 'center',
            marginTop: '16px'
          }}>
            Besoin d'un compte ? Contactez votre administrateur système
          </div>
        </div>
      </div>
    );
  }

  // Interface principale
  if (selectedMatch) {
    console.log('🎮 Main - Affichage de MatchPage pour:', selectedMatch.name);
    console.log('🎮 Main - selectedMatch object:', selectedMatch);
    console.log('🎮 Main - activeMatch object:', activeMatch);
    return (
      <MatchPage
        match={selectedMatch}
        onBack={handleBackToList}
        activeMatch={activeMatch}
        onMatchesUpdate={handleMatchesUpdate}
      />
    );
  }

  console.log('🏠 Main - Affichage de SpacePage');
  console.log('🏠 Main - selectedMatch is null, showing SpacePage');
  return (
    <SpacePage
      user={user}
      org={org}
      matches={matches}
      onMatchSelect={handleMatchSelect}
      onMatchesUpdate={handleMatchesUpdate}
      activeMatch={activeMatch}
    />
  );
}

console.log('🎯 Main - Création du root React');
const root = createRoot(document.getElementById('root')!);
root.render(<App />);
console.log('🚀 Main - Application React montée');