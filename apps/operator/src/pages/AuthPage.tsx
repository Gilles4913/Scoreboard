import React, { useState, useEffect } from 'react';
import { supa } from '../supabase';

interface AuthPageProps {
  onAuthSuccess: (user: any, isSuperAdmin: boolean, organizations: any[]) => void;
}

export function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [authStep, setAuthStep] = useState<'login' | 'register'>('login');
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Vérifier la session existante au démarrage
  useEffect(() => {
    checkExistingSession();
  }, []);

  const checkExistingSession = async () => {
    try {
      const { data: { session } } = await supa.auth.getSession();
      if (session?.user) {
        console.log('🔐 Session existante trouvée:', session.user.email);
        await handleAuthSuccess(session.user);
      }
    } catch (err) {
      console.error('❌ Erreur vérification session:', err);
    } finally {
      setIsCheckingSession(false);
    }
  };

  const handleAuthSuccess = async (user: any) => {
    try {
      setLoading(true);
      setError('');

      console.log('👤 Auth - Chargement des données pour:', user.email);
      
      // Charger les organisations de l'utilisateur
      const { data: orgMembers, error: orgError } = await supa
        .from('org_members_with_org')
        .select('*')
        .eq('user_id', user.id);

      if (orgError) {
        throw orgError;
      }

      console.log('🏢 Orgs - Trouvées:', orgMembers?.length || 0);

      // Vérifier si l'utilisateur est Super Admin
      const superAdminRole = orgMembers?.find(member => member.role === 'super_admin');
      const isSuperAdminUser = !!superAdminRole;
      
      console.log('👑 Super Admin - Détecté:', isSuperAdminUser);

      if (!orgMembers || orgMembers.length === 0) {
        setError('Aucune organisation trouvée pour cet utilisateur. Contactez un administrateur.');
        return;
      }

      // Préparer les données des organisations
      const organizations = orgMembers.map(member => ({
        id: member.org_id,
        slug: member.org_slug,
        name: member.org_name,
        role: member.role
      }));

      console.log('✅ Auth - Succès, redirection vers:', isSuperAdminUser ? 'Super Admin' : 'Operator');
      
      // Appeler la fonction de succès avec toutes les données
      onAuthSuccess(user, isSuperAdminUser, organizations);

    } catch (err) {
      console.error('💥 Auth - Erreur:', err);
      setError(`Erreur: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentials.email || !credentials.password) {
      setError('Veuillez remplir tous les champs');
      return;
    }

    try {
      setLoading(true);
      setError('');

      let result;
      if (authStep === 'login') {
        result = await supa.auth.signInWithPassword({
          email: credentials.email,
          password: credentials.password,
        });
      } else {
        result = await supa.auth.signUp({
          email: credentials.email,
          password: credentials.password,
        });
      }

      if (result.error) {
        throw result.error;
      }

      if (result.data.user) {
        await handleAuthSuccess(result.data.user);
      }

    } catch (err: any) {
      console.error('❌ Auth - Erreur:', err);
      setError(err.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supa.auth.signOut();
      setCredentials({ email: '', password: '' });
      setError('');
    } catch (err) {
      console.error('❌ Déconnexion - Erreur:', err);
    }
  };

  if (isCheckingSession) {
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
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>🔐</div>
          <div style={{ fontSize: '18px', marginBottom: '8px' }}>Vérification de la session...</div>
          <div style={{ fontSize: '14px', color: '#9aa0a6' }}>
            Chargement de vos données
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0b0b0c',
      color: '#eaeaea',
      fontFamily: 'Inter, ui-sans-serif, system-ui',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: '#111214',
        border: '1px solid #1b1c1f',
        borderRadius: '14px',
        padding: '40px',
        maxWidth: '400px',
        width: '100%'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{
            fontSize: '28px',
            margin: '0 0 8px 0',
            background: 'linear-gradient(135deg, #36ffb5, #2563eb)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            ⚽ Scoreboard Pro
          </h1>
          <div style={{ fontSize: '16px', color: '#9aa0a6' }}>
            {authStep === 'login' ? 'Connexion à votre compte' : 'Création de compte'}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
              Email
            </label>
            <input
              type="email"
              value={credentials.email}
              onChange={(e) => setCredentials(prev => ({ ...prev, email: e.target.value }))}
              placeholder="votre@email.com"
              style={{
                width: '100%',
                padding: '12px',
                background: '#1a1b1e',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#eaeaea',
                fontSize: '14px'
              }}
              disabled={loading}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
              Mot de passe
            </label>
            <input
              type="password"
              value={credentials.password}
              onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '12px',
                background: '#1a1b1e',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#eaeaea',
                fontSize: '14px'
              }}
              disabled={loading}
            />
          </div>

          {error && (
            <div style={{
              background: '#2d1b1b',
              border: '1px solid #dc2626',
              color: '#fca5a5',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '20px',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              background: loading ? '#6b7280' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginBottom: '16px'
            }}
          >
            {loading ? '⏳ Chargement...' : (authStep === 'login' ? 'Se connecter' : 'Créer le compte')}
          </button>
        </form>

        <div style={{ textAlign: 'center' }}>
          <button
            onClick={() => setAuthStep(authStep === 'login' ? 'register' : 'login')}
            style={{
              background: 'transparent',
              color: '#9aa0a6',
              border: 'none',
              fontSize: '14px',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
            disabled={loading}
          >
            {authStep === 'login' 
              ? 'Pas de compte ? Créer un compte' 
              : 'Déjà un compte ? Se connecter'
            }
          </button>
        </div>

        <div style={{
          marginTop: '30px',
          padding: '20px',
          background: '#1a1b1e',
          borderRadius: '8px',
          border: '1px solid #374151'
        }}>
          <div style={{ fontSize: '14px', color: '#9aa0a6', marginBottom: '10px' }}>
            Comptes de test disponibles :
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            <div>👑 Super Admin : gilles.guerrin@a2display.fr</div>
            <div>⚽ Operator : gilles.guerrin49@gmail.com</div>
          </div>
        </div>
      </div>
    </div>
  );
}
