import React, { useEffect, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { supa } from './supabase';
import { SpacePage } from './pages/SpacePage';
import { MatchPage } from './pages/MatchPage';
import SuperAdminPage from './pages/SuperAdminPage'; // ← à créer si pas encore fait
import type { MatchInfo } from '@pkg/types';
import './theme.css';

console.log('🚀 Operator - Démarrage de l’application');

function App() {
  // ---- État global appli ----
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  // Rôle / routage
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);

  // Contexte opérateur
  const [org, setOrg] = useState<any>(null);
  const [matches, setMatches] = useState<MatchInfo[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchInfo | null>(null);

  // Auth UI
  const [error, setError] = useState<string>('');
  const [authStep, setAuthStep] = useState<'login' | 'register'>('login');
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [authLoading, setAuthLoading] = useState(false);

  // Un match est actif seulement s'il a le statut 'live' (chronomètre démarré)
  const activeMatch = matches.find(m => m.status === 'live') || null;

  // ---- Démarrage : vérifier la session ----
  useEffect(() => {
    console.log('🔐 Auth - Vérification de la session');
    checkSession();
  }, []);

  async function checkSession() {
    try {
      const { data: { session }, error } = await supa.auth.getSession();

      if (error) {
        console.error('❌ Auth - Erreur session:', error);
        setError(`Erreur de session: ${error.message}`);
        setLoading(false);
        return;
      }

      if (session?.user) {
        console.log('✅ Auth - Session trouvée:', session.user.email);
        setUser(session.user);
        await loadUserBootstrap(session.user);
      } else {
        console.log('ℹ️ Auth - Aucune session active');
        setLoading(false);
      }
    } catch (err) {
      console.error('💥 Auth - Erreur inattendue:', err);
      setError(`Erreur inattendue: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
      setLoading(false);
    }
  }

  // Charge rôle + données nécessaires
  async function loadUserBootstrap(currentUser: any) {
    try {
      console.log('👤 User - Chargement du rôle pour:', currentUser.email);

      // 1) Vérifier super admin (RPC SQL côté DB)
      const { data: isAdmin, error: rpcError } = await supa.rpc('is_super_admin', { uid: currentUser.id });
      if (rpcError) {
        console.error('❌ Rôle - Erreur RPC is_super_admin:', rpcError);
      }
      const admin = !!isAdmin;
      setIsSuperAdmin(admin);

      // 2) Pour un super admin, on peut s’arrêter là (routage direct vers page Admin)
      if (admin) {
        console.log('🛡️ Rôle - Super Admin détecté → routage /admin');
        setLoading(false);
        return;
      }

      // 3) Sinon, charger les organisations de l’opérateur
      console.log('🏢 Orgs - Chargement des organisations de l’utilisateur');
      const { data: orgMembers, error: orgError } = await supa
        .from('org_members_with_org')
        .select('*')
        .eq('user_id', currentUser.id);

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

      // Prendre la première organisation (ou afficher un picker si besoin)
      const firstOrg = orgMembers[0];
      const orgData = {
        id: firstOrg.org_id,
        slug: firstOrg.org_slug,
        name: firstOrg.org_name
      };

      console.log('🏢 Org - Sélectionnée:', orgData.name);
      setOrg(orgData);

      // 4) Charger les matchs de cette organisation (opérateur)
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

  // ---- Auth actions ----
  async function handleAuth() {
    if (!credentials.email || !credentials.password) {
      setError('Email et mot de passe requis');
      return;
    }

    setAuthLoading(true);
    setError('');

    try {
      let result;

      if (authStep === 'login') {
        console.log('🔐 Auth - Tentative de connexion:', credentials.email);
        result = await supa.auth.signInWithPassword({
          email: credentials.email,
          password: credentials.password
        });
      } else {
        console.log('📝 Auth - Tentative d’inscription:', credentials.email);
        result = await supa.auth.signUp({
          email: credentials.email,
          password: credentials.password
        });
      }

      if (result.error) {
        console.error('❌ Auth - Erreur:', result.error);
        setError(result.error.message);
        setAuthLoading(false);
        return;
      }

      if (result.data.user) {
        console.log('✅ Auth - Succès:', result.data.user.email);
        setUser(result.data.user);
        await loadUserBootstrap(result.data.user);
      }
    } catch (err) {
      console.error('💥 Auth - Erreur inattendue:', err);
      setError(`Erreur authentification: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    }

    setAuthLoading(false);
  }

  // ---- Sélection / retour ----
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

  const handleBackToList = useCallback(() => {
    console.log('🔙 Retour à la liste des matchs');
    console.log('🔙 Main - Avant setSelectedMatch(null), selectedMatch actuel:', selectedMatch?.name || 'null');

    // Si un match est actif, on peut revenir à la liste mais on garde la contrainte de blocage
    if (activeMatch) {
      console.log('ℹ️ Match actif détecté - Retour à la liste (autres matchs restent bloqués)');
    }

    setSelectedMatch(null);
    console.log('🔙 Main - Après setSelectedMatch(null)');
  }, [selectedMatch, activeMatch]);

  const handleMatchesUpdate = useCallback((updatedMatches: MatchInfo[]) => {
    console.log('📋 Mise à jour des matchs:', updatedMatches.length);
    setMatches(updatedMatches);
  }, []);

  // ---- Rendu ----

  // 1) Écran de chargement
  if (loading) {
    return (
      <div style={screenStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 24, marginBottom: 16 }}>⚽</div>
          <div style={{ fontSize: 18, marginBottom: 8 }}>Chargement…</div>
          <div style={{ fontSize: 14, color: '#9aa0a6' }}>Vérification de la session</div>
        </div>
      </div>
    );
  }

  // 2) Écran d’auth
  if (!user) {
    return (
      <div style={screenStyle}>
        <div style={{ ...cardStyle, width: '100%', maxWidth: 400 }}>
          <h1 style={titleGradient}>⚽ Scoreboard Pro</h1>

          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button
                onClick={() => setAuthStep('login')}
                style={tabBtn(authStep === 'login')}
              >
                Connexion
              </button>
              <button
                onClick={() => setAuthStep('register')}
                style={tabBtn(authStep === 'register')}
              >
                Inscription
              </button>
            </div>

            <input
              type="email"
              placeholder="Email"
              value={credentials.email}
              onChange={e => setCredentials(prev => ({ ...prev, email: e.target.value }))}
              style={inputStyle}
              disabled={authLoading}
            />

            <input
              type="password"
              placeholder="Mot de passe"
              value={credentials.password}
              onChange={e => setCredentials(prev => ({ ...prev, password: e.target.value }))}
              onKeyPress={e => e.key === 'Enter' && handleAuth()}
              style={{ ...inputStyle, marginBottom: 16 }}
              disabled={authLoading}
            />

            <button
              onClick={handleAuth}
              disabled={authLoading || !credentials.email || !credentials.password}
              style={primaryBtn(!authLoading)}
            >
              {authLoading ? 'Chargement…' : (authStep === 'login' ? 'Se connecter' : 'S’inscrire')}
            </button>
          </div>

          {error && (
            <div style={errorBox}>
              {error}
            </div>
          )}

          <div style={smallMuted}>
            {authStep === 'login' ? 'Pas de compte ?' : 'Déjà un compte ?'}
            <button
              onClick={() => setAuthStep(authStep === 'login' ? 'register' : 'login')}
              style={linkBtn}
            >
              {authStep === 'login' ? 'S’inscrire' : 'Se connecter'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3) Rôle : Super Admin → page d’admin
  if (isSuperAdmin) {
    console.log('🛠️ Main - Affichage de SuperAdminPage');
    return <SuperAdminPage />;
  }

  // 4) Flux opérateur
  if (selectedMatch) {
    console.log('🎮 Main - Affichage de MatchPage pour:', selectedMatch.name);
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

// ---- Styles inline (cohérents avec le reste du projet) ----
const screenStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  background: '#0b0b0c',
  color: '#eaeaea',
  fontFamily: 'Inter, ui-sans-serif, system-ui'
};

const cardStyle: React.CSSProperties = {
  background: '#111214',
  border: '1px solid #1b1c1f',
  borderRadius: 14,
  padding: 40,
  textAlign: 'center',
  maxWidth: 400
};

const titleGradient: React.CSSProperties = {
  fontSize: 28,
  margin: '0 0 24px 0',
  textAlign: 'center',
  background: 'linear-gradient(135deg, #36ffb5, #2563eb)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text'
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 12,
  marginBottom: 12,
  background: '#121316',
  border: '1px solid #202327',
  borderRadius: 8,
  color: '#eaeaea',
  fontSize: 16,
  boxSizing: 'border-box' as const
};

const tabBtn = (active: boolean): React.CSSProperties => ({
  flex: 1,
  padding: '8px 16px',
  background: active ? '#2563eb' : '#374151',
  border: `1px solid ${active ? '#2563eb' : '#374151'}`,
  color: 'white',
  borderRadius: 8,
  cursor: 'pointer'
});

const primaryBtn = (enabled: boolean): React.CSSProperties => ({
  width: '100%',
  padding: 12,
  background: enabled ? '#2563eb' : '#6b7280',
  border: `1px solid ${enabled ? '#2563eb' : '#6b7280'}`,
  color: 'white',
  borderRadius: 8,
  cursor: enabled ? 'pointer' : 'not-allowed',
  fontSize: 16,
  fontWeight: 500
});

const errorBox: React.CSSProperties = {
  background: 'rgba(255, 107, 107, 0.1)',
  border: '1px solid rgba(255, 107, 107, 0.3)',
  color: '#ff6b6b',
  padding: 12,
  borderRadius: 8,
  fontSize: 14,
  marginTop: 16
};

const smallMuted: React.CSSProperties = {
  fontSize: 12,
  color: '#6b7280',
  textAlign: 'center',
  marginTop: 16
};

const linkBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#2563eb',
  cursor: 'pointer',
  textDecoration: 'underline',
  marginLeft: 4
};

console.log('🎯 Main - Création du root React');
const root = createRoot(document.getElementById('root')!);
root.render(<App />);
console.log('🚀 Main - Application React montée');
