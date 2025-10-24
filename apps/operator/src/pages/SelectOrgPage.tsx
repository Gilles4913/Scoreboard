import React, { useEffect, useState } from 'react';
import { supa } from '../supabase';

function getSelectedOrgId(): string | null {
  return localStorage.getItem('currentOrgId');
}
function setSelectedOrgId(orgId: string | null) {
  if (!orgId) localStorage.removeItem('currentOrgId');
  else localStorage.setItem('currentOrgId', orgId);
}

type Org = { id: string; name: string; slug: string };

export default function SelectOrgPage() {
  const [me, setMe] = useState<any>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [memberships, setMemberships] = useState<{ org_id: string; role: string }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supa.auth.getSession();
      setMe(session?.user ?? null);

      // Orgs accessibles (mode proto : tout)
      const { data: allOrgs } = await supa.from('orgs').select('id, name, slug').order('name', { ascending: true });
      setOrgs(allOrgs || []);

      // Memberships réels de l'utilisateur
      if (session?.user?.id) {
        const { data: mems } = await supa
          .from('org_members')
          .select('org_id, role')
          .eq('user_id', session.user.id);
        setMemberships(mems || []);
      }
    })();
  }, []);

  const myOrgIds = new Set(memberships.map(m => m.org_id));
  const myOrgs = orgs.filter(o => myOrgIds.has(o.id));

  const pick = (id: string) => {
    setSelectedOrgId(id);
    window.location.href = '/matches';
  };

  const onLogout = async () => {
    await supa.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div className="space-page">
      <div className="space-header">
        <h1>Choisir une organisation</h1>
        <div className="row">
          <span>{me?.email}</span>
          <button className="secondary" onClick={onLogout}>Déconnexion</button>
        </div>
      </div>

      {msg && <div className="form-message" style={{ marginBottom: 12 }}>{msg}</div>}

      <div className="card">
        {myOrgs.length === 0 ? (
          <div className="empty-list">Aucune organisation liée à votre compte.</div>
        ) : (
          <div className="matches-list">
            {myOrgs.map(o => (
              <div className="match-row" key={o.id}>
                <div className="match-details">
                  <div className="match-name">{o.name}</div>
                  <div className="match-teams">Slug : {o.slug}</div>
                </div>
                <div className="match-actions">
                  <button className="primary" onClick={() => pick(o.id)}>Sélectionner</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
