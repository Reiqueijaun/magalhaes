import { useState, useEffect } from 'react';
import { CheckCircle2, Plus, Repeat } from 'lucide-react';
import { authFetch } from '../config';
import { formatCurrency, parseCurrency } from '../utils';
import PayModal from './PayModal';

export default function Receivable() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Formulário
  const [desc, setDesc] = useState('');
  const [valor, setValor] = useState('');
  const [dataVenc, setDataVenc] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [recorrente, setRecorrente] = useState(false);
  
  const [companies, setCompanies] = useState([]);
  const [payTransaction, setPayTransaction] = useState(null);

  const fetchTransactions = async () => {
    try {
      const [transRes, compRes] = await Promise.all([
        authFetch('/api/transactions'),
        authFetch('/api/companies'),
      ]);
      if (transRes.ok) {
        const data = await transRes.json();
        setTransactions(data.filter(t => t.type === 'IN' && t.status === 'PENDING' && t.context === 'PJ'));
      }
      if (compRes.ok) setCompanies(await compRes.json());
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
          companyId: companyId || null,
          isRecurring: recorrente
        })
      });
      if (response.ok) {
        setIsModalOpen(false);
        fetchTransactions();
        setDesc(''); setValor(''); setDataVenc(''); setCompanyId(''); setRecorrente(false);
      }
    } catch (error) {
      alert('Erro ao salvar. Verifique se o servidor backend está ligado.');
    }
  };

  const handlePay = (transaction) => {
    setPayTransaction(transaction);
  };

  const handlePaySuccess = () => {
    setPayTransaction(null);
    fetchTransactions();
    alert('✅ Recebido! Valor registrado como entrada paga no extrato.');
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
              <td style={{ padding: '0.75rem 0', fontWeight: 500 }}>
                {item.description}
                {item.company && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.company.name}</div>}
                {item.isRecurring && <Repeat size={14} style={{ marginLeft: 6, color: 'var(--brand-blue)', verticalAlign: 'middle' }} title="Conta Recorrente Automática" />}
              </td>
              <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)' }}>{new Date(item.dueDate).toLocaleDateString('pt-BR')}</td>
              <td style={{ padding: '0.75rem 0', fontWeight: 600, textAlign: 'right', color: 'var(--success)' }}>
                R$ {item.amount.toFixed(2).replace('.', ',')}
              </td>
              <td style={{ padding: '0.75rem 0', textAlign: 'right', width: '160px' }}>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: 'var(--success)', borderColor: 'var(--success)' }}
                  onClick={() => handlePay(item)}
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
        <button id="tutorial-new-receivable" className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group"><label>Previsão de Recebimento</label><input type="date" value={dataVenc} onChange={e => setDataVenc(e.target.value)} required /></div>
                <div className="form-group">
                  <label>Empresa</label>
                  <select value={companyId} onChange={e => setCompanyId(e.target.value)} required>
                    <option value="">Selecione...</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" id="recorrenteRec" checked={recorrente} onChange={e => setRecorrente(e.target.checked)} style={{ width: 'auto' }} />
                <label htmlFor="recorrenteRec" style={{ margin: 0 }}>Repetir Mensalmente (Recorrente)</label>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, backgroundColor: 'var(--success)' }}>Cadastrar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <PayModal
        isOpen={!!payTransaction}
        onClose={() => setPayTransaction(null)}
        transaction={payTransaction}
        onPaySuccess={handlePaySuccess}
      />
    </div>
  );
}
