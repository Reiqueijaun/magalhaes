import { useState, useEffect, useMemo } from 'react';
import {
  Plus, CheckCircle2, FileText, Loader, Calendar, AlertCircle, Clock,
  TrendingDown, Trash2, Building2, Tag, UserCheck, CreditCard, Search,
  Filter, ArrowDownRight, AlertTriangle, Sparkles, Truck
} from 'lucide-react';
import { authFetch } from '../config';
import { formatCurrency, parseCurrency, todayInput, formatDateBR, daysUntil } from '../utils';
import PayModal from './PayModal';
import ConfirmModal from './ConfirmModal';

const fmt = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export default function Pending({ selectedCompanyId = 'all', companies = [], theme = 'light' }) {
  const [tab, setTab] = useState('baixa');
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [payTransaction, setPayTransaction] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Filtros Multidimensionais
  const [quickFilter, setQuickFilter] = useState('all'); // 'all', 'today', '7', '30', 'month'
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterSupplier, setFilterSupplier] = useState('all');
  const [filterCompany, setFilterCompany] = useState(selectedCompanyId || 'all');
  const [search, setSearch] = useState('');

  // Sincroniza filtro de empresa se mudar no topo
  useEffect(() => {
    if (selectedCompanyId) {
      setFilterCompany(selectedCompanyId);
    }
  }, [selectedCompanyId]);

  // Form fields
  const [desc, setDesc] = useState('');
  const [valor, setValor] = useState('');
  const [dataVenc, setDataVenc] = useState(todayInput());
  const [categoryId, setCategoryId] = useState('');
  const [entityId, setEntityId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [recorrente, setRecorrente] = useState(false);

  const fetchTransactions = async () => {
    try {
      const [transRes, catRes, entRes, bankRes] = await Promise.all([
        authFetch('/api/transactions'),
        authFetch('/api/categories'),
        authFetch('/api/entities'),
        authFetch('/api/bank-accounts'),
      ]);
      if (transRes.ok) {
        const data = await transRes.json();
        setTransactions(data.filter(t => t.type === 'OUT' && t.status === 'PENDING' && (!t.context || t.context === 'PJ')));
      }
      if (catRes.ok) {
        const cats = await catRes.json();
        setCategories(cats.filter(c => c.type === 'OUT'));
      }
      if (entRes.ok) {
        const ents = await entRes.json();
        setSuppliers(ents.filter(e => e.type === 'SUPPLIER'));
      }
      if (bankRes.ok) setBankAccounts(await bankRes.json());
    } catch { 
      console.log('Erro ao buscar dados'); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { fetchTransactions(); }, []);

  // Filtragem Multidimensional
  const filtered = useMemo(() => {
    const now = new Date(); now.setHours(0,0,0,0);
    return transactions.filter(t => {
      const due = new Date(t.dueDate);

      // Filtro de Empresa / Unidade
      if (filterCompany !== 'all' && t.companyId !== filterCompany) return false;

      // Filtro de Categoria
      if (filterCategory !== 'all' && t.categoryId !== filterCategory) return false;

      // Filtro de Fornecedor
      if (filterSupplier !== 'all' && t.entityId !== filterSupplier) return false;

      // Busca textual
      const s = search.toLowerCase();
      if (s) {
        const matchDesc = t.description.toLowerCase().includes(s);
        const matchSupplier = (t.entity?.name || '').toLowerCase().includes(s);
        const matchCat = (t.category?.name || '').toLowerCase().includes(s);
        if (!matchDesc && !matchSupplier && !matchCat) return false;
      }

      // Filtro de Vencimento
      if (quickFilter === 'today') return due <= new Date();
      if (quickFilter === '7') { const l = new Date(now); l.setDate(l.getDate()+7); return due <= l; }
      if (quickFilter === '30') { const l = new Date(now); l.setDate(l.getDate()+30); return due <= l; }
      if (quickFilter === 'month') return due <= new Date(now.getFullYear(), now.getMonth()+1, 0, 23,59,59);
      return true;
    });
  }, [transactions, quickFilter, filterCompany, filterCategory, filterSupplier, search]);

  const atrasadas = filtered.filter(t => new Date(t.dueDate) < new Date(new Date().setHours(0,0,0,0)));
  const hoje = filtered.filter(t => new Date(t.dueDate).toDateString() === new Date().toDateString());
  const futuros = filtered.filter(t => new Date(t.dueDate) > new Date() && new Date(t.dueDate).toDateString() !== new Date().toDateString());
  const totalPendente = filtered.reduce((a,b) => a+b.amount, 0);
  const totalAtrasado = atrasadas.reduce((a,b) => a+b.amount, 0);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!valor || !dataVenc || !desc) { 
      setError('Preencha a descrição, o valor e o vencimento do boleto.'); 
      return; 
    }
    setSaving(true); setError(''); setSuccess('');
    try {
      const response = await authFetch('/api/transactions', {
        method: 'POST',
        body: JSON.stringify({ 
          description: desc, 
          amount: parseCurrency(valor), 
          type: 'OUT', 
          status: 'PENDING', 
          dueDate: dataVenc, 
          companyId: companyId || (filterCompany !== 'all' ? filterCompany : null),
          categoryId: categoryId || null,
          entityId: entityId || null,
          bankAccountId: bankAccountId || null,
          isRecurring: recorrente 
        })
      });
      if (response.ok) {
        setSuccess('✅ Boleto cadastrado com sucesso no Contas a Pagar!');
        setDesc(''); setValor(''); setCategoryId(''); setEntityId(''); setCompanyId(''); setBankAccountId(''); setRecorrente(false);
        setDataVenc(todayInput());
        fetchTransactions();
        setTimeout(() => setSuccess(''), 3500);
      } else {
        const data = await response.json().catch(() => null);
        setError(data?.error || 'Erro ao salvar no servidor. Tente novamente.');
      }
    } catch { 
      setError('Erro de conexão com o servidor.'); 
    } finally { 
      setSaving(false); 
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      const res = await authFetch(`/api/transactions/${deleteItem.id}`, { method: 'DELETE' });
      if (res.ok) {
        setSuccess('✅ Registro excluído com sucesso.');
        fetchTransactions();
        setDeleteItem(null);
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError('Não foi possível excluir o registro.');
      }
    } catch {
      setError('Erro ao conectar ao servidor para exclusão.');
    } finally {
      setDeleting(false);
    }
  };

  const handleBoletoUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      alert('O arquivo do boleto é muito grande (máximo 6MB). Preencha os dados manualmente.');
      e.target.value = null;
      return;
    }
    setOcrLoading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const response = await authFetch('/api/ocr/boleto', { method: 'POST', body: JSON.stringify({ fileBase64: ev.target.result }) });
        const data = await response.json();
        // O OCR devolve o valor com ponto decimal ("1234.56"). O campo usa máscara
        // brasileira ("1.234,56"), então convertemos antes de preencher — caso
        // contrário parseCurrency multiplicaria o valor por 100 ao salvar.
        if (data.amount != null && data.amount !== '') {
          const num = Number(String(data.amount).replace(',', '.'));
          if (isFinite(num) && num > 0) {
            setValor(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
          }
        }
        if (data.dueDate) setDataVenc(data.dueDate);
        setTab('lancamento');
      } catch { 
        alert('Erro ao ler boleto automaticamente. Preencha os campos manualmente.'); 
        setTab('lancamento'); 
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
    setSuccess('✅ Baixa realizada com sucesso! Título transferido para o Extrato Pago.');
    setTimeout(() => setSuccess(''), 3500);
  };

  const FILTERS = [
    { v:'all', l:'Todos' },
    { v:'today', l:'Hoje / Atrasados' },
    { v:'7', l:'Próximos 7 dias' },
    { v:'30', l:'Próximos 30 dias' },
    { v:'month', l:'Este Mês' }
  ];

  const renderCard = (item) => {
    const diffDays = daysUntil(item.dueDate);
    const overdue = diffDays < 0;
    const isToday = diffDays === 0;

    return (
      <div 
        key={item.id} 
        className="fin-card"
        style={{
          padding: '1.1rem 1.25rem',
          borderLeft: overdue ? '4px solid var(--danger)' : isToday ? '4px solid var(--warning)' : '4px solid var(--info)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.85rem',
          marginBottom: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: '1 1 240px', minWidth: 0 }}>
          <div style={{ 
            width: 42, 
            height: 42, 
            borderRadius: '50%', 
            background: overdue ? 'var(--danger-bg)' : isToday ? 'var(--warning-bg)' : 'var(--info-bg)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            flexShrink: 0 
          }}>
            {overdue ? <AlertCircle size={20} color="var(--danger)" /> : isToday ? <Clock size={20} color="var(--warning)" /> : <Calendar size={20} color="var(--info)" />}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.description}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
              {item.entity && (
                <span className="badge-pill badge-neutral">
                  <Truck size={11} /> {item.entity.name}
                </span>
              )}
              {item.category && (
                <span className="badge-pill badge-info">
                  <Tag size={11} /> {item.category.name}
                </span>
              )}
              {item.company && (
                <span className="badge-pill badge-neutral">
                  <Building2 size={11} /> {item.company.name}
                </span>
              )}
              <span style={{ 
                fontSize: '0.75rem', 
                color: overdue ? 'var(--danger)' : isToday ? 'var(--warning-text)' : 'var(--text-muted)', 
                fontWeight: 700 
              }}>
                {overdue ? `⚠️ Atrasado há ${Math.abs(diffDays)}d` : isToday ? '⏰ Vence hoje' : `📅 Vence em ${diffDays}d (${formatDateBR(item.dueDate)})`}
              </span>
              {item.isRecurring && (
                <span className="badge-pill" style={{ background: 'rgba(124,58,237,0.12)', color: 'var(--brand-purple)', border: '1px solid rgba(124,58,237,0.25)' }}>
                  ↺ Recorrente
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          flex: '1 1 auto', 
          minWidth: '220px', 
          gap: 10,
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: 8,
          marginTop: 2
        }}>
          <div className="tabular-nums" style={{ fontWeight: 900, fontSize: '1.25rem', color: overdue ? 'var(--danger)' : 'var(--text-main)' }}>
            {fmt(item.amount)}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setPayTransaction(item)}
              className="btn btn-success"
              style={{ padding: '0.45rem 0.95rem', fontSize: '0.82rem', borderRadius: 8, gap: 5, minHeight: 38 }}
            >
              <CheckCircle2 size={15} /> Dar Baixa
            </button>
            <button
              onClick={() => setDeleteItem(item)}
              title="Excluir com segurança"
              className="btn btn-secondary"
              style={{ padding: '0.45rem 0.65rem', borderRadius: 8, color: 'var(--danger)', minHeight: 38 }}
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '1rem' }}>
        {[
          {
            icon: TrendingDown, label: 'Total a Pagar Filtrado', value: fmt(totalPendente), color: 'var(--danger)', bg: 'var(--danger-bg)',
            sub: `${filtered.length} boleto(s) pendente(s)`
          },
          {
            icon: AlertCircle, label: 'Boletos em Atraso', value: fmt(totalAtrasado), color: 'var(--danger-text)', bg: 'var(--danger-bg)',
            sub: `${atrasadas.length} boleto(s) vencido(s)`
          },
          {
            icon: Calendar, label: 'A Vencer nos Próximos Dias', value: fmt(futuros.reduce((a,b)=>a+b.amount,0)), color: 'var(--info)', bg: 'var(--info-bg)',
            sub: `${futuros.length} conta(s) futuras`
          }
        ].map(({icon:Icon,label,value,color,bg,sub}) => (
          <div key={label} className="fin-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={16} color={color} />
              </div>
            </div>
            <div className="tabular-nums" style={{ fontSize: '1.55rem', fontWeight: 900, color }}>{value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Success/Error Alerts */}
      {success && <div className="badge-pill badge-pill-success" style={{ width: '100%', padding: '0.85rem 1.15rem', borderRadius: 10, fontSize: '0.875rem' }}>{success}</div>}
      {error && <div className="badge-pill badge-pill-danger" style={{ width: '100%', padding: '0.85rem 1.15rem', borderRadius: 10, fontSize: '0.875rem' }}>{error}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: 5, gap: 6, boxShadow: 'var(--shadow-xs)' }}>
        <button 
          onClick={() => setTab('baixa')} 
          style={{ 
            flex: 1, 
            padding: '0.75rem 0.5rem', 
            border: 'none', 
            borderRadius: 'var(--radius-md)', 
            fontWeight: 800, 
            fontSize: '0.85rem', 
            cursor: 'pointer', 
            transition: 'all 0.2s', 
            background: tab === 'baixa' ? 'var(--brand-gradient)' : 'transparent', 
            color: tab === 'baixa' ? '#ffffff' : 'var(--text-muted)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: 6,
            boxShadow: tab === 'baixa' ? '0 2px 8px rgba(37,99,235,0.3)' : 'none'
          }}
        >
          <CheckCircle2 size={17} /> Baixa em Boletos
          {filtered.length > 0 && (
            <span style={{ 
              background: tab === 'baixa' ? 'rgba(255,255,255,0.25)' : 'var(--danger-bg)', 
              color: tab === 'baixa' ? '#ffffff' : 'var(--danger)', 
              borderRadius: 99, 
              fontSize: '0.7rem', 
              fontWeight: 800, 
              padding: '2px 7px' 
            }}>
              {filtered.length}
            </span>
          )}
        </button>
        <button 
          onClick={() => setTab('lancamento')} 
          style={{ 
            flex: 1, 
            padding: '0.75rem 0.5rem', 
            border: 'none', 
            borderRadius: 'var(--radius-md)', 
            fontWeight: 800, 
            fontSize: '0.85rem', 
            cursor: 'pointer', 
            transition: 'all 0.2s', 
            background: tab === 'lancamento' ? 'var(--brand-gradient)' : 'transparent', 
            color: tab === 'lancamento' ? '#ffffff' : 'var(--text-muted)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: 6,
            boxShadow: tab === 'lancamento' ? '0 2px 8px rgba(37,99,235,0.3)' : 'none'
          }}
        >
          <Plus size={17} /> + Lançar Boleto
        </button>
      </div>

      {/* TAB: Dar Baixa */}
      {tab === 'baixa' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* ─── BARRA DE FILTROS MULTIDIMENSIONAIS ────────────────────────── */}
          <div className="fin-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '1.15rem 1.25rem' }}>
            
            {/* Linha 1: Dropdowns de Unidade, Categoria, Fornecedor e Busca */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: '0.65rem', alignItems: 'center' }}>
              
              {/* Dropdown Unidade */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-body)', padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <Building2 size={15} color="var(--brand-blue)" />
                <select 
                  value={filterCompany} 
                  onChange={e => setFilterCompany(e.target.value)}
                  style={{ border: 'none', background: 'transparent', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', width: '100%', outline: 'none', padding: 0 }}
                >
                  <option value="all">🏢 Todas as Unidades</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Dropdown Categoria */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-body)', padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <Tag size={15} color="var(--brand-blue)" />
                <select 
                  value={filterCategory} 
                  onChange={e => setFilterCategory(e.target.value)}
                  style={{ border: 'none', background: 'transparent', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', width: '100%', outline: 'none', padding: 0 }}
                >
                  <option value="all">🏷️ Todas as Categorias</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Dropdown Fornecedor */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-body)', padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <UserCheck size={15} color="var(--brand-blue)" />
                <select 
                  value={filterSupplier} 
                  onChange={e => setFilterSupplier(e.target.value)}
                  style={{ border: 'none', background: 'transparent', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', width: '100%', outline: 'none', padding: 0 }}
                >
                  <option value="all">🚚 Todos Fornecedores</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              {/* Input Busca */}
              <div className="search-input-wrapper">
                <Search size={15} className="search-icon" />
                <input
                  type="text"
                  placeholder="Buscar boleto..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ fontSize: '0.82rem' }}
                />
              </div>

            </div>

            {/* Linha 2: Pílulas de Vencimento e Leitor OCR */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', marginRight: 2, textTransform: 'uppercase' }}>Vencimento:</span>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 }}>
                {FILTERS.map(f => (
                  <button 
                    key={f.v} 
                    onClick={() => setQuickFilter(f.v)} 
                    className={`filter-pill ${quickFilter === f.v ? 'active' : ''}`}
                  >
                    {f.l}
                  </button>
                ))}
              </div>

              <label style={{ marginLeft: 'auto', padding: '5px 12px', background: 'var(--brand-blue-light)', borderRadius: 20, fontSize: '0.78rem', fontWeight: 700, color: 'var(--brand-blue)', cursor: ocrLoading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 5, border: '1px solid rgba(59,130,246,0.25)', minHeight: 34 }}>
                {ocrLoading ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <FileText size={13} />} {ocrLoading ? 'Lendo boleto...' : 'Leitor OCR'}
                <input type="file" accept="application/pdf,image/*" style={{ display: 'none' }} onChange={handleBoletoUpload} disabled={ocrLoading} />
              </label>
            </div>

          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <Loader size={36} color="var(--brand-blue)" style={{ animation: 'spin 1s linear infinite' }} />
              <p style={{ color: 'var(--text-muted)', marginTop: 8, fontWeight: 600 }}>Carregando boletos...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="fin-card" style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <CheckCircle2 size={44} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block', color: 'var(--success)' }} />
              <p style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-main)' }}>Nenhum boleto encontrado com os filtros atuais!</p>
              <p style={{ fontSize: '0.85rem' }}>Tente alterar a unidade, categoria ou período selecionado.</p>
            </div>
          ) : (
            <div>
              {atrasadas.length > 0 && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontWeight: 800, color: 'var(--danger)', fontSize: '0.875rem' }}>🔴 BOLETOS ATRASADOS ({atrasadas.length})</span>
                    <span className="tabular-nums" style={{ fontWeight: 900, color: 'var(--danger)', fontSize: '0.875rem', marginLeft: 'auto' }}>{fmt(atrasadas.reduce((a,b)=>a+b.amount,0))}</span>
                  </div>
                  {atrasadas.map(renderCard)}
                </div>
              )}
              {hoje.length > 0 && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontWeight: 800, color: 'var(--warning-text)', fontSize: '0.875rem' }}>🟡 VENCENDO HOJE ({hoje.length})</span>
                    <span className="tabular-nums" style={{ fontWeight: 900, color: 'var(--warning-text)', marginLeft: 'auto', fontSize: '0.875rem' }}>{fmt(hoje.reduce((a,b)=>a+b.amount,0))}</span>
                  </div>
                  {hoje.map(renderCard)}
                </div>
              )}
              {futuros.length > 0 && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontWeight: 800, color: 'var(--info)', fontSize: '0.875rem' }}>🔵 A VENCER NOS PRÓXIMOS DIAS ({futuros.length})</span>
                    <span className="tabular-nums" style={{ fontWeight: 900, color: 'var(--info)', marginLeft: 'auto', fontSize: '0.875rem' }}>{fmt(futuros.reduce((a,b)=>a+b.amount,0))}</span>
                  </div>
                  {futuros.map(renderCard)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB: Lançar Novo Boleto / Dívida */}
      {tab === 'lancamento' && (
        <div className="fin-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ background: 'var(--brand-gradient)', padding: '1.25rem 1.5rem', color: '#ffffff' }}>
            <h3 style={{ color: '#ffffff', margin: 0, fontWeight: 800, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus size={20} /> Lançar Boleto ou Conta de Auto Peças / Diesel
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.85)', margin: '4px 0 0', fontSize: '0.82rem' }}>
              Cadastre boletos de distribuidores, compras de estoque ou despesas operacionais da oficina.
            </p>
          </div>

          <form onSubmit={handleSave} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            
            {/* Descrição */}
            <div className="form-group">
              <label>📝 Descrição do Boleto / Compra *</label>
              <input 
                value={desc} 
                onChange={e => setDesc(e.target.value)} 
                placeholder="Ex: Compra de Bicos e Válvulas Injetoras Bosch, Filtros e Óleo Lubrificante..." 
                required 
              />
            </div>

            {/* Valor e Vencimento */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label>💰 Valor do Boleto (R$) *</label>
                <input 
                  type="text" 
                  placeholder="0,00" 
                  value={valor} 
                  onChange={e => setValor(formatCurrency(e.target.value))} 
                  required 
                  style={{ fontWeight: 700 }}
                />
              </div>
              <div className="form-group">
                <label>📅 Data de Vencimento *</label>
                <input 
                  type="date" 
                  value={dataVenc} 
                  onChange={e => setDataVenc(e.target.value)} 
                  required 
                />
              </div>
            </div>

            {/* Categoria e Fornecedor */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Tag size={14} color="var(--brand-blue)" /> Categoria de Despesa
                </label>
                <select value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                  <option value="">— Selecione a Categoria —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <UserCheck size={14} color="var(--brand-blue)" /> Fornecedor / Distribuidora
                </label>
                <select value={entityId} onChange={e => setEntityId(e.target.value)}>
                  <option value="">— Selecione o Fornecedor —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            {/* Conta Bancária e Empresa */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <CreditCard size={14} color="var(--brand-blue)" /> Conta de Pagamento (opcional)
                </label>
                <select value={bankAccountId} onChange={e => setBankAccountId(e.target.value)}>
                  <option value="">— Selecione a Conta / Caixa —</option>
                  {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Building2 size={14} color="var(--brand-blue)" /> Unidade / Empresa
                </label>
                <select value={companyId} onChange={e => setCompanyId(e.target.value)}>
                  <option value="">— Sem empresa específica —</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            {/* Recorrência */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '0.75rem', background: 'var(--bg-body)', borderRadius: 8, border: '1px solid var(--border-color)', minHeight: 44 }}>
              <input type="checkbox" checked={recorrente} onChange={e => setRecorrente(e.target.checked)} style={{ width: 18, height: 18 }} />
              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                ↺ Repetir mensalmente (despesa fixa da loja/oficina)
              </span>
            </label>

            {/* Submit */}
            <button 
              type="submit" 
              disabled={saving} 
              className="btn btn-primary"
              style={{ 
                padding: '0.85rem', 
                fontWeight: 800, 
                fontSize: '0.95rem', 
                gap: 8,
              }}
            >
              {saving ? 'Salvando Boleto...' : <><Plus size={18} /> Cadastrar Boleto a Pagar</>}
            </button>
          </form>
        </div>
      )}

      {/* Pay Modal */}
      <PayModal 
        isOpen={!!payTransaction} 
        onClose={() => setPayTransaction(null)} 
        transaction={payTransaction} 
        onPaySuccess={handlePaySuccess} 
      />

      {/* Safe Delete Confirm Modal */}
      <ConfirmModal
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={handleDeleteConfirm}
        title="Excluir Boleto / Conta a Pagar"
        message="Mover este boleto para a lixeira? Ele sai do Contas a Pagar e dos relatórios, mas pode ser restaurado."
        itemName={deleteItem?.description}
        itemValue={deleteItem ? fmt(deleteItem.amount) : ''}
        loading={deleting}
      />
    </div>
  );
}

