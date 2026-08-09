import { useState, useEffect } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import API_URL from '../config';

export default function Expenses() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Formulário
  const [desc, setDesc] = useState('');
  const [valor, setValor] = useState('');
  const [dataVenc, setDataVenc] = useState(new Date().toISOString().split('T')[0]);
  const [categoryId, setCategoryId] = useState('');
  const [entityId, setEntityId] = useState('');
  const [banco, setBanco] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      const [transRes, catRes, entRes] = await Promise.all([
        fetch(`${API_URL}/api/transactions`),
        fetch(`${API_URL}/api/categories`),
        fetch(`${API_URL}/api/entities`),
      ]);
      const trans = await transRes.json();
      const cats = await catRes.json();
      const ents = await entRes.json();
      // Histórico = despesas já pagas
      setExpenses(trans.filter(t => t.type === 'OUT' && t.status === 'PAID'));
      setCategories(cats.filter(c => c.type === 'OUT'));
      setEntities(ents.filter(e => e.type === 'SUPPLIER'));
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
      const response = await fetch(`${API_URL}/api/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: desc + (banco ? ` (${banco})` : ''),
          amount: parseFloat(valor),
          type: 'OUT',
          status: 'PAID',
          dueDate: dataVenc,
          paymentDate: dataVenc,
          isRecurring: false,
          categoryId: categoryId || null,
          entityId: entityId || null,
        })
      });
      if (response.ok) {
        setIsModalOpen(false);
        fetchData();
        setDesc(''); setValor(''); setCategoryId(''); setEntityId(''); setBanco('');
        setDataVenc(new Date().toISOString().split('T')[0]);
      }
    } catch (err) {
      alert('Erro ao salvar. Verifique se o backend está rodando.');
    } finally {
      setSaving(false);
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
      <div className="card table-container" style={{ padding: 0 }}>
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
                filtered.map(expense => (
                  <tr key={expense.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(expense.paymentDate || expense.dueDate).toLocaleDateString('pt-BR')}</td>
                    <td style={{ fontWeight: 500 }}>{expense.description}</td>
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
                <label>Banco / Forma de Pagamento</label>
                <select value={banco} onChange={e => setBanco(e.target.value)}>
                  <option value="">Selecione...</option>
                  <option>Banco do Brasil</option>
                  <option>Itaú</option>
                  <option>Bradesco</option>
                  <option>Caixa Econômica</option>
                  <option>Nubank</option>
                  <option>PIX</option>
                  <option>Dinheiro (Caixa Físico)</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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
                <input type="number" step="0.01" min="0.01" placeholder="0,00" value={valor} onChange={e => setValor(e.target.value)} required />
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
