import { useState, useEffect } from 'react';
import { CheckCircle2, Plus } from 'lucide-react';
import API_URL from '../config';

export default function Pending() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Formulário
  const [desc, setDesc] = useState('');
  const [valor, setValor] = useState('');
  const [dataVenc, setDataVenc] = useState('');
  const [recorrente, setRecorrente] = useState(false);

  // Buscar dados da API
  const fetchTransactions = async () => {
    try {
      const response = await fetch(`${API_URL}/api/transactions`);
      if (response.ok) {
        const data = await response.json();
        // Filtra apenas SAÍDAS (OUT) que estão PENDENTES
        const pendingOut = data.filter(t => t.type === 'OUT' && t.status === 'PENDING');
        setTransactions(pendingOut);
      }
    } catch (error) {
      console.log('Erro ao buscar da API, o servidor backend está rodando?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/api/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: desc,
          amount: parseFloat(valor),
          type: 'OUT',
          status: 'PENDING',
          dueDate: dataVenc,
          isRecurring: recorrente
        })
      });
      if (response.ok) {
        setIsModalOpen(false);
        fetchTransactions(); // Recarrega a lista
        setDesc(''); setValor(''); setDataVenc(''); setRecorrente(false);
      }
    } catch (error) {
      alert('Erro ao salvar. Verifique se o servidor backend está ligado.');
    }
  };

  const handlePay = async (id) => {
    try {
      await fetch(`${API_URL}/api/transactions/${id}/pay`, { method: 'PATCH' });
      fetchTransactions(); // Remove da lista de pendentes
      alert('Pago! Transferido para o fluxo de despesas pagas.');
    } catch (error) {
      alert('Erro ao processar pagamento.');
    }
  };

  // Separação por urgência (Simplificada para a demonstração)
  const hoje = transactions.filter(t => new Date(t.dueDate) <= new Date());
  const futuros = transactions.filter(t => new Date(t.dueDate) > new Date());

  const renderGroup = (title, icon, items, color, total) => (
    <div className="card" style={{ marginBottom: '1.5rem', borderLeft: `4px solid ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {icon} {title}
        </h3>
        <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>R$ {total.toLocaleString('pt-BR')}</span>
      </div>
      <table style={{ width: '100%' }}>
        <tbody>
          {items.map(item => (
            <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '0.75rem 0', fontWeight: 500 }}>{item.description}</td>
              <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)' }}>{new Date(item.dueDate).toLocaleDateString('pt-BR')}</td>
              <td style={{ padding: '0.75rem 0', fontWeight: 600, textAlign: 'right' }}>R$ {item.amount.toFixed(2).replace('.', ',')}</td>
              <td style={{ padding: '0.75rem 0', textAlign: 'right', width: '150px' }}>
                <button className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: 'var(--brand-blue)', borderColor: 'var(--brand-blue)' }} onClick={() => handlePay(item.id)}>
                  <CheckCircle2 size={14} style={{ marginRight: '4px' }} /> Pago
                </button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr><td colSpan="4" style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>Nenhuma conta nesta categoria.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)' }}>O que eu tenho para pagar?</h2>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} /> Cadastrar Conta a Pagar
        </button>
      </div>

      {loading ? (
        <p>Carregando dados do banco...</p>
      ) : (
        <>
          {renderGroup('Hoje / Atrasadas', '🔴', hoje, 'var(--danger)', hoje.reduce((a, b) => a + b.amount, 0))}
          {renderGroup('Contas Futuras', '🟡', futuros, '#eab308', futuros.reduce((a, b) => a + b.amount, 0))}
        </>
      )}

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.25rem' }}>Nova Conta a Pagar</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', fontSize: '1.5rem' }}>&times;</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-group"><label>Descrição / Fornecedor</label><input type="text" value={desc} onChange={e => setDesc(e.target.value)} required /></div>
              <div className="form-group"><label>Valor (R$)</label><input type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} required /></div>
              <div className="form-group"><label>Vencimento</label><input type="date" value={dataVenc} onChange={e => setDataVenc(e.target.value)} required /></div>
              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
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
    </div>
  );
}
