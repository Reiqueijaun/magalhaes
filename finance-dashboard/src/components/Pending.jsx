import { useState } from 'react';
import { CheckCircle2, Plus } from 'lucide-react';

export default function Pending() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [hoje] = useState([
    { id: 1, fornecedor: 'Aluguel Galpão', valor: 5000.00, status: 'Vence Hoje' },
    { id: 2, fornecedor: 'Internet Corporativa', valor: 350.00, status: 'Vence Hoje' },
    { id: 3, fornecedor: 'Limpeza Terceirizada', valor: 1200.00, status: 'Atrasado' }
  ]);

  const [seteDias] = useState([
    { id: 4, fornecedor: 'Energia Elétrica', vencimento: '12/08', valor: 2340.00 },
    { id: 5, fornecedor: 'Fornecedor A', vencimento: '14/08', valor: 8500.00 }
  ]);

  const [trintaDias] = useState([
    { id: 6, fornecedor: 'Impostos Mensais', vencimento: '20/08', valor: 18000.00 },
    { id: 7, fornecedor: 'Softwares (SaaS)', vencimento: '25/08', valor: 1250.00 },
    { id: 8, fornecedor: 'Manutenção', vencimento: '30/08', valor: 4500.00 }
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
              <td style={{ padding: '0.75rem 0', fontWeight: 500 }}>{item.fornecedor}</td>
              <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)' }}>{item.vencimento || 'Hoje'}</td>
              <td style={{ padding: '0.75rem 0', fontWeight: 600, textAlign: 'right' }}>R$ {item.valor.toFixed(2).replace('.', ',')}</td>
              <td style={{ padding: '0.75rem 0', textAlign: 'right', width: '150px' }}>
                <button className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: 'var(--brand-blue)', borderColor: 'var(--brand-blue)' }} onClick={() => alert('Pago! Transferido para o fluxo de despesas.')}>
                  <CheckCircle2 size={14} style={{ marginRight: '4px' }} /> Pago
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
        <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)' }}>O que eu tenho para pagar?</h2>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} /> Cadastrar Conta a Pagar
        </button>
      </div>

      {renderGroup('Hoje / Atrasadas', '🔴', hoje, 'var(--danger)', hoje.reduce((a, b) => a + b.valor, 0))}
      {renderGroup('Próximos 7 dias', '🟠', seteDias, 'var(--warning)', seteDias.reduce((a, b) => a + b.valor, 0))}
      {renderGroup('Próximos 30 dias', '🟡', trintaDias, '#eab308', trintaDias.reduce((a, b) => a + b.valor, 0))}

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.25rem' }}>Nova Conta a Pagar</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', fontSize: '1.5rem' }}>&times;</button>
            </div>
            <form onSubmit={e => { e.preventDefault(); setIsModalOpen(false); }}>
              <div className="form-group"><label>Descrição / Fornecedor</label><input type="text" required /></div>
              <div className="form-group"><label>Valor (R$)</label><input type="number" required /></div>
              <div className="form-group"><label>Vencimento</label><input type="date" required /></div>
              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" id="recorrente" style={{ width: 'auto' }} />
                <label htmlFor="recorrente" style={{ margin: 0 }}>Repetir Mensalmente (Recorrente)</label>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>O sistema projetará essa conta automaticamente para os próximos meses caso seja recorrente.</p>
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
