import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, CreditCard, Loader, Download,
  Building2, Truck, PieChart as PieIcon, BarChart3, ArrowUpRight, ArrowDownRight,
  Sparkles, CheckCircle2, AlertTriangle, ShieldCheck
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { authFetch } from '../config';

const fmt = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const DONUT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];

export default function Dashboard({ selectedCompanyId = 'all', companies = [], theme = 'light' }) {
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);

  const isDark = theme === 'dark';
  const gridColor = isDark ? '#1e293b' : '#f1f5f9';
  const axisColor = isDark ? '#64748b' : '#94a3b8';
  const tooltipStyle = {
    backgroundColor: isDark ? '#111827' : '#ffffff',
    borderColor: isDark ? '#334155' : '#e2e8f0',
    color: isDark ? '#f8fafc' : '#0f172a',
    borderRadius: '10px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
    fontSize: '0.82rem',
    fontWeight: 600
  };

  const fetchAll = async () => {
    try {
      const summaryUrl = selectedCompanyId && selectedCompanyId !== 'all' 
        ? `/api/summary?companyId=${selectedCompanyId}` 
        : '/api/summary';

      const [summaryRes, transRes, catRes, entRes] = await Promise.all([
        authFetch(summaryUrl),
        authFetch('/api/transactions'),
        authFetch('/api/categories'),
        authFetch('/api/entities'),
      ]);
      setSummary(await summaryRes.json());
      setTransactions(await transRes.json());
      setCategories(await catRes.json());
      setEntities(await entRes.json());
    } catch (err) {
      console.error('Erro ao carregar analytics do dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [selectedCompanyId]);

  // Transações filtradas pela unidade selecionada
  const filteredTransactions = useMemo(() => {
    if (!selectedCompanyId || selectedCompanyId === 'all') {
      return transactions;
    }
    return transactions.filter(t => t.companyId === selectedCompanyId);
  }, [transactions, selectedCompanyId]);

  // ─── 1. GRÁFICO DE EVOLUÇÃO MENSAL (12 MESES) ──────────────────────────────
  const mesesNomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const chartData = useMemo(() => {
    return mesesNomes.map((name, idx) => {
      const receitas = filteredTransactions
        .filter(t => t.type === 'IN' && t.status === 'PAID' && new Date(t.paymentDate || t.dueDate).getMonth() === idx)
        .reduce((acc, t) => acc + t.amount, 0);
      const despesas = filteredTransactions
        .filter(t => t.type === 'OUT' && t.status === 'PAID' && new Date(t.paymentDate || t.dueDate).getMonth() === idx)
        .reduce((acc, t) => acc + t.amount, 0);
      const boletosPendentes = filteredTransactions
        .filter(t => t.type === 'OUT' && t.status === 'PENDING' && new Date(t.dueDate).getMonth() === idx)
        .reduce((acc, t) => acc + t.amount, 0);
      return { name, Receitas: receitas, Despesas: despesas, Boletos: boletosPendentes };
    });
  }, [filteredTransactions]);

  // ─── 2. TOP 5 FORNECEDORES / DISTRIBUIDORAS ────────────────────────────────
  const topFornecedores = useMemo(() => {
    const map = {};
    filteredTransactions
      .filter(t => t.type === 'OUT')
      .forEach(t => {
        const nome = t.entity?.name || 'Fornecedor Não Identificado';
        map[nome] = (map[nome] || 0) + t.amount;
      });

    return Object.entries(map)
      .map(([name, total]) => ({ name, Total: total }))
      .sort((a, b) => b.Total - a.Total)
      .slice(0, 5);
  }, [filteredTransactions]);

  // ─── 3. COMPARATIVO POR UNIDADE DE NEGÓCIO / EMPRESA ───────────────────────
  const comparativoUnidades = useMemo(() => {
    if (companies.length === 0) return [];
    return companies.map(comp => {
      const rec = transactions
        .filter(t => t.companyId === comp.id && t.type === 'IN' && t.status === 'PAID')
        .reduce((acc, t) => acc + t.amount, 0);
      const desp = transactions
        .filter(t => t.companyId === comp.id && t.type === 'OUT' && t.status === 'PAID')
        .reduce((acc, t) => acc + t.amount, 0);
      return {
        name: comp.name,
        Receitas: rec,
        Despesas: desp,
        Saldo: rec - desp
      };
    });
  }, [transactions, companies]);

  // ─── 4. DESPESAS POR CATEGORIA (DONUT CHART) ────────────────────────────────
  const despesasPorCategoria = useMemo(() => {
    return categories
      .filter(c => c.type === 'OUT')
      .map(cat => {
        const total = filteredTransactions
          .filter(t => t.categoryId === cat.id && t.status === 'PAID')
          .reduce((acc, t) => acc + t.amount, 0);
        return { name: cat.name, value: total, color: cat.color || '#3b82f6' };
      })
      .filter(c => c.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [categories, filteredTransactions]);

  const totalDespesasCat = despesasPorCategoria.reduce((acc, c) => acc + c.value, 0);

  // Cálculos de Fluxo e KPIs
  const receitaMes = summary?.receitaMes || 0;
  const despesasMes = summary?.despesasMes || 0;
  const rentabilidade = summary?.rentabilidade || 0;
  const contasVencidas = summary?.contasVencidasHoje || { total: 0, count: 0 };
  const aReceberHoje = summary?.aReceberHoje || 0;

  const saldoAtual = receitaMes - despesasMes;
  const entradasPrevistas = filteredTransactions.filter(t => t.type === 'IN' && t.status === 'PENDING').reduce((a, t) => a + t.amount, 0);
  const saidasPrevistas = filteredTransactions.filter(t => t.type === 'OUT' && t.status === 'PENDING').reduce((a, t) => a + t.amount, 0);
  const saldoProjetado = saldoAtual + entradasPrevistas - saidasPrevistas;

  const currentCompanyName = selectedCompanyId === 'all' 
    ? 'Todas as Unidades / Empresas' 
    : (companies.find(c => c.id === selectedCompanyId)?.name || 'Unidade Selecionada');

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setTextColor(37, 99, 235);
    doc.text('Relatório Executivo de Inteligência Financeira', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text(`Unidade: ${currentCompanyName} | Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Receita do Mês: ${fmt(receitaMes)}`, 14, 42);
    doc.text(`Despesas Pagas: ${fmt(despesasMes)}`, 14, 49);
    doc.text(`Saldo Projetado: ${fmt(saldoProjetado)}`, 14, 56);
    doc.text(`Margem Operacional Líquida: ${rentabilidade}%`, 14, 63);

    const catData = despesasPorCategoria.map(c => [c.name, fmt(c.value)]);
    autoTable(doc, {
      startY: 75,
      head: [['Categoria de Custo', 'Total Pago']],
      body: catData,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] }
    });

    doc.save(`relatorio-executivo-${selectedCompanyId}.pdf`);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '420px', flexDirection: 'column', gap: '1.25rem' }}>
        <Loader size={44} color="var(--brand-blue)" style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.95rem' }}>Carregando dados financeiros e inteligência executiva...</p>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      
      {/* ─── BANNER EXECUTIVO COM FLUXO PROJETADO ───────────────────────────── */}
      <div className="fin-hero-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.25rem', marginBottom: '1.75rem' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.15)', padding: '5px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', backdropFilter: 'blur(4px)' }}>
              <Building2 size={13} color="#93c5fd" /> {currentCompanyName}
            </div>
            <h2 style={{ fontSize: '1.65rem', fontWeight: 900, margin: '10px 0 4px', letterSpacing: '-0.03em' }}>
              Painel de Inteligência Financeira & Fluxo de Caixa
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.875rem', margin: 0, maxWidth: '650px' }}>
              Visão estratégica de receitas realizadas, previsão de recebíveis, gestão de boletos e projeção de liquidez.
            </p>
          </div>

          <button 
            onClick={generatePDF}
            className="btn"
            style={{
              background: 'rgba(255,255,255,0.15)',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 12,
              backdropFilter: 'blur(8px)',
              padding: '0.7rem 1.35rem',
              fontWeight: 700,
              fontSize: '0.85rem'
            }}
          >
            <Download size={16} /> Exportar Relatório Executivo (PDF)
          </button>
        </div>

        {/* Régua de Projeção & Sinais Vitais */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', 
          gap: '1rem', 
          background: 'rgba(0,0,0,0.2)', 
          padding: '1.25rem', 
          borderRadius: 14, 
          border: '1px solid rgba(255,255,255,0.12)' 
        }}>
          <div>
            <span style={{ fontSize: '0.72rem', opacity: 0.85, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>🟢 Saldo Realizado do Mês</span>
            <div className="tabular-nums" style={{ fontSize: '1.35rem', fontWeight: 900, color: saldoAtual >= 0 ? '#6ee7b7' : '#fda4af', marginTop: 3 }}>
              {fmt(saldoAtual)}
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.72rem', opacity: 0.85, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>📥 Entradas Futuras</span>
            <div className="tabular-nums" style={{ fontSize: '1.35rem', fontWeight: 900, color: '#93c5fd', marginTop: 3 }}>
              +{fmt(entradasPrevistas)}
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.72rem', opacity: 0.85, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>📤 Boletos Futuros</span>
            <div className="tabular-nums" style={{ fontSize: '1.35rem', fontWeight: 900, color: '#fda4af', marginTop: 3 }}>
              -{fmt(saidasPrevistas)}
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.12)', padding: '0.85rem 1.15rem', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)' }}>
            <span style={{ fontSize: '0.72rem', opacity: 0.95, fontWeight: 800, color: '#fde047', textTransform: 'uppercase', letterSpacing: '0.04em' }}>💰 Saldo Projetado</span>
            <div className="tabular-nums" style={{ fontSize: '1.4rem', fontWeight: 900, color: saldoProjetado >= 0 ? '#6ee7b7' : '#fda4af', marginTop: 3 }}>
              {fmt(saldoProjetado)}
            </div>
          </div>
        </div>
      </div>

      {/* ─── 4 CARDS DE KPI EXECUTIVO ───────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '1.15rem' }}>
        
        {/* Receita do Mês */}
        <div className="fin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Receita do Mês</span>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={18} color="var(--success)" />
            </div>
          </div>
          <div className="tabular-nums" style={{ fontSize: '1.65rem', fontWeight: 900, color: 'var(--success)' }}>
            {fmt(receitaMes)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
            <ArrowUpRight size={14} color="var(--success)" /> Entradas quitadas no período
          </div>
        </div>

        {/* Despesas Pagas */}
        <div className="fin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Despesas Pagas</span>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--danger-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingDown size={18} color="var(--danger)" />
            </div>
          </div>
          <div className="tabular-nums" style={{ fontSize: '1.65rem', fontWeight: 900, color: 'var(--danger)' }}>
            {fmt(despesasMes)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
            <ArrowDownRight size={14} color="var(--danger)" /> Saídas operacionais / compras
          </div>
        </div>

        {/* Margem Operacional */}
        <div className="fin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Margem Operacional</span>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--info-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={18} color="var(--info)" />
            </div>
          </div>
          <div className="tabular-nums" style={{ fontSize: '1.65rem', fontWeight: 900, color: 'var(--info)' }}>
            {rentabilidade}%
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
            Rentabilidade líquida sobre o faturamento
          </div>
        </div>

        {/* Boletos em Atraso */}
        <div className="fin-card" style={{ borderLeft: '4px solid var(--warning)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--warning-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Boletos em Atraso</span>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--warning-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CreditCard size={18} color="var(--warning)" />
            </div>
          </div>
          <div className="tabular-nums" style={{ fontSize: '1.65rem', fontWeight: 900, color: 'var(--warning-text)' }}>
            {fmt(contasVencidas.total)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--warning-text)', marginTop: 6, fontWeight: 700 }}>
            {contasVencidas.count} boleto(s) vencido(s) aguardando baixa
          </div>
        </div>

      </div>

      {/* ─── LINHA 1 DE GRÁFICOS: EVOLUÇÃO MENSAL & TOP FORNECEDORES ──────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '1.25rem' }}>
        
        {/* Gráfico 1: Evolução Mensal (Área) */}
        <div className="fin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                📈 Evolução de Receitas vs Despesas (12 Meses)
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Histórico comparativo do fluxo financeiro anual
              </p>
            </div>
          </div>

          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorDesp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis dataKey="name" stroke={axisColor} fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke={axisColor} fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => fmt(v)} contentStyle={tooltipStyle} />
                <Legend />
                <Area type="monotone" dataKey="Receitas" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRec)" />
                <Area type="monotone" dataKey="Despesas" stroke="#f43f5e" strokeWidth={2.5} fillOpacity={1} fill="url(#colorDesp)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Top 5 Fornecedores (Barras Horizontais) */}
        <div className="fin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Truck size={18} color="var(--brand-blue)" /> Top 5 Fornecedores & Distribuidoras
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Onde está concentrado o maior volume de compras e boletos
              </p>
            </div>
          </div>

          {topFornecedores.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              <Truck size={36} style={{ margin: '0 auto 8px', opacity: 0.3, display: 'block' }} />
              <p>Nenhum fornecedor vinculado a despesas ainda.</p>
            </div>
          ) : (
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topFornecedores} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridColor} />
                  <XAxis type="number" stroke={axisColor} fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" stroke={axisColor} fontSize={10} tickLine={false} axisLine={false} width={100} />
                  <Tooltip formatter={v => fmt(v)} contentStyle={tooltipStyle} />
                  <Bar dataKey="Total" fill="var(--brand-blue)" radius={[0, 6, 6, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

      </div>

      {/* ─── LINHA 2 DE GRÁFICOS: COMPARATIVO UNIDADES & DONUT CATEGORIAS ────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '1.25rem' }}>
        
        {/* Gráfico 3: Comparativo de Unidades de Negócio */}
        <div className="fin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building2 size={18} color="var(--brand-blue)" /> Comparativo entre Unidades
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Receitas e Despesas de cada filial / empresa
              </p>
            </div>
          </div>

          {comparativoUnidades.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              <Building2 size={36} style={{ margin: '0 auto 8px', opacity: 0.3, display: 'block' }} />
              <p>Cadastre mais de uma unidade em Configurações para ver o comparativo.</p>
            </div>
          ) : (
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparativoUnidades} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                  <XAxis dataKey="name" stroke={axisColor} fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke={axisColor} fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => fmt(v)} contentStyle={tooltipStyle} />
                  <Legend />
                  <Bar dataKey="Receitas" fill="#10b981" radius={[6, 6, 0, 0]} barSize={22} />
                  <Bar dataKey="Despesas" fill="#f43f5e" radius={[6, 6, 0, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Gráfico 4: Distribuição por Categorias (Donut Chart) */}
        <div className="fin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                <PieIcon size={18} color="var(--brand-blue)" /> Custos por Categoria
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Onde estão alocados os gastos da unidade
              </p>
            </div>
          </div>

          {despesasPorCategoria.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              <PieIcon size={36} style={{ margin: '0 auto 8px', opacity: 0.3, display: 'block' }} />
              <p>Nenhuma despesa categorizada no período.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '1.25rem', alignItems: 'center' }}>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={despesasPorCategoria}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {despesasPorCategoria.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={v => fmt(v)} contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Lista de Categorias com Barras */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
                {despesasPorCategoria.map((cat, idx) => {
                  const pct = totalDespesasCat > 0 ? (cat.value / totalDespesasCat) * 100 : 0;
                  const color = DONUT_COLORS[idx % DONUT_COLORS.length];
                  return (
                    <div key={cat.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 2 }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                          {cat.name}
                        </span>
                        <span className="tabular-nums" style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.8rem', whiteSpace: 'nowrap', marginLeft: 6 }}>
                          {fmt(cat.value)} ({pct.toFixed(0)}%)
                        </span>
                      </div>
                      <div style={{ height: 5, background: 'var(--bg-body)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.4s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}

