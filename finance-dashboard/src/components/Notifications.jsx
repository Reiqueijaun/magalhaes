import { useState, useEffect } from 'react';
import { Bell, AlertCircle, Clock } from 'lucide-react';
import { authFetch } from '../config';

export default function Notifications({ onNavigate }) {
  const [isOpen, setIsOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await authFetch('/api/transactions');
        const data = await res.json();
        
        const now = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(now.getDate() + 1);

        const urgent = data.filter(t => {
          if (t.type !== 'OUT' || t.status !== 'PENDING') return false;
          const due = new Date(t.dueDate);
          // Retorna true se estiver vencida ou vence amanhã/hoje
          return due <= tomorrow;
        }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

        setAlerts(urgent);
      } catch (e) {
        console.error('Erro ao buscar alertas');
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
    // Atualiza a cada 5 minutos
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const count = alerts.length;

  return (
    <div style={{ position: 'relative' }}>
      <button 
        id="tutorial-bell"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '8px', position: 'relative', display: 'flex',
          alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)'
        }}
      >
        <Bell size={20} />
        {count > 0 && (
          <div style={{
            position: 'absolute', top: 4, right: 4,
            background: 'var(--danger)', color: 'white',
            fontSize: '0.65rem', fontWeight: 'bold',
            width: 16, height: 16, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 0 2px white'
          }}>
            {count}
          </div>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: '8px',
          width: '320px', background: 'white', borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid var(--border-color)',
          zIndex: 100, overflow: 'hidden'
        }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: '0.875rem' }}>Alertas de Vencimento</h4>
            <span className="badge" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>{count} pendentes</span>
          </div>
          
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {loading ? (
              <p style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Verificando...</p>
            ) : count === 0 ? (
              <p style={{ padding: '1.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Nenhuma conta urgente para pagar! 🎉
              </p>
            ) : (
              alerts.map(a => {
                const isLate = new Date(a.dueDate) < new Date(new Date().setHours(0,0,0,0));
                return (
                  <div 
                    key={a.id} 
                    style={{ 
                      padding: '1rem', borderBottom: '1px solid var(--border-color)',
                      display: 'flex', gap: '12px', cursor: 'pointer', transition: 'background 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-body)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    onClick={() => {
                      setIsOpen(false);
                      onNavigate('pending');
                    }}
                  >
                    <div style={{ color: isLate ? 'var(--danger)' : '#eab308', paddingTop: '2px' }}>
                      {isLate ? <AlertCircle size={16} /> : <Clock size={16} />}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>{a.description}</p>
                      <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: isLate ? 'var(--danger)' : 'var(--text-muted)' }}>
                        {isLate ? 'Vencida!' : 'Vence hoje/amanhã'} • R$ {a.amount.toFixed(2).replace('.', ',')}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          {count > 0 && (
            <button 
              onClick={() => { setIsOpen(false); onNavigate('pending'); }}
              style={{ width: '100%', padding: '0.75rem', border: 'none', background: 'var(--bg-body)', color: 'var(--brand-blue)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
            >
              Ver todas as contas a pagar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
