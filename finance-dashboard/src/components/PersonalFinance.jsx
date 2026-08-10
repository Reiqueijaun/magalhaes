import { useState, useEffect, useMemo } from 'react';
import {
  User, Plus, TrendingUp, TrendingDown, Wallet, Target, PiggyBank,
  Trash2, CheckCircle2, ChevronDown, AlertTriangle, BarChart3, X, Repeat
} from 'lucide-react';
import { authFetch } from '../config';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

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

export default function PersonalFinance() {
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
      setTransactions(await tRes.json());
      setCategories(await cRes.json());
      setBudgets(await bRes.json());
      setGoals(await gRes.json());
    } catch (e) { console.error(e); }
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
      const color = t.category?.color || '#94a3b8';
      if (!map[key]) map[key] = { name: key, value: 0, color };
      map[key].value += t.amount;
    });
    return Object.values(map).sort((a: any, b: any) => b.value - a.value);
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

  // ── Estilos ──
  const tab = (key, label, icon) => (
    <button
      onClick={() => setActiveTab(key)}
      style={{
        padding: '0.6rem 1.2rem', borderRadius: 8, border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.875rem', fontWeight: 600,
        background: activeTab === key ? 'var(--brand-blue)' : 'transparent',
        color: activeTab === key ? 'white' : 'var(--text-muted)',
        transition: 'all 0.2s',
      }}
    >{icon} {label}</button>
  );

  const inputStyle = { width: '100%', padding: '0.6rem 0.75rem', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.875rem' };
  const labelStyle = { fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '0.3rem', display: 'block' };

  const pendentes = transactions.filter(t => t.status === 'PENDING');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={22} color="white" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Finanças Pessoais</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' }}>Controle dos seus gastos como Pessoa Física</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setTxModal(true)} style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Plus size={18} /> Novo Lançamento
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-body)', padding: '0.4rem', borderRadius: 10, width: 'fit-content' }}>
        {tab('dashboard', 'Dashboard', <BarChart3 size={16} />)}
        {tab('lancamentos', 'Lançamentos', <Wallet size={16} />)}
        {tab('orcamentos', 'Orçamentos', <PiggyBank size={16} />)}
        {tab('metas', 'Metas', <Target size={16} />)}
      </div>

      {loading ? <p style={{ color: 'var(--text-muted)' }}>Carregando...</p> : (
        <>
          {/* ── DASHBOARD ── */}
          {activeTab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              {/* Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                {[
                  { label: 'Receitas do Mês', value: fmt(totalIn), icon: <TrendingUp size={20} />, color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
                  { label: 'Despesas do Mês', value: fmt(totalOut), icon: <TrendingDown size={20} />, color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
                  { label: 'Saldo Atual', value: fmt(saldo), icon: <Wallet size={20} />, color: saldo >= 0 ? '#7c3aed' : '#ef4444', bg: saldo >= 0 ? 'rgba(124,58,237,0.12)' : 'rgba(239,68,68,0.12)' },
                ].map(c => (
                  <div key={c.label} className="card" style={{ padding: '1.5rem', borderLeft: `4px solid ${c.color}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{c.label}</span>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.color }}>{c.icon}</div>
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: c.color }}>{c.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                {/* Gráfico Onde vai meu dinheiro */}
                <div className="card" style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', marginBottom: '1.25rem' }}>Onde vai meu dinheiro?</h3>
                  {spendByCategory.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>Nenhuma despesa este mês.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie data={spendByCategory} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                          {(spendByCategory as any[]).map((entry: any, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip formatter={(v: any) => fmt(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Alertas de Orçamento */}
                <div className="card" style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', marginBottom: '1.25rem' }}>Status dos Orçamentos</h3>
                  {budgetsWithProgress.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                      <PiggyBank size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nenhum orçamento definido.</p>
                      <button className="btn btn-secondary" style={{ marginTop: 8 }} onClick={() => setActiveTab('orcamentos')}>Criar Orçamento</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {(budgetsWithProgress as any[]).map((b: any) => (
                        <div key={b.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{b.category?.name || b.name}</span>
                            <span style={{ fontSize: '0.8rem', color: b.pct >= 90 ? '#ef4444' : b.pct >= 70 ? '#f59e0b' : 'var(--text-muted)' }}>
                              {b.pct >= 90 && <AlertTriangle size={12} style={{ marginRight: 3 }} />}
                              {fmt(b.spent)} / {fmt(b.limitAmount)}
                            </span>
                          </div>
                          <div style={{ height: 8, background: 'var(--bg-body)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ width: `${b.pct}%`, height: '100%', borderRadius: 4, background: b.pct >= 90 ? '#ef4444' : b.pct >= 70 ? '#f59e0b' : '#7c3aed', transition: 'width 0.5s' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Pendentes */}
              {pendentes.length > 0 && (
                <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid #f59e0b' }}>
                  <h3 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={18} color="#f59e0b" /> {pendentes.length} lançamento(s) pendente(s)</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {pendentes.map(t => (
                      <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
                        <div>
                          <span style={{ fontWeight: 500 }}>{t.description}</span>
                          <span style={{ marginLeft: 8, color: 'var(--text-muted)', fontSize: '0.8rem' }}>• vence {fmtDate(t.dueDate)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontWeight: 700, color: t.type === 'IN' ? '#22c55e' : '#ef4444' }}>{fmt(t.amount)}</span>
                          <button className="btn btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', color: '#22c55e', borderColor: '#22c55e' }} onClick={() => payTx(t.id)}>
                            <CheckCircle2 size={13} style={{ marginRight: 3 }} /> Pago
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
            <div>
              <div className="card table-container" style={{ padding: 0 }}>
                {transactions.length === 0 ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Wallet size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                    <p>Nenhum lançamento pessoal ainda. Clique em "Novo Lançamento" para começar!</p>
                  </div>
                ) : (
                  <table>
                    <thead style={{ background: 'var(--bg-body)' }}>
                      <tr>
                        <th>Data</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th>Status</th><th style={{ textAlign: 'right' }}>Valor</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map(t => (
                        <tr key={t.id}>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{fmtDate(t.paymentDate || t.dueDate)}</td>
                          <td style={{ fontWeight: 500 }}>
                            {t.description}
                            {t.isRecurring && <Repeat size={12} style={{ marginLeft: 6, color: '#7c3aed', verticalAlign: 'middle' }} title="Recorrente" />}
                          </td>
                          <td>
                            {t.category ? (
                              <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700, background: `${t.category.color}22`, color: t.category.color }}>
                                {t.category.name}
                              </span>
                            ) : '—'}
                          </td>
                          <td>
                            <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700, background: t.type === 'IN' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: t.type === 'IN' ? '#22c55e' : '#ef4444' }}>
                              {t.type === 'IN' ? '▲ Receita' : '▼ Despesa'}
                            </span>
                          </td>
                          <td>
                            <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700, background: t.status === 'PAID' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)', color: t.status === 'PAID' ? '#22c55e' : '#ca8a04' }}>
                              {t.status === 'PAID' ? 'Pago' : 'Pendente'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: t.type === 'IN' ? '#22c55e' : '#ef4444' }}>
                            {t.type === 'IN' ? '+' : '-'} {fmt(t.amount)}
                          </td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {t.status === 'PENDING' && (
                              <button onClick={() => payTx(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#22c55e', marginRight: 8 }} title="Marcar como Pago">
                                <CheckCircle2 size={16} />
                              </button>
                            )}
                            <button onClick={() => deleteTx(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }} title="Excluir">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ── ORÇAMENTOS ── */}
          {activeTab === 'orcamentos' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={() => setBudgetModal(true)} style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Plus size={18} /> Novo Orçamento
                </button>
              </div>
              {budgetsWithProgress.length === 0 ? (
                <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <PiggyBank size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                  <p>Defina quanto quer gastar por categoria no mês.</p>
                  <p style={{ fontSize: '0.8rem' }}>Ex: Lazer: R$ 500,00 | Alimentação: R$ 1.200,00</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                  {(budgetsWithProgress as any[]).map((b: any) => (
                    <div key={b.id} className="card" style={{ padding: '1.5rem', position: 'relative' }}>
                      <button onClick={() => deleteBudget(b.id)} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <Trash2 size={14} />
                      </button>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: `${b.category?.color || '#7c3aed'}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <PiggyBank size={18} color={b.category?.color || '#7c3aed'} />
                        </div>
                        <div>
                          <p style={{ margin: 0, fontWeight: 700 }}>{b.category?.name || b.name}</p>
                          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{MONTHS[b.month - 1]} / {b.year}</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Gasto: <strong style={{ color: b.pct >= 90 ? '#ef4444' : '#7c3aed' }}>{fmt(b.spent)}</strong></span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Limite: <strong>{fmt(b.limitAmount)}</strong></span>
                      </div>
                      <div style={{ height: 10, background: 'var(--bg-body)', borderRadius: 5, overflow: 'hidden' }}>
                        <div style={{ width: `${b.pct}%`, height: '100%', borderRadius: 5, background: b.pct >= 90 ? 'linear-gradient(90deg, #ef4444, #dc2626)' : b.pct >= 70 ? 'linear-gradient(90deg, #f59e0b, #d97706)' : 'linear-gradient(90deg, #7c3aed, #4f46e5)', transition: 'width 0.5s' }} />
                      </div>
                      <p style={{ margin: '6px 0 0', fontSize: '0.8rem', textAlign: 'right', color: b.pct >= 90 ? '#ef4444' : 'var(--text-muted)', fontWeight: b.pct >= 90 ? 700 : 400 }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={() => setGoalModal(true)} style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Plus size={18} /> Nova Meta
                </button>
              </div>
              {goals.length === 0 ? (
                <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Target size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                  <p>Defina seus objetivos financeiros e acompanhe o progresso!</p>
                  <p style={{ fontSize: '0.8rem' }}>Ex: Viagem, Reserva de Emergência, Novo Carro...</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
                  {(goals as any[]).map((g: any) => {
                    const pct = Math.min((g.currentAmount / g.targetAmount) * 100, 100);
                    const done = pct >= 100;
                    return (
                      <div key={g.id} className="card" style={{ padding: '1.5rem', position: 'relative', borderTop: done ? '4px solid #22c55e' : '4px solid #7c3aed' }}>
                        <button onClick={() => deleteGoal(g.id)} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                          <Trash2 size={14} />
                        </button>
                        <div style={{ fontSize: '2rem', marginBottom: 8 }}>{g.emoji}</div>
                        <h3 style={{ fontSize: '1rem', margin: '0 0 4px' }}>{g.name}</h3>
                        {g.deadline && <p style={{ margin: '0 0 12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>⏰ até {fmtDate(g.deadline)}</p>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Guardado</span>
                          <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>{fmt(g.currentAmount)} / {fmt(g.targetAmount)}</span>
                        </div>
                        <div style={{ height: 10, background: 'var(--bg-body)', borderRadius: 5, overflow: 'hidden', marginBottom: 8 }}>
                          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 5, background: done ? 'linear-gradient(90deg, #22c55e, #16a34a)' : 'linear-gradient(90deg, #7c3aed, #4f46e5)', transition: 'width 0.5s' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: done ? '#22c55e' : '#7c3aed' }}>{done ? '🎉 Concluída!' : `${pct.toFixed(1)}%`}</span>
                          {!done && (
                            <button className="btn btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', color: '#7c3aed', borderColor: '#7c3aed' }} onClick={() => setDepositModal(g.id)}>
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
        <div className="modal-overlay" onClick={() => setTxModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3>Novo Lançamento Pessoal</h3>
              <button onClick={() => setTxModal(false)} style={{ background: 'none', fontSize: '1.5rem' }}>&times;</button>
            </div>
            <form onSubmit={saveTx}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <button type="button" onClick={() => setTxType('OUT')} style={{ padding: '0.75rem', borderRadius: 8, border: `2px solid ${txType === 'OUT' ? '#ef4444' : 'var(--border-color)'}`, background: txType === 'OUT' ? 'rgba(239,68,68,0.08)' : 'transparent', color: txType === 'OUT' ? '#ef4444' : 'var(--text-muted)', fontWeight: 700, cursor: 'pointer' }}>
                  ▼ Despesa
                </button>
                <button type="button" onClick={() => setTxType('IN')} style={{ padding: '0.75rem', borderRadius: 8, border: `2px solid ${txType === 'IN' ? '#22c55e' : 'var(--border-color)'}`, background: txType === 'IN' ? 'rgba(34,197,94,0.08)' : 'transparent', color: txType === 'IN' ? '#22c55e' : 'var(--text-muted)', fontWeight: 700, cursor: 'pointer' }}>
                  ▲ Receita
                </button>
              </div>
              <div className="form-group"><label>Descrição</label><input style={inputStyle} value={txDesc} onChange={e => setTxDesc(e.target.value)} required /></div>
              <div className="form-group"><label>Valor (R$)</label><input style={inputStyle} placeholder="0,00" value={txAmount} onChange={e => setTxAmount(formatCurrency(e.target.value))} required /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group"><label>Data</label><input type="date" style={inputStyle} value={txDate} onChange={e => setTxDate(e.target.value)} required /></div>
                <div className="form-group">
                  <label>Status</label>
                  <select style={inputStyle} value={txStatus} onChange={e => setTxStatus(e.target.value)}>
                    <option value="PAID">✅ Pago</option>
                    <option value="PENDING">🕐 Pendente</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Categoria</label>
                <select style={inputStyle} value={txCategory} onChange={e => setTxCategory(e.target.value)}>
                  <option value="">Sem categoria</option>
                  {categories.filter(c => c.type === txType).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" id="pf_recorrente" checked={txRecurring} onChange={e => setTxRecurring(e.target.checked)} style={{ width: 'auto' }} />
                <label htmlFor="pf_recorrente" style={{ margin: 0 }}>Repetir todo mês <Repeat size={13} style={{ verticalAlign: 'middle' }} /></label>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>Salvar Lançamento</button>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ORÇAMENTO ── */}
      {budgetModal && (
        <div className="modal-overlay" onClick={() => setBudgetModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3>Novo Orçamento</h3>
              <button onClick={() => setBudgetModal(false)} style={{ background: 'none', fontSize: '1.5rem' }}>&times;</button>
            </div>
            <form onSubmit={saveBudget}>
              <div className="form-group">
                <label>Categoria (ou nome livre)</label>
                <select style={inputStyle} value={bdCategory} onChange={e => setBdCategory(e.target.value)}>
                  <option value="">Escrever nome manualmente...</option>
                  {categories.filter(c => c.type === 'OUT').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {!bdCategory && (
                <div className="form-group"><label>Nome do Orçamento</label><input style={inputStyle} placeholder="Ex: Gastos com pets" value={bdName} onChange={e => setBdName(e.target.value)} required={!bdCategory} /></div>
              )}
              <div className="form-group"><label>Limite (R$)</label><input style={inputStyle} placeholder="0,00" value={bdLimit} onChange={e => setBdLimit(formatCurrency(e.target.value))} required /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>Mês</label>
                  <select style={inputStyle} value={bdMonth} onChange={e => setBdMonth(Number(e.target.value))}>
                    {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Ano</label><input type="number" style={inputStyle} value={bdYear} onChange={e => setBdYear(Number(e.target.value))} /></div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>Salvar Orçamento</button>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: META ── */}
      {goalModal && (
        <div className="modal-overlay" onClick={() => setGoalModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3>Nova Meta de Economia</h3>
              <button onClick={() => setGoalModal(false)} style={{ background: 'none', fontSize: '1.5rem' }}>&times;</button>
            </div>
            <form onSubmit={saveGoal}>
              <div className="form-group">
                <label>Emoji</label>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {EMOJIS.map(em => (
                    <button key={em} type="button" onClick={() => setGlEmoji(em)} style={{ fontSize: '1.25rem', background: glEmoji === em ? '#7c3aed22' : 'transparent', border: `2px solid ${glEmoji === em ? '#7c3aed' : 'transparent'}`, borderRadius: 8, padding: '0.25rem 0.4rem', cursor: 'pointer' }}>{em}</button>
                  ))}
                </div>
              </div>
              <div className="form-group"><label>Nome da Meta</label><input style={inputStyle} placeholder="Ex: Viagem para Europa" value={glName} onChange={e => setGlName(e.target.value)} required /></div>
              <div className="form-group"><label>Valor Alvo (R$)</label><input style={inputStyle} placeholder="0,00" value={glTarget} onChange={e => setGlTarget(formatCurrency(e.target.value))} required /></div>
              <div className="form-group"><label>Prazo (opcional)</label><input type="date" style={inputStyle} value={glDeadline} onChange={e => setGlDeadline(e.target.value)} /></div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>Criar Meta</button>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: DEPOSITAR ── */}
      {depositModal && (
        <div className="modal-overlay" onClick={() => setDepositModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div className="modal-header">
              <h3>Depositar na Meta</h3>
              <button onClick={() => setDepositModal(null)} style={{ background: 'none', fontSize: '1.5rem' }}>&times;</button>
            </div>
            <div className="form-group">
              <label>Valor a depositar (R$)</label>
              <input style={inputStyle} placeholder="0,00" value={depositAmt} onChange={e => setDepositAmt(formatCurrency(e.target.value))} autoFocus />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }} onClick={doDeposit}>
              Depositar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
