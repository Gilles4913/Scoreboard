
import React, { useEffect, useState } from 'react';
import { supa } from '../supabase';

interface Org {
  id: string;
  name: string;
  sport: string;
  archived: boolean;
  created_at: string;
}

interface Operator {
  id: string;
  email: string;
}

export default function SuperAdminPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Org | null>(null);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newOrgName, setNewOrgName] = useState('');
  const [newSport, setNewSport] = useState('');
  const [newOperatorEmail, setNewOperatorEmail] = useState('');

  // Chargement initial des organisations
  useEffect(() => {
    loadOrgs();
  }, []);

  async function loadOrgs() {
    try {
      setLoading(true);
      const { data, error } = await supa
        .from('orgs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrgs(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }

  async function selectOrg(org: Org) {
    setSelectedOrg(org);
    await loadOperators(org.id);
  }

  async function loadOperators(orgId: string) {
    try {
      const { data, error } = await supa
        .from('org_members')
        .select('user_id, email')
        .eq('org_id', orgId);

      if (error) throw error;
      setOperators(data?.map((op: any) => ({ id: op.user_id, email: op.email })) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    }
  }

  async function createOrg() {
    if (!newOrgName || !newSport) {
      alert('Veuillez renseigner un nom et un sport.');
      return;
    }
    try {
      const { error } = await supa
        .from('orgs')
        .insert([{ name: newOrgName, sport: newSport }]);
      if (error) throw error;
      setNewOrgName('');
      setNewSport('');
      await loadOrgs();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur création organisation');
    }
  }

  async function toggleArchive(org: Org) {
    const confirmMsg = org.archived
      ? `Désarchiver ${org.name} ?`
      : `Archiver ${org.name} ?`;
    if (!window.confirm(confirmMsg)) return;
    try {
      const { error } = await supa
        .from('orgs')
        .update({ archived: !org.archived })
        .eq('id', org.id);
      if (error) throw error;
      await loadOrgs();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur archivage organisation');
    }
  }

  async function deleteOrg(org: Org) {
    if (!window.confirm(`Supprimer définitivement ${org.name} ?`)) return;
    try {
      const { error } = await supa.from('orgs').delete().eq('id', org.id);
      if (error) throw error;
      setSelectedOrg(null);
      await loadOrgs();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur suppression organisation');
    }
  }

  async function addOperator() {
    if (!selectedOrg) return;
    if (!newOperatorEmail) {
      alert('Entrez un email.');
      return;
    }

    try {
      // 1. Chercher l’utilisateur existant
      const { data: userData, error: rpcError } = await supa.rpc(
        'admin_get_user_id_by_email',
        { p_email: newOperatorEmail }
      );

      if (rpcError) throw rpcError;
      const userId = userData || null;

      if (!userId) {
        alert("Cet utilisateur n'existe pas encore dans la base Supabase.");
        return;
      }

      // 2. Lier l’utilisateur à l’organisation
      const { error } = await supa.from('org_members').insert([
        { org_id: selectedOrg.id, user_id: userId, role: 'operator' }
      ]);
      if (error) throw error;

      setNewOperatorEmail('');
      await loadOperators(selectedOrg.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur ajout opérateur');
    }
  }

  async function removeOperator(op: Operator) {
    if (!selectedOrg) return;
    if (!window.confirm(`Retirer ${op.email} de ${selectedOrg.name} ?`)) return;
    try {
      const { error } = await supa
        .from('org_members')
        .delete()
        .eq('org_id', selectedOrg.id)
        .eq('user_id', op.id);
      if (error) throw error;
      await loadOperators(selectedOrg.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur suppression opérateur');
    }
  }

  return (
    <div style={container}>
      <div style={sidebar}>
        <h2 style={{ color: 'white' }}>Organisations</h2>

        {loading && <div>Chargement…</div>}
        {!loading && (
          <>
            {orgs.map((org) => (
              <div
                key={org.id}
                onClick={() => selectOrg(org)}
                style={{
                  ...orgItem,
                  background: selectedOrg?.id === org.id ? '#2563eb' : '#1b1c1f'
                }}
              >
                <div style={{ fontWeight: 600 }}>{org.name}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  {org.sport} {org.archived ? '(Archivé)' : ''}
                </div>
              </div>
            ))}

            <div style={divider}></div>

            <input
              placeholder="Nom organisation"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              style={input}
            />
            <input
              placeholder="Sport"
              value={newSport}
              onChange={(e) => setNewSport(e.target.value)}
              style={input}
            />
            <button onClick={createOrg} style={btnPrimary}>
              ➕ Créer
            </button>
          </>
        )}
      </div>

      <div style={content}>
        {selectedOrg ? (
          <>
            <h2 style={{ color: 'white' }}>{selectedOrg.name}</h2>
            <p style={{ color: '#9aa0a6' }}>Sport : {selectedOrg.sport}</p>

            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <button onClick={() => toggleArchive(selectedOrg)} style={btnSecondary}>
                {selectedOrg.archived ? 'Désarchiver' : 'Archiver'}
              </button>
              <button onClick={() => deleteOrg(selectedOrg)} style={btnDanger}>
                Supprimer
              </button>
            </div>

            <h3 style={{ color: 'white' }}>Opérateurs</h3>
            <div style={{ marginBottom: 12 }}>
              {operators.length === 0 && <p style={{ color: '#9aa0a6' }}>Aucun opérateur.</p>}
              {operators.map((op) => (
                <div
                  key={op.id}
                  style={{
                    ...opItem,
                    background: '#1b1c1f',
                    border: '1px solid #2c2d31'
                  }}
                >
                  <span>{op.email}</span>
                  <button onClick={() => removeOperator(op)} style={btnSmallDanger}>
                    ❌
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <input
                placeholder="Email opérateur"
                value={newOperatorEmail}
                onChange={(e) => setNewOperatorEmail(e.target.value)}
                style={input}
              />
              <button onClick={addOperator} style={btnPrimary}>
                ➕
              </button>
            </div>
          </>
        ) : (
          <div style={{ color: '#9aa0a6' }}>Sélectionnez une organisation</div>
        )}
      </div>
    </div>
  );
}

// 🎨 Styles inline cohérents
const container: React.CSSProperties = {
  display: 'flex',
  minHeight: 'calc(100vh - 60px)',
  background: '#0c0d10',
  color: 'white'
};

const sidebar: React.CSSProperties = {
  width: 280,
  background: '#111214',
  padding: 20,
  borderRight: '1px solid #1b1c1f',
  overflowY: 'auto'
};

const content: React.CSSProperties = {
  flex: 1,
  padding: 30,
  overflowY: 'auto'
};

const orgItem: React.CSSProperties = {
  padding: 12,
  borderRadius: 8,
  cursor: 'pointer',
  marginBottom: 6
};

const input: React.CSSProperties = {
  width: '100%',
  padding: 8,
  marginBottom: 8,
  background: '#121316',
  border: '1px solid #2c2d31',
  borderRadius: 6,
  color: 'white'
};

const btnPrimary: React.CSSProperties = {
  background: '#2563eb',
  border: 'none',
  padding: '8px 14px',
  color: 'white',
  borderRadius: 6,
  cursor: 'pointer'
};

const btnSecondary: React.CSSProperties = {
  background: '#374151',
  border: 'none',
  padding: '8px 14px',
  color: 'white',
  borderRadius: 6,
  cursor: 'pointer'
};

const btnDanger: React.CSSProperties = {
  background: '#dc2626',
  border: 'none',
  padding: '8px 14px',
  color: 'white',
  borderRadius: 6,
  cursor: 'pointer'
};

const btnSmallDanger: React.CSSProperties = {
  background: '#dc2626',
  border: 'none',
  padding: '2px 8px',
  color: 'white',
  borderRadius: 6,
  cursor: 'pointer'
};

const opItem: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '6px 8px',
  borderRadius: 6,
  marginBottom: 4
};

const divider: React.CSSProperties = {
  height: 1,
  background: '#1b1c1f',
  margin: '16px 0'
};

