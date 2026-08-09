import { useState, useEffect } from 'react';
import { CheckCircle2, Plus } from 'lucide-react';
import { authFetch } from '../config';
import { formatCurrency, parseCurrency } from '../utils';

export default function Receivable() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Formulário
  const [desc, setDesc] = useState('');
  const [valor, setValor] = useState('');
  const [dataVenc, setDataVenc] = useState('');
  const [recorrente, setRecorrente] = useState(false);

  const fetchTransactions = async () => {
    try {
      const response = await authFetch('/api/transactions');
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.filter(t => t.type === 'IN' && t.status === 'PENDING'));
      }
    } catch (error) {
      console.log('Erro ao buscar da API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTransactions(); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const response = await authFetch('/api/transactions', {
        method: 'POST',
        body: JSON.stringify({
          description: desc,
          amount: parseCurrency(valor),
          type: 'IN',
          status: 'PENDING',
          dueDate: dataVenc,
          isRecurring: recorrente
        })
      });
      if (response.ok) {
        setIsModalOpen(false);
        fetchTransactions();
        setDesc(''); setValor(''); setDataVenc(''); setRecorrente(false);
      }
    } catch (error) {
      alert('Erro ao salvar. Verifique se o servidor backend está ligado.');
    }
  };

  const handleReceived = async (id) => {
    try {
      await authFetch(`/api/transactions/${id}/pay`, { method: 'PATCH' });
      fetchTransactions();
      alert('✅ Recebido! Valor registrado como entrada paga.');
    } catch (error) {
      alert('Erro ao processar recebimento.');
    }
  };

  const now = new Date();
  const hoje = transactions.filter(t => new Date(t.dueDate) <= now);
  const futuros = transactions.filter(t => new Date(t.dueDate) > now);

  const renderGroup = (title, icon, items, color, total) => (
    <div className="card" style={{ marginBottom: '1.5rem', borderLeft: `4px solid ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {icon} {title}
        </h3>
        <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--success)' }}>
          R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </span>
      </div>
      <table style={{ width: '100%' }}>
        <tbody>
          {items.map(item => (
            <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '0.75rem 0', fontWeight: 500 }}>{item.description}</td>
              <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)' }}>{new Date(item.dueDate).toLocaleDateString('pt-BR')}</td>
              <td style={{ padding: '0.75rem 0', fontWeight: 600, textAlign: 'right', color: 'var(--success)' }}>
                R$ {item.amount.toFixed(2).replace('.', ',')}
              </td>
              <td style={{ padding: '0.75rem 0', textAlign: 'right', width: '160px' }}>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: 'var(--success)', borderColor: 'var(--success)' }}
                  onClick={() => handleReceived(item.id)}
                >
                  <CheckCircle2 size={14} style={{ marginRight: '4px' }} /> Recebido
                </button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr><td colSpan="4" style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>
              Nenhum recebimento nesta categoria.
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)' }}>O que tenho para receber?</h2>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} /> Registrar Cobrança
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Carregando dados do banco...</p>
      ) : (
        <>
          {renderGroup('Hoje / Atrasados', '🟢', hoje, 'var(--success)', hoje.reduce((a, b) => a + b.amount, 0))}
          {renderGroup('Futuros (A Vencer)', '🔵', futuros, 'var(--brand-blue)', futuros.reduce((a, b) => a + b.amount, 0))}
        </>
      )}

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.25rem' }}>Nova Conta a Receber</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', fontSize: '1.5rem' }}>&times;</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-group"><label>Descrição / Cliente</label><input type="text" value={desc} onChange={e => setDesc(e.target.value)} required /></div>
              <div className="form-group"><label>Valor (R$)</label><input type="text" placeholder="0,00" value={valor} onChange={e => setValor(formatCurrency(e.target.value))} required /></div>
              <div className="form-group"><label>Vencimento</label><input type="date" value={dataVenc} onChange={e => setDataVenc(e.target.value)} required /></div>
              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" id="recorrenteRec" checked={recorrente} onChange={e => setRecorrente(e.target.checked)} style={{ width: 'auto' }} />
                <label htmlFor="recorrenteRec" style={{ margin: 0 }}>Recebimento Mensal (Ex: Contrato fixo)</label>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Cadastrar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
