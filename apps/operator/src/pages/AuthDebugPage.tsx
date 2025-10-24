import React, { useEffect, useState } from 'react';
import { supa } from '../supabase';

type T = { ok: boolean; error?: string; count?: number };

export default function AuthDebugPage() {
  const [out, setOut] = useState<{ session?: boolean; user?: any; tests?: Record<string, T>; fatal?: string }>({});

  useEffect(() => {
    (async () => {
      const log: any = {};
      try {
        const { data: { session } } = await supa.auth.getSession();
        log.session = !!session;
        log.user = session?.user ?? null;

        const tests: Record<string, any> = {};
        tests.orgs        = await supa.from('orgs').select('*').limit(1);
        tests.org_members = await supa.from('org_members').select('*').limit(1);
        tests.profiles    = await supa.from('profiles').select('*').limit(1);
        tests.matches     = await supa.from('matches').select('*').limit(1);

        log.tests = Object.fromEntries(
          Object.entries(tests).map(([k, v]: any) => [k, { ok: !v.error, error: v.error?.message, count: v.data?.length ?? 0 }])
        );
        setOut(log);
      } catch (e: any) {
        setOut((prev: any) => ({ ...prev, fatal: e?.message || String(e) }));
      }
    })();
  }, []);

  const onLogout = async () => {
    await supa.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div className="space-page">
      <div className="space-header">
        <h1>Diagnostic Auth / DB</h1>
        <button className="secondary" onClick={onLogout}>Déconnexion</button>
      </div>
      <div className="card">
        <pre style={{ background:'#0a0d10', padding:16, borderRadius:8, overflow:'auto' }}>
{JSON.stringify(out, null, 2)}
        </pre>
      </div>
    </div>
  );
}
