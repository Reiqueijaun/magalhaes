import { useState, useEffect, useMemo } from 'react';
import { authFetch } from '../config';
import { X, CheckCircle2, DollarSign, TrendingDown, TrendingUp, AlertTriangle, Clock, Calendar, Plus, Sparkles, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency, parseCurrency } from '../utils';
import PayModal from './PayModal';
import ConfirmModal from './ConfirmModal';

const fmt = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export default function CalendarView({ selectedCompanyId = 'all', companies = [] }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const [selectedDay, setSelectedDay] = useState(null);
  const [payTransaction, setPayTransaction] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const mesesNomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const diasDaSemana = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

  // User greeting
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userName = user.name ? user.name.split(' ')[0] : 'Empresário';
  const hour = now.getHours();
  const greeting = hour < 12 ? '☀️ Bom dia' : hour < 18 ? '⛅ Boa tarde' : '🌙 Boa noite';

  const dataHojeExtenso = now.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

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

  // Transações filtradas pela unidade selecionada
  const filteredTransactions = useMemo(() => {
    if (!selectedCompanyId || selectedCompanyId === 'all') {
      return transactions;
    }
    return transactions.filter(t => t.companyId === selectedCompanyId);
  }, [transactions, selectedCompanyId]);

  // Cálculos do Briefing Diário
  const todayStr = now.toDateString();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // A Pagar Hoje
  const pagarHoje = useMemo(() => {
    return filteredTransactions.filter(t => t.type === 'OUT' && t.status === 'PENDING' && new Date(t.dueDate).toDateString() === todayStr);
  }, [filteredTransactions, todayStr]);
  const totalPagarHoje = pagarHoje.reduce((a,b) => a + b.amount, 0);

  // A Receber Hoje
  const receberHoje = useMemo(() => {
    return filteredTransactions.filter(t => t.type === 'IN' && t.status === 'PENDING' && new Date(t.dueDate).toDateString() === todayStr);
  }, [filteredTransactions, todayStr]);
  const totalReceberHoje = receberHoje.reduce((a,b) => a + b.amount, 0);

  // Atrasadas (Vencidas antes de hoje)
  const atrasadas = useMemo(() => {
    return filteredTransactions.filter(t => t.type === 'OUT' && t.status === 'PENDING' && new Date(t.dueDate) < startToday);
  }, [filteredTransactions, startToday]);
  const totalAtrasadas = atrasadas.reduce((a,b) => a + b.amount, 0);

  // Quase Vencendo (Próximos 3 dias a partir de amanhã)
  const quaseVencendo = useMemo(() => {
    const limit = new Date(startToday);
    limit.setDate(limit.getDate() + 3);
    return filteredTransactions.filter(t => {
      const due = new Date(t.dueDate);
      return t.type === 'OUT' && t.status === 'PENDING' && due > startToday && due <= limit;
    });
  }, [filteredTransactions, startToday]);
  const totalQuaseVencendo = quaseVencendo.reduce((a,b) => a + b.amount, 0);

  // Calendário Grid logic
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const eventsByDay = {};
  filteredTransactions.forEach(t => {
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
  const goToToday = () => {
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setSelectedDay(now.getDate());
  };

  const handlePaySuccess = () => {
    setPayTransaction(null);
    fetchTransactions();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      const res = await authFetch(`/api/transactions/${deleteItem.id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchTransactions();
        setDeleteItem(null);
      } else {
        alert('Não foi possível excluir o registro.');
      }
    } catch {
      alert('Erro de conexão ao excluir.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* ─── PAINEL: O DIA DO EMPRESÁRIO (BRIEFING DIÁRIO) ────────────────────── */}
      <div style={{ 
        background: 'linear-gradient(135deg, #1e293b 0%, #243b9d 100%)', 
        borderRadius: 16, 
        padding: '1.5rem 1.75rem', 
        color: 'white',
        boxShadow: '0 8px 24px rgba(36,59,157,0.25)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#93c5fd', fontSize: '0.85rem', fontWeight: 600, textTransform: 'capitalize' }}>
              <Calendar size={16} /> {dataHojeExtenso}
            </div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '4px 0 0', letterSpacing: '-0.02em' }}>
              {greeting}, {userName}!
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem', margin: '4px 0 0' }}>
              Aqui está o resumo financeiro das suas contas de auto peças e recebimentos para hoje:
            </p>
          </div>

          <button 
            onClick={goToToday}
            style={{ 
              padding: '8px 16px', 
              background: 'rgba(255,255,255,0.15)', 
              color: 'white', 
              border: '1px solid rgba(255,255,255,0.3)', 
              borderRadius: 10, 
              fontWeight: 700, 
              fontSize: '0.85rem', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              backdropFilter: 'blur(4px)'
            }}
          >
            <Sparkles size={16} color="#fbbf24" /> Focar no Dia de Hoje
          </button>
        </div>

        {/* 4 Cards de Resumo do Dia */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginTop: '1.25rem' }}>
          
          {/* Card: Pagar Hoje */}
          <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '1rem', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#fca5a5', letterSpacing: '0.05em' }}>🔴 A Pagar Hoje</span>
              <span style={{ fontSize: '0.75rem', background: '#ef4444', color: 'white', padding: '2px 8px', borderRadius: 10, fontWeight: 800 }}>{pagarHoje.length}</span>
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fca5a5' }}>
              {fmt(totalPagarHoje)}
            </div>
            {pagarHoje.length > 0 && (
              <button 
                onClick={() => { setSelectedDay(now.getDate()); setViewMonth(now.getMonth()); setViewYear(now.getFullYear()); }}
                style={{ marginTop: 8, width: '100%', padding: '5px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
              >
                Ver {pagarHoje.length} boleto(s) de hoje →
              </button>
            )}
          </div>

          {/* Card: Receber Hoje */}
          <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '1rem', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#86efac', letterSpacing: '0.05em' }}>🟢 A Receber Hoje</span>
              <span style={{ fontSize: '0.75rem', background: '#10b981', color: 'white', padding: '2px 8px', borderRadius: 10, fontWeight: 800 }}>{receberHoje.length}</span>
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#86efac' }}>
              {fmt(totalReceberHoje)}
            </div>
            {receberHoje.length > 0 && (
              <button 
                onClick={() => { setSelectedDay(now.getDate()); setViewMonth(now.getMonth()); setViewYear(now.getFullYear()); }}
                style={{ marginTop: 8, width: '100%', padding: '5px', background: '#10b981', color: 'white', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
              >
                Confirmar {receberHoje.length} entrada(s) →
              </button>
            )}
          </div>

          {/* Card: Quase Vencendo / Atrasadas */}
          <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '1rem', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#fde047', letterSpacing: '0.05em' }}>⚠️ Alerta de Vencimento</span>
              <span style={{ fontSize: '0.75rem', background: '#f59e0b', color: 'white', padding: '2px 8px', borderRadius: 10, fontWeight: 800 }}>{atrasadas.length + quaseVencendo.length}</span>
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fde047' }}>
              {fmt(totalAtrasadas + totalQuaseVencendo)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>
              {atrasadas.length > 0 ? `🔴 ${atrasadas.length} atrasada(s)` : '✅ Zero atrasos'} · 🟡 {quaseVencendo.length} próx. 3 dias
            </div>
          </div>

          {/* Card: Saldo Previsto do Fechamento */}
          <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '1rem', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#bae6fd', letterSpacing: '0.05em' }}>💵 Balanço de Hoje</span>
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: (totalReceberHoje - totalPagarHoje) >= 0 ? '#86efac' : '#fca5a5' }}>
              {(totalReceberHoje - totalPagarHoje) >= 0 ? '+' : ''}{fmt(totalReceberHoje - totalPagarHoje)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>
              {totalReceberHoje >= totalPagarHoje ? '✨ Entradas cobrem as despesas de hoje' : '⚠️ Mais contas a pagar do que a receber hoje'}
            </div>
          </div>

        </div>
      </div>

      {/* ─── NAVEGAÇÃO DO CALENDÁRIO ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '1rem 1.5rem', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={prevMonth} style={{ padding: '8px 12px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, fontSize: '0.85rem', color: '#334155' }}>
            <ChevronLeft size={16} /> Mês Anterior
          </button>
          <button onClick={nextMonth} style={{ padding: '8px 12px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, fontSize: '0.85rem', color: '#334155' }}>
            Próximo Mês <ChevronRight size={16} />
          </button>
        </div>

        <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#1e293b' }}>
          {mesesNomes[viewMonth]} de {viewYear}
        </h3>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: '0.8rem', color: '#64748b' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} /> Receitas</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} /> Despesas/Boletos</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} /> Pendente</span>
        </div>
      </div>

      {/* ─── GRADE DO CALENDÁRIO ────────────────────────────────────────────── */}
      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>Carregando dados do calendário...</p>
      ) : (
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          {/* Cabeçalho dos dias da semana */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            {diasDaSemana.map((d, i) => (
              <div key={d} style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 700, fontSize: '0.8rem', color: (i === 0 || i === 6) ? '#94a3b8' : '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Células dos dias */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: 'minmax(105px, auto)' }}>
            {cells.map((day, idx) => {
              const isToday = day && day === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear();
              const events = day ? (eventsByDay[day] || []) : [];
              
              let totalIn = 0;
              let totalOut = 0;
              let hasPendingOut = false;

              events.forEach(ev => {
                if (ev.type === 'IN') totalIn += ev.amount;
                if (ev.type === 'OUT') {
                  totalOut += ev.amount;
                  if (ev.status === 'PENDING') hasPendingOut = true;
                }
              });

              return (
                <div
                  key={idx}
                  onClick={() => day && setSelectedDay(day)}
                  style={{
                    minHeight: '105px',
                    padding: '8px',
                    borderRight: (idx + 1) % 7 !== 0 ? '1px solid #f1f5f9' : 'none',
                    borderBottom: '1px solid #f1f5f9',
                    backgroundColor: !day ? '#f8fafc' : isToday ? '#eff6ff' : 'white',
                    cursor: day ? 'pointer' : 'default',
                    transition: 'all 0.15s ease',
                    position: 'relative',
                    boxShadow: isToday ? 'inset 0 0 0 2px #2563eb' : 'none',
                  }}
                  onMouseEnter={e => { if (day) e.currentTarget.style.backgroundColor = isToday ? '#dbeafe' : '#f8fafc'; }}
                  onMouseLeave={e => { if (day) e.currentTarget.style.backgroundColor = isToday ? '#eff6ff' : 'white'; }}
                >
                  {day && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ 
                          fontWeight: isToday ? 900 : 700, 
                          fontSize: '0.9rem', 
                          color: isToday ? '#1d4ed8' : '#334155',
                          width: isToday ? '24px' : 'auto',
                          height: isToday ? '24px' : 'auto',
                          borderRadius: '50%',
                          background: isToday ? '#2563eb' : 'transparent',
                          color: isToday ? 'white' : '#334155',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {day}
                        </span>
                        {isToday && (
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, background: '#dbeafe', color: '#1e40af', padding: '1px 6px', borderRadius: 10 }}>HOJE</span>
                        )}
                        {hasPendingOut && !isToday && (
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} title="Possui contas a pagar pendentes" />
                        )}
                      </div>

                      {events.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {totalIn > 0 && (
                            <div style={{ fontSize: '0.72rem', color: '#065f46', background: '#d1fae5', padding: '2px 5px', borderRadius: 4, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              + {fmt(totalIn)}
                            </div>
                          )}
                          {totalOut > 0 && (
                            <div style={{ fontSize: '0.72rem', color: '#991b1b', background: '#fee2e2', padding: '2px 5px', borderRadius: 4, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              - {fmt(totalOut)}
                            </div>
                          )}
                          <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: 2, fontWeight: 500 }}>
                            {events.length} movimentação(ões)
                          </div>
                        </div>
                      ) : (
                        <div style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: '0.7rem', color: '#cbd5e1' }}>—</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── MODAL DETALHADO DO DIA SELECIONADO ─────────────────────────────── */}
      {selectedDay && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: '1rem',
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={() => setSelectedDay(null)}
        >
          <div 
            style={{
              background: 'white',
              borderRadius: 16,
              maxWidth: '680px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              overflow: 'hidden'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header do modal */}
            <div style={{ padding: '1.25rem 1.5rem', background: 'linear-gradient(135deg, #1e293b, #243b9d)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Agenda Diária</span>
                <h3 style={{ margin: '2px 0 0', fontSize: '1.2rem', fontWeight: 800 }}>
                  Movimentações do Dia {selectedDay} de {mesesNomes[viewMonth]} de {viewYear}
                </h3>
              </div>
              <button onClick={() => setSelectedDay(null)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {/* Lista de movimentações */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(eventsByDay[selectedDay] || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                  <Calendar size={40} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
                  <p style={{ fontWeight: 700, fontSize: '1.05rem', color: '#334155' }}>Nenhum boleto ou recebimento neste dia</p>
                  <p style={{ fontSize: '0.85rem' }}>Não há contas agendadas para esta data.</p>
                </div>
              ) : (
                (eventsByDay[selectedDay] || []).map(t => {
                  const isPaid = t.status === 'PAID';
                  const isOut = t.type === 'OUT';
                  return (
                    <div 
                      key={t.id} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        padding: '1rem', 
                        borderRadius: 10, 
                        border: `1px solid ${isPaid ? '#e2e8f0' : isOut ? '#fecaca' : '#bbf7d0'}`,
                        borderLeft: `4px solid ${isPaid ? '#64748b' : isOut ? '#ef4444' : '#10b981'}`,
                        background: '#f8fafc',
                        gap: '1rem'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.description}
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                          {t.entity && <span style={{ fontSize: '0.72rem', color: '#475569', background: '#e2e8f0', padding: '1px 6px', borderRadius: 4 }}>🏢 {t.entity.name}</span>}
                          {t.category && <span style={{ fontSize: '0.72rem', color: '#243b9d', background: '#eef1f8', padding: '1px 6px', borderRadius: 4 }}>🏷️ {t.category.name}</span>}
                          <span style={{ 
                            fontSize: '0.72rem', 
                            fontWeight: 700, 
                            padding: '1px 6px', 
                            borderRadius: 4,
                            background: isPaid ? '#d1fae5' : '#fee2e2',
                            color: isPaid ? '#065f46' : '#991b1b'
                          }}>
                            {isPaid ? '✅ Quitado/Pago' : '⏳ Pendente'}
                          </span>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: isOut ? '#ef4444' : '#10b981' }}>
                          {isOut ? '-' : '+'} {fmt(t.amount)}
                        </div>

                        {!isPaid && (
                          <button 
                            onClick={() => setPayTransaction(t)}
                            style={{ 
                              padding: '6px 12px', 
                              background: 'linear-gradient(135deg, #10b981, #059669)', 
                              color: 'white', 
                              border: 'none', 
                              borderRadius: 8, 
                              fontWeight: 700, 
                              fontSize: '0.8rem', 
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            <CheckCircle2 size={14} /> Baixar
                          </button>
                        )}

                        <button 
                          onClick={() => setDeleteItem(t)}
                          title="Excluir com segurança"
                          style={{ padding: '6px 8px', background: '#fee2e2', border: 'none', borderRadius: 6, color: '#ef4444', cursor: 'pointer' }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer do Modal */}
            <div style={{ padding: '1rem 1.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                Total: <strong>{(eventsByDay[selectedDay] || []).length}</strong> registro(s)
              </span>
              <button 
                onClick={() => setSelectedDay(null)}
                style={{ padding: '8px 18px', background: '#1e293b', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Modal */}
      <PayModal
        isOpen={!!payTransaction}
        onClose={() => setPayTransaction(null)}
        transaction={payTransaction}
        onPaySuccess={handlePaySuccess}
      />

      {/* Safe Delete Confirm Modal */}
      <ConfirmModal
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={handleDeleteConfirm}
        title="Excluir Movimentação do Calendário"
        message="Atenção: Tem certeza que deseja excluir este registro financeiro?"
        itemName={deleteItem?.description}
        itemValue={deleteItem ? fmt(deleteItem.amount) : ''}
        loading={deleting}
      />
    </div>
  );
}
