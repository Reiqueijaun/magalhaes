import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Paperclip, Trash2, Calendar, TrendingDown, DollarSign, Building, Tag, UserCheck, CreditCard, Filter } from 'lucide-react';
import { authFetch } from '../config';
import { formatCurrency, parseCurrency } from '../utils';
import ConfirmModal from './ConfirmModal';

const fmt = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export default function Expenses() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [entities, setEntities] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [periodFilter, setPeriodFilter] = useState('month'); // 'today', '7', 'month', 'year', 'all'

  // Delete modal state
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Formulário
  const [desc, setDesc] = useState('');
  const [valor, setValor] = useState('');
  const [dataVenc, setDataVenc] = useState(new Date().toISOString().split('T')[0]);
  const [categoryId, setCategoryId] = useState('');
  const [entityId, setEntityId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      const [transRes, catRes, entRes, compRes, bankRes] = await Promise.all([
        authFetch('/api/transactions'),
        authFetch('/api/categories'),
        authFetch('/api/entities'),
        authFetch('/api/companies'),
        authFetch('/api/bank-accounts'),
      ]);
      const trans = await transRes.json();
      const cats = await catRes.json();
      const ents = await entRes.json();
      const comps = await compRes.json();
      const banks = await bankRes.json();
      setExpenses(trans.filter(t => t.type === 'OUT' && t.status === 'PAID' && (!t.context || t.context === 'PJ')));
      setCategories(cats.filter(c => c.type === 'OUT'));
      setEntities(ents.filter(e => e.type === 'SUPPLIER'));
      setCompanies(comps);
      setBankAccounts(banks);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Filtro por período
  const filteredExpenses = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return expenses.filter(e => {
      const pDate = new Date(e.paymentDate || e.dueDate);
      
      // Match de texto
      const s = search.toLowerCase();
      const matchSearch = !s || 
        e.description.toLowerCase().includes(s) || 
        (e.entity?.name || '').toLowerCase().includes(s) || 
        (e.category?.name || '').toLowerCase().includes(s);

      if (!matchSearch) return false;

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
  }, [expenses, search, periodFilter]);

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
          companyId: companyId || null,
          bankAccountId: bankAccountId || null,
        })
      });
      if (response.ok) {
        setIsModalOpen(false);
        fetchData();
        setDesc(''); setValor(''); setCategoryId(''); setEntityId(''); setCompanyId(''); setBankAccountId('');
        setDataVenc(new Date().toISOString().split('T')[0]);
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
        const newTab = window.open();
        newTab.document.write(`<iframe src="${data.attachmentUrl}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
        
        <div style={{ background: 'white', borderRadius: 12, padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Pago no Período
            </span>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingDown size={18} color="#dc2626" />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#dc2626' }}>
            {fmt(totalPagoPeriodo)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>
            {filteredExpenses.length} despesa(s) quitada(s)
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: 12, padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Maior Despesa Paga
            </span>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={18} color="#d97706" />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1e293b' }}>
            {fmt(maiorDespesa)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>
            No período selecionado
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: 12, padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Média por Pagamento
            </span>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={18} color="#0284c7" />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0284c7' }}>
            {fmt(mediaPagamento)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>
            Média de custos por boleto/despesa
          </div>
        </div>

      </div>

      {/* Barra de Filtros de Período e Busca */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', background: 'white', padding: '1rem 1.25rem', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        
        {/* Chips de Período (Hoje, Mês, Ano) */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => setPeriodFilter(opt.id)}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: periodFilter === opt.id ? '2px solid #243b9d' : '1px solid #e2e8f0',
                background: periodFilter === opt.id ? '#eef1f8' : 'white',
                color: periodFilter === opt.id ? '#243b9d' : '#64748b',
                transition: 'all 0.15s ease'
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Busca e Botão Novo */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1, justifyContent: 'flex-end', minWidth: 260 }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Buscar despesa, fornecedor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.75rem 0.5rem 2rem', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '0.85rem' }}
            />
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            style={{
              padding: '0.55rem 1.1rem',
              background: 'linear-gradient(135deg, #243b9d, #1d3080)',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 6px rgba(36,59,157,0.2)'
            }}
          >
            <Plus size={16} /> + Lançar Despesa Já Paga
          </button>
        </div>

      </div>

      {/* Tabela de Extrato de Despesas Pagas */}
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        {loading ? (
          <p style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Carregando histórico de pagamentos...</p>
        ) : filteredExpenses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem', color: '#94a3b8' }}>
            <Calendar size={40} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
            <p style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1e293b' }}>Nenhum pagamento registrado neste período</p>
            <p style={{ fontSize: '0.85rem' }}>Alterne o filtro para "Todo o Histórico" ou registre uma nova despesa paga.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '0.85rem 1.25rem', color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Data Pgto</th>
                  <th style={{ padding: '0.85rem 1.25rem', color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Descrição / Compra</th>
                  <th style={{ padding: '0.85rem 1.25rem', color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Fornecedor</th>
                  <th style={{ padding: '0.85rem 1.25rem', color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Categoria</th>
                  <th style={{ padding: '0.85rem 1.25rem', color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', textAlign: 'right' }}>Valor Pago</th>
                  <th style={{ padding: '0.85rem 1.25rem', color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map(expense => (
                  <tr key={expense.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.85rem 1.25rem', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>
                      {new Date(expense.paymentDate || expense.dueDate).toLocaleDateString('pt-BR')}
                    </td>
                    <td style={{ padding: '0.85rem 1.25rem', fontWeight: 600, color: '#1e293b' }}>
                      {expense.description}
                      {expense.company && <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 400 }}>🏢 {expense.company.name}</div>}
                    </td>
                    <td style={{ padding: '0.85rem 1.25rem', color: '#64748b', fontSize: '0.85rem' }}>
                      {expense.entity?.name ? `🚚 ${expense.entity.name}` : '—'}
                    </td>
                    <td style={{ padding: '0.85rem 1.25rem' }}>
                      {expense.category ? (
                        <span style={{ background: '#eef1f8', color: '#243b9d', padding: '3px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700 }}>
                          {expense.category.name}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', fontWeight: 800, color: '#dc2626', fontSize: '1rem', whiteSpace: 'nowrap' }}>
                      - {fmt(expense.amount)}
                    </td>
                    <td style={{ padding: '0.85rem 1.25rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                        {expense.hasAttachment ? (
                          <button onClick={() => viewAttachment(expense.id)} title="Ver Comprovante Anexo" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '5px 8px', color: '#2563eb', cursor: 'pointer' }}>
                            <Paperclip size={15} />
                          </button>
                        ) : (
                          <label style={{ cursor: 'pointer', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '5px 8px', color: '#94a3b8', display: 'flex', alignItems: 'center' }} title="Anexar Comprovante">
                            <Paperclip size={15} />
                            <input type="file" style={{ display: 'none' }} accept="image/*,.pdf" onChange={(e) => handleFileUpload(expense.id, e)} />
                          </label>
                        )}

                        <button 
                          onClick={() => setDeleteItem(expense)} 
                          title="Excluir despesa com segurança"
                          style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 6, padding: '5px 8px', color: '#ef4444', cursor: 'pointer' }}
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
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: '1rem',
          }}
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            style={{
              background: 'white',
              borderRadius: 16,
              maxWidth: '540px',
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ background: 'linear-gradient(135deg, #243b9d, #1d3080)', padding: '1.25rem 1.5rem', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Plus size={18} /> Registrar Despesa Paga no Dia
              </h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>&times;</button>
            </div>

            <form onSubmit={handleSave} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Data do Pagamento *</label>
                  <input type="date" value={dataVenc} onChange={e => setDataVenc(e.target.value)} required style={{ padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: 8 }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Valor Pago (R$) *</label>
                  <input type="text" placeholder="0,00" value={valor} onChange={e => setValor(formatCurrency(e.target.value))} required style={{ padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: 8, fontWeight: 700 }} />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Descrição da Compra / Despesa *</label>
                <input type="text" placeholder="Ex: Compra de Óleo Lubrificante e Filtros, Peças de Injeção..." value={desc} onChange={e => setDesc(e.target.value)} required style={{ padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: 8 }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Categoria</label>
                  <select value={categoryId} onChange={e => setCategoryId(e.target.value)} style={{ padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: 8 }}>
                    <option value="">Selecione...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Fornecedor</label>
                  <select value={entityId} onChange={e => setEntityId(e.target.value)} style={{ padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: 8 }}>
                    <option value="">Selecione...</option>
                    {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Conta / Caixa Utilizado</label>
                <select value={bankAccountId} onChange={e => setBankAccountId(e.target.value)} style={{ padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: 8 }}>
                  <option value="">Selecione...</option>
                  {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

              <button 
                type="submit" 
                disabled={saving}
                style={{
                  padding: '0.85rem',
                  background: 'linear-gradient(135deg, #243b9d, #1d3080)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: saving ? 'wait' : 'pointer',
                  marginTop: '0.5rem',
                  boxShadow: '0 4px 12px rgba(36,59,157,0.2)'
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
        message="Atenção: Tem certeza que deseja excluir este pagamento do seu extrato histórico? Isso afetará os relatórios e totalizadores."
        itemName={deleteItem?.description}
        itemValue={deleteItem ? fmt(deleteItem.amount) : ''}
        loading={deleting}
      />

    </div>
  );
}
