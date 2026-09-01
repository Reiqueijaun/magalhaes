import { useState } from 'react';
import { Wallet, Eye, EyeOff, UserPlus, LogIn } from 'lucide-react';
import API_URL from '../config';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Estados para Reset de Senha
  const [isResetting, setIsResetting] = useState(false);
  const [pin, setPin] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (isResetting) {
      // Validação de senha mínima no cliente
      if (password.length < 8) {
        setError('A nova senha deve ter no mínimo 8 caracteres.');
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_URL}/api/auth/reset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, newPassword: password, pin }),
        });
        
        const data = await res.json().catch(() => ({}));

        if (res.status === 429) {
          setError('⏳ ' + (data?.error || 'Muitas tentativas de redefinição. Aguarde alguns minutos e tente novamente.'));
          return;
        }

        if (!res.ok) { setError(data.error || 'Erro ao resetar senha'); return; }
        
        setSuccess('Senha alterada! Agora você pode fazer login.');
        setIsResetting(false);
        setPassword('');
        setPin('');
      } catch {
        setError('Não foi possível conectar ao servidor.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Fluxo de Login Normal
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      
      let data;
      try {
        data = await res.json();
      } catch {
        if (res.status === 429) {
          setError('⏳ Muitas tentativas em pouco tempo. Aguarde um ou dois minutos e tente novamente.');
        } else {
          setError(`Erro no servidor (status ${res.status}). Tente novamente em instantes.`);
        }
        return;
      }

      if (res.status === 429) {
        setError('⏳ ' + (data?.error || 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.'));
        return;
      }

      if (!res.ok) {
        setError(data?.error || 'E-mail ou senha incorretos.');
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      onLogin(data.user);
    } catch (err) {
      console.error('Erro no login:', err);
      setError('Não foi possível conectar ao servidor. Verifique sua conexão com a internet.');
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
        padding: 'clamp(1.5rem, 5vw, 3rem)',
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
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, background: 'linear-gradient(135deg, var(--brand-blue) 0%, #1a2a6c 100%)', borderRadius: '16px', color: 'white', marginBottom: '1rem', boxShadow: '0 8px 16px rgba(36, 59, 157, 0.2)' }}>
            <Wallet size={32} />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
            {isResetting ? 'Recuperar Senha' : 'Bem-vindo de volta'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>Sistema de Gestão Financeira</p>
        </div>

        {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '12px', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem', border: '1px solid #fecaca' }}>{error}</div>}
        {success && <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '12px', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem', border: '1px solid #bbf7d0' }}>{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>E-mail</label>
            <input type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required style={{ width: '100%' }} />
          </div>
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label>{isResetting ? 'Nova Senha' : 'Senha'}</label>
              {!isResetting && (
                <button type="button" onClick={() => { setIsResetting(true); setError(''); setSuccess(''); }} style={{ background: 'none', border: 'none', color: 'var(--brand-blue)', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>Esqueci a senha</button>
              )}
            </div>
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
          
          {isResetting && (
            <div className="form-group">
              <label>PIN Mestre de Segurança</label>
              <input type="password" placeholder="Digite o PIN de 4 dígitos" value={pin} onChange={e => setPin(e.target.value)} required style={{ width: '100%', letterSpacing: '2px' }} />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '0.875rem', background: 'var(--brand-blue)',
              color: 'white', border: 'none', borderRadius: '10px', fontWeight: 600,
              fontSize: '1rem', cursor: loading ? 'wait' : 'pointer',
              transition: 'background 0.2s',
              marginTop: '0.5rem',
            }}
          >
            {loading ? 'Aguarde...' : isResetting ? 'Salvar Nova Senha' : '→ Entrar no sistema'}
          </button>
          
          {isResetting && (
            <button type="button" onClick={() => { setIsResetting(false); setError(''); setSuccess(''); }} style={{ width: '100%', padding: '0.875rem', background: 'transparent', color: 'var(--text-muted)', border: 'none', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', marginTop: '0.5rem' }}>
              Voltar para o Login
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
