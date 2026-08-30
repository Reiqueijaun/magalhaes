import { useState, useEffect, useMemo } from 'react';
import { authFetch } from '../config';
import {
  X, CheckCircle2, DollarSign, TrendingDown, TrendingUp, AlertTriangle,
  Clock, Calendar, Plus, Sparkles, AlertCircle, ChevronLeft, ChevronRight,
  ArrowDownRight, ArrowUpRight, Check
} from 'lucide-react';
import { formatCurrency, parseCurrency } from '../utils';
import PayModal from './PayModal';
import ConfirmModal from './ConfirmModal';

const fmt = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export default function CalendarView({ selectedCompanyId = 'all', companies = [], theme = 'light' }) {
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
      <div className="fin-hero-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#93c5fd', fontSize: '0.85rem', fontWeight: 700, textTransform: 'capitalize' }}>
              <Calendar size={16} /> {dataHojeExtenso}
            </div>
            <h2 style={{ fontSize: '1.65rem', fontWeight: 900, margin: '6px 0 0', letterSpacing: '-0.02em', color: '#ffffff' }}>
              {greeting}, {userName}!
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.88rem', margin: '4px 0 0' }}>
              Aqui está o resumo financeiro dos seus compromissos e recebimentos diários:
            </p>
          </div>

          <button 
            onClick={goToToday}
            className="btn"
            style={{ 
              padding: '8px 16px', 
              background: 'rgba(255,255,255,0.18)', 
              color: '#ffffff', 
              border: '1px solid rgba(255,255,255,0.3)', 
              borderRadius: 10, 
              fontWeight: 800, 
              fontSize: '0.85rem', 
              gap: 6,
              backdropFilter: 'blur(4px)'
            }}
          >
            <Sparkles size={16} color="#fbbf24" /> Focar no Dia de Hoje
          </button>
        </div>

        {/* 4 Cards de Resumo do Dia */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
          
          {/* Card: Pagar Hoje */}
          <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 12, padding: '1.1rem', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#fca5a5', letterSpacing: '0.05em' }}>🔴 A Pagar Hoje</span>
              <span style={{ fontSize: '0.72rem', background: 'var(--danger)', color: 'white', padding: '2px 8px', borderRadius: 10, fontWeight: 800 }}>{pagarHoje.length}</span>
            </div>
            <div className="tabular-nums" style={{ fontSize: '1.45rem', fontWeight: 900, color: '#fca5a5' }}>
              {fmt(totalPagarHoje)}
            </div>
            {pagarHoje.length > 0 && (
              <button 
                onClick={() => { setSelectedDay(now.getDate()); setViewMonth(now.getMonth()); setViewYear(now.getFullYear()); }}
                className="btn btn-danger"
                style={{ marginTop: 8, width: '100%', padding: '5px', borderRadius: 6, fontSize: '0.75rem' }}
              >
                Ver {pagarHoje.length} boleto(s) de hoje →
              </button>
            )}
          </div>

          {/* Card: Receber Hoje */}
          <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 12, padding: '1.1rem', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#86efac', letterSpacing: '0.05em' }}>🟢 A Receber Hoje</span>
              <span style={{ fontSize: '0.72rem', background: 'var(--success)', color: 'white', padding: '2px 8px', borderRadius: 10, fontWeight: 800 }}>{receberHoje.length}</span>
            </div>
            <div className="tabular-nums" style={{ fontSize: '1.45rem', fontWeight: 900, color: '#86efac' }}>
              {fmt(totalReceberHoje)}
            </div>
            {receberHoje.length > 0 && (
              <button 
                onClick={() => { setSelectedDay(now.getDate()); setViewMonth(now.getMonth()); setViewYear(now.getFullYear()); }}
                className="btn btn-success"
                style={{ marginTop: 8, width: '100%', padding: '5px', borderRadius: 6, fontSize: '0.75rem' }}
              >
                Confirmar {receberHoje.length} entrada(s) →
              </button>
            )}
          </div>

          {/* Card: Quase Vencendo / Atrasadas */}
          <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 12, padding: '1.1rem', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#fde047', letterSpacing: '0.05em' }}>⚠️ Alerta de Vencimento</span>
              <span style={{ fontSize: '0.72rem', background: 'var(--warning)', color: 'white', padding: '2px 8px', borderRadius: 10, fontWeight: 800 }}>{atrasadas.length + quaseVencendo.length}</span>
            </div>
            <div className="tabular-nums" style={{ fontSize: '1.45rem', fontWeight: 900, color: '#fde047' }}>
              {fmt(totalAtrasadas + totalQuaseVencendo)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>
              {atrasadas.length > 0 ? `🔴 ${atrasadas.length} atrasada(s)` : '✅ Zero atrasos'} · 🟡 {quaseVencendo.length} próx. 3 dias
            </div>
          </div>

          {/* Card: Saldo Previsto do Fechamento */}
          <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 12, padding: '1.1rem', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#bae6fd', letterSpacing: '0.05em' }}>💵 Balanço de Hoje</span>
            </div>
            <div className="tabular-nums" style={{ fontSize: '1.45rem', fontWeight: 900, color: (totalReceberHoje - totalPagarHoje) >= 0 ? '#86efac' : '#fca5a5' }}>
              {(totalReceberHoje - totalPagarHoje) >= 0 ? '+' : ''}{fmt(totalReceberHoje - totalPagarHoje)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>
              {totalReceberHoje >= totalPagarHoje ? '✨ Entradas cobrem as despesas de hoje' : '⚠️ Mais contas a pagar do que a receber hoje'}
            </div>
          </div>

        </div>
      </div>

      {/* ─── NAVEGAÇÃO DO CALENDÁRIO ─────────────────────────────────────────── */}
      <div className="fin-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={prevMonth} className="btn btn-secondary" style={{ padding: '7px 12px', fontSize: '0.85rem' }}>
            <ChevronLeft size={16} /> Mês Anterior
          </button>
          <button onClick={nextMonth} className="btn btn-secondary" style={{ padding: '7px 12px', fontSize: '0.85rem' }}>
            Próximo Mês <ChevronRight size={16} />
          </button>
        </div>

        <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 900, color: 'var(--text-main)' }}>
          {mesesNomes[viewMonth]} de {viewYear}
        </h3>

        <div style={{ display: 'flex', gap: 14, alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} /> Receitas</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)' }} /> Despesas</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warning)' }} /> Pendente</span>
        </div>
      </div>

      {/* ─── GRADE DO CALENDÁRIO ────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Carregando dados do calendário...</p>
        </div>
      ) : (
        <div className="fin-card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Cabeçalho dos dias da semana */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'var(--bg-body)', borderBottom: '1px solid var(--border-color)' }}>
            {diasDaSemana.map((d, i) => (
              <div key={d} style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 800, fontSize: '0.78rem', color: (i === 0 || i === 6) ? 'var(--text-muted)' : 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Células dos dias */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: 'minmax(110px, auto)' }}>
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
                    minHeight: '110px',
                    padding: '8px',
                    borderRight: (idx + 1) % 7 !== 0 ? '1px solid var(--border-subtle)' : 'none',
                    borderBottom: '1px solid var(--border-subtle)',
                    backgroundColor: !day ? 'var(--bg-body)' : isToday ? 'var(--brand-blue-light)' : 'var(--bg-card)',
                    cursor: day ? 'pointer' : 'default',
                    transition: 'all 0.15s ease',
                    position: 'relative',
                    boxShadow: isToday ? 'inset 0 0 0 2px var(--brand-blue)' : 'none',
                  }}
                >
                  {day && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ 
                          fontWeight: isToday ? 900 : 700, 
                          fontSize: '0.9rem', 
                          width: isToday ? '24px' : 'auto',
                          height: isToday ? '24px' : 'auto',
                          borderRadius: '50%',
                          background: isToday ? 'var(--brand-blue)' : 'transparent',
                          color: isToday ? '#ffffff' : 'var(--text-main)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {day}
                        </span>
                        {isToday && (
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, background: 'var(--brand-blue)', color: '#ffffff', padding: '1px 6px', borderRadius: 10 }}>HOJE</span>
                        )}
                        {hasPendingOut && !isToday && (
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--danger)' }} title="Possui contas a pagar pendentes" />
                        )}
                      </div>

                      {events.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {totalIn > 0 && (
                            <div className="tabular-nums" style={{ fontSize: '0.72rem', color: 'var(--success-text)', background: 'var(--success-bg)', padding: '2px 5px', borderRadius: 4, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              + {fmt(totalIn)}
                            </div>
                          )}
                          {totalOut > 0 && (
                            <div className="tabular-nums" style={{ fontSize: '0.72rem', color: 'var(--danger-text)', background: 'var(--danger-bg)', padding: '2px 5px', borderRadius: 8, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              - {fmt(totalOut)}
                            </div>
                          )}
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2, fontWeight: 600 }}>
                            {events.length} movimentação(ões)
                          </div>
                        </div>
                      ) : (
                        <div style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', opacity: 0.4 }}>—</span>
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
        <div className="modal-backdrop" onClick={() => setSelectedDay(null)}>
          <div className="modal-content" style={{ maxWidth: '680px' }} onClick={e => e.stopPropagation()}>
            {/* Header do modal */}
            <div style={{ padding: '1.25rem 1.5rem', background: 'var(--brand-gradient)', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Agenda Diária</span>
                <h3 style={{ margin: '2px 0 0', fontSize: '1.2rem', fontWeight: 900, color: '#ffffff' }}>
                  Movimentações do Dia {selectedDay} de {mesesNomes[viewMonth]} de {viewYear}
                </h3>
              </div>
              <button onClick={() => setSelectedDay(null)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#ffffff', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {/* Lista de movimentações */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', maxHeight: '60vh', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(eventsByDay[selectedDay] || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                  <Calendar size={40} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
                  <p style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)' }}>Nenhum boleto ou recebimento neste dia</p>
                  <p style={{ fontSize: '0.85rem' }}>Não há contas agendadas para esta data.</p>
                </div>
              ) : (
                (eventsByDay[selectedDay] || []).map(t => {
                  const isPaid = t.status === 'PAID';
                  const isOut = t.type === 'OUT';
                  return (
                    <div 
                      key={t.id} 
                      className="fin-card"
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        padding: '1rem', 
                        borderLeft: isPaid ? '4px solid var(--border-color)' : isOut ? '4px solid var(--danger)' : '4px solid var(--success)',
                        gap: '1rem'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.description}
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                          {t.entity && (
                            <span className="badge-pill badge-neutral">
                              🏢 {t.entity.name}
                            </span>
                          )}
                          {t.category && (
                            <span className="badge-pill badge-info">
                              🏷️ {t.category.name}
                            </span>
                          )}
                          <span className={`badge-pill ${isPaid ? 'badge-pill-success' : 'badge-pill-danger'}`}>
                            {isPaid ? '✅ Quitado' : '⏳ Pendente'}
                          </span>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="tabular-nums" style={{ fontWeight: 900, fontSize: '1.15rem', color: isOut ? 'var(--danger)' : 'var(--success)' }}>
                          {isOut ? '-' : '+'} {fmt(t.amount)}
                        </div>

                        {!isPaid && (
                          <button 
                            onClick={() => setPayTransaction(t)}
                            className="btn btn-success"
                            style={{ padding: '6px 12px', fontSize: '0.8rem', gap: 4 }}
                          >
                            <CheckCircle2 size={14} /> Baixar
                          </button>
                        )}

                        <button 
                          onClick={() => setDeleteItem(t)}
                          title="Excluir com segurança"
                          className="btn btn-secondary"
                          style={{ padding: '6px 8px', color: 'var(--danger)' }}
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
            <div style={{ padding: '1rem 1.5rem', background: 'var(--bg-body)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Total: <strong>{(eventsByDay[selectedDay] || []).length}</strong> registro(s)
              </span>
              <button 
                onClick={() => setSelectedDay(null)}
                className="btn btn-primary"
                style={{ padding: '8px 18px', fontSize: '0.85rem' }}
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

