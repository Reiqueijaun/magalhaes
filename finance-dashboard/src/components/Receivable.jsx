import { useState, useEffect, useMemo } from 'react';
import {
  Plus, CheckCircle2, Calendar, TrendingUp, Clock, Trash2,
  Building2, Tag, UserCheck, CreditCard, Search, Filter,
  ArrowUpRight, Sparkles, User
} from 'lucide-react';
import { authFetch } from '../config';
import { formatCurrency, parseCurrency } from '../utils';
import PayModal from './PayModal';
import ConfirmModal from './ConfirmModal';

const fmt = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export default function Receivable({ selectedCompanyId = 'all', companies = [], theme = 'light' }) {
  const [tab, setTab] = useState('confirmar');
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [clients, setClients] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [payTransaction, setPayTransaction] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Filtros Multidimensionais
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterClient, setFilterClient] = useState('all');
  const [filterCompany, setFilterCompany] = useState(selectedCompanyId || 'all');
  const [search, setSearch] = useState('');

  // Sincroniza filtro de empresa se mudar no topo
  useEffect(() => {
    if (selectedCompanyId) {
      setFilterCompany(selectedCompanyId);
    }
  }, [selectedCompanyId]);

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
        setTransactions(data.filter(t => t.type === 'IN' && t.status === 'PENDING' && (!t.context || t.context === 'PJ')));
      }
      if (catRes.ok) {
        const cats = await catRes.json();
        setCategories(cats.filter(c => c.type === 'IN'));
      }
      if (entRes.ok) {
        const ents = await entRes.json();
        setClients(ents.filter(e => e.type === 'CLIENT'));
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
    return transactions.filter(t => {
      // Filtro de Empresa / Unidade
      if (filterCompany !== 'all' && t.companyId !== filterCompany) return false;

      // Filtro de Categoria
      if (filterCategory !== 'all' && t.categoryId !== filterCategory) return false;

      // Filtro de Cliente
      if (filterClient !== 'all' && t.entityId !== filterClient) return false;

      // Busca textual
      const s = search.toLowerCase();
      if (s) {
        const matchDesc = t.description.toLowerCase().includes(s);
        const matchClient = (t.entity?.name || '').toLowerCase().includes(s);
        const matchCat = (t.category?.name || '').toLowerCase().includes(s);
        if (!matchDesc && !matchClient && !matchCat) return false;
      }

      return true;
    });
  }, [transactions, filterCompany, filterCategory, filterClient, search]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!valor || !dataVenc || !desc) { 
      setError('Preencha a descrição, o valor e a data de previsão de recebimento.'); 
      return; 
    }
    setSaving(true); setError(''); setSuccess('');
    try {
      const response = await authFetch('/api/transactions', {
        method: 'POST',
        body: JSON.stringify({ 
          description: desc, 
          amount: parseCurrency(valor), 
          type: 'IN', 
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
        setSuccess('✅ Cobrança / Venda registrada com sucesso!');
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
        setSuccess('✅ Registro de cobrança excluído com sucesso.');
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

  const handlePaySuccess = () => {
    setPayTransaction(null);
    fetchTransactions();
    setSuccess('✅ Recebimento confirmado! Registrado com sucesso no extrato.');
    setTimeout(() => setSuccess(''), 3500);
  };

  const now = new Date();
  const vencidos = filtered.filter(t => new Date(t.dueDate) < new Date(new Date().setHours(0,0,0,0)));
  const hoje = filtered.filter(t => new Date(t.dueDate).toDateString() === now.toDateString());
  const futuros = filtered.filter(t => new Date(t.dueDate) > now && new Date(t.dueDate).toDateString() !== now.toDateString());
  const totalPendente = filtered.reduce((a,b) => a+b.amount, 0);

  const renderCard = (item) => {
    const dueDate = new Date(item.dueDate);
    const nowDay = new Date(); nowDay.setHours(0,0,0,0);
    const diffDays = Math.ceil((dueDate - nowDay) / (1000*60*60*24));
    const isOverdue = dueDate < nowDay;
    const isToday = dueDate.toDateString() === new Date().toDateString();

    return (
      <div 
        key={item.id} 
        className="fin-card"
        style={{
          padding: '1.1rem 1.35rem',
          borderLeft: isOverdue ? '4px solid var(--warning)' : isToday ? '4px solid var(--success)' : '4px solid var(--info)',
          display: 'flex',
          alignItems: 'center',
          gap: '1.25rem',
          marginBottom: 10,
        }}
      >
        <div style={{ 
          width: 44, 
          height: 44, 
          borderRadius: '50%', 
          background: isOverdue ? 'var(--warning-bg)' : isToday ? 'var(--success-bg)' : 'var(--info-bg)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          flexShrink: 0 
        }}>
          {isOverdue ? <Clock size={20} color="var(--warning)" /> : isToday ? <CheckCircle2 size={20} color="var(--success)" /> : <Calendar size={20} color="var(--info)" />}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.description}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            {item.entity && (
              <span className="badge-pill badge-pill-success">
                <User size={12} /> Cliente: {item.entity.name}
              </span>
            )}
            {item.category && (
              <span className="badge-pill badge-info">
                <Tag size={12} /> {item.category.name}
              </span>
            )}
            {item.company && (
              <span className="badge-pill badge-neutral">
                <Building2 size={12} /> {item.company.name}
              </span>
            )}
            <span style={{ 
              fontSize: '0.75rem', 
              color: isOverdue ? 'var(--warning-text)' : isToday ? 'var(--success-text)' : 'var(--text-muted)', 
              fontWeight: 700 
            }}>
              {isOverdue ? `⚠️ Deveria ter entrado há ${Math.abs(diffDays)} dia(s)` : isToday ? '✨ Previsto para entrar hoje' : `📅 Previsão: ${dueDate.toLocaleDateString('pt-BR')} (em ${diffDays} dia(s))`}
            </span>
            {item.isRecurring && (
              <span className="badge-pill" style={{ background: 'rgba(124,58,237,0.12)', color: 'var(--brand-purple)', border: '1px solid rgba(124,58,237,0.25)' }}>
                ↺ Recorrente
              </span>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div className="tabular-nums" style={{ fontWeight: 900, fontSize: '1.25rem', color: 'var(--success)' }}>
            {fmt(item.amount)}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setPayTransaction(item)}
              className="btn btn-success"
              style={{ padding: '0.45rem 0.95rem', fontSize: '0.8rem', borderRadius: 8, gap: 5 }}
            >
              <CheckCircle2 size={14} /> Confirmar Recebido
            </button>
            <button
              onClick={() => setDeleteItem(item)}
              title="Excluir com segurança"
              className="btn btn-secondary"
              style={{ padding: '0.45rem 0.65rem', borderRadius: 8, color: 'var(--danger)' }}
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

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
        {[
          {
            icon: TrendingUp, label: 'Total a Receber Filtrado', value: fmt(totalPendente), color: 'var(--success)', bg: 'var(--success-bg)',
            sub: `${filtered.length} cobrança(s) em aberto`
          },
          {
            icon: Clock, label: 'A Receber Hoje / Pendente', value: fmt([...vencidos,...hoje].reduce((a,b)=>a+b.amount,0)), color: 'var(--info)', bg: 'var(--info-bg)',
            sub: `${vencidos.length + hoje.length} recebimento(s)`
          },
          {
            icon: Calendar, label: 'Previsões Futuras de Clientes', value: fmt(futuros.reduce((a,b)=>a+b.amount,0)), color: 'var(--brand-purple)', bg: 'rgba(124,58,237,0.12)',
            sub: `${futuros.length} recebimento(s) futuros`
          }
        ].map(({icon:Icon,label,value,color,bg,sub}) => (
          <div key={label} className="fin-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={16} color={color} />
              </div>
            </div>
            <div className="tabular-nums" style={{ fontSize: '1.65rem', fontWeight: 900, color }}>{value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>
          </div>
        ))}
      </div>

      {success && <div className="badge-pill badge-pill-success" style={{ width: '100%', padding: '0.85rem 1.15rem', borderRadius: 10, fontSize: '0.875rem' }}>{success}</div>}
      {error && <div className="badge-pill badge-pill-danger" style={{ width: '100%', padding: '0.85rem 1.15rem', borderRadius: 10, fontSize: '0.875rem' }}>{error}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: 5, gap: 6, boxShadow: 'var(--shadow-xs)' }}>
        <button 
          onClick={() => setTab('confirmar')} 
          style={{ 
            flex: 1, 
            padding: '0.75rem', 
            border: 'none', 
            borderRadius: 'var(--radius-md)', 
            fontWeight: 800, 
            fontSize: '0.88rem', 
            cursor: 'pointer', 
            transition: 'all 0.2s', 
            background: tab === 'confirmar' ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent', 
            color: tab === 'confirmar' ? '#ffffff' : 'var(--text-muted)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: 8,
            boxShadow: tab === 'confirmar' ? '0 2px 8px rgba(16,185,129,0.3)' : 'none'
          }}
        >
          <CheckCircle2 size={18} /> Confirmar Recebimentos
          {filtered.length > 0 && (
            <span style={{ 
              background: tab === 'confirmar' ? 'rgba(255,255,255,0.25)' : 'var(--success-bg)', 
              color: tab === 'confirmar' ? '#ffffff' : 'var(--success-text)', 
              borderRadius: 99, 
              fontSize: '0.72rem', 
              fontWeight: 800, 
              padding: '2px 8px' 
            }}>
              {filtered.length}
            </span>
          )}
        </button>
        <button 
          onClick={() => setTab('lancamento')} 
          style={{ 
            flex: 1, 
            padding: '0.75rem', 
            border: 'none', 
            borderRadius: 'var(--radius-md)', 
            fontWeight: 800, 
            fontSize: '0.88rem', 
            cursor: 'pointer', 
            transition: 'all 0.2s', 
            background: tab === 'lancamento' ? 'var(--brand-gradient)' : 'transparent', 
            color: tab === 'lancamento' ? '#ffffff' : 'var(--text-muted)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: 8,
            boxShadow: tab === 'lancamento' ? '0 2px 8px rgba(37,99,235,0.3)' : 'none'
          }}
        >
          <Plus size={18} /> + Registrar Nova Cobrança / Venda
        </button>
      </div>

      {/* TAB: Confirmar recebimentos */}
      {tab === 'confirmar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* ─── BARRA DE FILTROS MULTIDIMENSIONAIS ────────────────────────── */}
          <div className="fin-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '1.15rem 1.35rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', alignItems: 'center' }}>
              
              {/* Dropdown Unidade */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-body)', padding: '5px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <Building2 size={15} color="var(--success)" />
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-body)', padding: '5px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <Tag size={15} color="var(--success)" />
                <select 
                  value={filterCategory} 
                  onChange={e => setFilterCategory(e.target.value)}
                  style={{ border: 'none', background: 'transparent', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', width: '100%', outline: 'none', padding: 0 }}
                >
                  <option value="all">🏷️ Todas as Categorias</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Dropdown Cliente */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-body)', padding: '5px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <UserCheck size={15} color="var(--success)" />
                <select 
                  value={filterClient} 
                  onChange={e => setFilterClient(e.target.value)}
                  style={{ border: 'none', background: 'transparent', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', width: '100%', outline: 'none', padding: 0 }}
                >
                  <option value="all">👤 Todos os Clientes</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Input Busca */}
              <div className="search-input-wrapper">
                <Search size={15} className="search-icon" />
                <input
                  type="text"
                  placeholder="Buscar cliente, serviço..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ fontSize: '0.82rem' }}
                />
              </div>

            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <Loader size={36} color="var(--success)" style={{ animation: 'spin 1s linear infinite' }} />
              <p style={{ color: 'var(--text-muted)', marginTop: 8, fontWeight: 600 }}>Carregando cobranças...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="fin-card" style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <CheckCircle2 size={44} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block', color: 'var(--success)' }} />
              <p style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-main)' }}>Nenhuma cobrança encontrada com os filtros atuais!</p>
              <p style={{ fontSize: '0.85rem' }}>Tente alterar a unidade ou categoria selecionada.</p>
            </div>
          ) : (
            <div>
              {[...vencidos, ...hoje].length > 0 && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontWeight: 800, color: 'var(--success)', fontSize: '0.875rem' }}>✅ RECEBIMENTOS PARA HOJE / PENDENTES ({[...vencidos,...hoje].length})</span>
                    <span className="tabular-nums" style={{ fontWeight: 900, color: 'var(--success)', marginLeft: 'auto', fontSize: '0.875rem' }}>{fmt([...vencidos,...hoje].reduce((a,b)=>a+b.amount,0))}</span>
                  </div>
                  {[...vencidos, ...hoje].map(renderCard)}
                </div>
              )}
              {futuros.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontWeight: 800, color: 'var(--brand-purple)', fontSize: '0.875rem' }}>🔮 PREVISTOS PARA OS PRÓXIMOS DIAS ({futuros.length})</span>
                    <span className="tabular-nums" style={{ fontWeight: 800, color: 'var(--brand-purple)', marginLeft: 'auto', fontSize: '0.875rem' }}>{fmt(futuros.reduce((a,b)=>a+b.amount,0))}</span>
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
        <div className="fin-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ background: 'linear-gradient(135deg, #10b981, #059669)', padding: '1.25rem 1.5rem', color: '#ffffff' }}>
            <h3 style={{ color: '#ffffff', margin: 0, fontWeight: 800, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus size={20} /> Registrar Cobrança / Venda de Auto Peças & Serviços
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.85)', margin: '4px 0 0', fontSize: '0.82rem' }}>
              Cadastre vendas a prazo, faturamento de frotas ou serviços de manutenção diesel a receber.
            </p>
          </div>

          <form onSubmit={handleSave} style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Descrição */}
            <div className="form-group">
              <label>📝 Descrição do Serviço / Venda de Peças *</label>
              <input 
                value={desc} 
                onChange={e => setDesc(e.target.value)} 
                placeholder="Ex: Venda de Peças Diesel - Transportadora Silva, Manutenção de Bomba e Bicos Injetores..." 
                required 
              />
            </div>

            {/* Valor e Previsão */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>💰 Valor Previsto (R$) *</label>
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
                <label>📅 Previsão de Recebimento *</label>
                <input 
                  type="date" 
                  value={dataVenc} 
                  onChange={e => setDataVenc(e.target.value)} 
                  required 
                />
              </div>
            </div>

            {/* Categoria e Cliente */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Tag size={14} color="var(--success)" /> Categoria de Receita
                </label>
                <select value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                  <option value="">— Selecione a Categoria —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <UserCheck size={14} color="var(--success)" /> Cliente / Frotista
                </label>
                <select value={entityId} onChange={e => setEntityId(e.target.value)}>
                  <option value="">— Selecione o Cliente —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            {/* Conta Bancária e Empresa */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <CreditCard size={14} color="var(--success)" /> Conta de Entrada (opcional)
                </label>
                <select value={bankAccountId} onChange={e => setBankAccountId(e.target.value)}>
                  <option value="">— Selecione a Conta de Destino —</option>
                  {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Building2 size={14} color="var(--success)" /> Unidade / Empresa
                </label>
                <select value={companyId} onChange={e => setCompanyId(e.target.value)}>
                  <option value="">— Sem empresa específica —</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            {/* Recorrência */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '0.75rem', background: 'var(--bg-body)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
              <input type="checkbox" checked={recorrente} onChange={e => setRecorrente(e.target.checked)} style={{ width: 16, height: 16 }} />
              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                ↺ Repetir mensalmente (faturamento recorrente/mensalista)
              </span>
            </label>

            {/* Submit */}
            <button 
              type="submit" 
              disabled={saving} 
              className="btn btn-success"
              style={{ 
                padding: '0.85rem', 
                fontWeight: 800, 
                fontSize: '0.95rem', 
                gap: 8,
              }}
            >
              {saving ? 'Salvando Cobrança...' : <><Plus size={18} /> Registrar Cobrança / Venda</>}
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
        title="Excluir Cobrança a Receber"
        message="Atenção: Tem certeza que deseja excluir esta previsão de recebimento do sistema?"
        itemName={deleteItem?.description}
        itemValue={deleteItem ? fmt(deleteItem.amount) : ''}
        loading={deleting}
      />
    </div>
  );
}

