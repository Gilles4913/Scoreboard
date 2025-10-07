import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Scoreboard } from './components/Scoreboard';

interface OrganizationDisplayProps {
  orgSlug: string;
}

export function OrganizationDisplay({ orgSlug }: OrganizationDisplayProps) {
  const [org, setOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const supabaseUrl = 'https://opwjfpybcgtgcvldizar.supabase.co';
  const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wd2pmcHliY2d0Z2N2bGRpemFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0OTQ5MTksImV4cCI6MjA3MzA3MDkxOX0.8yrYMlhFmjAF5_LG9FtCx8XrJ1sFOz2YejDDupbhgpY';

  const supa = createClient(supabaseUrl, supabaseAnonKey, { 
    auth: { persistSession: false } 
  });

  useEffect(() => {
    loadOrganization();
  }, [orgSlug]);

  const loadOrganization = async () => {
    try {
      setLoading(true);
      setError('');

      // Charger l'organisation par son slug
      const { data: orgData, error: orgError } = await supa
        .from('orgs')
        .select('*')
        .eq('slug', orgSlug)
        .single();

      if (orgError) {
        throw orgError;
      }

      if (!orgData) {
        setError(`Organisation "${orgSlug}" non trouvée`);
        return;
      }

      setOrg(orgData);
    } catch (err) {
      console.error('Erreur chargement organisation:', err);
      setError(`Erreur: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    } finally {
      setLoading(false);
    }
  };

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
          <div style={{ fontSize: '18px', marginBottom: '8px' }}>Chargement...</div>
          <div style={{ fontSize: '14px', color: '#9aa0a6' }}>
            Chargement de l'organisation {orgSlug}
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
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            Vérifiez que l'URL est correcte
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
      fontFamily: 'Inter, ui-sans-serif, system-ui'
    }}>
      {/* Header avec nom de l'organisation */}
      <div style={{
        background: '#111214',
        borderBottom: '1px solid #1b1c1f',
        padding: '20px',
        textAlign: 'center'
      }}>
        <h1 style={{
          fontSize: '24px',
          margin: '0 0 8px 0',
          background: 'linear-gradient(135deg, #36ffb5, #2563eb)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          ⚽ {org.name}
        </h1>
        <div style={{ fontSize: '14px', color: '#9aa0a6' }}>
          Scoreboard Display - {org.slug}
        </div>
      </div>

      {/* Scoreboard principal */}
      <div style={{ padding: '20px' }}>
        <Scoreboard orgSlug={orgSlug} />
      </div>
    </div>
  );
}
