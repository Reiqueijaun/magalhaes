import { useState, useEffect } from 'react';
import API_URL from '../config';

export default function CalendarView() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const mesesNomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const diasDaSemana = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`${API_URL}/api/transactions`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { setTransactions(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Monta a grade do calendário
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  // Agrupa transações por dia do mês atual
  const eventsByDay = {};
  transactions.forEach(t => {
    const date = new Date(t.dueDate);
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

      {/* Legenda */}
      <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.875rem', paddingLeft: '0.5rem' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: 'var(--danger)' }}></div> Saída / Conta a Pagar
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: 'var(--success)' }}></div> Entrada / A Receber
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: '#94a3b8' }}></div> Pago
        </span>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Carregando calendário...</p>
      ) : (
        <div id="tutorial-calendar-full" className="calendar-grid">
          {/* Cabeçalho dos dias da semana */}
          {diasDaSemana.map(d => (
            <div key={d} className="calendar-day-header">{d}</div>
          ))}

          {/* Células do calendário */}
          {cells.map((day, idx) => {
            const isToday = day && day === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear();
            const events = day ? (eventsByDay[day] || []) : [];

            return (
              <div
                key={idx}
                className="calendar-cell"
                style={{
                  backgroundColor: !day ? 'var(--bg-body)' : isToday ? 'rgba(36,59,157,0.04)' : 'white',
                  opacity: !day ? 0.5 : 1,
                  borderTop: isToday ? '2px solid var(--brand-blue)' : '1px solid transparent',
                }}
              >
                {day && (
                  <>
                    <div className="calendar-date" style={{
                      color: isToday ? 'var(--brand-blue)' : 'var(--text-muted)',
                      fontWeight: isToday ? 700 : 600,
                    }}>
                      {day}
                    </div>
                    {events.slice(0, 4).map((ev, eIdx) => {
                      const isPaid = ev.status === 'PAID';
                      const isIn = ev.type === 'IN';
                      
                      const borderColor = isPaid ? '#cbd5e1' : isIn ? 'var(--success)' : 'var(--danger)';
                      const bgColor = isPaid ? '#f8fafc' : isIn ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)';
                      const textColor = isPaid ? '#64748b' : isIn ? 'var(--success)' : 'var(--danger)';
                      const dotColor = isPaid ? '#cbd5e1' : isIn ? 'var(--success)' : 'var(--danger)';

                      return (
                        <div key={eIdx} className="calendar-event" style={{ 
                          backgroundColor: bgColor, 
                          color: textColor,
                          borderLeft: `3px solid ${borderColor}`,
                          padding: '4px 6px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          borderRadius: '0 4px 4px 0',
                          marginBottom: '4px',
                          fontSize: '0.75rem',
                          lineHeight: 1.2
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: dotColor, flexShrink: 0 }}></div>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                              {ev.description}
                            </span>
                          </div>
                          <span style={{ fontWeight: 800, flexShrink: 0, opacity: 0.9 }}>
                            {ev.amount >= 1000 ? `${(ev.amount/1000).toFixed(1)}k` : `${ev.amount.toFixed(0)}`}
                          </span>
                        </div>
                      );
                    })}
                    {events.length > 4 && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', paddingLeft: '6px', fontWeight: 600, marginTop: '2px' }}>
                        +{events.length - 4} evento(s)
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
