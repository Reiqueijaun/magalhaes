import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { authFetch } from '../config';
import { formatCurrency, parseCurrency } from '../utils';

export default function PayModal({ isOpen, onClose, transaction, onPaySuccess }) {
  const [dataVenc, setDataVenc] = useState(new Date().toISOString().split('T')[0]);
  const [bankAccountId, setBankAccountId] = useState('');
  const [valor, setValor] = useState('');
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Fetch bank accounts
      authFetch('/api/bank-accounts')
        .then(res => res.json())
        .then(data => {
          setBankAccounts(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));

      // Reset form with transaction data
      if (transaction) {
        setValor(transaction.amount.toFixed(2).replace('.', ','));
        setDataVenc(new Date().toISOString().split('T')[0]);
        setBankAccountId(transaction.bankAccountId || '');
      }
    }
  }, [isOpen, transaction]);

  if (!isOpen || !transaction) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const endpoint = transaction.context === 'PF' 
        ? `/api/pf/transactions/${transaction.id}/pay`
        : `/api/transactions/${transaction.id}/pay`;

      const res = await authFetch(endpoint, {
        method: 'PATCH',
        body: JSON.stringify({
          paymentDate: dataVenc,
          bankAccountId: bankAccountId || null,
          amount: parseCurrency(valor)
        })
      });

      if (res.ok) {
        onPaySuccess();
      } else {
        alert('Erro ao dar baixa no título.');
      }
    } catch (err) {
      alert('Erro de conexão ao dar baixa.');
    } finally {
      setSaving(false);
    }
  };

  const isReceita = transaction.type === 'IN';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontSize: '1.25rem' }}>Baixar Título - {transaction.description}</h3>
          <button onClick={onClose} style={{ background: 'none', fontSize: '1.5rem', color: 'var(--text-muted)' }}><X size={20} /></button>
        </div>
        
        <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--bg-body)', borderRadius: '8px', borderLeft: `4px solid ${isReceita ? 'var(--success)' : 'var(--danger)'}` }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Valor Original:</p>
          <p style={{ margin: '4px 0 0', fontWeight: 600, fontSize: '1.1rem' }}>R$ {transaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>

        <form onSubmit={handleSave}>
          <div className="form-group">
            <label>Data do {isReceita ? 'Recebimento' : 'Pagamento'}</label>
            <input type="date" value={dataVenc} onChange={e => setDataVenc(e.target.value)} required />
          </div>
          
          <div className="form-group">
            <label>Conta Bancária / Caixa</label>
            {loading ? <p style={{ fontSize: '0.875rem' }}>Carregando contas...</p> : (
              <select value={bankAccountId} onChange={e => setBankAccountId(e.target.value)} required>
                <option value="">Selecione de onde saiu/entrou o dinheiro...</option>
                {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
          </div>
          
          <div className="form-group">
            <label>Valor Efetivo (R$)</label>
            <input type="text" placeholder="0,00" value={valor} onChange={e => setValor(formatCurrency(e.target.value))} required />
            <small style={{ color: 'var(--text-muted)' }}>Altere se houve juros ou descontos.</small>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, backgroundColor: isReceita ? 'var(--success)' : 'var(--brand-blue)' }} disabled={saving}>
              {saving ? 'Processando...' : 'Confirmar Baixa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
