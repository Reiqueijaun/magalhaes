import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, Paperclip, Trash2, Calendar, TrendingDown, DollarSign,
  Building2, Tag, UserCheck, CreditCard, Filter, Loader, Eye, ArrowDownRight
} from 'lucide-react';
import { authFetch } from '../config';
import { formatCurrency, parseCurrency, todayInput, formatDateBR } from '../utils';
import ConfirmModal from './ConfirmModal';

const fmt = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export default function Expenses({ selectedCompanyId = 'all', companies = [], theme = 'light' }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [entities, setEntities] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [periodFilter, setPeriodFilter] = useState('month'); // 'today', '7', 'month', 'year', 'all'

  // Filtros Multidimensionais
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterSupplier, setFilterSupplier] = useState('all');
  const [filterCompany, setFilterCompany] = useState(selectedCompanyId || 'all');

  // Sincroniza filtro de empresa se mudar no topo
  useEffect(() => {
    if (selectedCompanyId) {
      setFilterCompany(selectedCompanyId);
    }
  }, [selectedCompanyId]);

  // Delete modal state
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Formulário
  const [desc, setDesc] = useState('');
  const [valor, setValor] = useState('');
  const [dataVenc, setDataVenc] = useState(todayInput());
  const [categoryId, setCategoryId] = useState('');
  const [entityId, setEntityId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      const [transRes, catRes, entRes, bankRes] = await Promise.all([
        authFetch('/api/transactions'),
        authFetch('/api/categories'),
        authFetch('/api/entities'),
        authFetch('/api/bank-accounts'),
      ]);
      const trans = await transRes.json();
      const cats = await catRes.json();
      const ents = await entRes.json();
      const banks = await bankRes.json();
      setExpenses(trans.filter(t => t.type === 'OUT' && t.status === 'PAID' && (!t.context || t.context === 'PJ')));
      setCategories(cats.filter(c => c.type === 'OUT'));
      setEntities(ents.filter(e => e.type === 'SUPPLIER'));
      setBankAccounts(banks);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Filtro Multidimensional por período, empresa, categoria e fornecedor
  const filteredExpenses = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return expenses.filter(e => {
      const pDate = new Date(e.paymentDate || e.dueDate);
      
      // Filtro de Empresa / Unidade
      if (filterCompany !== 'all' && e.companyId !== filterCompany) return false;

      // Filtro de Categoria
      if (filterCategory !== 'all' && e.categoryId !== filterCategory) return false;

      // Filtro de Fornecedor
      if (filterSupplier !== 'all' && e.entityId !== filterSupplier) return false;

      // Match de texto
      const s = search.toLowerCase();
      if (s) {
        const matchSearch = e.description.toLowerCase().includes(s) || 
          (e.entity?.name || '').toLowerCase().includes(s) || 
          (e.category?.name || '').toLowerCase().includes(s);
        if (!matchSearch) return false;
      }

      if (periodFilter === 'today') {
        return pDate.toDateString() === now.toDateString();
      }
      if (periodFilter === '7') {
        const past7 = new Date(now);
        past7.setDate(past7.getDate() - 7);
        return pDate >= past7 && pDate <= new Date();
      }
      if (periodFilter === 'month') {
        return pDate.getMonth() === now.getMonth() && pDate.getFullYear() === now.getFullYear();
      }
      if (periodFilter === 'year') {
        return pDate.getFullYear() === now.getFullYear();
      }
      return true; // 'all'
    });
  }, [expenses, search, periodFilter, filterCompany, filterCategory, filterSupplier]);

  const totalPagoPeriodo = filteredExpenses.reduce((acc, t) => acc + t.amount, 0);
  const mediaPagamento = filteredExpenses.length > 0 ? totalPagoPeriodo / filteredExpenses.length : 0;
  const maiorDespesa = filteredExpenses.reduce((max, t) => t.amount > max ? t.amount : max, 0);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await authFetch('/api/transactions', {
        method: 'POST',
        body: JSON.stringify({
          description: desc,
          amount: parseCurrency(valor),
          type: 'OUT',
          status: 'PAID',
          dueDate: dataVenc,
          paymentDate: dataVenc,
          isRecurring: false,
          categoryId: categoryId || null,
          entityId: entityId || null,
          companyId: companyId || (filterCompany !== 'all' ? filterCompany : null),
          bankAccountId: bankAccountId || null,
        })
      });
      if (response.ok) {
        setIsModalOpen(false);
        fetchData();
        setDesc(''); setValor(''); setCategoryId(''); setEntityId(''); setCompanyId(''); setBankAccountId('');
        setDataVenc(todayInput());
      }
    } catch (err) {
      alert('Erro ao salvar. Verifique a conexão com o servidor.');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (id, e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      alert('O arquivo é muito grande. O limite é 8MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result;
      try {
        await authFetch(`/api/transactions/${id}/attach`, {
          method: 'PATCH',
          body: JSON.stringify({ attachmentUrl: base64 })
        });
        alert('Comprovante anexado com sucesso!');
        fetchData();
      } catch (err) {
        alert('Erro ao anexar comprovante.');
      }
    };
    reader.readAsDataURL(file);
  };

  const viewAttachment = async (id) => {
    try {
      const res = await authFetch(`/api/transactions/${id}/attachment`);
      const data = await res.json();
      if (data.attachmentUrl) {
        // Validação de segurança: só abre URLs HTTPS ou data: de PDF — nunca javascript:
        const url = String(data.attachmentUrl);
        const isHttps = url.startsWith('https://');
        const isPdfData = url.startsWith('data:application/pdf;base64,');
        if (!isHttps && !isPdfData) {
          alert('URL do anexo inválida ou não segura.');
          return;
        }
        // Abre a URL diretamente — nunca usa document.write
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        alert('Anexo não encontrado.');
      }
    } catch (err) {
      alert('Erro ao carregar o anexo.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      const res = await authFetch(`/api/transactions/${deleteItem.id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchData();
        setDeleteItem(null);
      } else {
        alert('Erro ao excluir a despesa.');
      }
    } catch {
      alert('Erro de conexão com o servidor.');
    } finally {
      setDeleting(false);
    }
  };

  const PERIOD_OPTIONS = [
    { id: 'today', label: 'Hoje' },
    { id: '7', label: 'Últimos 7 dias' },
    { id: 'month', label: 'Este Mês' },
    { id: 'year', label: 'Este Ano' },
    { id: 'all', label: 'Todo o Histórico' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Header com Totais do Período */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '1rem' }}>
        
        <div className="fin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Pago no Período
            </span>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--danger-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingDown size={18} color="var(--danger)" />
            </div>
          </div>
          <div className="tabular-nums" style={{ fontSize: '1.55rem', fontWeight: 900, color: 'var(--danger)' }}>
            {fmt(totalPagoPeriodo)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
            {filteredExpenses.length} despesa(s) quitada(s)
          </div>
        </div>

        <div className="fin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Maior Despesa Paga
            </span>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--warning-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={18} color="var(--warning-text)" />
            </div>
          </div>
          <div className="tabular-nums" style={{ fontSize: '1.55rem', fontWeight: 900, color: 'var(--text-main)' }}>
            {fmt(maiorDespesa)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
            No período selecionado
          </div>
        </div>

        <div className="fin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Média por Pagamento
            </span>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--info-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={18} color="var(--info)" />
            </div>
          </div>
          <div className="tabular-nums" style={{ fontSize: '1.55rem', fontWeight: 900, color: 'var(--info)' }}>
            {fmt(mediaPagamento)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Média de custos por despesa
          </div>
        </div>

      </div>

      {/* ─── BARRA DE FILTROS MULTIDIMENSIONAIS ──────────────────────────── */}
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
              <option value="all">🚚 Todos os Fornecedores</option>
              {entities.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Input Busca */}
          <div className="search-input-wrapper">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              placeholder="Buscar no histórico..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ fontSize: '0.82rem' }}
            />
          </div>

        </div>

        {/* Linha 2: Pílulas de Período e Botão de Novo */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', marginRight: 2, textTransform: 'uppercase' }}>Período:</span>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 }}>
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => setPeriodFilter(opt.id)}
                className={`filter-pill ${periodFilter === opt.id ? 'active' : ''}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="btn btn-primary"
            style={{
              marginLeft: 'auto',
              padding: '0.45rem 0.95rem',
              fontSize: '0.82rem',
              borderRadius: 8,
              gap: 6,
              whiteSpace: 'nowrap',
              minHeight: 36,
            }}
          >
            <Plus size={15} /> + Lançar Pago
          </button>
        </div>

      </div>

      {/* Tabela de Extrato de Despesas Pagas */}
      <div className="fin-table-container">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <Loader size={36} color="var(--brand-blue)" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ color: 'var(--text-muted)', marginTop: 8, fontWeight: 600 }}>Carregando histórico de pagamentos...</p>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem', color: 'var(--text-muted)' }}>
            <Calendar size={40} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
            <p style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)' }}>Nenhum pagamento encontrado com os filtros atuais</p>
            <p style={{ fontSize: '0.85rem' }}>Alterne os filtros de unidade, categoria ou período selecionado.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="fin-table">
              <thead>
                <tr>
                  <th>Data Pgto</th>
                  <th>Descrição / Compra</th>
                  <th>Fornecedor</th>
                  <th>Categoria</th>
                  <th style={{ textAlign: 'right' }}>Valor Pago</th>
                  <th style={{ textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map(expense => (
                  <tr key={expense.id}>
                    <td className="tabular-nums" style={{ fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                      {formatDateBR(expense.paymentDate || expense.dueDate)}
                    </td>
                    <td>
                      <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{expense.description}</div>
                      {expense.company && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>🏢 {expense.company.name}</div>}
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
                      {expense.entity?.name ? (
                        <span className="badge-pill badge-neutral">
                          🚚 {expense.entity.name}
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      {expense.category ? (
                        <span className="badge-pill badge-info">
                          {expense.category.name}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 900, color: 'var(--danger)', fontSize: '1.05rem', whiteSpace: 'nowrap' }}>
                      - {fmt(expense.amount)}
                    </td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                        {expense.hasAttachment ? (
                          <button 
                            onClick={() => viewAttachment(expense.id)} 
                            title="Ver Comprovante Anexo" 
                            className="btn btn-secondary"
                            style={{ padding: '0.45rem 0.65rem', color: 'var(--brand-blue)', minHeight: 36 }}
                          >
                            <Eye size={15} />
                          </button>
                        ) : (
                          <label 
                            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', minHeight: 36 }} 
                            title="Anexar Comprovante"
                            className="btn btn-secondary"
                          >
                            <Paperclip size={15} />
                            <input type="file" style={{ display: 'none' }} accept="image/*,.pdf" onChange={(e) => handleFileUpload(expense.id, e)} />
                          </label>
                        )}

                        <button 
                          onClick={() => setDeleteItem(expense)} 
                          title="Excluir despesa com segurança"
                          className="btn btn-secondary"
                          style={{ padding: '0.45rem 0.65rem', color: 'var(--danger)', minHeight: 36 }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Lançamento Direto de Despesa Paga */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '540px' }} onClick={e => e.stopPropagation()}>
            <div style={{ background: 'var(--brand-gradient)', padding: '1.25rem 1.5rem', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, color: '#ffffff' }}>
                <Plus size={18} /> Registrar Despesa Paga no Dia
              </h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#ffffff', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontWeight: 800 }}>&times;</button>
            </div>

            <form onSubmit={handleSave} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label>Data do Pagamento *</label>
                  <input type="date" value={dataVenc} onChange={e => setDataVenc(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Valor Pago (R$) *</label>
                  <input type="text" placeholder="0,00" value={valor} onChange={e => setValor(formatCurrency(e.target.value))} required style={{ fontWeight: 700 }} />
                </div>
              </div>

              <div className="form-group">
                <label>Descrição da Compra / Despesa *</label>
                <input type="text" placeholder="Ex: Compra de Óleo Lubrificante e Filtros..." value={desc} onChange={e => setDesc(e.target.value)} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label>Categoria</label>
                  <select value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                    <option value="">Selecione...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Fornecedor</label>
                  <select value={entityId} onChange={e => setEntityId(e.target.value)}>
                    <option value="">Selecione...</option>
                    {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label>Conta / Caixa Utilizado</label>
                  <select value={bankAccountId} onChange={e => setBankAccountId(e.target.value)}>
                    <option value="">Selecione...</option>
                    {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Building2 size={14} color="var(--brand-blue)" /> Unidade / Empresa *
                  </label>
                  <select value={companyId} onChange={e => setCompanyId(e.target.value)} required>
                    <option value="">— Selecione a empresa —</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={saving}
                className="btn btn-primary"
                style={{
                  padding: '0.85rem',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  marginTop: '0.5rem',
                }}
              >
                {saving ? 'Salvando...' : 'Salvar no Histórico Pago'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Safe Delete Confirm Modal */}
      <ConfirmModal
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={handleDeleteConfirm}
        title="Excluir Pagamento do Extrato"
        message="Mover este pagamento para a lixeira? Ele sai do extrato e dos totalizadores, mas pode ser restaurado depois."
        itemName={deleteItem?.description}
        itemValue={deleteItem ? fmt(deleteItem.amount) : ''}
        loading={deleting}
      />

    </div>
  );
}

