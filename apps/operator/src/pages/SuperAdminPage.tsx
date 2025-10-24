import React, { useEffect, useMemo, useState } from 'react';
import { supa } from '../supabase';

type Org = { id: string; slug: string; name: string };
type Member = { user_id: string; role: 'operator' | 'admin' | 'super_admin'; org_id: string };
type Profile = { id: string; email?: string | null };

function slugify(input: string) {
  return input
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
}

export default function SuperAdminPage() {
  const [me, setMe] = useState<any>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Création org
  const [orgName, setOrgName] = useState('');
  const orgSlug = useMemo(() => slugify(orgName || ''), [orgName]);

  // Ajout opérateur par email
  const [newOperatorEmail, setNewOperatorEmail] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supa.auth.getSession();
      setMe(session?.user ?? null);
    })();
  }, []);

  // Charger mes orgs (où je suis membre super_admin) + toutes visibles (mode proto)
  useEffect(() => {
    (async () => {
      const { data, error } = await supa.from('orgs').select('id, slug, name').order('created_at', { ascending: false });
      if (!error && data) {
        setOrgs(data);
        if (!currentOrgId && data.length) setCurrentOrgId(data[0].id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Charger membres de l’org + leurs profils (pour afficher email)
  useEffect(() => {
    (async () => {
      if (!currentOrgId) return;
      const { data: mems, error } = await supa
        .from('org_members')
        .select('user_id, role, org_id')
        .eq('org_id', currentOrgId);

      if (!error && mems) {
        setMembers(mems);
        const ids = Array.from(new Set(mems.map(m => m.user_id)));
        if (ids.length) {
          const { data: profs } = await supa
            .from('profiles')
            .select('id, email')
            .in('id', ids);
          const map: Record<string, Profile> = {};
          (profs || []).forEach(p => { map[p.id] = p; });
          setProfilesById(map);
        } else {
          setProfilesById({});
        }
      }
    })();
  }, [currentOrgId]);

  const onLogout = async () => {
    await supa.auth.signOut();
    window.location.href = '/login';
  };

  const createOrganization = async () => {
    setBusy(true); setMessage(null);
    try {
      if (!orgName.trim()) { setMessage('Nom requis'); return; }
      if (!me?.id) { setMessage('Session requise'); return; }

      // 1) créer l’org
      const { data: org, error: orgErr } = await supa
        .from('orgs')
        .insert({ name: orgName.trim(), slug: orgSlug || slugify(orgName) })
        .select()
        .single();

      if (orgErr || !org) {
        setMessage(`Erreur création Organisation : ${orgErr?.message || 'inconnue'}`);
        return;
      }

      // 2) ajouter le créateur comme super_admin (mode proto : pas de RLS)
      await supa.from('org_members').insert({
        user_id: me.id,
        org_id: org.id,
        role: 'super_admin'
      });

      setOrgs(prev => [org as Org, ...prev]);
      setCurrentOrgId(org.id);
      setOrgName('');
      setMessage('Organisation créée ✅');
    } catch (e: any) {
      setMessage(`Erreur création Organisation : ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const addOperatorByEmail = async () => {
    setBusy(true); setMessage(null);
    try {
      if (!currentOrgId) { setMessage('Sélectionne une organisation'); return; }
      if (!newOperatorEmail.trim()) { setMessage('Email requis'); return; }

      // On lit le profil via la table profiles (publiques), pas auth.users (restreint côté client)
      const { data: prof } = await supa
        .from('profiles')
        .select('id, email')
        .eq('email', newOperatorEmail.trim().toLowerCase())
        .maybeSingle();

      if (!prof) {
        setMessage(`Cet utilisateur n'existe pas encore dans la base Supabase.`);
        return;
      }

      // upsert membership operator
      const { error: upErr } = await supa
        .from('org_members')
        .upsert({ user_id: prof.id, org_id: currentOrgId, role: 'operator' }, { onConflict: 'user_id,org_id' });

      if (upErr) {
        setMessage(`Erreur ajout opérateur : ${upErr.message}`);
        return;
      }

      // refresh list
      setNewOperatorEmail('');
      // recharge les membres
      const { data: mems } = await supa
        .from('org_members')
        .select('user_id, role, org_id')
        .eq('org_id', currentOrgId);
      setMembers(mems || []);

      // cache profil
      setProfilesById(prev => ({ ...prev, [prof.id]: prof as Profile }));
      setMessage('Opérateur ajouté ✅');
    } catch (e: any) {
      setMessage(`Erreur ajout opérateur : ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (userId: string) => {
    if (!currentOrgId) return;
    setBusy(true); setMessage(null);
    try {
      await supa
        .from('org_members')
        .delete()
        .eq('org_id', currentOrgId)
        .eq('user_id', userId);
      setMembers(prev => prev.filter(m => m.user_id !== userId));
      setMessage('Membre retiré ✅');
    } catch (e: any) {
      setMessage(`Erreur suppression : ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };
  // --- Création de compte utilisateur via API admin ---
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('operator');

  const createNewUser = async () => {
    setBusy(true); setMessage(null);
    try {
      if (!newUserEmail.trim() || !newUserPassword.trim()) {
        setMessage('Email et mot de passe requis');
        return;
      }

      // ⚠️ Ton backend admin doit tourner sur http://localhost:3000
      const response = await fetch('http://localhost:3000/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': 'changeme-very-secret', // même valeur que ton .env du backend
        },
        body: JSON.stringify({
          email: newUserEmail,
          password: newUserPassword,
          org_slug: orgs.find(o => o.id === currentOrgId)?.slug,
          role: newUserRole,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Erreur inconnue');

      setMessage(`Utilisateur créé : ${result.user.email}`);
      setNewUserEmail('');
      setNewUserPassword('');
    } catch (e: any) {
      setMessage(`Erreur création utilisateur : ${e.message || e}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-page">
      <div className="space-header">
        <h1>Super Admin — Gestion des organisations</h1>
        <div className="row">
          <span>{me?.email}</span>
          <button className="secondary" onClick={onLogout}>Déconnexion</button>
        </div>
      </div>

      {message && <div className="form-message" style={{ marginBottom: 12 }}>{message}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-grid">
          <div className="form-row-split">
            <div className="form-field">
              <label>Créer une organisation</label>
              <input placeholder="Nom de l'organisation"
                     value={orgName} onChange={e => setOrgName(e.target.value)} />
              <div className="small">Slug proposé : <code>{orgSlug || '—'}</code></div>
            </div>
            <div className="form-field" style={{ alignSelf: 'end' }}>
              <button className="primary" disabled={busy} onClick={createOrganization}>
                Créer
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-row">
          <label>Organisation active</label>
          <select value={currentOrgId ?? ''} onChange={e => setCurrentOrgId(e.target.value)}>
            {orgs.map(o => <option key={o.id} value={o.id}>{o.name} ({o.slug})</option>)}
          </select>
        </div>
      </div>
      <hr style={{ margin: '20px 0', borderColor: '#1b1c1f' }} />
      <h2 className="h1">Créer un nouvel utilisateur (Super Admin)</h2>
      <div className="form-grid" style={{ marginTop: 8 }}>
        <div className="form-row">
          <label>Email</label>
          <input
            placeholder="exemple@domaine.com"
            value={newUserEmail}
            onChange={e => setNewUserEmail(e.target.value)}
          />
        </div>
        <div className="form-row">
          <label>Mot de passe</label>
          <input
            type="password"
            placeholder="Mot de passe"
            value={newUserPassword}
            onChange={e => setNewUserPassword(e.target.value)}
          />
        </div>
        <div className="form-row">
          <label>Rôle</label>
          <select
            value={newUserRole}
            onChange={e => setNewUserRole(e.target.value)}
          >
            <option value="operator">Operator</option>
            <option value="admin">Admin</option>
            <option value="super_admin">Super Admin</option>
          </select>
        </div>
        <button className="primary" disabled={busy} onClick={createNewUser}>
          Créer l’utilisateur
        </button>
      </div>

      <div className="card">
        <h2 className="h1">Opérateurs de l’organisation</h2>
        <div className="form-row-split" style={{ marginTop: 8 }}>
          <div className="form-field">
            <label>Ajouter un opérateur par email Supabase</label>
            <input placeholder="email@domaine.tld"
                   value={newOperatorEmail}
                   onChange={e => setNewOperatorEmail(e.target.value)} />
          </div>
          <div className="form-field" style={{ alignSelf: 'end' }}>
            <button className="primary" disabled={busy} onClick={addOperatorByEmail}>
              Ajouter
            </button>
          </div>
        </div>

        <div className="matches-list" style={{ marginTop: 16 }}>
          {members.length === 0 ? (
            <div className="empty-list">Aucun membre pour cette organisation.</div>
          ) : (
            members.map(m => {
              const p = profilesById[m.user_id];
              return (
                <div className="match-row" key={m.user_id}>
                  <div className="match-details">
                    <div className="match-name">{p?.email || m.user_id}</div>
                    <div className="match-teams">Rôle : {m.role}</div>
                  </div>
                  <div className="match-actions">
                    <button className="danger" onClick={() => removeMember(m.user_id)}>Retirer</button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
