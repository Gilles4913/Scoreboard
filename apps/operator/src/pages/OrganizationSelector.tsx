import React, { useState, useEffect, useCallback } from 'react';
import { supa } from '../supabase';

interface Organization {
  id: string;
  slug: string;
  name: string;
  created_at: string;
}

interface OrganizationSelectorProps {
  user: any;
  onOrganizationSelect: (org: Organization) => void;
  isSuperAdmin?: boolean;
}

export function OrganizationSelector({ user, onOrganizationSelect, isSuperAdmin }: OrganizationSelectorProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadOrganizations();
  }, [user, isSuperAdmin]);

  const loadOrganizations = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      let orgs: Organization[] = [];

      if (isSuperAdmin) {
        // Super Admin : accès à toutes les organisations
        const { data, error: orgsError } = await supa
          .from('orgs')
          .select('*')
          .order('name', { ascending: true });

        if (orgsError) throw orgsError;
        orgs = orgs || [];
      } else {
        // Operator : seulement ses organisations
        const { data: orgMembers, error: membersError } = await supa
          .from('org_members_with_org')
          .select('*')
          .eq('user_id', user.id);

        if (membersError) throw membersError;

        orgs = orgMembers?.map(member => ({
          id: member.org_id,
          slug: member.org_slug,
          name: member.org_name,
          created_at: member.created_at
        })) || [];
      }

      setOrganizations(orgs);

      // Auto-sélectionner la première organisation si une seule
      if (orgs.length === 1) {
        onOrganizationSelect(orgs[0]);
      }

    } catch (err) {
      console.error('Erreur chargement organisations:', err);
      setError(`Erreur: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    } finally {
      setLoading(false);
    }
  }, [user, isSuperAdmin, onOrganizationSelect]);

  const handleOrganizationSelect = useCallback((org: Organization) => {
    console.log('🏢 Sélection organisation:', org.name);
    onOrganizationSelect(org);
  }, [onOrganizationSelect]);

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
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>🏢</div>
          <div style={{ fontSize: '18px', marginBottom: '8px' }}>Chargement des organisations...</div>
          <div style={{ fontSize: '14px', color: '#9aa0a6' }}>
            Récupération de vos espaces de travail
          </div>
        </div>
      </div>
    );
  }

  if (error) {
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
          maxWidth: '500px'
        }}>
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>❌</div>
          <div style={{ fontSize: '18px', marginBottom: '8px' }}>Erreur</div>
          <div style={{ fontSize: '14px', color: '#ff6b6b', marginBottom: '20px' }}>
            {error}
          </div>
          <button 
            onClick={loadOrganizations}
            style={{
              background: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 24px',
              cursor: 'pointer'
            }}
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (organizations.length === 0) {
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
          maxWidth: '500px'
        }}>
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>🏢</div>
          <div style={{ fontSize: '18px', marginBottom: '8px' }}>Aucune organisation</div>
          <div style={{ fontSize: '14px', color: '#9aa0a6', marginBottom: '20px' }}>
            {isSuperAdmin 
              ? 'Aucune organisation trouvée dans le système.' 
              : 'Vous n\'êtes membre d\'aucune organisation. Contactez un administrateur.'
            }
          </div>
          {isSuperAdmin && (
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              Utilisez l'interface Super Admin pour créer des organisations.
            </div>
          )}
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
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        background: '#111214',
        border: '1px solid #1b1c1f',
        borderRadius: '14px',
        padding: '40px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
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
          <div style={{ fontSize: '16px', color: '#9aa0a6', marginBottom: '20px' }}>
            Sélectionnez votre organisation
          </div>
          {isSuperAdmin && (
            <div style={{
              background: 'linear-gradient(135deg, #8b5cf6, #d946ef)',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: '600',
              display: 'inline-block'
            }}>
              👑 Super Admin
            </div>
          )}
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px'
        }}>
          {organizations.map(org => (
            <div
              key={org.id}
              onClick={() => handleOrganizationSelect(org)}
              style={{
                background: '#1a1b1e',
                border: '2px solid #374151',
                borderRadius: '12px',
                padding: '24px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'center'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#2563eb';
                e.currentTarget.style.background = '#1e293b';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#374151';
                e.currentTarget.style.background = '#1a1b1e';
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '16px' }}>🏢</div>
              <h3 style={{
                fontSize: '20px',
                margin: '0 0 8px 0',
                color: '#eaeaea'
              }}>
                {org.name}
              </h3>
              <div style={{
                fontSize: '14px',
                color: '#9aa0a6',
                marginBottom: '16px'
              }}>
                {org.slug}
              </div>
              <div style={{
                fontSize: '12px',
                color: '#6b7280'
              }}>
                Créée le {new Date(org.created_at).toLocaleDateString('fr-FR')}
              </div>
            </div>
          ))}
        </div>

        <div style={{
          textAlign: 'center',
          marginTop: '40px',
          padding: '20px',
          background: '#1a1b1e',
          borderRadius: '8px',
          border: '1px solid #374151'
        }}>
          <div style={{ fontSize: '14px', color: '#9aa0a6', marginBottom: '8px' }}>
            Connecté en tant que : {user?.email}
          </div>
          <button
            onClick={() => supa.auth.signOut()}
            style={{
              background: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
