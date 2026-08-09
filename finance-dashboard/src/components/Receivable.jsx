import { useState } from 'react';
import { CheckCircle2, Plus } from 'lucide-react';

export default function Receivable() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [hoje] = useState([
    { id: 1, cliente: 'Cliente João Silva', valor: 8400.00, status: 'Vence Hoje' }
  ]);

  const [seteDias] = useState([
    { id: 2, cliente: 'Contrato Empresa B', vencimento: '11/08', valor: 8500.00 },
    { id: 3, cliente: 'Parcela Vendas C', vencimento: '15/08', valor: 15300.00 }
  ]);

  const [trintaDias] = useState([
    { id: 4, cliente: 'Contrato Empresa D', vencimento: '20/08', valor: 14200.00 },
    { id: 5, cliente: 'Recebimento de Projeto', vencimento: '30/08', valor: 80300.00 }
  ]);

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
              <td style={{ padding: '0.75rem 0', fontWeight: 500 }}>{item.cliente}</td>
              <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)' }}>{item.vencimento || 'Hoje'}</td>
              <td style={{ padding: '0.75rem 0', fontWeight: 600, textAlign: 'right', color: 'var(--success)' }}>R$ {item.valor.toFixed(2).replace('.', ',')}</td>
              <td style={{ padding: '0.75rem 0', textAlign: 'right', width: '150px' }}>
                <button className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: 'var(--success)', borderColor: 'var(--success)' }} onClick={() => alert('Recebido! Valor adicionado ao caixa.')}>
                  <CheckCircle2 size={14} style={{ marginRight: '4px' }} /> Recebido
                </button>
              </td>
            </tr>
          ))}
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

      {renderGroup('Hoje', '🟢', hoje, 'var(--success)', hoje.reduce((a, b) => a + b.valor, 0))}
      {renderGroup('Próximos 7 dias', '🔵', seteDias, 'var(--brand-blue)', seteDias.reduce((a, b) => a + b.valor, 0))}
      {renderGroup('Próximos 30 dias', '🟣', trintaDias, '#8b5cf6', trintaDias.reduce((a, b) => a + b.valor, 0))}

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.25rem' }}>Nova Conta a Receber</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', fontSize: '1.5rem' }}>&times;</button>
            </div>
            <form onSubmit={e => { e.preventDefault(); setIsModalOpen(false); }}>
              <div className="form-group"><label>Cliente / Pagador</label><input type="text" required /></div>
              <div className="form-group"><label>Valor (R$)</label><input type="number" required /></div>
              <div className="form-group"><label>Vencimento</label><input type="date" required /></div>
              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" id="recorrenteRec" style={{ width: 'auto' }} />
                <label htmlFor="recorrenteRec" style={{ margin: 0 }}>Recebimento Mensal (Ex: Contrato de Manutenção)</label>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Cadastrar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
