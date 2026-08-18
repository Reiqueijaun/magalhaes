import { useState } from 'react';
import { Package, Lock, User, Eye, EyeOff, Warehouse } from 'lucide-react';
import API_URL from '../config.js';

export default function WarehouseLogin({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Credenciais inválidas.'); setLoading(false); return; }

      const mod = data.user?.module || 'FINANCE';
      if (mod !== 'WAREHOUSE' && mod !== 'ADMIN') {
        setError('Acesso negado. Este usuário não tem permissão ao almoxarifado.');
        setLoading(false);
        return;
      }

      localStorage.setItem('warehouse_token', data.token);
      localStorage.setItem('warehouse_user', JSON.stringify(data.user));
      onLogin(data.user);
    } catch {
      setError('Erro de conexão com o servidor.');
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1c1917 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
    }}>
      {/* Background pattern */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.03, backgroundImage: 'repeating-linear-gradient(45deg, #d97706 0, #d97706 1px, transparent 0, transparent 50%)', backgroundSize: '20px 20px', pointerEvents: 'none' }} />

      <div style={{
        width: '100%',
        maxWidth: 420,
        position: 'relative',
      }}>
        {/* Logo / Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ width: 72, height: 72, background: 'linear-gradient(135deg, #d97706, #b45309)', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', boxShadow: '0 8px 24px rgba(217,119,6,0.4)' }}>
            <Warehouse size={38} color="white" />
          </div>
          <h1 style={{ color: 'white', fontSize: '1.6rem', fontWeight: 800, margin: '0 0 4px' }}>Almoxarifado</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0 }}>Magalhães Inteligência — Controle de Estoque</p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 20,
          padding: '2rem',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
        }}>
          <h2 style={{ color: 'white', fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lock size={18} color="#d97706" /> Acesso Restrito
          </h2>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 10, padding: '0.75rem 1rem', color: '#fca5a5', fontSize: '0.85rem', marginBottom: '1.25rem', fontWeight: 500 }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>E-mail</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  style={{ width: '100%', padding: '0.7rem 0.75rem 0.7rem 2.25rem', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: 'white', fontSize: '0.9rem', boxSizing: 'border-box', outline: 'none' }}
                  onFocus={e => e.target.style.borderColor = '#d97706'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Senha</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{ width: '100%', padding: '0.7rem 2.5rem 0.7rem 2.25rem', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: 'white', fontSize: '0.9rem', boxSizing: 'border-box', outline: 'none' }}
                  onFocus={e => e.target.style.borderColor = '#d97706'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
                />
                <button type="button" onClick={() => setShowPass(p => !p)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 8,
                padding: '0.85rem',
                background: loading ? '#78350f' : 'linear-gradient(135deg, #d97706, #b45309)',
                color: 'white',
                border: 'none',
                borderRadius: 12,
                fontWeight: 800,
                fontSize: '0.95rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 16px rgba(217,119,6,0.4)',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {loading ? (
                <>
                  <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Entrando...
                </>
              ) : (
                <><Package size={18} /> Acessar Almoxarifado</>
              )}
            </button>
          </form>

          <div style={{ marginTop: '1.5rem', padding: '0.75rem', background: 'rgba(217,119,6,0.08)', borderRadius: 10, border: '1px solid rgba(217,119,6,0.2)', fontSize: '0.78rem', color: '#d97706', textAlign: 'center' }}>
            🔒 Área restrita a usuários do almoxarifado.<br />
            Para acesso ao financeiro, <a href="/" style={{ color: '#fbbf24', fontWeight: 'bold', textDecoration: 'none' }}>volte ao Início ↗</a>
          </div>
        </div>

        <p style={{ textAlign: 'center', color: '#475569', fontSize: '0.75rem', marginTop: '1.5rem' }}>
          © 2026 Magalhães Inteligência
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #475569; }
      `}</style>
    </div>
  );
}
