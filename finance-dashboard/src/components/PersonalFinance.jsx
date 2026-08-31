import { useState, useEffect, useMemo } from 'react';
import {
  User, Plus, TrendingUp, TrendingDown, Wallet, Target, PiggyBank,
  Trash2, CheckCircle2, ChevronDown, AlertTriangle, BarChart3, X, Repeat,
  Sparkles, DollarSign, Calendar
} from 'lucide-react';
import { authFetch } from '../config';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const fmt = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const fmtDate = (d) => new Date(d).toLocaleDateString('pt-BR');
const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const EMOJIS = ['🎯','🏠','✈️','🚗','📚','💊','🏋️','💍','🎓','🌴','📱','💻','🎸','🐶','👶'];

const formatCurrency = (v) => {
  const digits = v.replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits) / 100;
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
};

export default function PersonalFinance({ theme = 'light' }) {
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modais
  const [txModal, setTxModal] = useState(false);
  const [budgetModal, setBudgetModal] = useState(false);
  const [goalModal, setGoalModal] = useState(false);
  const [depositModal, setDepositModal] = useState(null); // goal id

  // Formulário de Transação
  const [txDesc, setTxDesc] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txType, setTxType] = useState('OUT');
  const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 10));
  const [txCategory, setTxCategory] = useState('');
  const [txRecurring, setTxRecurring] = useState(false);
  const [txStatus, setTxStatus] = useState('PAID');

  // Formulário de Orçamento
  const [bdName, setBdName] = useState('');
  const [bdCategory, setBdCategory] = useState('');
  const [bdLimit, setBdLimit] = useState('');
  const now = new Date();
  const [bdMonth, setBdMonth] = useState(now.getMonth() + 1);
  const [bdYear, setBdYear] = useState(now.getFullYear());

  // Formulário de Meta
  const [glName, setGlName] = useState('');
  const [glEmoji, setGlEmoji] = useState('🎯');
  const [glTarget, setGlTarget] = useState('');
  const [glDeadline, setGlDeadline] = useState('');
  const [depositAmt, setDepositAmt] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [tRes, cRes, bRes, gRes] = await Promise.all([
        authFetch('/api/pf/transactions'),
        authFetch('/api/pf/categories'),
        authFetch(`/api/pf/budgets?month=${now.getMonth() + 1}&year=${now.getFullYear()}`),
        authFetch('/api/pf/goals'),
      ]);
      const [tData, cData, bData, gData] = await Promise.all([
        tRes.json(), cRes.json(), bRes.json(), gRes.json(),
      ]);
      if (Array.isArray(tData)) setTransactions(tData);
      if (Array.isArray(cData)) setCategories(cData);
      if (Array.isArray(bData)) setBudgets(bData);
      if (Array.isArray(gData)) setGoals(gData);
    } catch (e) { console.error('Erro ao carregar finanças pessoais:', e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // ── Cálculos do Dashboard ──
  const thisMonth = useMemo(() => {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return transactions.filter(t => {
      const d = new Date(t.paymentDate || t.dueDate);
      return d >= start && d <= end;
    });
  }, [transactions]);

  const totalIn  = thisMonth.filter(t => t.type === 'IN').reduce((a, b) => a + b.amount, 0);
  const totalOut = thisMonth.filter(t => t.type === 'OUT').reduce((a, b) => a + b.amount, 0);
  const saldo = totalIn - totalOut;

  // Gasto por categoria no mês
  const spendByCategory = useMemo(() => {
    const map = {};
    thisMonth.filter(t => t.type === 'OUT').forEach(t => {
      const key = t.category?.name || 'Outros';
      const color = t.category?.color || '#3b82f6';
      if (!map[key]) map[key] = { name: key, value: 0, color };
      map[key].value += t.amount;
    });
    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [thisMonth]);

  // Progresso dos orçamentos (gastos reais vs limite)
  const budgetsWithProgress = useMemo(() => {
    return budgets.map(b => {
      const spent = thisMonth
        .filter(t => t.type === 'OUT' && (b.categoryId ? t.categoryId === b.categoryId : t.category?.name === b.name))
        .reduce((a, t) => a + t.amount, 0);
      const pct = Math.min((spent / b.limitAmount) * 100, 100);
      return { ...b, spent, pct };
    });
  }, [budgets, thisMonth]);

  // ── Ações ──
  const saveTx = async (e) => {
    e.preventDefault();
    const amount = parseFloat(txAmount.replace(/\./g, '').replace(',', '.'));
    await authFetch('/api/pf/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: txDesc, amount, type: txType, status: txStatus,
        dueDate: txDate, isRecurring: txRecurring, categoryId: txCategory || null,
      }),
    });
    setTxModal(false); setTxDesc(''); setTxAmount(''); setTxCategory(''); setTxRecurring(false);
    load();
  };

  const payTx = async (id) => {
    await authFetch(`/api/pf/transactions/${id}/pay`, { method: 'PATCH' });
    load();
  };

  const deleteTx = async (id) => {
    if (!confirm('Excluir este lançamento?')) return;
    await authFetch(`/api/pf/transactions/${id}`, { method: 'DELETE' });
    load();
  };

  const saveBudget = async (e) => {
    e.preventDefault();
    const limitAmount = parseFloat(bdLimit.replace(/\./g, '').replace(',', '.'));
    const cat = categories.find(c => c.id === bdCategory);
    await authFetch('/api/pf/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: cat?.name || bdName, categoryId: bdCategory || null, limitAmount, month: bdMonth, year: bdYear }),
    });
    setBudgetModal(false); setBdName(''); setBdCategory(''); setBdLimit(''); load();
  };

  const deleteBudget = async (id) => {
    if (!confirm('Excluir este orçamento?')) return;
    await authFetch(`/api/pf/budgets/${id}`, { method: 'DELETE' });
    load();
  };

  const saveGoal = async (e) => {
    e.preventDefault();
    const targetAmount = parseFloat(glTarget.replace(/\./g, '').replace(',', '.'));
    await authFetch('/api/pf/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: glName, emoji: glEmoji, targetAmount, deadline: glDeadline || null }),
    });
    setGoalModal(false); setGlName(''); setGlTarget(''); setGlDeadline(''); load();
  };

  const doDeposit = async () => {
    const amount = parseFloat(depositAmt.replace(/\./g, '').replace(',', '.'));
    await authFetch(`/api/pf/goals/${depositModal}/deposit`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    });
    setDepositModal(null); setDepositAmt(''); load();
  };

  const deleteGoal = async (id) => {
    if (!confirm('Excluir esta meta?')) return;
    await authFetch(`/api/pf/goals/${id}`, { method: 'DELETE' });
    load();
  };

  const tab = (key, label, icon) => (
    <button
      onClick={() => setActiveTab(key)}
      className={`filter-pill ${activeTab === key ? 'active' : ''}`}
      style={{
        padding: '0.6rem 1.25rem',
        borderRadius: 10,
        fontWeight: 800,
        display: 'flex',
        alignItems: 'center',
        gap: 6
      }}
    >
      {icon} {label}
    </button>
  );

  const pendentes = transactions.filter(t => t.status === 'PENDING');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--brand-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={22} color="white" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>Finanças Pessoais (PF)</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>Controle patrimonial independente e metas de vida</p>
          </div>
        </div>
        <button 
          className="btn btn-primary" 
          onClick={() => setTxModal(true)} 
          style={{ background: 'var(--brand-purple)', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800 }}
        >
          <Plus size={18} /> Novo Lançamento
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-card)', padding: '0.4rem', borderRadius: 12, border: '1px solid var(--border-color)', maxWidth: '100%', overflowX: 'auto' }}>
        {tab('dashboard', 'Dashboard', <BarChart3 size={16} />)}
        {tab('lancamentos', 'Lançamentos', <Wallet size={16} />)}
        {tab('orcamentos', 'Orçamentos', <PiggyBank size={16} />)}
        {tab('metas', 'Metas (Cofrinho)', <Target size={16} />)}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--text-muted)' }}>Carregando dados pessoais...</p>
        </div>
      ) : (
        <>
          {/* ── DASHBOARD ── */}
          {activeTab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '1rem' }}>
                {[
                  { label: 'Receitas do Mês', value: fmt(totalIn), icon: TrendingUp, color: 'var(--success)', bg: 'var(--success-bg)' },
                  { label: 'Despesas do Mês', value: fmt(totalOut), icon: TrendingDown, color: 'var(--danger)', bg: 'var(--danger-bg)' },
                  { label: 'Saldo Atual', value: fmt(saldo), icon: Wallet, color: saldo >= 0 ? 'var(--brand-purple)' : 'var(--danger)', bg: saldo >= 0 ? 'rgba(124,58,237,0.12)' : 'var(--danger-bg)' },
                ].map(c => {
                  const Icon = c.icon;
                  return (
                    <div key={c.label} className="fin-card" style={{ padding: '1rem 1.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c.label}</span>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.color }}>
                          <Icon size={16} />
                        </div>
                      </div>
                      <div className="tabular-nums" style={{ fontSize: '1.55rem', fontWeight: 900, color: c.color }}>{c.value}</div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1.25rem' }}>
                {/* Gráfico Onde vai meu dinheiro */}
                <div className="fin-card">
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 1.25rem', color: 'var(--text-main)' }}>Onde vai meu dinheiro?</h3>
                  {spendByCategory.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>Nenhuma despesa este mês.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie data={spendByCategory} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                          {(spendByCategory).map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: isDark ? '#1e293b' : '#ffffff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, borderRadius: 8, color: isDark ? '#ffffff' : '#000000' }} formatter={(v) => fmt(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Alertas de Orçamento */}
                <div className="fin-card">
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 1.25rem', color: 'var(--text-main)' }}>Status dos Orçamentos</h3>
                  {budgetsWithProgress.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                      <PiggyBank size={36} style={{ opacity: 0.3, margin: '0 auto 8px', display: 'block', color: 'var(--brand-purple)' }} />
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nenhum orçamento definido.</p>
                      <button className="btn btn-secondary" style={{ marginTop: 8 }} onClick={() => setActiveTab('orcamentos')}>Criar Orçamento</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {(budgetsWithProgress).map((b) => (
                        <div key={b.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-main)' }}>{b.category?.name || b.name}</span>
                            <span className="tabular-nums" style={{ fontSize: '0.8rem', fontWeight: 700, color: b.pct >= 90 ? 'var(--danger)' : b.pct >= 70 ? 'var(--warning-text)' : 'var(--text-muted)' }}>
                              {b.pct >= 90 && <AlertTriangle size={12} style={{ display: 'inline', marginRight: 3 }} />}
                              {fmt(b.spent)} / {fmt(b.limitAmount)}
                            </span>
                          </div>
                          <div style={{ height: 8, background: 'var(--bg-body)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ width: `${b.pct}%`, height: '100%', borderRadius: 4, background: b.pct >= 90 ? 'var(--danger)' : b.pct >= 70 ? 'var(--warning)' : 'var(--brand-purple)', transition: 'width 0.5s' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Pendentes */}
              {pendentes.length > 0 && (
                <div className="fin-card" style={{ borderLeft: '4px solid var(--warning)' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-main)' }}>
                    <AlertTriangle size={18} color="var(--warning)" /> {pendentes.length} lançamento(s) pendente(s)
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {pendentes.map(t => (
                      <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: 8 }}>
                        <div>
                          <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{t.description}</span>
                          <span style={{ marginLeft: 8, color: 'var(--text-muted)', fontSize: '0.8rem' }}>• vence {fmtDate(t.dueDate)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                          <span className="tabular-nums" style={{ fontWeight: 900, color: t.type === 'IN' ? 'var(--success)' : 'var(--danger)' }}>{fmt(t.amount)}</span>
                          <button className="btn btn-success" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', minHeight: 34 }} onClick={() => payTx(t.id)}>
                            <CheckCircle2 size={13} /> Pago
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── LANÇAMENTOS ── */}
          {activeTab === 'lancamentos' && (
            <div className="fin-table-container">
              {transactions.length === 0 ? (
                <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Wallet size={40} style={{ opacity: 0.3, margin: '0 auto 12px', display: 'block' }} />
                  <p style={{ fontWeight: 700, color: 'var(--text-main)' }}>Nenhum lançamento pessoal ainda. Clique em "Novo Lançamento" para começar!</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="fin-table">
                    <thead>
                      <tr>
                        <th>Data</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th>Status</th><th style={{ textAlign: 'right' }}>Valor</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map(t => (
                        <tr key={t.id}>
                          <td className="tabular-nums" style={{ color: 'var(--text-muted)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{fmtDate(t.paymentDate || t.dueDate)}</td>
                          <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                            {t.description}
                            {t.isRecurring && <Repeat size={12} style={{ marginLeft: 6, color: 'var(--brand-purple)', verticalAlign: 'middle' }} title="Recorrente" />}
                          </td>
                          <td>
                            {t.category ? (
                              <span className="badge-pill badge-info">
                                {t.category.name}
                              </span>
                            ) : '—'}
                          </td>
                          <td>
                            <span className={`badge-pill ${t.type === 'IN' ? 'badge-pill-success' : 'badge-pill-danger'}`}>
                              {t.type === 'IN' ? '▲ Receita' : '▼ Despesa'}
                            </span>
                          </td>
                          <td>
                            <span className={`badge-pill ${t.status === 'PAID' ? 'badge-pill-success' : 'badge-pill-warning'}`}>
                              {t.status === 'PAID' ? 'Pago' : 'Pendente'}
                            </span>
                          </td>
                          <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 900, color: t.type === 'IN' ? 'var(--success)' : 'var(--danger)' }}>
                            {t.type === 'IN' ? '+' : '-'} {fmt(t.amount)}
                          </td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {t.status === 'PENDING' && (
                              <button onClick={() => payTx(t.id)} className="btn btn-secondary" style={{ padding: '0.35rem 0.5rem', color: 'var(--success)', marginRight: 6, minHeight: 34 }} title="Marcar como Pago">
                                <CheckCircle2 size={15} />
                              </button>
                            )}
                            <button onClick={() => deleteTx(t.id)} className="btn btn-secondary" style={{ padding: '0.35rem 0.5rem', color: 'var(--danger)', minHeight: 34 }} title="Excluir">
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── ORÇAMENTOS ── */}
          {activeTab === 'orcamentos' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={() => setBudgetModal(true)} style={{ background: 'var(--brand-purple)', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800 }}>
                  <Plus size={18} /> Novo Orçamento
                </button>
              </div>
              {budgetsWithProgress.length === 0 ? (
                <div className="fin-card" style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <PiggyBank size={48} style={{ opacity: 0.3, margin: '0 auto 12px', display: 'block', color: 'var(--brand-purple)' }} />
                  <p style={{ fontWeight: 800, color: 'var(--text-main)' }}>Defina quanto quer gastar por categoria no mês.</p>
                  <p style={{ fontSize: '0.85rem' }}>Ex: Lazer: R$ 500,00 | Alimentação: R$ 1.200,00</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: '1.25rem' }}>
                  {(budgetsWithProgress).map((b) => (
                    <div key={b.id} className="fin-card" style={{ padding: '1.25rem', position: 'relative' }}>
                      <button onClick={() => deleteBudget(b.id)} style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <Trash2 size={15} />
                      </button>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem' }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(124,58,237,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <PiggyBank size={20} color="var(--brand-purple)" />
                        </div>
                        <div>
                          <p style={{ margin: 0, fontWeight: 800, color: 'var(--text-main)' }}>{b.category?.name || b.name}</p>
                          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{MONTHS[b.month - 1]} / {b.year}</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 4 }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Gasto: <strong className="tabular-nums" style={{ color: b.pct >= 90 ? 'var(--danger)' : 'var(--brand-purple)' }}>{fmt(b.spent)}</strong></span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Limite: <strong className="tabular-nums">{fmt(b.limitAmount)}</strong></span>
                      </div>
                      <div style={{ height: 10, background: 'var(--bg-body)', borderRadius: 5, overflow: 'hidden' }}>
                        <div style={{ width: `${b.pct}%`, height: '100%', borderRadius: 5, background: b.pct >= 90 ? 'var(--danger)' : b.pct >= 70 ? 'var(--warning)' : 'var(--brand-purple)', transition: 'width 0.5s' }} />
                      </div>
                      <p className="tabular-nums" style={{ margin: '8px 0 0', fontSize: '0.8rem', textAlign: 'right', color: b.pct >= 90 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: b.pct >= 90 ? 800 : 600 }}>
                        {b.pct >= 90 && '⚠️ '}
                        {b.pct.toFixed(0)}% utilizado • Restam {fmt(Math.max(b.limitAmount - b.spent, 0))}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── METAS ── */}
          {activeTab === 'metas' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={() => setGoalModal(true)} style={{ background: 'var(--brand-purple)', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800 }}>
                  <Plus size={18} /> Nova Meta
                </button>
              </div>
              {goals.length === 0 ? (
                <div className="fin-card" style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Target size={48} style={{ opacity: 0.3, margin: '0 auto 12px', display: 'block', color: 'var(--brand-purple)' }} />
                  <p style={{ fontWeight: 800, color: 'var(--text-main)' }}>Defina seus objetivos financeiros e acompanhe o progresso!</p>
                  <p style={{ fontSize: '0.85rem' }}>Ex: Viagem, Reserva de Emergência, Novo Carro...</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: '1.25rem' }}>
                  {(goals).map((g) => {
                    const pct = Math.min((g.currentAmount / g.targetAmount) * 100, 100);
                    const done = pct >= 100;
                    return (
                      <div key={g.id} className="fin-card" style={{ padding: '1.25rem', position: 'relative', borderTop: done ? '4px solid var(--success)' : '4px solid var(--brand-purple)' }}>
                        <button onClick={() => deleteGoal(g.id)} style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                          <Trash2 size={15} />
                        </button>
                        <div style={{ fontSize: '2rem', marginBottom: 6 }}>{g.emoji}</div>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 4px', color: 'var(--text-main)' }}>{g.name}</h3>
                        {g.deadline && <p style={{ margin: '0 0 10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>⏰ até {fmtDate(g.deadline)}</p>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 4 }}>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Guardado</span>
                          <span className="tabular-nums" style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)' }}>{fmt(g.currentAmount)} / {fmt(g.targetAmount)}</span>
                        </div>
                        <div style={{ height: 10, background: 'var(--bg-body)', borderRadius: 5, overflow: 'hidden', marginBottom: 10 }}>
                          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 5, background: done ? 'var(--success)' : 'var(--brand-purple)', transition: 'width 0.5s' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="tabular-nums" style={{ fontSize: '0.85rem', fontWeight: 800, color: done ? 'var(--success)' : 'var(--brand-purple)' }}>{done ? '🎉 Concluída!' : `${pct.toFixed(1)}%`}</span>
                          {!done && (
                            <button className="btn btn-secondary" style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem', color: 'var(--brand-purple)', borderColor: 'var(--brand-purple)', minHeight: 34 }} onClick={() => setDepositModal(g.id)}>
                              + Depositar
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── MODAL: NOVO LANÇAMENTO ── */}
      {txModal && (
        <div className="modal-backdrop" onClick={() => setTxModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div style={{ background: 'var(--brand-purple)', padding: '1.25rem 1.5rem', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem' }}>Novo Lançamento Pessoal</h3>
              <button onClick={() => setTxModal(false)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>&times;</button>
            </div>
            <form onSubmit={saveTx} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 120px), 1fr))', gap: '0.75rem' }}>
                <button type="button" onClick={() => setTxType('OUT')} style={{ padding: '0.75rem', borderRadius: 8, border: `2px solid ${txType === 'OUT' ? 'var(--danger)' : 'var(--border-color)'}`, background: txType === 'OUT' ? 'var(--danger-bg)' : 'transparent', color: txType === 'OUT' ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 800, cursor: 'pointer', minHeight: 44 }}>
                  ▼ Despesa
                </button>
                <button type="button" onClick={() => setTxType('IN')} style={{ padding: '0.75rem', borderRadius: 8, border: `2px solid ${txType === 'IN' ? 'var(--success)' : 'var(--border-color)'}`, background: txType === 'IN' ? 'var(--success-bg)' : 'transparent', color: txType === 'IN' ? 'var(--success)' : 'var(--text-muted)', fontWeight: 800, cursor: 'pointer', minHeight: 44 }}>
                  ▲ Receita
                </button>
              </div>
              <div className="form-group"><label>Descrição</label><input value={txDesc} onChange={e => setTxDesc(e.target.value)} required /></div>
              <div className="form-group"><label>Valor (R$)</label><input placeholder="0,00" value={txAmount} onChange={e => setTxAmount(formatCurrency(e.target.value))} required style={{ fontWeight: 700 }} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: '0.75rem' }}>
                <div className="form-group"><label>Data</label><input type="date" value={txDate} onChange={e => setTxDate(e.target.value)} required /></div>
                <div className="form-group">
                  <label>Status</label>
                  <select value={txStatus} onChange={e => setTxStatus(e.target.value)}>
                    <option value="PAID">✅ Pago</option>
                    <option value="PENDING">🕐 Pendente</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Categoria</label>
                <select value={txCategory} onChange={e => setTxCategory(e.target.value)}>
                  <option value="">Sem categoria</option>
                  {categories.filter(c => c.type === txType).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" id="pf_recorrente" checked={txRecurring} onChange={e => setTxRecurring(e.target.checked)} style={{ width: 18, height: 18 }} />
                <label htmlFor="pf_recorrente" style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>Repetir todo mês <Repeat size={13} style={{ verticalAlign: 'middle' }} /></label>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem', background: 'var(--brand-purple)', padding: '0.85rem', fontWeight: 800 }}>Salvar Lançamento</button>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ORÇAMENTO ── */}
      {budgetModal && (
        <div className="modal-backdrop" onClick={() => setBudgetModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div style={{ background: 'var(--brand-purple)', padding: '1.25rem 1.5rem', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem' }}>Novo Orçamento</h3>
              <button onClick={() => setBudgetModal(false)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>&times;</button>
            </div>
            <form onSubmit={saveBudget} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label>Categoria</label>
                <select value={bdCategory} onChange={e => setBdCategory(e.target.value)}>
                  <option value="">Escrever nome manualmente...</option>
                  {categories.filter(c => c.type === 'OUT').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {!bdCategory && (
                <div className="form-group"><label>Nome do Orçamento</label><input placeholder="Ex: Gastos com pets" value={bdName} onChange={e => setBdName(e.target.value)} required={!bdCategory} /></div>
              )}
              <div className="form-group"><label>Limite (R$)</label><input placeholder="0,00" value={bdLimit} onChange={e => setBdLimit(formatCurrency(e.target.value))} required style={{ fontWeight: 700 }} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>Mês</label>
                  <select value={bdMonth} onChange={e => setBdMonth(Number(e.target.value))}>
                    {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Ano</label><input type="number" value={bdYear} onChange={e => setBdYear(Number(e.target.value))} /></div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem', background: 'var(--brand-purple)', padding: '0.85rem', fontWeight: 800 }}>Salvar Orçamento</button>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: META ── */}
      {goalModal && (
        <div className="modal-backdrop" onClick={() => setGoalModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div style={{ background: 'var(--brand-purple)', padding: '1.25rem 1.5rem', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem' }}>Nova Meta de Economia</h3>
              <button onClick={() => setGoalModal(false)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>&times;</button>
            </div>
            <form onSubmit={saveGoal} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label>Emoji</label>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {EMOJIS.map(em => (
                    <button key={em} type="button" onClick={() => setGlEmoji(em)} style={{ fontSize: '1.25rem', background: glEmoji === em ? 'rgba(124,58,237,0.15)' : 'var(--bg-body)', border: `2px solid ${glEmoji === em ? 'var(--brand-purple)' : 'transparent'}`, borderRadius: 8, padding: '0.25rem 0.4rem', cursor: 'pointer' }}>{em}</button>
                  ))}
                </div>
              </div>
              <div className="form-group"><label>Nome da Meta</label><input placeholder="Ex: Viagem para Europa" value={glName} onChange={e => setGlName(e.target.value)} required /></div>
              <div className="form-group"><label>Valor Alvo (R$)</label><input placeholder="0,00" value={glTarget} onChange={e => setGlTarget(formatCurrency(e.target.value))} required style={{ fontWeight: 700 }} /></div>
              <div className="form-group"><label>Prazo (opcional)</label><input type="date" value={glDeadline} onChange={e => setGlDeadline(e.target.value)} /></div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem', background: 'var(--brand-purple)', padding: '0.85rem', fontWeight: 800 }}>Criar Meta</button>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: DEPOSITAR ── */}
      {depositModal && (
        <div className="modal-backdrop" onClick={() => setDepositModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div style={{ background: 'var(--brand-purple)', padding: '1.25rem 1.5rem', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem' }}>Depositar na Meta</h3>
              <button onClick={() => setDepositModal(null)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>&times;</button>
            </div>
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label>Valor a depositar (R$)</label>
                <input placeholder="0,00" value={depositAmt} onChange={e => setDepositAmt(formatCurrency(e.target.value))} autoFocus style={{ fontWeight: 700 }} />
              </div>
              <button className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem', background: 'var(--brand-purple)', padding: '0.85rem', fontWeight: 800 }} onClick={doDeposit}>
                Confirmar Depósito
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

