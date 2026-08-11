import { useState, useEffect, useMemo } from 'react';
import { Plus, CheckCircle2, FileText, Loader, Repeat, Filter, Calendar } from 'lucide-react';
import { authFetch } from '../config';
import { formatCurrency, parseCurrency } from '../utils';
import PayModal from './PayModal';

const fmt = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const QUICK_FILTERS = [
  { value: 'all',    label: 'Todos' },
  { value: 'today',  label: 'Hoje / Atrasados' },
  { value: '7',      label: 'Próx. 7 dias' },
  { value: '15',     label: 'Próx. 15 dias' },
  { value: '30',     label: 'Próx. 30 dias' },
  { value: 'month',  label: 'Este Mês' },
  { value: 'custom', label: 'Período específico' },
];

export default function Pending() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [quickFilter, setQuickFilter] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Formulário
  const [desc, setDesc] = useState('');
  const [valor, setValor] = useState('');
  const [dataVenc, setDataVenc] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [recorrente, setRecorrente] = useState(false);

  const [companies, setCompanies] = useState([]);
  const [payTransaction, setPayTransaction] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);

  const fetchTransactions = async () => {
    try {
      const [transRes, compRes] = await Promise.all([
        authFetch('/api/transactions'),
        authFetch('/api/companies'),
      ]);
      if (transRes.ok) {
        const data = await transRes.json();
        // Filtra saídas pendentes PJ (tolerante a context ausente = legado)
        const pendingOut = data.filter(t =>
          t.type === 'OUT' &&
          t.status === 'PENDING' &&
          (!t.context || t.context === 'PJ')
        );
        setTransactions(pendingOut);
      }
      if (compRes.ok) setCompanies(await compRes.json());
    } catch (error) {
      console.log('Erro ao buscar da API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTransactions(); }, []);

  // ── Aplicar filtro de prazo ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return transactions.filter(t => {
      const due = new Date(t.dueDate);
      if (quickFilter === 'today') {
        return due <= new Date(); // vencidas ou hoje
      }
      if (quickFilter === 'month') {
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        return due <= endOfMonth;
      }
      if (quickFilter === 'custom') {
        if (!customFrom || !customTo) return true;
        const from = new Date(customFrom + 'T00:00:00');
        const to   = new Date(customTo   + 'T23:59:59');
        return due >= from && due <= to;
      }
      if (quickFilter !== 'all') {
        const days = parseInt(quickFilter);
        const limit = new Date(now);
        limit.setDate(limit.getDate() + days);
        limit.setHours(23, 59, 59);
        return due <= limit;
      }
      return true; // 'all'
    });
  }, [transactions, quickFilter, customFrom, customTo]);

  // ── Separar em grupos ────────────────────────────────────────────────────────
  const atrasadas = filtered.filter(t => new Date(t.dueDate) < new Date(new Date().toDateString()));
  const hoje      = filtered.filter(t => {
    const d = new Date(t.dueDate);
    const n = new Date();
    return d.toDateString() === n.toDateString();
  });
  const futuros   = filtered.filter(t => {
    const d = new Date(t.dueDate);
    const n = new Date();
    n.setHours(0,0,0,0);
    return d > n && d.toDateString() !== new Date().toDateString();
  });

  const totalGeral = filtered.reduce((a, b) => a + b.amount, 0);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const response = await authFetch('/api/transactions', {
        method: 'POST',
        body: JSON.stringify({
          description: desc,
          amount: parseCurrency(valor),
          type: 'OUT',
          status: 'PENDING',
          dueDate: dataVenc,
          companyId: companyId || null,
          isRecurring: recorrente
        })
      });
      if (response.ok) {
        setIsModalOpen(false);
        fetchTransactions();
        setDesc(''); setValor(''); setDataVenc(''); setCompanyId(''); setRecorrente(false);
      }
    } catch (error) {
      alert('Erro ao salvar. Verifique se o servidor backend está ligado.');
    }
  };

  const handleBoletoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setOcrLoading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const response = await authFetch('/api/ocr/boleto', {
          method: 'POST',
          body: JSON.stringify({ fileBase64: ev.target.result })
        });
        const data = await response.json();
        if (data.amount) setValor(data.amount);
        if (data.dueDate) setDataVenc(data.dueDate);
        setIsModalOpen(true);
      } catch (err) {
        alert('Erro ao ler boleto. Tente preencher manualmente.');
        setIsModalOpen(true);
      } finally {
        setOcrLoading(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = null;
  };

  const handlePaySuccess = () => {
    setPayTransaction(null);
    fetchTransactions();
    alert('✅ Título baixado com sucesso! Transferido para o extrato.');
  };

  const renderRow = (item) => (
    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
      <td style={{ padding: '0.75rem 0', fontWeight: 500 }}>
        <div>{item.description}</div>
        {item.company && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>🏢 {item.company.name}</div>}
        {item.isRecurring && <span style={{ fontSize: '0.7rem', color: 'var(--brand-blue)', display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 2 }}><Repeat size={11}/> Recorrente</span>}
      </td>
      <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
        <Calendar size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
        {new Date(item.dueDate).toLocaleDateString('pt-BR')}
      </td>
      <td style={{ padding: '0.75rem 0', fontWeight: 700, textAlign: 'right', color: 'var(--danger)' }}>
        {fmt(item.amount)}
      </td>
      <td style={{ padding: '0.75rem 0', textAlign: 'right', width: '130px' }}>
        <button
          className="btn btn-secondary"
          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: 'var(--brand-blue)', borderColor: 'var(--brand-blue)' }}
          onClick={() => setPayTransaction(item)}
        >
          <CheckCircle2 size={14} style={{ marginRight: '4px' }} /> Dar Baixa
        </button>
      </td>
    </tr>
  );

  const renderGroup = (title, icon, items, color, borderColor) => {
    if (items.length === 0) return null;
    const total = items.reduce((a, b) => a + b.amount, 0);
    return (
      <div className="card" style={{ borderLeft: `4px solid ${borderColor}`, marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', color }}>
            {icon} {title}
            <span style={{ fontSize: '0.8rem', background: `${borderColor}22`, color: borderColor, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
              {items.length} conta(s)
            </span>
          </h3>
          <span style={{ fontSize: '1.1rem', fontWeight: 700, color }}>{fmt(total)}</span>
        </div>
        <table id="tutorial-pending-table" style={{ width: '100%' }}>
          <tbody>
            {items.map(renderRow)}
          </tbody>
        </table>
      </div>
    );
  };

  const filterBtnStyle = (val) => ({
    padding: '5px 14px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
    border: quickFilter === val ? '2px solid var(--brand-blue)' : '1px solid var(--border-color)',
    background: quickFilter === val ? 'var(--brand-blue)' : 'var(--bg-card)',
    color: quickFilter === val ? 'white' : 'var(--text-main)',
    transition: 'all 0.15s',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)', margin: 0 }}>Contas a Pagar</h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            {filtered.length} conta(s) · Total: <strong style={{ color: 'var(--danger)' }}>{fmt(totalGeral)}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <label id="tutorial-import-boleto" className="btn btn-secondary" style={{ cursor: ocrLoading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {ocrLoading ? <Loader size={18} className="spin" /> : <FileText size={18} />}
            {ocrLoading ? 'Lendo boleto...' : 'Importar Boleto (PDF)'}
            <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={handleBoletoUpload} disabled={ocrLoading} />
          </label>
          <button id="tutorial-new-pending" className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={18} /> Registrar Conta a Pagar
          </button>
        </div>
      </div>

      {/* ── Barra de Filtros Rápidos ── */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', padding: '0.75rem 1rem', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', alignItems: 'center' }}>
        <Filter size={15} style={{ color: 'var(--text-muted)', marginRight: 4 }} />
        {QUICK_FILTERS.map(opt => (
          <button key={opt.value} style={filterBtnStyle(opt.value)} onClick={() => setQuickFilter(opt.value)}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* ── Filtro de período específico ── */}
      {quickFilter === 'custom' && (
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '0.75rem 1rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600 }}>De:</span>
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ padding: '0.4rem 0.6rem', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.875rem' }} />
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600 }}>Até:</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ padding: '0.4rem 0.6rem', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.875rem' }} />
        </div>
      )}

      {/* ── Lista agrupada ── */}
      {loading ? (
        <p>Carregando dados do banco...</p>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <Calendar size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p>Nenhuma conta a pagar encontrada para este filtro.</p>
        </div>
      ) : (
        <>
          {renderGroup('Atrasadas', '🔴', atrasadas, 'var(--danger)', 'var(--danger)')}
          {renderGroup('Vence Hoje', '🟠', hoje, '#f97316', '#f97316')}
          {renderGroup('Contas Futuras', '🟡', futuros, '#ca8a04', '#eab308')}
        </>
      )}

      {/* ── Modal Novo Lançamento ── */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.25rem' }}>Nova Conta a Pagar</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', fontSize: '1.5rem' }}>&times;</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-group"><label>Descrição / Fornecedor</label><input type="text" value={desc} onChange={e => setDesc(e.target.value)} required /></div>
              <div className="form-group"><label>Valor (R$)</label><input type="text" placeholder="0,00" value={valor} onChange={e => setValor(formatCurrency(e.target.value))} required /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group"><label>Vencimento</label><input type="date" value={dataVenc} onChange={e => setDataVenc(e.target.value)} required /></div>
                <div className="form-group">
                  <label>Empresa</label>
                  <select value={companyId} onChange={e => setCompanyId(e.target.value)} required>
                    <option value="">Selecione...</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div id="tutorial-pending-recurring-checkbox" className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" id="recorrente" checked={recorrente} onChange={e => setRecorrente(e.target.checked)} style={{ width: 'auto' }} />
                <label htmlFor="recorrente" style={{ margin: 0 }}>Repetir Mensalmente (Recorrente)</label>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Cadastrar no Banco</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal de Baixa ── */}
      <PayModal
        isOpen={!!payTransaction}
        onClose={() => setPayTransaction(null)}
        transaction={payTransaction}
        onPaySuccess={handlePaySuccess}
      />
    </div>
  );
}
