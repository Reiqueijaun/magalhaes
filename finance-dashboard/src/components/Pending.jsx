import { useState, useEffect, useMemo } from 'react';
import { Plus, CheckCircle2, FileText, Loader, Calendar, AlertCircle, Clock, TrendingDown, Trash2, Building2, Tag, UserCheck, CreditCard, Search, Filter } from 'lucide-react';
import { authFetch } from '../config';
import { formatCurrency, parseCurrency } from '../utils';
import PayModal from './PayModal';
import ConfirmModal from './ConfirmModal';

const fmt = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export default function Pending({ selectedCompanyId = 'all', companies = [] }) {
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
  const [dataVenc, setDataVenc] = useState(new Date().toISOString().split('T')[0]);
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
        setSuccess('✅ Boleto/Conta cadastrado com sucesso!');
        setDesc(''); setValor(''); setCategoryId(''); setEntityId(''); setCompanyId(''); setBankAccountId(''); setRecorrente(false);
        setDataVenc(new Date().toISOString().split('T')[0]);
        fetchTransactions();
        setTimeout(() => setSuccess(''), 3500);
      } else { 
        setError('Erro ao salvar no servidor. Tente novamente.'); 
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
        setSuccess('✅ Registro excluído com segurança.');
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
    setOcrLoading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const response = await authFetch('/api/ocr/boleto', { method: 'POST', body: JSON.stringify({ fileBase64: ev.target.result }) });
        const data = await response.json();
        if (data.amount) setValor(data.amount);
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
    setSuccess('✅ Baixa realizada! Registro transferido para o Extrato Pago.');
    setTimeout(() => setSuccess(''), 3500);
  };

  const FILTERS = [{ v:'all', l:'Todos' },{ v:'today', l:'Hoje/Atrasados' },{ v:'7', l:'Próximos 7 dias' },{ v:'30', l:'Próximos 30 dias' },{ v:'month', l:'Este Mês' }];

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
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.description}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            {item.entity && <span style={{ fontSize: '0.75rem', color: '#475569', background: '#f1f5f9', padding: '1px 8px', borderRadius: 6 }}>🚚 {item.entity.name}</span>}
            {item.category && <span style={{ fontSize: '0.75rem', color: '#243b9d', background: '#eef1f8', padding: '1px 8px', borderRadius: 6 }}>🏷️ {item.category.name}</span>}
            {item.company && <span style={{ fontSize: '0.75rem', color: '#64748b' }}>🏢 {item.company.name}</span>}
            <span style={{ fontSize: '0.75rem', color: overdue ? '#ef4444' : '#64748b', fontWeight: overdue ? 700 : 500 }}>
              {overdue ? `⚠️ Venceu há ${Math.abs(diffDays)} dia(s)` : isToday ? '⏰ Vence hoje' : `📅 Vence em ${diffDays} dia(s) — ${dueDate.toLocaleDateString('pt-BR')}`}
            </span>
            {item.isRecurring && <span style={{ fontSize: '0.72rem', color: '#7c3aed', background: '#ede9fe', padding: '1px 6px', borderRadius: 10 }}>↺ Recorrente</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div style={{ fontWeight: 800, fontSize: '1.15rem', color: overdue ? '#ef4444' : '#1e293b' }}>
            {fmt(item.amount)}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setPayTransaction(item)}
              style={{ padding: '6px 14px', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, boxShadow: '0 2px 6px rgba(16,185,129,0.2)' }}
            >
              <CheckCircle2 size={14} /> Dar Baixa
            </button>
            <button
              onClick={() => setDeleteItem(item)}
              title="Excluir com segurança"
              style={{ padding: '6px 8px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 8, color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
        {[
          {
            icon: TrendingDown, label: 'Total a Pagar Filtrado', value: fmt(totalPendente), color: '#ef4444', bg: '#fee2e2',
            sub: `${filtered.length} boleto(s)/conta(s) pendente(s)`
          },
          {
            icon: AlertCircle, label: 'Boletos em Atraso', value: fmt(totalAtrasado), color: '#dc2626', bg: '#fee2e2',
            sub: `${atrasadas.length} boleto(s) vencido(s)`
          },
          {
            icon: Calendar, label: 'A Vencer nos Próximos Dias', value: fmt(futuros.reduce((a,b)=>a+b.amount,0)), color: '#0284c7', bg: '#e0f2fe',
            sub: `${futuros.length} conta(s) futuras`
          }
        ].map(({icon:Icon,label,value,color,bg,sub}) => (
          <div key={label} style={{ background: 'white', borderRadius: 12, padding: '1.1rem 1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={16} color={color} /></div>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 3 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Success/Error Alerts */}
      {success && <div style={{ background: '#d1fae5', color: '#065f46', borderRadius: 10, padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.875rem' }}>{success}</div>}
      {error && <div style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 10, padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.875rem' }}>{error}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: 6, gap: 6, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <button onClick={() => setTab('baixa')} style={{ flex: 1, padding: '0.75rem', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s', background: tab === 'baixa' ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'transparent', color: tab === 'baixa' ? 'white' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <CheckCircle2 size={18} /> Dar Baixa em Boletos
          {filtered.length > 0 && <span style={{ background: tab === 'baixa' ? 'rgba(255,255,255,0.3)' : '#fee2e2', color: tab === 'baixa' ? 'white' : '#ef4444', borderRadius: 99, fontSize: '0.75rem', fontWeight: 800, padding: '2px 8px' }}>{filtered.length}</span>}
        </button>
        <button onClick={() => setTab('lancamento')} style={{ flex: 1, padding: '0.75rem', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s', background: tab === 'lancamento' ? 'linear-gradient(135deg, #243b9d, #1d3080)' : 'transparent', color: tab === 'lancamento' ? 'white' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Plus size={18} /> + Lançar Novo Boleto / Dívida
        </button>
      </div>

      {/* TAB: Dar Baixa */}
      {tab === 'baixa' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* ─── BARRA DE FILTROS MULTIDIMENSIONAIS ────────────────────────── */}
          <div style={{ background: 'white', padding: '1rem 1.25rem', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            
            {/* Linha 1: Dropdowns de Unidade, Categoria, Fornecedor e Busca */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', alignItems: 'center' }}>
              
              {/* Dropdown Unidade */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1' }}>
                <Building2 size={15} color="#243b9d" />
                <select 
                  value={filterCompany} 
                  onChange={e => setFilterCompany(e.target.value)}
                  style={{ border: 'none', background: 'transparent', fontSize: '0.82rem', fontWeight: 600, color: '#1e293b', width: '100%', outline: 'none' }}
                >
                  <option value="all">🏢 Todas as Unidades</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Dropdown Categoria */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1' }}>
                <Tag size={15} color="#243b9d" />
                <select 
                  value={filterCategory} 
                  onChange={e => setFilterCategory(e.target.value)}
                  style={{ border: 'none', background: 'transparent', fontSize: '0.82rem', fontWeight: 600, color: '#1e293b', width: '100%', outline: 'none' }}
                >
                  <option value="all">🏷️ Todas as Categorias</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Dropdown Fornecedor */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1' }}>
                <UserCheck size={15} color="#243b9d" />
                <select 
                  value={filterSupplier} 
                  onChange={e => setFilterSupplier(e.target.value)}
                  style={{ border: 'none', background: 'transparent', fontSize: '0.82rem', fontWeight: 600, color: '#1e293b', width: '100%', outline: 'none' }}
                >
                  <option value="all">🚚 Todos os Fornecedores</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              {/* Input Busca */}
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Buscar descrição do boleto..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ width: '100%', padding: '0.45rem 0.6rem 0.45rem 2rem', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '0.82rem' }}
                />
              </div>

            </div>

            {/* Linha 2: Chips de Vencimento e Leitor OCR */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginRight: 4 }}>Vencimento:</span>
              {FILTERS.map(f => (
                <button 
                  key={f.v} 
                  onClick={() => setQuickFilter(f.v)} 
                  style={{ 
                    padding: '4px 12px', 
                    borderRadius: 20, 
                    fontSize: '0.78rem', 
                    fontWeight: 600, 
                    cursor: 'pointer', 
                    border: quickFilter === f.v ? '2px solid #ef4444' : '1px solid #e2e8f0', 
                    background: quickFilter === f.v ? '#fee2e2' : 'white', 
                    color: quickFilter === f.v ? '#dc2626' : '#64748b', 
                    transition: 'all 0.15s' 
                  }}
                >
                  {f.l}
                </button>
              ))}

              <label style={{ marginLeft: 'auto', padding: '5px 12px', background: '#eef1f8', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600, color: '#243b9d', cursor: ocrLoading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 5, border: '1px solid #c7d2fe' }}>
                {ocrLoading ? <Loader size={13} /> : <FileText size={13} />} {ocrLoading ? 'Lendo boleto...' : 'Leitor de Boleto (PDF)'}
                <input type="file" accept="application/pdf,image/*" style={{ display: 'none' }} onChange={handleBoletoUpload} disabled={ocrLoading} />
              </label>
            </div>

          </div>

          {loading ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>Carregando boletos pendentes...</p> : filtered.length === 0 ? (
            <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: '3.5rem', textAlign: 'center', color: '#94a3b8' }}>
              <CheckCircle2 size={44} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block', color: '#10b981' }} />
              <p style={{ fontWeight: 700, fontSize: '1.1rem', color: '#1e293b' }}>Nenhum boleto encontrado com os filtros atuais!</p>
              <p style={{ fontSize: '0.85rem' }}>Tente alterar a unidade, categoria ou período selecionado.</p>
            </div>
          ) : (
            <div>
              {atrasadas.length > 0 && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontWeight: 800, color: '#ef4444', fontSize: '0.875rem' }}>🔴 BOLETOS ATRASADOS ({atrasadas.length})</span>
                    <span style={{ fontWeight: 800, color: '#ef4444', fontSize: '0.875rem', marginLeft: 'auto' }}>{fmt(atrasadas.reduce((a,b)=>a+b.amount,0))}</span>
                  </div>
                  {atrasadas.map(renderCard)}
                </div>
              )}
              {hoje.length > 0 && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontWeight: 800, color: '#f59e0b', fontSize: '0.875rem' }}>🟡 VENCENDO HOJE ({hoje.length})</span>
                    <span style={{ fontWeight: 800, color: '#f59e0b', marginLeft: 'auto', fontSize: '0.875rem' }}>{fmt(hoje.reduce((a,b)=>a+b.amount,0))}</span>
                  </div>
                  {hoje.map(renderCard)}
                </div>
              )}
              {futuros.length > 0 && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontWeight: 800, color: '#0284c7', fontSize: '0.875rem' }}>🔵 A VENCER NOS PRÓXIMOS DIAS ({futuros.length})</span>
                    <span style={{ fontWeight: 800, color: '#0284c7', marginLeft: 'auto', fontSize: '0.875rem' }}>{fmt(futuros.reduce((a,b)=>a+b.amount,0))}</span>
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
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ background: 'linear-gradient(135deg, #243b9d, #1d3080)', padding: '1.25rem 1.5rem' }}>
            <h3 style={{ color: 'white', margin: 0, fontWeight: 700, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus size={20} /> Lançar Boleto ou Conta de Auto Peças / Diesel
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.8)', margin: '4px 0 0', fontSize: '0.82rem' }}>
              Cadastre boletos de distribuidores, compras de estoque ou despesas operacionais da oficina.
            </p>
          </div>

          <form onSubmit={handleSave} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Descrição */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155' }}>
                📝 Descrição do Boleto / Compra *
              </label>
              <input 
                value={desc} 
                onChange={e => setDesc(e.target.value)} 
                placeholder="Ex: Compra de Bicos e Válvulas Injetoras Bosch, Filtros e Óleo Lubrificante, Frete de Peças Diesel..." 
                required 
                style={{ padding: '0.65rem 0.85rem', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '0.9rem' }} 
              />
            </div>

            {/* Valor e Vencimento */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155' }}>💰 Valor do Boleto (R$) *</label>
                <input 
                  type="text" 
                  placeholder="0,00" 
                  value={valor} 
                  onChange={e => setValor(formatCurrency(e.target.value))} 
                  required 
                  style={{ padding: '0.65rem 0.85rem', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '0.95rem', fontWeight: 600 }} 
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155' }}>📅 Data de Vencimento *</label>
                <input 
                  type="date" 
                  value={dataVenc} 
                  onChange={e => setDataVenc(e.target.value)} 
                  required 
                  style={{ padding: '0.65rem 0.85rem', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '0.9rem' }} 
                />
              </div>
            </div>

            {/* Categoria e Fornecedor */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Tag size={14} color="#243b9d" /> Categoria de Despesa
                </label>
                <select value={categoryId} onChange={e => setCategoryId(e.target.value)} style={{ padding: '0.65rem 0.85rem', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '0.88rem' }}>
                  <option value="">— Selecione a Categoria —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <UserCheck size={14} color="#243b9d" /> Fornecedor / Distribuidora
                </label>
                <select value={entityId} onChange={e => setEntityId(e.target.value)} style={{ padding: '0.65rem 0.85rem', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '0.88rem' }}>
                  <option value="">— Selecione o Fornecedor —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            {/* Conta Bancária e Empresa */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <CreditCard size={14} color="#243b9d" /> Conta de Pagamento (opcional)
                </label>
                <select value={bankAccountId} onChange={e => setBankAccountId(e.target.value)} style={{ padding: '0.65rem 0.85rem', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '0.88rem' }}>
                  <option value="">— Selecione a Conta / Caixa —</option>
                  {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Building2 size={14} color="#243b9d" /> Unidade / Empresa
                </label>
                <select value={companyId} onChange={e => setCompanyId(e.target.value)} style={{ padding: '0.65rem 0.85rem', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '0.88rem' }}>
                  <option value="">— Sem empresa específica —</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            {/* Recorrência */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '0.75rem', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <input type="checkbox" checked={recorrente} onChange={e => setRecorrente(e.target.checked)} style={{ width: 16, height: 16 }} />
              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#475569' }}>
                ↺ Repetir mensalmente (despesa fixa da loja/oficina)
              </span>
            </label>

            {/* Submit */}
            <button 
              type="submit" 
              disabled={saving} 
              style={{ 
                padding: '0.85rem', 
                background: saving ? '#94a3b8' : 'linear-gradient(135deg, #243b9d, #1d3080)', 
                color: 'white', 
                border: 'none', 
                borderRadius: 10, 
                fontWeight: 700, 
                fontSize: '1rem', 
                cursor: saving ? 'not-allowed' : 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: 8,
                boxShadow: '0 4px 12px rgba(36,59,157,0.2)' 
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
        message="Atenção: Tem certeza que deseja excluir permanentemente este boleto do contas a pagar?"
        itemName={deleteItem?.description}
        itemValue={deleteItem ? fmt(deleteItem.amount) : ''}
        loading={deleting}
      />
    </div>
  );
}
