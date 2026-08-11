import { useState, useEffect } from 'react';
import { Plus, Search, Paperclip, Trash2 } from 'lucide-react';
import { authFetch } from '../config';
import { formatCurrency, parseCurrency } from '../utils';


export default function Expenses() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [entities, setEntities] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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
      alert('Erro ao salvar. Verifique se o backend está rodando.');
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

  const deleteExpense = async (id) => {
    if (!confirm('Deseja excluir esta despesa?')) return;
    try {
      await authFetch(`/api/transactions/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      alert('Erro ao excluir.');
    }
  };

  const filtered = expenses.filter(e =>
    e.description.toLowerCase().includes(search.toLowerCase()) ||
    (e.category?.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (e.entity?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalFiltrado = filtered.reduce((acc, e) => acc + e.amount, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar por descrição, categoria ou fornecedor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', paddingLeft: '35px' }}
          />
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} /> Registrar Despesa Paga
        </button>
      </div>

      {/* Card Resumo */}
      <div style={{ display: 'flex', gap: '1rem' }}>
        <div className="card stat-card" style={{ flex: 1 }}>
          <div className="stat-header"><span>Total no filtro</span></div>
          <div className="stat-value" style={{ fontSize: '1.5rem' }}>R$ {totalFiltrado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          <div className="stat-footer"><span className="text-muted">{filtered.length} registro(s)</span></div>
        </div>
      </div>

      {/* Tabela */}
      <div id="tutorial-expenses-table" className="card table-container" style={{ padding: 0 }}>
        {loading ? (
          <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Carregando despesas...</p>
        ) : (
          <table>
            <thead style={{ backgroundColor: 'var(--bg-body)' }}>
              <tr>
                <th>Data</th>
                <th>Descrição</th>
                <th>Fornecedor</th>
                <th>Categoria</th>
                <th>Valor (R$)</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    Nenhuma despesa encontrada. Registre a primeira clicando no botão acima!
                  </td>
                </tr>
              ) : (
                filtered.map((expense, index) => (
                  <tr key={expense.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(expense.paymentDate || expense.dueDate).toLocaleDateString('pt-BR')}</td>
                    <td style={{ fontWeight: 500 }}>
                      {expense.description}
                      {expense.company && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{expense.company.name}</div>}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{expense.entity?.name || '—'}</td>
                    <td>
                      {expense.category ? (
                        <span className="badge" style={{ backgroundColor: 'var(--brand-blue-light)', color: 'var(--brand-blue)' }}>
                          {expense.category.name}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--danger)' }}>
                      R$ {expense.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {expense.hasAttachment ? (
                        <button id={index === 0 ? "tutorial-expense-attachment" : undefined} onClick={() => viewAttachment(expense.id)} title="Ver Comprovante" style={{ marginRight: '12px', color: 'var(--brand-blue)', background: 'none', border: 'none', cursor: 'pointer' }}>
                          <Paperclip size={18} />
                        </button>
                      ) : (
                        <label id={index === 0 ? "tutorial-expense-attachment" : undefined} style={{ cursor: 'pointer', marginRight: '12px', color: 'var(--text-muted)' }} title="Anexar Comprovante">
                          <Paperclip size={18} />
                          <input type="file" style={{ display: 'none' }} accept="image/*,.pdf" onChange={(e) => handleFileUpload(expense.id, e)} />
                        </label>
                      )}
                      <button onClick={() => deleteExpense(expense.id)} style={{ color: 'var(--danger)', background: 'none' }} title="Excluir">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.25rem' }}>Registrar Despesa Paga</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', fontSize: '1.5rem', color: 'var(--text-muted)' }}>&times;</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label>Data do Pagamento</label>
                <input type="date" value={dataVenc} onChange={e => setDataVenc(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Descrição</label>
                <input type="text" placeholder="Ex: Compra de material" value={desc} onChange={e => setDesc(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Conta Bancária / Forma de Pagamento</label>
                <select value={bankAccountId} onChange={e => setBankAccountId(e.target.value)}>
                  <option value="">Selecione...</option>
                  {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Empresa</label>
                  <select value={companyId} onChange={e => setCompanyId(e.target.value)} required>
                    <option value="">Selecione...</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Categoria</label>
                  <select value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                    <option value="">Sem categoria</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Fornecedor</label>
                  <select value={entityId} onChange={e => setEntityId(e.target.value)}>
                    <option value="">Nenhum</option>
                    {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Valor Pago (R$)</label>
                <input type="text" placeholder="0,00" value={valor} onChange={e => setValor(formatCurrency(e.target.value))} required />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar no Banco'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
