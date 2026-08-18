import { useState, useEffect } from 'react';
import { Plus, CheckCircle2, Repeat, Calendar, TrendingUp, Clock, DollarSign } from 'lucide-react';
import { authFetch } from '../config';
import { formatCurrency, parseCurrency } from '../utils';
import PayModal from './PayModal';

const fmt = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export default function Receivable() {
  const [tab, setTab] = useState('confirmar');
  const [transactions, setTransactions] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [payTransaction, setPayTransaction] = useState(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [desc, setDesc] = useState('');
  const [valor, setValor] = useState('');
  const [dataVenc, setDataVenc] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [recorrente, setRecorrente] = useState(false);

  const fetchTransactions = async () => {
    try {
      const [transRes, compRes] = await Promise.all([
        authFetch('/api/transactions'),
        authFetch('/api/companies'),
      ]);
      if (transRes.ok) {
        const data = await transRes.json();
        setTransactions(data.filter(t => t.type === 'IN' && t.status === 'PENDING' && (!t.context || t.context === 'PJ')));
      }
      if (compRes.ok) setCompanies(await compRes.json());
    } catch { console.log('Erro ao buscar'); } finally { setLoading(false); }
  };

  useEffect(() => { fetchTransactions(); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!valor || !dataVenc || !desc) { setError('Preencha todos os campos obrigatórios.'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      const response = await authFetch('/api/transactions', {
        method: 'POST',
        body: JSON.stringify({ description: desc, amount: parseCurrency(valor), type: 'IN', status: 'PENDING', dueDate: dataVenc, companyId: companyId || null, isRecurring: recorrente })
      });
      if (response.ok) {
        setSuccess('✅ Cobrança registrada com sucesso!');
        setDesc(''); setValor(''); setDataVenc(''); setCompanyId(''); setRecorrente(false);
        fetchTransactions();
        setTimeout(() => setSuccess(''), 3000);
      } else { setError('Erro ao salvar. Tente novamente.'); }
    } catch { setError('Erro de conexão com o servidor.'); } finally { setSaving(false); }
  };

  const handlePaySuccess = () => {
    setPayTransaction(null);
    fetchTransactions();
    setSuccess('✅ Recebimento confirmado! Registrado no extrato.');
    setTimeout(() => setSuccess(''), 3000);
  };

  const now = new Date();
  const vencidos = transactions.filter(t => new Date(t.dueDate) < new Date(new Date().setHours(0,0,0,0)));
  const hoje = transactions.filter(t => new Date(t.dueDate).toDateString() === now.toDateString());
  const futuros = transactions.filter(t => new Date(t.dueDate) > now && new Date(t.dueDate).toDateString() !== now.toDateString());
  const totalPendente = transactions.reduce((a,b) => a+b.amount, 0);

  const renderCard = (item) => {
    const dueDate = new Date(item.dueDate);
    const nowDay = new Date(); nowDay.setHours(0,0,0,0);
    const diffDays = Math.ceil((dueDate - nowDay) / (1000*60*60*24));
    const isOverdue = dueDate < nowDay;
    const isToday = dueDate.toDateString() === new Date().toDateString();
    return (
      <div key={item.id} style={{ background: 'white', border: `1px solid ${isOverdue ? '#bbf7d0' : '#e2e8f0'}`, borderLeft: `4px solid ${isOverdue ? '#10b981' : isToday ? '#0284c7' : '#6ee7b7'}`, borderRadius: 12, padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: 10 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: isOverdue ? '#d1fae5' : '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {isOverdue ? <Clock size={22} color="#10b981" /> : <Calendar size={22} color="#0284c7" />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description}</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
            {item.company && <span style={{ fontSize: '0.75rem', color: '#64748b' }}>🏢 {item.company.name}</span>}
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              {isOverdue ? `⏰ Deveria ter entrado há ${Math.abs(diffDays)} dia(s)` : isToday ? '✨ Previsto para hoje' : `📅 Previsto para ${dueDate.toLocaleDateString('pt-BR')} (em ${diffDays} dia(s))`}
            </span>
            {item.isRecurring && <span style={{ fontSize: '0.72rem', color: '#7c3aed', background: '#ede9fe', padding: '1px 6px', borderRadius: 10 }}>↺ Recorrente</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#10b981' }}>{fmt(item.amount)}</div>
          <button
            onClick={() => setPayTransaction(item)}
            style={{ marginTop: 6, padding: '6px 14px', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <CheckCircle2 size={14} /> Confirmar Recebido
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        {[{
          icon: TrendingUp, label: 'Total a Receber', value: fmt(totalPendente), color: '#10b981', bg: '#d1fae5',
          sub: `${transactions.length} cobrança(s) pendente(s)`
        },{
          icon: Clock, label: 'A Receber Hoje/Atrasado', value: fmt([...vencidos,...hoje].reduce((a,b)=>a+b.amount,0)), color: '#0284c7', bg: '#e0f2fe',
          sub: `${vencidos.length + hoje.length} cobrança(s)`
        },{
          icon: Calendar, label: 'Previsto (futuros)', value: fmt(futuros.reduce((a,b)=>a+b.amount,0)), color: '#7c3aed', bg: '#ede9fe',
          sub: `${futuros.length} cobrança(s) futuras`
        }].map(({icon:Icon,label,value,color,bg,sub}) => (
          <div key={label} style={{ background: 'white', borderRadius: 12, padding: '1rem 1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={16} color={color} /></div>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 2 }}>{sub}</div>
          </div>
        ))}
      </div>

      {success && <div style={{ background: '#d1fae5', color: '#065f46', borderRadius: 10, padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.875rem' }}>{success}</div>}
      {error && <div style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 10, padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.875rem' }}>{error}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: 6, gap: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <button onClick={() => setTab('confirmar')} style={{ flex: 1, padding: '0.65rem', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', background: tab === 'confirmar' ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent', color: tab === 'confirmar' ? 'white' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
          <CheckCircle2 size={16} /> Confirmar Recebimentos
          {transactions.length > 0 && <span style={{ background: tab === 'confirmar' ? 'rgba(255,255,255,0.3)' : '#d1fae5', color: tab === 'confirmar' ? 'white' : '#10b981', borderRadius: 99, fontSize: '0.7rem', fontWeight: 800, padding: '1px 7px' }}>{transactions.length}</span>}
        </button>
        <button onClick={() => setTab('lancamento')} style={{ flex: 1, padding: '0.65rem', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', background: tab === 'lancamento' ? 'linear-gradient(135deg, #243b9d, #1d3080)' : 'transparent', color: tab === 'lancamento' ? 'white' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
          <Plus size={16} /> Registrar Nova Cobrança
        </button>
      </div>

      {/* TAB: Confirmar recebimentos */}
      {tab === 'confirmar' && (
        <div>
          {loading ? <p style={{ color: '#94a3b8' }}>Carregando...</p> : transactions.length === 0 ? (
            <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
              <CheckCircle2 size={40} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
              <p style={{ fontWeight: 600 }}>Nenhuma cobrança pendente!</p>
              <p style={{ fontSize: '0.85rem' }}>Use "Registrar Nova Cobrança" para adicionar.</p>
            </div>
          ) : (
            <div>
              {[...vencidos, ...hoje].length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, color: '#10b981', fontSize: '0.875rem' }}>✅ RECEBER AGORA ({[...vencidos,...hoje].length})</span>
                    <span style={{ fontWeight: 700, color: '#10b981', marginLeft: 'auto', fontSize: '0.875rem' }}>{fmt([...vencidos,...hoje].reduce((a,b)=>a+b.amount,0))}</span>
                  </div>
                  {[...vencidos, ...hoje].map(renderCard)}
                </div>
              )}
              {futuros.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, color: '#7c3aed', fontSize: '0.875rem' }}>🔮 PREVISTO ({futuros.length})</span>
                    <span style={{ fontWeight: 700, color: '#7c3aed', marginLeft: 'auto', fontSize: '0.875rem' }}>{fmt(futuros.reduce((a,b)=>a+b.amount,0))}</span>
                  </div>
                  {futuros.map(renderCard)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB: Registrar cobrança */}
      {tab === 'lancamento' && (
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ background: 'linear-gradient(135deg, #10b981, #059669)', padding: '1rem 1.5rem' }}>
            <h3 style={{ color: 'white', margin: 0, fontWeight: 700, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus size={18} /> Registrar Nova Cobrança
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.8)', margin: '4px 0 0', fontSize: '0.8rem' }}>Preencha os dados e clique em Registrar. A cobrança aparecerá na aba "Confirmar Recebimentos".</p>
          </div>
          <form onSubmit={handleSave} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#475569' }}>📝 Descrição / Cliente *</label>
              <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ex: Serviço prestado, Venda para cliente XYZ..." required style={{ padding: '0.6rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.9rem' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#475569' }}>💰 Valor (R$) *</label>
                <input type="text" placeholder="0,00" value={valor} onChange={e => setValor(formatCurrency(e.target.value))} required style={{ padding: '0.6rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.9rem' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#475569' }}>📅 Previsão de Recebimento *</label>
                <input type="date" value={dataVenc} onChange={e => setDataVenc(e.target.value)} required style={{ padding: '0.6rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.9rem' }} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#475569' }}>🏢 Empresa (opcional)</label>
              <select value={companyId} onChange={e => setCompanyId(e.target.value)} style={{ padding: '0.6rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.9rem' }}>
                <option value="">— Sem empresa —</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '0.75rem', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
              <input type="checkbox" checked={recorrente} onChange={e => setRecorrente(e.target.checked)} style={{ width: 16, height: 16 }} />
              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#475569' }}>↺ Repetir mensalmente (recorrente)</span>
            </label>
            <button type="submit" disabled={saving} style={{ padding: '0.75rem', background: saving ? '#94a3b8' : 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.95rem', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {saving ? 'Salvando...' : <><Plus size={18} /> Registrar Cobrança</>}
            </button>
          </form>
        </div>
      )}

      <PayModal isOpen={!!payTransaction} onClose={() => setPayTransaction(null)} transaction={payTransaction} onPaySuccess={handlePaySuccess} />
    </div>
  );
}
