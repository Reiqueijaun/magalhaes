import { useState, useEffect, useMemo } from 'react';
import { Plus, CheckCircle2, FileText, Loader, Repeat, Calendar, AlertCircle, Clock, TrendingDown } from 'lucide-react';
import { authFetch } from '../config';
import { formatCurrency, parseCurrency } from '../utils';
import PayModal from './PayModal';

const fmt = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export default function Pending() {
  const [tab, setTab] = useState('baixa');
  const [transactions, setTransactions] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [payTransaction, setPayTransaction] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Filtro rápido
  const [quickFilter, setQuickFilter] = useState('all');

  // Form fields
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
        setTransactions(data.filter(t => t.type === 'OUT' && t.status === 'PENDING' && (!t.context || t.context === 'PJ')));
      }
      if (compRes.ok) setCompanies(await compRes.json());
    } catch { console.log('Erro ao buscar'); } finally { setLoading(false); }
  };

  useEffect(() => { fetchTransactions(); }, []);

  const filtered = useMemo(() => {
    const now = new Date(); now.setHours(0,0,0,0);
    return transactions.filter(t => {
      const due = new Date(t.dueDate);
      if (quickFilter === 'today') return due <= new Date();
      if (quickFilter === '7') { const l = new Date(now); l.setDate(l.getDate()+7); return due <= l; }
      if (quickFilter === '30') { const l = new Date(now); l.setDate(l.getDate()+30); return due <= l; }
      if (quickFilter === 'month') return due <= new Date(now.getFullYear(), now.getMonth()+1, 0, 23,59,59);
      return true;
    });
  }, [transactions, quickFilter]);

  const atrasadas = filtered.filter(t => new Date(t.dueDate) < new Date(new Date().setHours(0,0,0,0)));
  const hoje = filtered.filter(t => new Date(t.dueDate).toDateString() === new Date().toDateString());
  const futuros = filtered.filter(t => new Date(t.dueDate) > new Date());
  const totalPendente = filtered.reduce((a,b) => a+b.amount, 0);
  const totalAtrasado = atrasadas.reduce((a,b) => a+b.amount, 0);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!valor || !dataVenc || !desc) { setError('Preencha todos os campos obrigatórios.'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      const response = await authFetch('/api/transactions', {
        method: 'POST',
        body: JSON.stringify({ description: desc, amount: parseCurrency(valor), type: 'OUT', status: 'PENDING', dueDate: dataVenc, companyId: companyId || null, isRecurring: recorrente })
      });
      if (response.ok) {
        setSuccess('✅ Conta cadastrada com sucesso!');
        setDesc(''); setValor(''); setDataVenc(''); setCompanyId(''); setRecorrente(false);
        fetchTransactions();
        setTimeout(() => setSuccess(''), 3000);
      } else { setError('Erro ao salvar. Tente novamente.'); }
    } catch { setError('Erro de conexão com o servidor.'); } finally { setSaving(false); }
  };

  const handleBoletoUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setOcrLoading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const response = await authFetch('/api/ocr/boleto', { method: 'POST', body: JSON.stringify({ fileBase64: ev.target.result }) });
        const data = await response.json();
        if (data.amount) setValor(data.amount);
        if (data.dueDate) setDataVenc(data.dueDate);
        setTab('lancamento');
      } catch { alert('Erro ao ler boleto. Preencha manualmente.'); setTab('lancamento'); } finally { setOcrLoading(false); }
    };
    reader.readAsDataURL(file);
    e.target.value = null;
  };

  const handlePaySuccess = () => {
    setPayTransaction(null);
    fetchTransactions();
    setSuccess('✅ Baixa realizada! Transferido para o extrato.');
    setTimeout(() => setSuccess(''), 3000);
  };

  const FILTERS = [{ v:'all', l:'Todos' },{ v:'today', l:'Hoje/Atrasados' },{ v:'7', l:'7 dias' },{ v:'30', l:'30 dias' },{ v:'month', l:'Este Mês' }];

  const cardStyle = (overdue) => ({
    background: 'white',
    border: `1px solid ${overdue ? '#fecaca' : '#e2e8f0'}`,
    borderLeft: `4px solid ${overdue ? '#ef4444' : '#f59e0b'}`,
    borderRadius: 12,
    padding: '1rem 1.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    transition: 'box-shadow 0.2s',
    marginBottom: 10,
  });

  const renderCard = (item) => {
    const dueDate = new Date(item.dueDate);
    const now = new Date(); now.setHours(0,0,0,0);
    const overdue = dueDate < now;
    const isToday = dueDate.toDateString() === new Date().toDateString();
    const diffDays = Math.ceil((dueDate - now) / (1000*60*60*24));
    return (
      <div key={item.id} style={cardStyle(overdue)}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: overdue ? '#fee2e2' : isToday ? '#fef3c7' : '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {overdue ? <AlertCircle size={22} color="#ef4444" /> : isToday ? <Clock size={22} color="#f59e0b" /> : <Calendar size={22} color="#0284c7" />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description}</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
            {item.company && <span style={{ fontSize: '0.75rem', color: '#64748b' }}>🏢 {item.company.name}</span>}
            <span style={{ fontSize: '0.75rem', color: overdue ? '#ef4444' : '#64748b', fontWeight: overdue ? 700 : 400 }}>
              {overdue ? `⚠️ Venceu há ${Math.abs(diffDays)} dia(s)` : isToday ? '⏰ Vence hoje' : `📅 Vence em ${diffDays} dia(s) — ${dueDate.toLocaleDateString('pt-BR')}`}
            </span>
            {item.isRecurring && <span style={{ fontSize: '0.72rem', color: '#7c3aed', background: '#ede9fe', padding: '1px 6px', borderRadius: 10 }}>↺ Recorrente</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '1.1rem', color: overdue ? '#ef4444' : '#1e293b' }}>{fmt(item.amount)}</div>
          <button
            onClick={() => setPayTransaction(item)}
            style={{ marginTop: 6, padding: '6px 14px', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <CheckCircle2 size={14} /> Dar Baixa
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        {[{
          icon: TrendingDown, label: 'Total Pendente', value: fmt(totalPendente), color: '#ef4444', bg: '#fee2e2',
          sub: `${filtered.length} conta(s) pendente(s)`
        },{
          icon: AlertCircle, label: 'Total Atrasado', value: fmt(totalAtrasado), color: '#dc2626', bg: '#fee2e2',
          sub: `${atrasadas.length} conta(s) em atraso`
        },{
          icon: Calendar, label: 'A Vencer (futuros)', value: fmt(futuros.reduce((a,b)=>a+b.amount,0)), color: '#0284c7', bg: '#e0f2fe',
          sub: `${futuros.length} conta(s) futuras`
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

      {/* Success/Error */}
      {success && <div style={{ background: '#d1fae5', color: '#065f46', borderRadius: 10, padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.875rem' }}>{success}</div>}
      {error && <div style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 10, padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.875rem' }}>{error}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: 6, gap: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <button onClick={() => setTab('baixa')} style={{ flex: 1, padding: '0.65rem', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', transition: 'all 0.2s', background: tab === 'baixa' ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'transparent', color: tab === 'baixa' ? 'white' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
          <CheckCircle2 size={16} /> Dar Baixa
          {filtered.length > 0 && <span style={{ background: tab === 'baixa' ? 'rgba(255,255,255,0.3)' : '#fee2e2', color: tab === 'baixa' ? 'white' : '#ef4444', borderRadius: 99, fontSize: '0.7rem', fontWeight: 800, padding: '1px 7px' }}>{filtered.length}</span>}
        </button>
        <button onClick={() => setTab('lancamento')} style={{ flex: 1, padding: '0.65rem', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', transition: 'all 0.2s', background: tab === 'lancamento' ? 'linear-gradient(135deg, #243b9d, #1d3080)' : 'transparent', color: tab === 'lancamento' ? 'white' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
          <Plus size={16} /> Lançar Nova Conta
        </button>
      </div>

      {/* TAB: Dar Baixa */}
      {tab === 'baixa' && (
        <div>
          {/* Filter chips */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: '1rem' }}>
            {FILTERS.map(f => (
              <button key={f.v} onClick={() => setQuickFilter(f.v)} style={{ padding: '5px 14px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', border: quickFilter === f.v ? '2px solid #ef4444' : '1px solid #e2e8f0', background: quickFilter === f.v ? '#fee2e2' : 'white', color: quickFilter === f.v ? '#dc2626' : '#64748b', transition: 'all 0.15s' }}>{f.l}</button>
            ))}
            <label style={{ marginLeft: 'auto', padding: '5px 14px', background: '#eef1f8', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600, color: '#243b9d', cursor: ocrLoading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 5, border: '1px solid #c7d2fe' }}>
              {ocrLoading ? <Loader size={13} /> : <FileText size={13} />} {ocrLoading ? 'Lendo...' : 'Importar Boleto'}
              <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={handleBoletoUpload} disabled={ocrLoading} />
            </label>
          </div>

          {loading ? <p style={{ color: '#94a3b8' }}>Carregando...</p> : filtered.length === 0 ? (
            <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
              <CheckCircle2 size={40} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
              <p style={{ fontWeight: 600 }}>Nenhuma conta pendente! 🎉</p>
              <p style={{ fontSize: '0.85rem' }}>Use a aba "Lançar Nova Conta" para cadastrar.</p>
            </div>
          ) : (
            <div>
              {atrasadas.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, color: '#ef4444', fontSize: '0.875rem' }}>🔴 ATRASADAS ({atrasadas.length})</span>
                    <span style={{ fontWeight: 700, color: '#ef4444', fontSize: '0.875rem', marginLeft: 'auto' }}>{fmt(atrasadas.reduce((a,b)=>a+b.amount,0))}</span>
                  </div>
                  {atrasadas.map(renderCard)}
                </div>
              )}
              {hoje.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, color: '#f59e0b', fontSize: '0.875rem' }}>🟡 VENCE HOJE ({hoje.length})</span>
                    <span style={{ fontWeight: 700, color: '#f59e0b', marginLeft: 'auto', fontSize: '0.875rem' }}>{fmt(hoje.reduce((a,b)=>a+b.amount,0))}</span>
                  </div>
                  {hoje.map(renderCard)}
                </div>
              )}
              {futuros.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, color: '#0284c7', fontSize: '0.875rem' }}>🔵 A VENCER ({futuros.length})</span>
                    <span style={{ fontWeight: 700, color: '#0284c7', marginLeft: 'auto', fontSize: '0.875rem' }}>{fmt(futuros.reduce((a,b)=>a+b.amount,0))}</span>
                  </div>
                  {futuros.map(renderCard)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB: Lançar */}
      {tab === 'lancamento' && (
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ background: 'linear-gradient(135deg, #243b9d, #1d3080)', padding: '1rem 1.5rem' }}>
            <h3 style={{ color: 'white', margin: 0, fontWeight: 700, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus size={18} /> Lançar Nova Conta a Pagar
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.7)', margin: '4px 0 0', fontSize: '0.8rem' }}>Preencha os dados e clique em Cadastrar. A conta aparecerá na aba "Dar Baixa".</p>
          </div>
          <form onSubmit={handleSave} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#475569' }}>📝 Descrição / Fornecedor *</label>
              <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ex: Conta de luz, Aluguel, Fornecedor XYZ..." required style={{ padding: '0.6rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.9rem' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#475569' }}>💰 Valor (R$) *</label>
                <input type="text" placeholder="0,00" value={valor} onChange={e => setValor(formatCurrency(e.target.value))} required style={{ padding: '0.6rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.9rem' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#475569' }}>📅 Vencimento *</label>
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
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '0.75rem', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <input type="checkbox" checked={recorrente} onChange={e => setRecorrente(e.target.checked)} style={{ width: 16, height: 16 }} />
              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#475569' }}>↺ Repetir mensalmente (conta recorrente)</span>
            </label>
            <button type="submit" disabled={saving} style={{ padding: '0.75rem', background: saving ? '#94a3b8' : 'linear-gradient(135deg, #243b9d, #1d3080)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.95rem', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {saving ? 'Salvando...' : <><Plus size={18} /> Cadastrar Conta a Pagar</>}
            </button>
          </form>
        </div>
      )}

      <PayModal isOpen={!!payTransaction} onClose={() => setPayTransaction(null)} transaction={payTransaction} onPaySuccess={handlePaySuccess} />
    </div>
  );
}
