import { useState } from 'react';
import { Wallet, Eye, EyeOff, UserPlus, LogIn } from 'lucide-react';
import API_URL from '../config';

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const body = mode === 'login' ? { email, password } : { name, email, password };
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erro desconhecido'); return; }
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      onLogin(data.user);
    } catch {
      setError('Não foi possível conectar ao servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a2a7a 0%, #243b9d 50%, #1d3080 100%)',
      padding: '1rem',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '3rem',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
        animation: 'fadeIn 0.4s ease',
      }}>
        <style>{`
          @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'linear-gradient(135deg, #243b9d, #1d3080)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem',
            boxShadow: '0 8px 20px rgba(36,59,157,0.4)',
          }}>
            <Wallet size={32} color="white" />
          </div>
          <h1 style={{ fontSize: '1.5rem', color: '#243b9d', margin: 0, fontWeight: 700 }}>Magalhaes Inteligencia</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>Sistema de Gestão Financeira</p>
        </div>

        {/* Toggle Login / Cadastro */}
        <div style={{ display: 'flex', background: 'var(--bg-body)', borderRadius: '10px', padding: '4px', marginBottom: '1.5rem' }}>
          <button
            onClick={() => setMode('login')}
            style={{
              flex: 1, padding: '0.6rem', borderRadius: '8px', border: 'none',
              fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
              background: mode === 'login' ? 'white' : 'transparent',
              color: mode === 'login' ? '#243b9d' : 'var(--text-muted)',
              boxShadow: mode === 'login' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            <LogIn size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Entrar
          </button>
          <button
            onClick={() => setMode('register')}
            style={{
              flex: 1, padding: '0.6rem', borderRadius: '8px', border: 'none',
              fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
              background: mode === 'register' ? 'white' : 'transparent',
              color: mode === 'register' ? '#243b9d' : 'var(--text-muted)',
              boxShadow: mode === 'register' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            <UserPlus size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Cadastrar
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="form-group">
              <label>Nome completo</label>
              <input type="text" placeholder="Seu nome" value={name} onChange={e => setName(e.target.value)} required style={{ width: '100%' }} />
            </div>
          )}
          <div className="form-group">
            <label>E-mail</label>
            <input type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required style={{ width: '100%' }} />
          </div>
          <div className="form-group">
            <label>Senha</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{ width: '100%', paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', color: 'var(--text-muted)' }}
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.875rem', marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '0.875rem', borderRadius: '10px',
              background: 'linear-gradient(135deg, #243b9d, #1d3080)',
              color: 'white', fontWeight: 700, fontSize: '1rem',
              border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1, transition: 'all 0.2s',
              marginTop: '0.5rem',
            }}
          >
            {loading ? 'Aguarde...' : mode === 'login' ? '→ Entrar no sistema' : '→ Criar minha conta'}
          </button>
        </form>
      </div>
    </div>
  );
}
