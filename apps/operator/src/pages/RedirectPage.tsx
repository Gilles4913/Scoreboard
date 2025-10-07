import React, { useState, useEffect } from 'react';
import { SuperAdminPage } from './SuperAdminPage';
import { OrganizationSelector } from './OrganizationSelector';
import { SpacePage } from './SpacePage';
import { MatchPage } from './MatchPage';
import { supa } from '../supabase';
import type { MatchInfo } from '@pkg/types';

interface RedirectPageProps {
  user: any;
  isSuperAdmin: boolean;
  organizations: any[];
}

export function RedirectPage({ user, isSuperAdmin, organizations }: RedirectPageProps) {
  const [selectedOrg, setSelectedOrg] = useState<any>(null);
  const [matches, setMatches] = useState<MatchInfo[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [showSuperAdmin, setShowSuperAdmin] = useState(false);
  const [showOrgSelector, setShowOrgSelector] = useState(false);

  // Un match est actif seulement s'il a le statut 'live' (chronomètre démarré)
  const activeMatch = matches.find(m => m.status === 'live') || null;

  useEffect(() => {
    // Si Super Admin, afficher directement l'interface Super Admin
    if (isSuperAdmin) {
      console.log('👑 Redirect - Super Admin détecté, affichage interface Super Admin');
      setShowSuperAdmin(true);
      return;
    }

    // Si Operator, déterminer l'affichage selon le nombre d'organisations
    if (organizations.length === 0) {
      setError('Aucune organisation trouvée pour cet utilisateur. Contactez un administrateur.');
      return;
    }

    if (organizations.length === 1) {
      // Une seule organisation - sélection automatique
      const org = organizations[0];
      console.log('🏢 Redirect - Une organisation, sélection automatique:', org.name);
      setSelectedOrg(org);
      loadMatches(org.id);
    } else {
      // Plusieurs organisations - afficher le sélecteur
      console.log('🏢 Redirect - Plusieurs organisations, affichage du sélecteur');
      setShowOrgSelector(true);
    }
  }, [isSuperAdmin, organizations]);

  const loadMatches = async (orgId: string) => {
    try {
      setLoading(true);
      setError('');

      console.log('⚽ Matches - Chargement pour org:', orgId);
      
      const { data: matchesData, error: matchesError } = await supa
        .from('matches')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });

      if (matchesError) {
        throw matchesError;
      }

      console.log('⚽ Matches - Trouvés:', matchesData?.length || 0);
      setMatches(matchesData || []);
    } catch (err) {
      console.error('❌ Matches - Erreur:', err);
      setError(`Erreur chargement matchs: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleOrganizationSelect = async (org: any) => {
    console.log('🏢 Redirect - Sélection organisation:', org.name);
    setSelectedOrg(org);
    setShowOrgSelector(false);
    setSelectedMatch(null);
    await loadMatches(org.id);
  };

  const handleChangeOrganization = () => {
    console.log('🔄 Redirect - Changement d\'organisation');
    setShowOrgSelector(true);
    setSelectedMatch(null);
    setMatches([]);
  };

  const handleMatchSelect = (match: MatchInfo) => {
    console.log('🎮 Redirect - Sélection match:', match.name);
    setSelectedMatch(match);
  };

  const handleBackToList = () => {
    console.log('🔙 Redirect - Retour à la liste');
    setSelectedMatch(null);
  };

  const handleMatchesUpdate = (updatedMatches: MatchInfo[]) => {
    console.log('📋 Redirect - Mise à jour des matchs:', updatedMatches.length);
    setMatches(updatedMatches);
  };

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
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>⏳</div>
          <div style={{ fontSize: '18px', marginBottom: '8px' }}>Chargement...</div>
          <div style={{ fontSize: '14px', color: '#9aa0a6' }}>
            Préparation de votre interface
          </div>
        </div>
      </div>
    );
  }

  // Écran d'erreur
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
            onClick={() => window.location.reload()}
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

  // Interface Super Admin
  if (showSuperAdmin) {
    console.log('👑 Redirect - Affichage de SuperAdminPage');
    return (
      <SuperAdminPage
        user={user}
        onBack={() => setShowSuperAdmin(false)}
      />
    );
  }

  // Sélecteur d'organisation
  if (showOrgSelector) {
    console.log('🏢 Redirect - Affichage du sélecteur d\'organisation');
    return (
      <OrganizationSelector
        user={user}
        onOrganizationSelect={handleOrganizationSelect}
        isSuperAdmin={isSuperAdmin}
      />
    );
  }

  // Interface principale (SpacePage ou MatchPage)
  if (selectedMatch) {
    console.log('🎮 Redirect - Affichage de MatchPage pour:', selectedMatch.name);
    return (
      <MatchPage
        match={selectedMatch}
        onBack={handleBackToList}
        activeMatch={activeMatch}
        onMatchesUpdate={handleMatchesUpdate}
        org={selectedOrg}
        onChangeOrganization={handleChangeOrganization}
      />
    );
  }

  console.log('🏠 Redirect - Affichage de SpacePage');
  return (
    <SpacePage
      user={user}
      org={selectedOrg}
      matches={matches}
      onMatchSelect={handleMatchSelect}
      onMatchesUpdate={handleMatchesUpdate}
      activeMatch={activeMatch}
      isSuperAdmin={isSuperAdmin}
      onShowSuperAdmin={() => setShowSuperAdmin(true)}
      onChangeOrganization={handleChangeOrganization}
    />
  );
}
