import React, { useState, useEffect, useCallback } from 'react';
import { supa } from '../supabase';

interface Organization {
  id: string;
  slug: string;
  name: string;
  created_at: string;
}

interface User {
  id: string;
  email: string;
  created_at: string;
}

interface OrgMember {
  org_id: string;
  user_id: string;
  role: 'super_admin' | 'operator';
  org_name?: string;
  org_slug?: string;
  user_email?: string;
}

interface SuperAdminPageProps {
  user: any;
  onBack: () => void;
}

export function SuperAdminPage({ user, onBack }: SuperAdminPageProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' }>({ text: '', type: 'info' });

  // États pour les modals
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // États pour les formulaires
  const [orgForm, setOrgForm] = useState({ name: '', slug: '' });
  const [userForm, setUserForm] = useState({ email: '', password: '' });
  const [memberForm, setMemberForm] = useState({ org_id: '', user_id: '', role: 'operator' as 'super_admin' | 'operator' });

  // Charger les données au démarrage
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      // Charger les organisations
      const { data: orgs, error: orgsError } = await supa
        .from('orgs')
        .select('*')
        .order('created_at', { ascending: false });

      if (orgsError) throw orgsError;
      setOrganizations(orgs || []);

      // Charger les utilisateurs (profils)
      const { data: profiles, error: profilesError } = await supa
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;
      setUsers(profiles || []);

      // Charger les membres d'organisations avec détails
      const { data: members, error: membersError } = await supa
        .from('org_members_with_org')
        .select('*');

      if (membersError) throw membersError;
      setOrgMembers(members || []);

    } catch (err) {
      console.error('Erreur chargement données:', err);
      setError(`Erreur: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const showMessage = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage({ text, type });
    if (text) {
      setTimeout(() => setMessage({ text: '', type: 'info' }), type === 'success' ? 3000 : 5000);
    }
  }, []);

  // Gestion des organisations
  const handleCreateOrg = useCallback(async () => {
    if (!orgForm.name.trim() || !orgForm.slug.trim()) {
      showMessage('Nom et slug requis', 'error');
      return;
    }

    try {
      const { data, error } = await supa
        .from('orgs')
        .insert({
          name: orgForm.name.trim(),
          slug: orgForm.slug.trim().toLowerCase()
        })
        .select('*')
        .single();

      if (error) throw error;

      setOrganizations(prev => [data, ...prev]);
      showMessage('Organisation créée avec succès', 'success');
      setShowOrgModal(false);
      setOrgForm({ name: '', slug: '' });

    } catch (err) {
      console.error('Erreur création organisation:', err);
      showMessage(`Erreur: ${err instanceof Error ? err.message : 'Erreur inconnue'}`, 'error');
    }
  }, [orgForm, showMessage]);

  const handleEditOrg = useCallback(async () => {
    if (!editingOrg || !orgForm.name.trim() || !orgForm.slug.trim()) {
      showMessage('Nom et slug requis', 'error');
      return;
    }

    try {
      const { data, error } = await supa
        .from('orgs')
        .update({
          name: orgForm.name.trim(),
          slug: orgForm.slug.trim().toLowerCase()
        })
        .eq('id', editingOrg.id)
        .select('*')
        .single();

      if (error) throw error;

      setOrganizations(prev => prev.map(org => org.id === editingOrg.id ? data : org));
      showMessage('Organisation modifiée avec succès', 'success');
      setShowOrgModal(false);
      setEditingOrg(null);
      setOrgForm({ name: '', slug: '' });

    } catch (err) {
      console.error('Erreur modification organisation:', err);
      showMessage(`Erreur: ${err instanceof Error ? err.message : 'Erreur inconnue'}`, 'error');
    }
  }, [editingOrg, orgForm, showMessage]);

  const handleDeleteOrg = useCallback(async (orgId: string) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette organisation ? Cette action supprimera aussi tous les matchs associés.')) {
      return;
    }

    try {
      const { error } = await supa
        .from('orgs')
        .delete()
        .eq('id', orgId);

      if (error) throw error;

      setOrganizations(prev => prev.filter(org => org.id !== orgId));
      setOrgMembers(prev => prev.filter(member => member.org_id !== orgId));
      showMessage('Organisation supprimée avec succès', 'success');

    } catch (err) {
      console.error('Erreur suppression organisation:', err);
      showMessage(`Erreur: ${err instanceof Error ? err.message : 'Erreur inconnue'}`, 'error');
    }
  }, [showMessage]);

  // Gestion des utilisateurs
  const handleCreateUser = useCallback(async () => {
    if (!userForm.email.trim() || !userForm.password.trim()) {
      showMessage('Email et mot de passe requis', 'error');
      return;
    }

    try {
      const { data, error } = await supa.auth.admin.createUser({
        email: userForm.email.trim(),
        password: userForm.password.trim(),
        email_confirm: true
      });

      if (error) throw error;

      showMessage('Utilisateur créé avec succès', 'success');
      setShowUserModal(false);
      setUserForm({ email: '', password: '' });
      loadAllData(); // Recharger les données

    } catch (err) {
      console.error('Erreur création utilisateur:', err);
      showMessage(`Erreur: ${err instanceof Error ? err.message : 'Erreur inconnue'}`, 'error');
    }
  }, [userForm, showMessage, loadAllData]);

  // Gestion des membres d'organisations
  const handleAddMember = useCallback(async () => {
    if (!memberForm.org_id || !memberForm.user_id) {
      showMessage('Organisation et utilisateur requis', 'error');
      return;
    }

    try {
      const { data, error } = await supa
        .from('org_members')
        .insert({
          org_id: memberForm.org_id,
          user_id: memberForm.user_id,
          role: memberForm.role
        })
        .select('*')
        .single();

      if (error) throw error;

      // Recharger les membres avec détails
      const { data: members, error: membersError } = await supa
        .from('org_members_with_org')
        .select('*');

      if (membersError) throw membersError;
      setOrgMembers(members || []);

      showMessage('Membre ajouté avec succès', 'success');
      setMemberForm({ org_id: '', user_id: '', role: 'operator' });

    } catch (err) {
      console.error('Erreur ajout membre:', err);
      showMessage(`Erreur: ${err instanceof Error ? err.message : 'Erreur inconnue'}`, 'error');
    }
  }, [memberForm, showMessage]);

  const handleRemoveMember = useCallback(async (orgId: string, userId: string) => {
    if (!window.confirm('Êtes-vous sûr de vouloir retirer ce membre de l\'organisation ?')) {
      return;
    }

    try {
      const { error } = await supa
        .from('org_members')
        .delete()
        .eq('org_id', orgId)
        .eq('user_id', userId);

      if (error) throw error;

      setOrgMembers(prev => prev.filter(member => !(member.org_id === orgId && member.user_id === userId)));
      showMessage('Membre retiré avec succès', 'success');

    } catch (err) {
      console.error('Erreur suppression membre:', err);
      showMessage(`Erreur: ${err instanceof Error ? err.message : 'Erreur inconnue'}`, 'error');
    }
  }, [showMessage]);

  const openOrgModal = useCallback((org?: Organization) => {
    if (org) {
      setEditingOrg(org);
      setOrgForm({ name: org.name, slug: org.slug });
    } else {
      setEditingOrg(null);
      setOrgForm({ name: '', slug: '' });
    }
    setShowOrgModal(true);
  }, []);

  const openUserModal = useCallback(() => {
    setEditingUser(null);
    setUserForm({ email: '', password: '' });
    setShowUserModal(true);
  }, []);

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
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>👑</div>
          <div style={{ fontSize: '18px', marginBottom: '8px' }}>Chargement...</div>
          <div style={{ fontSize: '14px', color: '#9aa0a6' }}>
            Chargement des données Super Admin
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="super-admin-page">
      <div className="card">
        <div className="space-header">
          <h1 className="h1">👑 Super Admin Panel</h1>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="org-section">
              <strong>Gestion des organisations et utilisateurs</strong>
              <div style={{ fontSize: '14px', color: '#9aa0a6', marginTop: '4px' }}>
                Connecté en tant que: {user?.email}
              </div>
            </div>
            <button 
              onClick={onBack}
              style={{ background: '#6b7280', borderColor: '#6b7280' }}
            >
              ← Retour
            </button>
          </div>
        </div>

        {error && (
          <div style={{
            background: 'rgba(255, 107, 107, 0.1)',
            border: '1px solid rgba(255, 107, 107, 0.3)',
            color: '#ff6b6b',
            padding: '12px',
            borderRadius: '8px',
            margin: '16px 0'
          }}>
            {error}
          </div>
        )}

        {message.text && (
          <div style={{
            background: message.type === 'error' ? 'rgba(255, 107, 107, 0.1)' : 
                       message.type === 'success' ? 'rgba(74, 222, 128, 0.1)' : 'rgba(251, 191, 36, 0.1)',
            border: `1px solid ${message.type === 'error' ? 'rgba(255, 107, 107, 0.3)' : 
                              message.type === 'success' ? 'rgba(74, 222, 128, 0.3)' : 'rgba(251, 191, 36, 0.3)'}`,
            color: message.type === 'error' ? '#ff6b6b' : 
                   message.type === 'success' ? '#4ade80' : '#fbbf24',
            padding: '12px',
            borderRadius: '8px',
            margin: '16px 0'
          }}>
            {message.text}
          </div>
        )}

        <div className="sep" />

        {/* Section Organisations */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 className="h1">🏢 Organisations ({organizations.length})</h2>
            <button 
              onClick={() => openOrgModal()}
              className="add-match-btn"
            >
              ➕ Nouvelle organisation
            </button>
          </div>

          <div className="matches-list">
            {organizations.map(org => (
              <div key={org.id} className="match-row">
                <div className="match-details">
                  <div className="match-name">{org.name}</div>
                  <div className="match-teams">Slug: {org.slug}</div>
                  <div className="match-sport">
                    <span className="sport-badge">ID: {org.id}</span>
                  </div>
                </div>
                <div className="match-datetime">
                  <div className="match-date">Créée le {new Date(org.created_at).toLocaleDateString('fr-FR')}</div>
                  <div className="match-time">{new Date(org.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <div className="match-actions">
                  <button 
                    onClick={() => openOrgModal(org)}
                    style={{ background: '#f59e0b', borderColor: '#f59e0b', color: 'white' }}
                  >
                    ✏️ Modifier
                  </button>
                  <button 
                    onClick={() => handleDeleteOrg(org.id)}
                    className="danger"
                  >
                    🗑️ Supprimer
                  </button>
                </div>
              </div>
            ))}
            {organizations.length === 0 && (
              <div className="empty-list">
                <div>Aucune organisation</div>
                <div className="small">Créez votre première organisation</div>
              </div>
            )}
          </div>
        </div>

        <div className="sep" />

        {/* Section Utilisateurs */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 className="h1">👤 Utilisateurs ({users.length})</h2>
            <button 
              onClick={openUserModal}
              className="add-match-btn"
            >
              ➕ Nouvel utilisateur
            </button>
          </div>

          <div className="matches-list">
            {users.map(user => (
              <div key={user.id} className="match-row">
                <div className="match-details">
                  <div className="match-name">{user.email}</div>
                  <div className="match-sport">
                    <span className="sport-badge">ID: {user.id}</span>
                  </div>
                </div>
                <div className="match-datetime">
                  <div className="match-date">Créé le {new Date(user.created_at).toLocaleDateString('fr-FR')}</div>
                  <div className="match-time">{new Date(user.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <div className="match-actions">
                  <span style={{ color: '#9aa0a6', fontSize: '14px' }}>
                    Utilisateur système
                  </span>
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <div className="empty-list">
                <div>Aucun utilisateur</div>
                <div className="small">Créez votre premier utilisateur</div>
              </div>
            )}
          </div>
        </div>

        <div className="sep" />

        {/* Section Membres d'organisations */}
        <div style={{ marginBottom: '40px' }}>
          <h2 className="h1">👥 Membres d'organisations ({orgMembers.length})</h2>
          
          <div style={{ background: '#1a1b1e', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#eaeaea' }}>Ajouter un membre</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Organisation</label>
                <select 
                  value={memberForm.org_id}
                  onChange={e => setMemberForm(prev => ({ ...prev, org_id: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: '#121316',
                    border: '1px solid #202327',
                    borderRadius: '6px',
                    color: '#eaeaea'
                  }}
                >
                  <option value="">Sélectionner...</option>
                  {organizations.map(org => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Utilisateur</label>
                <select 
                  value={memberForm.user_id}
                  onChange={e => setMemberForm(prev => ({ ...prev, user_id: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: '#121316',
                    border: '1px solid #202327',
                    borderRadius: '6px',
                    color: '#eaeaea'
                  }}
                >
                  <option value="">Sélectionner...</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>{user.email}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Rôle</label>
                <select 
                  value={memberForm.role}
                  onChange={e => setMemberForm(prev => ({ ...prev, role: e.target.value as 'super_admin' | 'operator' }))}
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: '#121316',
                    border: '1px solid #202327',
                    borderRadius: '6px',
                    color: '#eaeaea'
                  }}
                >
                  <option value="operator">Operator</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <button 
                onClick={handleAddMember}
                className="primary"
                disabled={!memberForm.org_id || !memberForm.user_id}
              >
                Ajouter
              </button>
            </div>
          </div>

          <div className="matches-list">
            {orgMembers.map(member => (
              <div key={`${member.org_id}-${member.user_id}`} className="match-row">
                <div className="match-details">
                  <div className="match-name">{member.user_email}</div>
                  <div className="match-teams">Organisation: {member.org_name}</div>
                  <div className="match-sport">
                    <span className={`sport-badge ${member.role === 'super_admin' ? 'super-admin' : 'operator'}`}>
                      {member.role === 'super_admin' ? '👑 Super Admin' : '👤 Operator'}
                    </span>
                  </div>
                </div>
                <div className="match-actions">
                  <button 
                    onClick={() => handleRemoveMember(member.org_id, member.user_id)}
                    className="danger"
                  >
                    🗑️ Retirer
                  </button>
                </div>
              </div>
            ))}
            {orgMembers.length === 0 && (
              <div className="empty-list">
                <div>Aucun membre d'organisation</div>
                <div className="small">Ajoutez des membres aux organisations</div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Organisation */}
        {showOrgModal && (
          <div className="modal-overlay" onClick={() => setShowOrgModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{editingOrg ? '✏️ Modifier l\'organisation' : '➕ Nouvelle organisation'}</h2>
                <button 
                  className="modal-close"
                  onClick={() => setShowOrgModal(false)}
                >
                  ✕
                </button>
              </div>
              
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-row">
                    <label>Nom de l'organisation</label>
                    <input 
                      className="input" 
                      placeholder="Ex: Association Sportive" 
                      value={orgForm.name} 
                      onChange={e => setOrgForm(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  
                  <div className="form-row">
                    <label>Slug (identifiant unique)</label>
                    <input 
                      className="input" 
                      placeholder="Ex: as-sport" 
                      value={orgForm.slug} 
                      onChange={e => setOrgForm(prev => ({ ...prev, slug: e.target.value.toLowerCase() }))}
                    />
                  </div>
                </div>
              </div>
              
              <div className="modal-footer">
                <button 
                  onClick={() => setShowOrgModal(false)}
                  className="secondary"
                >
                  Annuler
                </button>
                <button 
                  onClick={editingOrg ? handleEditOrg : handleCreateOrg}
                  className="primary"
                  disabled={!orgForm.name.trim() || !orgForm.slug.trim()}
                >
                  {editingOrg ? '✅ Sauvegarder' : '✅ Créer'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Utilisateur */}
        {showUserModal && (
          <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>➕ Nouvel utilisateur</h2>
                <button 
                  className="modal-close"
                  onClick={() => setShowUserModal(false)}
                >
                  ✕
                </button>
              </div>
              
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-row">
                    <label>Email</label>
                    <input 
                      className="input" 
                      type="email"
                      placeholder="Ex: utilisateur@example.com" 
                      value={userForm.email} 
                      onChange={e => setUserForm(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  
                  <div className="form-row">
                    <label>Mot de passe</label>
                    <input 
                      className="input" 
                      type="password"
                      placeholder="Mot de passe temporaire" 
                      value={userForm.password} 
                      onChange={e => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              
              <div className="modal-footer">
                <button 
                  onClick={() => setShowUserModal(false)}
                  className="secondary"
                >
                  Annuler
                </button>
                <button 
                  onClick={handleCreateUser}
                  className="primary"
                  disabled={!userForm.email.trim() || !userForm.password.trim()}
                >
                  ✅ Créer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
