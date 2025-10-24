import React, { useEffect, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { supa } from './supabase';
import { SpacePage } from './pages/SpacePage';
import { MatchPage } from './pages/MatchPage';
import SuperAdminPage from './pages/SuperAdminPage';
import type { MatchInfo } from '@pkg/types';
import './theme.css';

console.log('🚀 Operator - Démarrage de l’application');

type AdminView = 'admin' | 'operator';

function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [adminView, setAdminView] = useState<AdminView>(() => {
    const saved = localStorage.getItem('adminView');
    return (saved === 'operator' || saved === 'admin') ? (saved as AdminView) : 'admin';
  });

  const [org, setOrg] = useState<any>(null);
  const [matches, setMatches] = useState<MatchInfo[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchInfo | null>(null);

  const [error, setError] = useState<string>('');
  const [authStep, setAuthStep] = useState<'login' | 'register'>('login');
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [authLoading, setAuthLoading] = useState(false);

  const activeMatch = matches.find(m => m.status === 'live') || null;

  useEffect(() => {
    console.log('🔐 Auth - Vérification de la session');
    checkSession();
  }, []);

  async function checkSession() {
    try {
      const { data: { session }, error } = await supa.auth.getSession();
      if (error) {
        setError(`Erreur session: ${error.message}`);
        setLoading(false);
        return;
      }

      if (session?.user) {
        setUser(session.user);
        await loadUserBootstrap(session.user);
      } else {
        setLoading(false);
      }
    } catch (err) {
      setError(`Erreur inattendue: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
      setLoading(false);
    }
  }

  async function loadUserBootstrap(currentUser: any) {
    try {
      const { data: isAdmin } = await supa.rpc('is_super_admin', { uid: currentUser.id });
      const admin = !!isAdmin;
      setIsSuperAdmin(admin);

      if (admin && adminView === 'admin') {
        setLoading(false);
        return;
      }

      await ensureOperatorContext(currentUser.id);
      setLoading(false);
    } catch (err) {
      setError(`Erreur chargement utilisateur: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
      setLoading(false);
    }
  }

  async function ensureOperatorContext(userId: string) {
    if (org && matches.length > 0) return;

    const { data: orgMembers, error: orgError } = await supa
      .from('org_members_with_org')
      .select('*')
      .eq('user_id', userId);

    if (orgError) {
      setError(`Erreur organisations: ${orgError.message}`);
      return;
    }

    if (!orgMembers || orgMembers.length === 0) {
      setError('Aucune organisation trouvée pour cet utilisateur.');
      return;
    }

    const firstOrg = orgMembers[0];
    const orgData = {
      id: firstOrg.org_id,
      slug: firstOrg.org_slug,
      name: firstOrg.org_name
    };
    setOrg(orgData);

    await loadMatches(orgData.id);
  }

  async function loadMatches(orgId: string) {
    try {
      const { data, error } = await supa
        .from('matches')
        .select('*')
        .eq('org_id', orgId)
        .order('scheduled_at', { ascending: true });

      if (error) {
        setError(`Erreur matchs: ${error.message}`);
        return;
      }

      setMatches((data as any) || []);
    } catch (err) {
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
      let result;
      if (authStep === 'login') {
        result = await supa.auth.signInWithPassword({
          email: credentials.email,
          password: credentials.password
        });
      } else {
        result = await supa.auth.signUp({
          email: credentials.email,
          password: credentials.password
        });
      }

      if (result.error) {
        setError(result.error.message);
        setAuthLoading(false);
        return;
      }

      if (result.data.user) {
        setUser(result.data.user);
        await loadUserBootstrap(result.data.user);
      }
    } catch (err) {
      setError(`Erreur authentification: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    }

    setAuthLoading(false);
  }

  const handleMatchSelect = useCallback((match: MatchInfo) => {
    if (activeMatch && activeMatch.id !== match.id) {
      alert(`Impossible de sélectionner un autre match.\nLe match "${activeMatch.name}" est actuellement actif.`);
      return;
    }
    setSelectedMatch(match);
  }, [selectedMatch, activeMatch]);

  const handleBackToList = useCallback(() => {
    setSelectedMatch(null);
  }, []);

  const handleMatchesUpdate = useCallback((updatedMatches: MatchInfo[]) => {
    setMatches(updatedMatches);
  }, []);

  useEffect(() => {
    localStorage.setItem('adminView', adminView);
  }, [adminView]);

  const onSwitchView = async (view: AdminView) => {
    if (view === adminView) return;
    setAdminView(view);
    if (view === 'operator' && user) {
      await ensureOperatorContext(user.id);
    }
  };

  const HeaderBar = () => {
    if (!isSuperAdmin || !user) return null;
    return (
      <div style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: '#0c0d10', borderBottom: '1px solid #1b1c1f',
        padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ fontWeight: 600 }}>⚽ Scoreboard Pro</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onSwitchView('admin')} style={tabBtn(adminView === 'admin')}>Admin</button>
          <button onClick={() => onSwitchView('operator')} style={tabBtn(adminView === 'operator')}>Opérateur</button>
        </div>
        <div style={{ fontSize: 12, color: '#9aa0a6' }}>{user.email}</div>
      </div>
    );
  };

  if (loading) {
    return <div style={screenStyle}>Chargement…</div>;
  }

  if (!user) {
    return (
      <div style={screenStyle}>
        <div style={{ ...cardStyle, width: '100%', maxWidth: 400 }}>
          <h1 style={titleGradient}>⚽ Scoreboard Pro</h1>

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

          {error && <div style={errorBox}>{error}</div>}
        </div>
      </div>
    );
  }

  if (isSuperAdmin && adminView === 'admin') {
    return (
      <>
        <HeaderBar />
        <SuperAdminPage />
      </>
    );
  }

  if (selectedMatch) {
    return (
      <>
        {isSuperAdmin && <HeaderBar />}
        <MatchPage
          match={selectedMatch}
          onBack={handleBackToList}
          activeMatch={activeMatch}
          onMatchesUpdate={handleMatchesUpdate}
        />
      </>
    );
  }

  return (
    <>
      {isSuperAdmin && <HeaderBar />}
      <SpacePage
        user={user}
        org={org}
        matches={matches}
        onMatchSelect={handleMatchSelect}
        onMatchesUpdate={handleMatchesUpdate}
        activeMatch={activeMatch}
      />
    </>
  );
}

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
  border: '1px solid #1b1c1f', // ✅ corrigé ici
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
  WebkitTextFillColor: 'transparent'
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

console.log('🎯 Main - Création du root React');
const root = createRoot(document.getElementById('root')!);
root.render(<App />);
console.log('🚀 Main - Application React montée');
