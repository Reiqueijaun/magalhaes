import { useState, useEffect } from 'react';
import { Plus, CheckCircle2, FileText, Loader, Repeat } from 'lucide-react';
import { authFetch } from '../config';
import { formatCurrency, parseCurrency } from '../utils';
import PayModal from './PayModal';

export default function Pending() {
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

  // Buscar dados da API
  const fetchTransactions = async () => {
    try {
      const [transRes, compRes] = await Promise.all([
        authFetch('/api/transactions'),
        authFetch('/api/companies'),
      ]);
      if (transRes.ok) {
        const data = await transRes.json();
        // Filtra apenas SAÍDAS (OUT) que estão PENDENTES no contexto PJ
        const pendingOut = data.filter(t => t.type === 'OUT' && t.status === 'PENDING' && t.context === 'PJ');
        setTransactions(pendingOut);
      }
      if (compRes.ok) setCompanies(await compRes.json());
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
      const response = await authFetch('/api/transactions', {
        method: 'POST',
        body: JSON.stringify({
          description: desc,
          amount: parseCurrency(valor),
          type: 'OUT',
          status: 'PENDING',
          dueDate: dataVenc,
          companyId: companyId || null,
          isRecurring: recorrente
        })
      });
      if (response.ok) {
        setIsModalOpen(false);
        fetchTransactions(); // Recarrega a lista
        setDesc(''); setValor(''); setDataVenc(''); setCompanyId(''); setRecorrente(false);
      }
    } catch (error) {
      alert('Erro ao salvar. Verifique se o servidor backend está ligado.');
    }
  };

  const [ocrLoading, setOcrLoading] = useState(false);

  const handleBoletoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setOcrLoading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const response = await authFetch('/api/ocr/boleto', {
          method: 'POST',
          body: JSON.stringify({ fileBase64: ev.target.result })
        });
        const data = await response.json();
        
        if (data.amount) setValor(data.amount);
        if (data.dueDate) setDataVenc(data.dueDate);
        
        setIsModalOpen(true); // Abre o form preenchido
      } catch (err) {
        alert('Erro ao ler boleto. Tente preencher manualmente.');
        setIsModalOpen(true);
      } finally {
        setOcrLoading(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = null; // reseta o input
  };

  const handlePay = (transaction) => {
    setPayTransaction(transaction);
  };

  const handlePaySuccess = () => {
    setPayTransaction(null);
    fetchTransactions();
    alert('✅ Título baixado com sucesso! Transferido para o extrato.');
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
      <table id="tutorial-pending-table" style={{ width: '100%' }}>
        <tbody>
          {items.map(item => (
            <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '0.75rem 0', fontWeight: 500 }}>
                {item.description}
                {item.company && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.company.name}</div>}
                {item.isRecurring && <Repeat size={14} style={{ marginLeft: 6, color: 'var(--brand-blue)', verticalAlign: 'middle' }} title="Conta Recorrente Automática" />}
              </td>
              <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)' }}>{new Date(item.dueDate).toLocaleDateString('pt-BR')}</td>
              <td style={{ padding: '0.75rem 0', fontWeight: 600, textAlign: 'right' }}>R$ {item.amount.toFixed(2).replace('.', ',')}</td>
              <td style={{ padding: '0.75rem 0', textAlign: 'right', width: '150px' }}>
                <button className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: 'var(--brand-blue)', borderColor: 'var(--brand-blue)' }} onClick={() => handlePay(item)}>
                  <CheckCircle2 size={14} style={{ marginRight: '4px' }} /> Dar Baixa
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
        <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)' }}>O que tenho para pagar?</h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <label id="tutorial-import-boleto" className="btn btn-secondary" style={{ cursor: ocrLoading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {ocrLoading ? <Loader size={18} className="spin" /> : <FileText size={18} />}
            {ocrLoading ? 'Lendo boleto...' : 'Importar Boleto (PDF)'}
            <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={handleBoletoUpload} disabled={ocrLoading} />
          </label>
          <button id="tutorial-new-pending" className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={18} /> Registrar Conta a Pagar
          </button>
        </div>
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
              <div className="form-group"><label>Valor (R$)</label><input type="text" placeholder="0,00" value={valor} onChange={e => setValor(formatCurrency(e.target.value))} required /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group"><label>Vencimento</label><input type="date" value={dataVenc} onChange={e => setDataVenc(e.target.value)} required /></div>
                <div className="form-group">
                  <label>Empresa</label>
                  <select value={companyId} onChange={e => setCompanyId(e.target.value)} required>
                    <option value="">Selecione...</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div id="tutorial-pending-recurring-checkbox" className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
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

      {/* Modal de Baixa Profissional */}
      <PayModal
        isOpen={!!payTransaction}
        onClose={() => setPayTransaction(null)}
        transaction={payTransaction}
        onPaySuccess={handlePaySuccess}
      />
    </div>
  );
}
