// apps/operator/src/pages/SuperAdminPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { supa } from '../supabase';

type Org = {
  id: string;
  slug: string;
  name: string;
  sport: 'football' | 'basket' | 'handball' | 'hockey' | 'hockey_ice' | 'hockey_field' | 'volleyball' | 'unknown';
  archived_at: string | null;
  created_at?: string;
};

type Member = {
  org_id: string;
  user_id: string;
  role: 'super_admin' | 'operator';
  email?: string; // pour l’affichage si tu veux enrichir via auth.users
};

const SPORTS: Org['sport'][] = ['football','basket','handball','hockey','hockey_ice','hockey_field','volleyball','unknown'];

export default function SuperAdminPage() {
  const [loading, setLoading] = useState(false);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [error, setError] = useState<string>('');
  const [form, setForm] = useState<Partial<Org>>({ slug: '', name: '', sport: 'football' });
  const [membersByOrg, setMembersByOrg] = useState<Record<string, Member[]>>({});
  const [ops, setOps] = useState({ userEmail: '', orgId: '' });

  const activeOrgs = useMemo(() => orgs.filter(o => !o.archived_at), [orgs]);
  const archivedOrgs = useMemo(() => orgs.filter(o => !!o.archived_at), [orgs]);

  async function loadOrgs() {
    setLoading(true);
    setError('');
    const { data, error } = await supa
      .from('orgs')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) setError(error.message);
    setOrgs((data as Org[]) || []);
    setLoading(false);
  }

  async function loadMembers(orgId: string) {
    const { data, error } = await supa
      .from('org_members')
      .select('org_id,user_id,role')
      .eq('org_id', orgId);
    if (error) {
      setError(error.message);
      return;
    }
    setMembersByOrg(prev => ({ ...prev, [orgId]: (data as Member[]) || [] }));
  }

  useEffect(() => { loadOrgs(); }, []);

  async function handleCreateOrg() {
    setError('');
    if (!form.slug || !form.name || !form.sport) {
      setError('slug, name et sport sont requis.');
      return;
    }
    const { error } = await supa.from('orgs').insert({
      slug: form.slug,
      name: form.name,
      sport: form.sport
    });
    if (error) {
      setError(error.message);
      return;
    }
    setForm({ slug: '', name: '', sport: 'football' });
    await loadOrgs();
  }

  async function handleUpdateOrg(id: string, patch: Partial<Org>) {
    setError('');
    const { error } = await supa.from('orgs').update(patch).eq('id', id);
    if (error) {
      setError(error.message);
      return;
    }
    await loadOrgs();
  }

  async function handleArchiveOrg(id: string) {
    setError('');
    const { error } = await supa.from('orgs').update({ archived_at: new Date().toISOString() }).eq('id', id);
    if (error) {
      setError(error.message);
      return;
    }
    await loadOrgs();
  }

  async function handleUnarchiveOrg(id: string) {
    setError('');
    const { error } = await supa.from('orgs').update({ archived_at: null }).eq('id', id);
    if (error) {
      setError(error.message);
      return;
    }
    await loadOrgs();
  }

  async function handleDeleteOrg(id: string) {
    if (!confirm('Supprimer définitivement cette organisation ?')) return;
    setError('');
    const { error } = await supa.from('orgs').delete().eq('id', id);
    if (error) {
      setError(error.message);
      return;
    }
    await loadOrgs();
  }

  // Helpers pour opérateurs
  async function getUserIdByEmail(email: string): Promise<string | null> {
    // ⚠️ En vanilla Supabase (sans admin API), tu ne peux pas lister auth.users côté client.
    // Stratégie simple: tu maintiens un mapping côté app (invitation par magic link), ou tu crées un RPC sécurisé.
    // Ici on suppose que tu as un RPC sécurisé qui retourne l’uid par email (réservé aux super_admin).
    const { data, error } = await supa.rpc('admin_get_user_id_by_email', { p_email: email });
    if (error) {
      setError(error.message);
      return null;
    }
    return data as string | null;
  }

  async function handleAddOperator() {
    setError('');
    if (!ops.orgId || !ops.userEmail) {
      setError('Sélectionne une organisation et saisis un email utilisateur.');
      return;
    }
    const uid = await getUserIdByEmail(ops.userEmail);
    if (!uid) {
      setError('Utilisateur introuvable (vérifie l’email ou implémente la création/invitation).');
      return;
    }
    const { error } = await supa.from('org_members').insert({
      org_id: ops.orgId,
      user_id: uid,
      role: 'operator'
    });
    if (error) {
      // L’index uq_operator_single_org remontera une erreur si l’utilisateur est déjà opérateur ailleurs
      setError(error.message);
      return;
    }
    setOps({ userEmail: '', orgId: ops.orgId });
    await loadMembers(ops.orgId);
  }

  async function handleRemoveOperator(orgId: string, userId: string) {
    setError('');
    const { error } = await supa.from('org_members').delete()
      .eq('org_id', orgId).eq('user_id', userId).eq('role', 'operator');
    if (error) {
      setError(error.message);
      return;
    }
    await loadMembers(orgId);
  }

  return (
    <div style={{ padding: 24, color: '#eaeaea', background: '#0b0b0c', minHeight: '100vh', fontFamily: 'Inter, system-ui' }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>🛠️ Super Admin</h1>
      <p style={{ color: '#9aa0a6', marginBottom: 24 }}>
        Gestion des organisations et des opérateurs (invariants DB appliqués).
      </p>

      {error && (
        <div style={{ background: 'rgba(255, 107, 107, 0.1)', border: '1px solid rgba(255, 107, 107, 0.3)', color: '#ff6b6b', padding: 12, borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Création d’organisation */}
      <div style={{ border: '1px solid #1b1c1f', background: '#111214', borderRadius: 12, padding: 16, marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, margin: '0 0 12px 0' }}>Créer une organisation</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input placeholder="slug" value={form.slug ?? ''} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} style={inputStyle}/>
          <input placeholder="name" value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle}/>
          <select value={form.sport ?? 'football'} onChange={e => setForm(f => ({ ...f, sport: e.target.value as Org['sport'] }))} style={selectStyle}>
            {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={handleCreateOrg} style={btnPrimary}>Créer</button>
        </div>
      </div>

      {/* Orgs actives */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, margin: '0 0 12px 0' }}>Organisations actives</h2>
        {loading ? <div>Chargement…</div> : (
          activeOrgs.length === 0 ? <div>Aucune organisation.</div> : (
            <div style={{ display: 'grid', gap: 12 }}>
              {activeOrgs.map(org => (
                <OrgCard
                  key={org.id}
                  org={org}
                  onEdit={(patch) => handleUpdateOrg(org.id, patch)}
                  onArchive={() => handleArchiveOrg(org.id)}
                  onDelete={() => handleDeleteOrg(org.id)}
                  onLoadMembers={() => loadMembers(org.id)}
                  members={membersByOrg[org.id] || []}
                  onAddOperator={(email) => setOps({ userEmail: email, orgId: org.id })}
                  onRemoveOperator={(userId) => handleRemoveOperator(org.id, userId)}
                />
              ))}
            </div>
          )
        )}
      </section>

      {/* Orgs archivées */}
      <section>
        <h2 style={{ fontSize: 18, margin: '0 0 12px 0' }}>Organisations archivées</h2>
        {archivedOrgs.length === 0 ? <div>—</div> : (
          <div style={{ display: 'grid', gap: 12 }}>
            {archivedOrgs.map(org => (
              <div key={org.id} style={cardStyle}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{org.name}</div>
                    <div style={{ fontSize: 12, color: '#9aa0a6' }}>{org.slug} — {org.sport}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => handleUnarchiveOrg(org.id)} style={btnGhost}>Désarchiver</button>
                    <button onClick={() => handleDeleteOrg(org.id)} style={btnDanger}>Supprimer</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Drawer simple pour ajouter un opérateur à l’org sélectionnée */}
      {ops.orgId && (
        <div style={{ marginTop: 24, borderTop: '1px dashed #333', paddingTop: 16 }}>
          <h3 style={{ fontSize: 16, marginBottom: 8 }}>Ajouter un opérateur</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input placeholder="email opérateur" value={ops.userEmail} onChange={e => setOps(p => ({ ...p, userEmail: e.target.value }))} style={inputStyle}/>
            <button onClick={handleAddOperator} style={btnPrimary}>Ajouter</button>
            <button onClick={() => setOps({ userEmail: '', orgId: '' })} style={btnGhost}>Annuler</button>
          </div>
          <div style={{ fontSize: 12, color: '#9aa0a6', marginTop: 4 }}>
            L’unicité “un opérateur → une org” est appliquée en base (index partiel).
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: '#121316', border: '1px solid #202327', color: '#eaeaea',
  padding: '10px 12px', borderRadius: 8, minWidth: 160
};
const selectStyle = { ...inputStyle };
const btnPrimary: React.CSSProperties = { padding: '10px 12px', borderRadius: 8, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', cursor: 'pointer' };
const btnGhost: React.CSSProperties   = { padding: '10px 12px', borderRadius: 8, border: '1px solid #374151', background: '#1f2937', color: '#eaeaea', cursor: 'pointer' };
const btnDanger: React.CSSProperties  = { padding: '10px 12px', borderRadius: 8, border: '1px solid #ef4444', background: '#b91c1c', color: '#fff', cursor: 'pointer' };
const cardStyle: React.CSSProperties  = { border: '1px solid #1b1c1f', background: '#111214', borderRadius: 12, padding: 16 };

function OrgCard(props: {
  org: Org;
  members: Member[];
  onEdit: (patch: Partial<Org>) => void;
  onArchive: () => void;
  onDelete: () => void;
  onLoadMembers: () => void;
  onAddOperator: (email: string) => void;
  onRemoveOperator: (userId: string) => void;
}) {
  const { org, members, onEdit, onArchive, onDelete, onLoadMembers, onAddOperator, onRemoveOperator } = props;
  const [edit, setEdit] = useState<Partial<Org>>({ name: org.name, sport: org.sport });

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 600 }}>{org.name}</div>
          <div style={{ fontSize: 12, color: '#9aa0a6' }}>{org.slug} — {org.sport}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onArchive()} style={btnGhost}>Archiver</button>
          <button onClick={() => onDelete()} style={btnDanger}>Supprimer</button>
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={edit.name ?? ''} onChange={e => setEdit(p => ({ ...p, name: e.target.value }))} style={inputStyle}/>
        <select value={edit.sport ?? 'football'} onChange={e => setEdit(p => ({ ...p, sport: e.target.value as Org['sport'] }))} style={selectStyle}>
          {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={() => onEdit(edit)} style={btnPrimary}>Enregistrer</button>
      </div>

      <div style={{ marginTop: 12, borderTop: '1px dashed #333', paddingTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h3 style={{ fontSize: 16, margin: 0 }}>Opérateurs</h3>
          <button onClick={onLoadMembers} style={btnGhost}>Actualiser</button>
        </div>

        {members.length === 0 ? (
          <div style={{ color: '#9aa0a6', marginTop: 8 }}>— Aucun opérateur —</div>
        ) : (
          <ul style={{ marginTop: 8 }}>
            {members.map(m => (
              <li key={m.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                <div><code>{m.user_id}</code> — {m.role}</div>
                {m.role === 'operator' && (
                  <button onClick={() => onRemoveOperator(m.user_id)} style={btnDanger}>Retirer</button>
                )}
              </li>
            ))}
          </ul>
        )}

        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <button onClick={() => onAddOperator(prompt('Email de l’opérateur à ajouter ?') || '')} style={btnPrimary}>+ Ajouter un opérateur</button>
        </div>
      </div>
    </div>
  );
}

