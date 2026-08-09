import { useState } from 'react';
import { Plus, Search, Filter } from 'lucide-react';

export default function Expenses() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [expenses, setExpenses] = useState([
    { id: 1, data: '08/08/2026', pagador: 'João (Financeiro)', banco: 'Banco do Brasil', valor: 450.00, categoria: 'Material de Escritório', status: 'Pago' },
    { id: 2, data: '08/08/2026', pagador: 'Maria (Sócia)', banco: 'Itaú', valor: 1200.00, categoria: 'Fornecedores', status: 'Pago' },
    { id: 3, data: '07/08/2026', pagador: 'João (Financeiro)', banco: 'Bradesco', valor: 350.00, categoria: 'Energia', status: 'Pago' },
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '1rem', flex: 1 }}>
          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input type="text" placeholder="Buscar despesas..." style={{ width: '100%', paddingLeft: '35px' }} />
          </div>
          <button className="btn btn-secondary">
            <Filter size={18} /> Filtrar
          </button>
        </div>
        
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} /> Nova Despesa
        </button>
      </div>

      {/* Table */}
      <div className="card table-container" style={{ padding: '0' }}>
        <table>
          <thead style={{ backgroundColor: 'var(--bg-body)' }}>
            <tr>
              <th>Data</th>
              <th>Quem Pagou</th>
              <th>Banco/Caixa</th>
              <th>Categoria</th>
              <th>Valor (R$)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => (
              <tr key={expense.id}>
                <td>{expense.data}</td>
                <td>{expense.pagador}</td>
                <td>{expense.banco}</td>
                <td>{expense.categoria}</td>
                <td style={{ fontWeight: 600 }}>R$ {expense.valor.toFixed(2).replace('.', ',')}</td>
                <td>
                  <span className="badge paid">{expense.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Nova Despesa */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)' }}>Registrar Nova Despesa</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', fontSize: '1.5rem', color: 'var(--text-muted)' }}>&times;</button>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); setIsModalOpen(false); }}>
              <div className="form-group">
                <label>Data</label>
                <input type="date" defaultValue="2026-08-08" required />
              </div>
              <div className="form-group">
                <label>Quem está pagando?</label>
                <input type="text" placeholder="Ex: João Silva" required />
              </div>
              <div className="form-group">
                <label>Qual Banco / Caixa?</label>
                <select required>
                  <option value="">Selecione...</option>
                  <option value="bb">Banco do Brasil</option>
                  <option value="itau">Itaú</option>
                  <option value="caixa_fisico">Caixa Físico da Empresa</option>
                </select>
              </div>
              <div className="form-group">
                <label>Valor Pago</label>
                <input type="number" step="0.01" placeholder="R$ 0,00" required />
              </div>
              
              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Salvar Registro</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
