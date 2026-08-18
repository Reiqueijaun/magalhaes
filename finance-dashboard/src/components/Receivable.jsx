import { useState, useEffect, useMemo } from 'react';
import { Plus, CheckCircle2, Calendar, TrendingUp, Clock, Trash2, Building2, Tag, UserCheck, CreditCard, Search, Filter } from 'lucide-react';
import { authFetch } from '../config';
import { formatCurrency, parseCurrency } from '../utils';
import PayModal from './PayModal';
import ConfirmModal from './ConfirmModal';

const fmt = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export default function Receivable({ selectedCompanyId = 'all', companies = [] }) {
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
        setSuccess('✅ Registro de cobrança excluído com segurança.');
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
      <div key={item.id} style={{ background: 'white', border: `1px solid ${isOverdue ? '#fde68a' : '#e2e8f0'}`, borderLeft: `4px solid ${isOverdue ? '#f59e0b' : isToday ? '#10b981' : '#0284c7'}`, borderRadius: 12, padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: 10 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: isOverdue ? '#fef3c7' : isToday ? '#d1fae5' : '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {isOverdue ? <Clock size={22} color="#f59e0b" /> : <Calendar size={22} color="#10b981" />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.description}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            {item.entity && <span style={{ fontSize: '0.75rem', color: '#065f46', background: '#d1fae5', padding: '1px 8px', borderRadius: 6 }}>👤 Cliente: {item.entity.name}</span>}
            {item.category && <span style={{ fontSize: '0.75rem', color: '#243b9d', background: '#eef1f8', padding: '1px 8px', borderRadius: 6 }}>🏷️ {item.category.name}</span>}
            {item.company && <span style={{ fontSize: '0.75rem', color: '#64748b' }}>🏢 {item.company.name}</span>}
            <span style={{ fontSize: '0.75rem', color: isOverdue ? '#d97706' : '#64748b', fontWeight: isOverdue ? 700 : 500 }}>
              {isOverdue ? `⚠️ Deveria ter entrado há ${Math.abs(diffDays)} dia(s)` : isToday ? '✨ Previsto para entrar hoje' : `📅 Previsão: ${dueDate.toLocaleDateString('pt-BR')} (em ${diffDays} dia(s))`}
            </span>
            {item.isRecurring && <span style={{ fontSize: '0.72rem', color: '#7c3aed', background: '#ede9fe', padding: '1px 6px', borderRadius: 10 }}>↺ Recorrente</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#10b981' }}>{fmt(item.amount)}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setPayTransaction(item)}
              style={{ padding: '6px 14px', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, boxShadow: '0 2px 6px rgba(16,185,129,0.2)' }}
            >
              <CheckCircle2 size={14} /> Confirmar Recebido
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

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
        {[
          {
            icon: TrendingUp, label: 'Total a Receber Filtrado', value: fmt(totalPendente), color: '#10b981', bg: '#d1fae5',
            sub: `${filtered.length} cobrança(s) em aberto`
          },
          {
            icon: Clock, label: 'A Receber Hoje / Atrasado', value: fmt([...vencidos,...hoje].reduce((a,b)=>a+b.amount,0)), color: '#0284c7', bg: '#e0f2fe',
            sub: `${vencidos.length + hoje.length} recebimento(s)`
          },
          {
            icon: Calendar, label: 'Previsões Futuras de Clientes', value: fmt(futuros.reduce((a,b)=>a+b.amount,0)), color: '#7c3aed', bg: '#ede9fe',
            sub: `${futuros.length} recebimento(s) futuros`
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

      {success && <div style={{ background: '#d1fae5', color: '#065f46', borderRadius: 10, padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.875rem' }}>{success}</div>}
      {error && <div style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 10, padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.875rem' }}>{error}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: 6, gap: 6, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <button onClick={() => setTab('confirmar')} style={{ flex: 1, padding: '0.75rem', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', background: tab === 'confirmar' ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent', color: tab === 'confirmar' ? 'white' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <CheckCircle2 size={18} /> Confirmar Recebimentos
          {filtered.length > 0 && <span style={{ background: tab === 'confirmar' ? 'rgba(255,255,255,0.3)' : '#d1fae5', color: tab === 'confirmar' ? 'white' : '#10b981', borderRadius: 99, fontSize: '0.75rem', fontWeight: 800, padding: '2px 8px' }}>{filtered.length}</span>}
        </button>
        <button onClick={() => setTab('lancamento')} style={{ flex: 1, padding: '0.75rem', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', background: tab === 'lancamento' ? 'linear-gradient(135deg, #243b9d, #1d3080)' : 'transparent', color: tab === 'lancamento' ? 'white' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Plus size={18} /> + Registrar Nova Cobrança / Venda
        </button>
      </div>

      {/* TAB: Confirmar recebimentos */}
      {tab === 'confirmar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* ─── BARRA DE FILTROS MULTIDIMENSIONAIS ────────────────────────── */}
          <div style={{ background: 'white', padding: '1rem 1.25rem', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', alignItems: 'center' }}>
              
              {/* Dropdown Unidade */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1' }}>
                <Building2 size={15} color="#10b981" />
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
                <Tag size={15} color="#10b981" />
                <select 
                  value={filterCategory} 
                  onChange={e => setFilterCategory(e.target.value)}
                  style={{ border: 'none', background: 'transparent', fontSize: '0.82rem', fontWeight: 600, color: '#1e293b', width: '100%', outline: 'none' }}
                >
                  <option value="all">🏷️ Todas as Categorias</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Dropdown Cliente */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1' }}>
                <UserCheck size={15} color="#10b981" />
                <select 
                  value={filterClient} 
                  onChange={e => setFilterClient(e.target.value)}
                  style={{ border: 'none', background: 'transparent', fontSize: '0.82rem', fontWeight: 600, color: '#1e293b', width: '100%', outline: 'none' }}
                >
                  <option value="all">👤 Todos os Clientes</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Input Busca */}
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Buscar cliente, serviço..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ width: '100%', padding: '0.45rem 0.6rem 0.45rem 2rem', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '0.82rem' }}
                />
              </div>

            </div>
          </div>

          {loading ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>Carregando cobranças...</p> : filtered.length === 0 ? (
            <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: '3.5rem', textAlign: 'center', color: '#94a3b8' }}>
              <CheckCircle2 size={44} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block', color: '#10b981' }} />
              <p style={{ fontWeight: 700, fontSize: '1.1rem', color: '#1e293b' }}>Nenhuma cobrança encontrada com os filtros atuais!</p>
              <p style={{ fontSize: '0.85rem' }}>Tente alterar a unidade ou categoria selecionada.</p>
            </div>
          ) : (
            <div>
              {[...vencidos, ...hoje].length > 0 && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontWeight: 800, color: '#10b981', fontSize: '0.875rem' }}>✅ RECEBIMENTOS PARA HOJE / PENDENTES ({[...vencidos,...hoje].length})</span>
                    <span style={{ fontWeight: 800, color: '#10b981', marginLeft: 'auto', fontSize: '0.875rem' }}>{fmt([...vencidos,...hoje].reduce((a,b)=>a+b.amount,0))}</span>
                  </div>
                  {[...vencidos, ...hoje].map(renderCard)}
                </div>
              )}
              {futuros.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontWeight: 800, color: '#7c3aed', fontSize: '0.875rem' }}>🔮 PREVISTOS PARA OS PRÓXIMOS DIAS ({futuros.length})</span>
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
          <div style={{ background: 'linear-gradient(135deg, #10b981, #059669)', padding: '1.25rem 1.5rem' }}>
            <h3 style={{ color: 'white', margin: 0, fontWeight: 700, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus size={20} /> Registrar Cobrança / Venda de Auto Peças & Serviços
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.85)', margin: '4px 0 0', fontSize: '0.82rem' }}>
              Cadastre vendas a prazo, faturamento de frotas ou serviços de manutenção diesel a receber.
            </p>
          </div>

          <form onSubmit={handleSave} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Descrição */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155' }}>
                📝 Descrição do Serviço / Venda de Peças *
              </label>
              <input 
                value={desc} 
                onChange={e => setDesc(e.target.value)} 
                placeholder="Ex: Venda de Peças Diesel - Transportadora Silva, Manutenção de Bomba e Bicos Injetores..." 
                required 
                style={{ padding: '0.65rem 0.85rem', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '0.9rem' }} 
              />
            </div>

            {/* Valor e Previsão */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155' }}>💰 Valor Previsto (R$) *</label>
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
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155' }}>📅 Previsão de Recebimento *</label>
                <input 
                  type="date" 
                  value={dataVenc} 
                  onChange={e => setDataVenc(e.target.value)} 
                  required 
                  style={{ padding: '0.65rem 0.85rem', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '0.9rem' }} 
                />
              </div>
            </div>

            {/* Categoria e Cliente */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Tag size={14} color="#10b981" /> Categoria de Receita
                </label>
                <select value={categoryId} onChange={e => setCategoryId(e.target.value)} style={{ padding: '0.65rem 0.85rem', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '0.88rem' }}>
                  <option value="">— Selecione a Categoria —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <UserCheck size={14} color="#10b981" /> Cliente / Frotista
                </label>
                <select value={entityId} onChange={e => setEntityId(e.target.value)} style={{ padding: '0.65rem 0.85rem', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '0.88rem' }}>
                  <option value="">— Selecione o Cliente —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            {/* Conta Bancária e Empresa */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <CreditCard size={14} color="#10b981" /> Conta de Entrada (opcional)
                </label>
                <select value={bankAccountId} onChange={e => setBankAccountId(e.target.value)} style={{ padding: '0.65rem 0.85rem', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '0.88rem' }}>
                  <option value="">— Selecione a Conta de Destino —</option>
                  {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Building2 size={14} color="#10b981" /> Unidade / Empresa
                </label>
                <select value={companyId} onChange={e => setCompanyId(e.target.value)} style={{ padding: '0.65rem 0.85rem', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '0.88rem' }}>
                  <option value="">— Sem empresa específica —</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            {/* Recorrência */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '0.75rem', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
              <input type="checkbox" checked={recorrente} onChange={e => setRecorrente(e.target.checked)} style={{ width: 16, height: 16 }} />
              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155' }}>
                ↺ Repetir mensalmente (faturamento recorrente/mensalista)
              </span>
            </label>

            {/* Submit */}
            <button 
              type="submit" 
              disabled={saving} 
              style={{ 
                padding: '0.85rem', 
                background: saving ? '#94a3b8' : 'linear-gradient(135deg, #10b981, #059669)', 
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
                boxShadow: '0 4px 12px rgba(16,185,129,0.2)' 
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
