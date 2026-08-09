import { useState } from 'react';

export default function CalendarView() {
  const [currentMonth] = useState('Agosto 2026');
  
  // Mock days for August 2026
  const diasDaSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  // August 2026 starts on Saturday (01/08/2026) -> 6 leading empty days (wait, 1 is Sat, so Dom, Seg, Ter, Qua, Qui, Sex are empty)
  // Let's just create a generic grid of 35 cells for demonstration
  const diasDoMes = [];
  for(let i=0; i<35; i++) {
    if (i < 6 || i > 36) diasDoMes.push({ dia: null });
    else diasDoMes.push({ dia: i - 5 });
  }

  const eventos = {
    10: [
      { tipo: 'saida', desc: 'Aluguel', valor: 5000 }
    ],
    11: [
      { tipo: 'entrada', desc: 'Recebimento', valor: 8500 }
    ],
    12: [
      { tipo: 'saida', desc: 'Energia', valor: 2340 }
    ],
    15: [
      { tipo: 'saida', desc: 'Pagamento', valor: 8400 },
      { tipo: 'entrada', desc: 'Vendas C', valor: 15300 }
    ],
    20: [
      { tipo: 'entrada', desc: 'Recebimento', valor: 14200 },
      { tipo: 'saida', desc: 'Impostos', valor: 18000 }
    ]
  };

  return (
    <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
      <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
        <h2 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.25rem' }}>Calendário Financeiro - {currentMonth}</h2>
        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 10, height: 10, backgroundColor: 'var(--danger)', borderRadius: '50%' }}></div> Saídas</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 10, height: 10, backgroundColor: 'var(--success)', borderRadius: '50%' }}></div> Entradas</span>
        </div>
      </div>
      
      <div className="calendar-grid">
        {diasDaSemana.map(dia => (
          <div key={dia} className="calendar-day-header">{dia}</div>
        ))}
        
        {diasDoMes.map((cell, idx) => (
          <div key={idx} className="calendar-cell" style={{ opacity: cell.dia ? 1 : 0.4, backgroundColor: cell.dia ? 'var(--bg-card)' : 'var(--bg-body)' }}>
            {cell.dia && <div className="calendar-date">{cell.dia}</div>}
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {cell.dia && eventos[cell.dia] && eventos[cell.dia].map((ev, eIdx) => (
                <div key={eIdx} className={`calendar-event ${ev.tipo}`}>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>{ev.desc}</span>
                  <span style={{ fontWeight: 'bold' }}>{(ev.valor / 1000).toFixed(1)}k</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
