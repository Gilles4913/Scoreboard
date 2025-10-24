import React, { useState } from 'react';
import { supa } from '../supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('arthur.roy49@gmail.com');
  const [password, setPassword] = useState('admin');
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const { error } = await supa.auth.signInWithPassword({ email, password });
      if (error) setMsg(error.message);
      else window.location.href = '/'; // HomeRedirector fera la redirection par rôle
    } catch (err: any) {
      setMsg(err?.message || 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-page">
      <div className="space-header">
        <h1>Connexion</h1>
      </div>
      <form className="card" onSubmit={onSubmit}>
        <div className="form-grid">
          <div className="form-row">
            <label>Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email" />
          </div>
          <div className="form-row">
            <label>Mot de passe</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="mot de passe" />
          </div>
          <button className="primary" disabled={loading}>
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
          {msg && <div className="form-message">{msg}</div>}
        </div>
      </form>
    </div>
  );
}
