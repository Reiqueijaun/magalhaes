import { useState, useEffect } from 'react';
import { authFetch } from '../config';
import { X, CheckCircle2, DollarSign, TrendingDown, TrendingUp } from 'lucide-react';
import { formatCurrency } from '../utils';
import PayModal from './PayModal';

export default function CalendarView() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const [selectedDay, setSelectedDay] = useState(null);
  const [payTransaction, setPayTransaction] = useState(null);

  const mesesNomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const diasDaSemana = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

  const fetchTransactions = async () => {
    try {
      const res = await authFetch('/api/transactions');
      if (res.ok) {
        setTransactions(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const eventsByDay = {};
  transactions.forEach(t => {
    const date = new Date(t.status === 'PAID' && t.paymentDate ? t.paymentDate : t.dueDate);
    if (date.getFullYear() === viewYear && date.getMonth() === viewMonth) {
      const d = date.getDate();
      if (!eventsByDay[d]) eventsByDay[d] = [];
      eventsByDay[d].push(t);
    }
  });

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const handlePaySuccess = () => {
    setPayTransaction(null);
    fetchTransactions(); // Reload transactions
    alert('✅ Baixa realizada com sucesso!');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header do Calendário */}
      <div className="card" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn btn-secondary" onClick={prevMonth}>← Anterior</button>
        <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--brand-blue)' }}>
          {mesesNomes[viewMonth]} {viewYear}
        </h2>
        <button className="btn btn-secondary" onClick={nextMonth}>Próximo →</button>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Carregando calendário...</p>
      ) : (
        <div id="tutorial-calendar-full" className="calendar-grid">
          {diasDaSemana.map(d => (
            <div key={d} className="calendar-day-header">{d}</div>
          ))}

          {cells.map((day, idx) => {
            const isToday = day && day === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear();
            const events = day ? (eventsByDay[day] || []) : [];
            
            let receitas = 0;
            let custos = 0;
            let maiorCusto = null;

            events.forEach(ev => {
              if (ev.type === 'IN') receitas += ev.amount;
              if (ev.type === 'OUT') {
                custos += ev.amount;
                if (!maiorCusto || ev.amount > maiorCusto.amount) maiorCusto = ev;
              }
            });

            const fmtShort = (val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val.toFixed(0);

            return (
              <div
                key={idx}
                className="calendar-cell"
                style={{
                  backgroundColor: !day ? 'var(--bg-body)' : isToday ? 'rgba(36,59,157,0.04)' : 'white',
                  opacity: !day ? 0.5 : 1,
                  borderTop: isToday ? '2px solid var(--brand-blue)' : '1px solid transparent',
                  cursor: day ? 'pointer' : 'default',
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
                onClick={() => day && setSelectedDay(day)}
              >
                {day && (
                  <>
                    <div style={{ color: isToday ? 'var(--brand-blue)' : 'var(--text-muted)', fontWeight: isToday ? 700 : 600, fontSize: '0.9rem', marginBottom: '4px' }}>
                      {day}
                    </div>
                    
                    {events.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {receitas > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--success)', backgroundColor: 'rgba(34,197,94,0.1)', padding: '2px 4px', borderRadius: '4px', fontWeight: 600 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}><TrendingUp size={12}/> Receitas</span>
                            <span>R$ {fmtShort(receitas)}</span>
                          </div>
                        )}
                        {custos > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--danger)', backgroundColor: 'rgba(239,68,68,0.1)', padding: '2px 4px', borderRadius: '4px', fontWeight: 600 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}><TrendingDown size={12}/> Custos</span>
                            <span>R$ {fmtShort(custos)}</span>
                          </div>
                        )}
                        {maiorCusto && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', borderTop: '1px solid var(--border-color)', paddingTop: '4px' }}>
                            <span style={{ display: 'block', fontWeight: 600 }}>Maior custo:</span>
                            <span style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{maiorCusto.description}</span>
                            {maiorCusto.company && (
                              <span style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.65rem' }}>🏢 {maiorCusto.company.name}</span>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>Sem mov.</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal do Dia */}
      {selectedDay && (
        <div className="modal-overlay" onClick={() => setSelectedDay(null)}>
          <div className="modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.25rem' }}>Movimentações do dia {selectedDay}/{viewMonth + 1}/{viewYear}</h3>
              <button onClick={() => setSelectedDay(null)} style={{ background: 'none', fontSize: '1.5rem', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {(eventsByDay[selectedDay] || []).length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>Nenhuma movimentação para este dia.</p>
              ) : (
                <table style={{ width: '100%', fontSize: '0.9rem' }}>
                  <tbody>
                    {(eventsByDay[selectedDay] || []).map(t => (
                      <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.75rem 0', fontWeight: 500 }}>
                          {t.description}
                          {t.company && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.company.name}</div>}
                        </td>
                        <td style={{ padding: '0.75rem 0' }}>
                           <span style={{
                            padding: '2px 8px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 700,
                            backgroundColor: t.status === 'PAID' ? 'rgba(34,197,94,0.12)' : 'rgba(234,179,8,0.12)',
                            color: t.status === 'PAID' ? 'var(--success)' : '#ca8a04',
                          }}>
                            {t.status === 'PAID' ? 'Pago' : 'Pendente'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0', textAlign: 'right', fontWeight: 600, color: t.type === 'IN' ? 'var(--success)' : 'var(--danger)' }}>
                          {t.type === 'IN' ? '+' : '-'} R$ {t.amount.toFixed(2).replace('.', ',')}
                        </td>
                        <td style={{ padding: '0.75rem 0', textAlign: 'right', width: '100px' }}>
                          {t.status === 'PENDING' && (
                            <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', color: 'var(--brand-blue)', borderColor: 'var(--brand-blue)' }} onClick={() => setPayTransaction(t)}>
                              <CheckCircle2 size={14} style={{ marginRight: '4px' }} /> Baixar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Pagamento sobreposto ao calendário */}
      <PayModal
        isOpen={!!payTransaction}
        onClose={() => setPayTransaction(null)}
        transaction={payTransaction}
        onPaySuccess={handlePaySuccess}
      />
    </div>
  );
}
