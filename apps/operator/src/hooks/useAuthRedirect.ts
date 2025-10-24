import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supa } from '../supabase';

function setSelectedOrgId(orgId: string | null) {
  if (!orgId) localStorage.removeItem('currentOrgId');
  else localStorage.setItem('currentOrgId', orgId);
}

/**
 * Redirige selon:
 * - /login si pas de session
 * - /super-admin si profil.role='super_admin' ou membership super_admin
 * - /select-org si >1 org
 * - /matches si 1 seule org (et on la sélectionne)
 * - /auth-debug sinon
 */
export function useAuthRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data: { session } } = await supa.auth.getSession();
        if (!mounted) return;

        if (!session) {
          navigate('/login', { replace: true });
          return;
        }
        const userId = session.user.id;

        // profil (si présent)
        const { data: profile, error: pErr } = await supa
          .from('profiles')
          .select('id, role')
          .eq('id', userId)
          .maybeSingle();

        if (!mounted) return;
        if (pErr) {
          navigate('/auth-debug', { replace: true });
          return;
        }

        // memberships
        const { data: memberships, error: mErr } = await supa
          .from('orgs') // plus simple: on cherche les orgs où il est membre via vue/joins désactivés ? on reste basique:
          .select('id, slug, name'); // DB ouverte en proto → toutes les orgs sont visibles; pour être fidèle à la logique, lis org_members:
        if (mErr) {
          // fallback vers org_members si select orgs avec RLS plus tard
        }

        const { data: mems, error: mmErr } = await supa
          .from('org_members')
          .select('org_id, role')
          .eq('user_id', userId);

        if (!mounted) return;
        if (mmErr) {
          navigate('/auth-debug', { replace: true });
          return;
        }

        const isSuperAdmin =
          profile?.role === 'super_admin' ||
          (mems ?? []).some(m => m.role === 'super_admin');

        if (isSuperAdmin) {
          navigate('/super-admin', { replace: true });
          return;
        }

        const orgCount = (mems?.length ?? 0);
        if (orgCount > 1) {
          navigate('/select-org', { replace: true });
          return;
        }
        if (orgCount === 1) {
          setSelectedOrgId(mems![0].org_id);
          navigate('/matches', { replace: true });
          return;
        }

        navigate('/auth-debug', { replace: true });
      } catch {
        navigate('/auth-debug', { replace: true });
      }
    })();

    return () => { mounted = false; };
  }, [navigate]);
}
