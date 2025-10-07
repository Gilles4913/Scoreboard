import React, { useState, useCallback, useMemo } from 'react';
import type { MatchInfo, Sport } from '@pkg/types';
import { supa } from '../supabase';

const SPORTS: Sport[] = ['basic','football','handball','basket','hockey_ice','hockey_field','volleyball'];

interface SpacePageProps {
  user: any;
  org: { id: string, slug: string, name: string } | null;
  matches: MatchInfo[];
  onMatchSelect: (match: MatchInfo) => void;
  onMatchesUpdate: (matches: MatchInfo[]) => void;
  activeMatch: MatchInfo | null;
  isSuperAdmin?: boolean;
  onShowSuperAdmin?: () => void;
  onChangeOrganization?: () => void;
}

interface MatchFormData {
  name: string;
  sport: Sport;
  home_name: string;
  away_name: string;
  home_logo?: string;
  away_logo?: string;
  date: string;
  time: string;
}

const initialFormData: MatchFormData = {
  name: 'Match',
  sport: 'basic',
  home_name: 'HOME',
  away_name: 'AWAY',
  home_logo: '',
  away_logo: '',
  date: '',
  time: ''
};

export function SpacePage({ user, org, matches, onMatchSelect, onMatchesUpdate, activeMatch, isSuperAdmin, onShowSuperAdmin, onChangeOrganization }: SpacePageProps) {
  console.log('🏠 SpacePage - Rendu avec:', { 
    user: user?.email, 
    org: org?.name, 
    matchesCount: matches.length,
    activeMatch: activeMatch?.name || 'Aucun'
  });
  
  // États locaux simples
  const [modalState, setModalState] = useState<{
    type: 'none' | 'create' | 'edit';
    editingId: string | null;
  }>({ type: 'none', editingId: null });
  
  const [formData, setFormData] = useState<MatchFormData>(initialFormData);
  const [operationState, setOperationState] = useState<{
    isSubmitting: boolean;
    message: string;
    messageType: 'success' | 'error' | 'info';
  }>({
    isSubmitting: false,
    message: '',
    messageType: 'info'
  });

  // Mémorisation des matchs pour éviter les re-calculs
  const { upcomingMatches, archivedMatches } = useMemo(() => {
    const upcoming = matches
      .filter(m => m.status === 'scheduled' || m.status === 'live')
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    
    const archived = matches
      .filter(m => m.status === 'finished' || m.status === 'archived')
      .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
    
    return { upcomingMatches: upcoming, archivedMatches: archived };
  }, [matches]);

  // Fonction pour afficher les messages (stable)
  const setMessage = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setOperationState(prev => ({ ...prev, message, messageType: type }));
    if (message) {
      setTimeout(() => {
        setOperationState(prev => ({ ...prev, message: '' }));
      }, type === 'success' ? 2000 : 5000);
    }
  }, []);

  // Fonction pour réinitialiser le formulaire (stable)
  const resetForm = useCallback(() => {
    setFormData(initialFormData);
    setOperationState(prev => ({ ...prev, message: '' }));
  }, []);

  // Fonctions de modal (stables)
  const openCreateModal = useCallback(() => {
    resetForm();
    setModalState({ type: 'create', editingId: null });
  }, [resetForm]);

  const openEditModal = useCallback((match: MatchInfo) => {
    const matchDate = new Date(match.scheduled_at);
    setFormData({
      name: match.name,
      sport: match.sport,
      home_name: match.home_name,
      away_name: match.away_name,
      home_logo: (match as any).home_logo || '',
      away_logo: (match as any).away_logo || '',
      date: matchDate.toISOString().split('T')[0],
      time: matchDate.toTimeString().substring(0, 5)
    });
    setModalState({ type: 'edit', editingId: match.id });
    setOperationState(prev => ({ ...prev, message: '' }));
  }, []);

  const closeModal = useCallback(() => {
    if (operationState.isSubmitting) return;
    setModalState({ type: 'none', editingId: null });
    resetForm();
  }, [operationState.isSubmitting, resetForm]);

  const updateFormField = useCallback((field: keyof MatchFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleImageUpload = useCallback((file: File, team: 'home' | 'away') => {
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      setMessage('Veuillez sélectionner un fichier image', 'error');
      return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
      setMessage('L\'image doit faire moins de 2MB', 'error');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      updateFormField(team === 'home' ? 'home_logo' : 'away_logo', result);
    };
    reader.readAsDataURL(file);
  }, [updateFormField, setMessage]);

  const removeImage = useCallback((team: 'home' | 'away') => {
    updateFormField(team === 'home' ? 'home_logo' : 'away_logo', '');
  }, [updateFormField]);

  const scheduleISO = useCallback(() => {
    if (!formData.date) return new Date().toISOString();
    const hhmm = (formData.time || '00:00').split(':');
    const d = new Date(`${formData.date}T${hhmm[0].padStart(2,'0')}:${(hhmm[1] || '00').padStart(2,'0')}:00`);
    return d.toISOString();
  }, [formData.date, formData.time]);

  const createMatch = useCallback(async () => {
    if (!org) {
      setMessage('Veuillez sélectionner un espace d\'abord', 'error');
      return;
    }
    if (!formData.name.trim()) {
      setMessage('Le nom du match est requis', 'error');
      return;
    }

    setOperationState(prev => ({ ...prev, isSubmitting: true }));
    setMessage('Création en cours...', 'info');

    try {
      const display_token = Math.random().toString(36).substring(2, 15);
      const { data, error } = await supa.from('matches').insert({
        org_id: org.id,
        name: formData.name,
        sport: formData.sport,
        home_name: formData.home_name,
        away_name: formData.away_name,
        home_logo: formData.home_logo || null,
        away_logo: formData.away_logo || null,
        scheduled_at: scheduleISO(),
        status: 'scheduled',
        public_display: true,
        display_token
      }).select('*').single();

      if (error) {
        setMessage(`Erreur: ${error.message}`, 'error');
        return;
      }

      const updatedMatches = [...matches, data as any];
      onMatchesUpdate(updatedMatches);
      setMessage('Match créé avec succès !', 'success');
      
      setTimeout(() => {
        setModalState({ type: 'none', editingId: null });
        resetForm();
      }, 1500);

    } catch (err) {
      setMessage(`Erreur inattendue: ${err instanceof Error ? err.message : 'Erreur inconnue'}`, 'error');
    } finally {
      setOperationState(prev => ({ ...prev, isSubmitting: false }));
    }
  }, [org, formData, scheduleISO, matches, onMatchesUpdate, setMessage, resetForm]);

  const editMatch = useCallback(async () => {
    if (!modalState.editingId) return;

    setOperationState(prev => ({ ...prev, isSubmitting: true }));
    setMessage('Modification en cours...', 'info');

    try {
      const { data, error } = await supa
        .from('matches')
        .update({
          name: formData.name,
          sport: formData.sport,
          home_name: formData.home_name,
          away_name: formData.away_name,
          home_logo: formData.home_logo || null,
          away_logo: formData.away_logo || null,
          scheduled_at: scheduleISO(),
          updated_at: new Date().toISOString()
        })
        .eq('id', modalState.editingId)
        .select('*')
        .single();

      if (error) {
        setMessage(`Erreur lors de la modification: ${error.message}`, 'error');
        return;
      }

      const updatedMatches = matches.map(m => 
        m.id === modalState.editingId ? data as any : m
      );
      onMatchesUpdate(updatedMatches);
      setMessage('Match modifié avec succès !', 'success');
      
      setTimeout(() => {
        setModalState({ type: 'none', editingId: null });
        resetForm();
      }, 1500);

    } catch (err) {
      setMessage(`Erreur inattendue: ${err instanceof Error ? err.message : 'Erreur inconnue'}`, 'error');
    } finally {
      setOperationState(prev => ({ ...prev, isSubmitting: false }));
    }
  }, [modalState.editingId, formData, scheduleISO, matches, onMatchesUpdate, setMessage, resetForm]);

  const handleSubmit = useCallback(() => {
    if (operationState.isSubmitting) return;
    
    if (modalState.type === 'create') {
      createMatch();
    } else if (modalState.type === 'edit') {
      editMatch();
    }
  }, [operationState.isSubmitting, modalState.type, createMatch, editMatch]);

  const deleteMatch = useCallback(async (matchId: string) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce match ?')) {
      return;
    }

    console.log('🗑️ Suppression du match:', matchId);
    setOperationState(prev => ({ ...prev, isSubmitting: true }));
    setMessage('Suppression en cours...', 'info');

    try {
      const { error } = await supa.from('matches').delete().eq('id', matchId);
      
      if (error) {
        console.error('❌ Erreur suppression:', error);
        setMessage(`Erreur lors de la suppression: ${error.message}`, 'error');
        return;
      }
      
      console.log('✅ Match supprimé avec succès');
      const updatedMatches = matches.filter(m => m.id !== matchId);
      onMatchesUpdate(updatedMatches);
      setMessage('Match supprimé avec succès !', 'success');
      
    } catch (err) {
      console.error('💥 Erreur inattendue:', err);
      setMessage(`Erreur inattendue: ${err instanceof Error ? err.message : 'Erreur inconnue'}`, 'error');
    } finally {
      setOperationState(prev => ({ ...prev, isSubmitting: false }));
    }
  }, [matches, onMatchesUpdate]);

  const handleSignOut = useCallback(() => {
    supa.auth.signOut();
  }, []);

  // Fonction simple pour sélectionner un match
  function handleMatchSelect(match: MatchInfo) {
    console.log('🎯 SpacePage - Sélection du match:', match.name);
    console.log('🎯 SpacePage - Match object complet:', match);
    console.log('🎯 SpacePage - Appel de onMatchSelect...');
    onMatchSelect(match);
    console.log('🎯 SpacePage - onMatchSelect appelé avec succès');
  }

  // Rendu
  return (
    <div className="space-page">
      <div className="card">
        <div className="space-header">
          <h1 className="h1">⚽ Scoreboard Pro</h1>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="org-section">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <strong>{org?.name || 'Aucun espace disponible'}</strong>
                {onChangeOrganization && (
                  <button 
                    onClick={onChangeOrganization}
                    style={{
                      background: '#6b7280',
                      borderColor: '#6b7280',
                      color: 'white',
                      padding: '4px 8px',
                      fontSize: '12px'
                    }}
                    title="Changer d'organisation"
                  >
                    🔄 Changer
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {isSuperAdmin && onShowSuperAdmin && (
                  <button 
                    onClick={onShowSuperAdmin}
                    style={{
                      background: 'linear-gradient(135deg, #8b5cf6, #d946ef)',
                      borderColor: '#8b5cf6',
                      color: 'white'
                    }}
                    title="Interface Super Admin"
                  >
                    👑 Super Admin
                  </button>
                )}
                {org && (
                  <button 
                    onClick={openCreateModal}
                    className="add-match-btn"
                    title="Ajouter un nouveau match"
                    disabled={operationState.isSubmitting}
                  >
                    ➕ Ajouter un match
                  </button>
                )}
                {activeMatch && (
                  <div style={{
                    background: '#dc2626',
                    color: 'white',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}>
                    🔴 Match actif: {activeMatch.name}
                  </div>
                )}
              </div>
            </div>
            <button 
              onClick={handleSignOut}
              style={{ background: '#dc2626', borderColor: '#dc2626' }}
              disabled={operationState.isSubmitting}
            >
              Déconnexion
            </button>
          </div>
        </div>

        <div className="sep" />
        
        <h2 className="h1">
          Matchs à venir ({upcomingMatches.length})
        </h2>
        <div className="matches-list">
          {upcomingMatches.map(m => (
            <div key={m.id} className={`match-row ${activeMatch?.id === m.id ? 'active-match' : ''}`}>
              <div className="match-details">
                <div className="match-name">{m.name}</div>
                <div className="match-teams">
                  {(m as any).home_logo && (
                    <img src={(m as any).home_logo} alt="Logo" className="team-logo-small" />
                  )}
                  {m.home_name} vs {m.away_name}
                  {(m as any).away_logo && (
                    <img src={(m as any).away_logo} alt="Logo" className="team-logo-small" />
                  )}
                </div>
                <div className="match-sport">
                  <span className="sport-badge">{m.sport}</span>
                  {activeMatch?.id === m.id && (
                    <span style={{
                      background: '#dc2626',
                      color: 'white',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: '600',
                      marginLeft: '8px'
                    }}>
                      ACTIF
                    </span>
                  )}
                </div>
              </div>
              <div className="match-datetime">
                <div className="match-date">{new Date(m.scheduled_at).toLocaleDateString('fr-FR')}</div>
                <div className="match-time">{new Date(m.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <div className="match-actions">
                <button 
                  onClick={() => handleMatchSelect(m)}
                  className="primary"
                  disabled={operationState.isSubmitting || (activeMatch && activeMatch.id !== m.id)}
                  title={activeMatch?.id === m.id ? 'Aller à la console de ce match' : 
                         (activeMatch && activeMatch.id !== m.id) ? `Impossible - Match "${activeMatch.name}" est actif` : 
                         'Sélectionner ce match'}
                >
                  {activeMatch?.id === m.id ? '🎮 Console' : 'Sélectionner'}
                </button>
                <button 
                  onClick={() => openEditModal(m)} 
                  style={{ background: '#f59e0b', borderColor: '#f59e0b', color: 'white' }}
                  disabled={operationState.isSubmitting}
                  title="Modifier ce match"
                >
                  ✏️ Modifier
                </button>
                <button 
                  onClick={() => deleteMatch(m.id)} 
                  className="danger"
                  disabled={operationState.isSubmitting || activeMatch?.id === m.id}
                  title={activeMatch?.id === m.id ? 'Impossible de supprimer un match actif' :
                         'Supprimer ce match définitivement'}
                >
                  🗑️ Supprimer
                </button>
              </div>
            </div>
          ))}
          {upcomingMatches.length === 0 && (
            <div className="empty-list">
              <div>Aucun match à venir</div>
              <div className="small">Créez votre premier match ci-dessus</div>
            </div>
          )}
        </div>

        {archivedMatches.length > 0 && (
          <>
            <div className="sep" />
            <h2 className="h1">Matchs archivés ({archivedMatches.length})</h2>
            <div className="matches-list archived">
              {archivedMatches.map(m => (
                <div key={m.id} className="match-row archived">
                  <div className="match-details">
                    <div className="match-name">{m.name}</div>
                    <div className="match-teams">{m.home_name} vs {m.away_name}</div>
                  </div>
                  <div className="match-datetime">
                    <div className="match-date">{new Date(m.scheduled_at).toLocaleDateString('fr-FR')}</div>
                    <div className="match-time">{new Date(m.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  <div className="match-actions">
                    <button 
                      onClick={() => handleMatchSelect(m)} 
                      style={{ background: '#6b7280', borderColor: '#6b7280' }}
                      disabled={operationState.isSubmitting}
                    >
                      Sélectionner
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Modal de création/modification */}
        {modalState.type !== 'none' && (
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{modalState.type === 'edit' ? '✏️ Modifier le match' : '➕ Nouveau match'}</h2>
                <button 
                  className="modal-close"
                  onClick={closeModal}
                  title="Fermer"
                  disabled={operationState.isSubmitting}
                >
                  ✕
                </button>
              </div>
              
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-row">
                    <label>Nom du match</label>
                    <input 
                      className="input" 
                      placeholder="Ex: Finale championnat" 
                      value={formData.name} 
                      onChange={e => updateFormField('name', e.target.value)}
                      disabled={operationState.isSubmitting}
                    />
                  </div>
                  
                  <div className="form-row">
                    <label>Sport</label>
                    <select 
                      className="input"
                      value={formData.sport} 
                      onChange={e => updateFormField('sport', e.target.value)}
                      disabled={operationState.isSubmitting}
                    >
                      {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  
                  <div className="form-row-split">
                    <div className="form-field">
                      <label>Équipe A</label>
                      <input 
                        className="input" 
                        placeholder="Nom équipe A" 
                        value={formData.home_name} 
                        onChange={e => updateFormField('home_name', e.target.value)}
                        disabled={operationState.isSubmitting}
                      />
                      <div className="logo-upload">
                        <label className="logo-upload-label">
                          📷 Logo équipe A
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'home')}
                            style={{ display: 'none' }}
                            disabled={operationState.isSubmitting}
                          />
                        </label>
                        {formData.home_logo && (
                          <div className="logo-preview">
                            <img src={formData.home_logo} alt="Logo équipe A" />
                            <button 
                              type="button" 
                              onClick={() => removeImage('home')}
                              className="logo-remove"
                              title="Supprimer le logo"
                              disabled={operationState.isSubmitting}
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="form-field">
                      <label>Équipe B</label>
                      <input 
                        className="input" 
                        placeholder="Nom équipe B" 
                        value={formData.away_name} 
                        onChange={e => updateFormField('away_name', e.target.value)}
                        disabled={operationState.isSubmitting}
                      />
                      <div className="logo-upload">
                        <label className="logo-upload-label">
                          📷 Logo équipe B
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'away')}
                            style={{ display: 'none' }}
                            disabled={operationState.isSubmitting}
                          />
                        </label>
                        {formData.away_logo && (
                          <div className="logo-preview">
                            <img src={formData.away_logo} alt="Logo équipe B" />
                            <button 
                              type="button" 
                              onClick={() => removeImage('away')}
                              className="logo-remove"
                              title="Supprimer le logo"
                              disabled={operationState.isSubmitting}
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="form-row-split">
                    <div className="form-field">
                      <label>Date</label>
                      <input 
                        className="input" 
                        type="date" 
                        value={formData.date} 
                        onChange={e => updateFormField('date', e.target.value)}
                        disabled={operationState.isSubmitting}
                      />
                    </div>
                    <div className="form-field">
                      <label>Heure</label>
                      <input 
                        className="input" 
                        type="time" 
                        value={formData.time} 
                        onChange={e => updateFormField('time', e.target.value)}
                        disabled={operationState.isSubmitting}
                      />
                    </div>
                  </div>
                  
                  {operationState.message && (
                    <div className="form-message" style={{ 
                      color: operationState.messageType === 'error' ? '#ff6b6b' : 
                            operationState.messageType === 'success' ? '#4ade80' : '#fbbf24'
                    }}>
                      {operationState.message}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="modal-footer">
                <button 
                  onClick={closeModal}
                  className="secondary"
                  disabled={operationState.isSubmitting}
                >
                  Annuler
                </button>
                <button 
                  onClick={handleSubmit}
                  className="primary"
                  disabled={!formData.name.trim() || operationState.isSubmitting}
                >
                  {operationState.isSubmitting ? '⏳ En cours...' : 
                   modalState.type === 'edit' ? '✅ Sauvegarder' : '✅ Créer le match'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}