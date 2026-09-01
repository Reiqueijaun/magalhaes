import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, CreditCard, Loader, Download,
  Building2, Truck, PieChart as PieIcon, BarChart3, ArrowUpRight, ArrowDownRight,
  Sparkles, CheckCircle2, AlertTriangle, ShieldCheck, Activity, Award,
  ChevronRight, Calendar, Zap, Layers, RefreshCw
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell,
  ReferenceLine, Line, ComposedChart
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { authFetch } from '../config';

const fmt = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const DONUT_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#f43f5e',
  '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6',
  '#6366f1', '#64748b'
];

// Mini Gerador de Sparkline SVG ultra-leve e fluído
const MiniSparkline = ({ data, color = '#10b981', height = 28, width = 74 }) => {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;
  const h = height - padding * 2;
  const w = width - padding * 2;

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * w;
    const y = padding + h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const areaD = `M ${points[0]} L ${points.join(' L ')} L ${padding + w},${height} L ${padding},${height} Z`;
  const gradId = `sparkGrad-${color.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0.0} />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradId})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// Tooltip Rica e Flutuante (Glassmorphism Fintech)
const FintechCustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const rec = payload.find(p => p.dataKey === 'Receitas')?.value || 0;
    const desp = payload.find(p => p.dataKey === 'Despesas')?.value || 0;
    const saldo = rec - desp;
    const margin = rec > 0 ? ((saldo / rec) * 100).toFixed(1) : '0.0';

    return (
      <div className="fintech-tooltip">
        <div className="fintech-tooltip-header">
          <span>📅 {label} • Performance</span>
          {rec > 0 && (
            <span style={{ color: saldo >= 0 ? '#10b981' : '#f43f5e', fontWeight: 800 }}>
              {saldo >= 0 ? `+${margin}%` : `${margin}%`}
            </span>
          )}
        </div>

        {payload.map((entry, idx) => (
          <div key={`tt-row-${idx}`} className="fintech-tooltip-row">
            <span className="fintech-tooltip-label">
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color, display: 'inline-block' }} />
              {entry.name}
            </span>
            <span className="fintech-tooltip-val">
              {fmt(entry.value)}
            </span>
          </div>
        ))}

        {rec > 0 && desp > 0 && (
          <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.12)', display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
            <span style={{ opacity: 0.8, fontWeight: 600 }}>Saldo Líquido:</span>
            <span style={{ fontWeight: 900, color: saldo >= 0 ? '#34d399' : '#fb7185' }}>
              {fmt(saldo)}
            </span>
          </div>
        )}
      </div>
    );
  }
  return null;
};

export default function Dashboard({ selectedCompanyId = 'all', companies = [], theme = 'light' }) {
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modos interativos de visualização
  const [chartMode, setChartMode] = useState('combined'); // 'combined' | 'net' | 'all'
  const [hoveredCategory, setHoveredCategory] = useState(null);

  const isDark = theme === 'dark';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
  const axisColor = isDark ? '#64748b' : '#94a3b8';

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

  // Apenas transações da empresa (PJ) e não excluídas — nunca mistura com finanças pessoais.
  const pjTransactions = useMemo(
    () => transactions.filter(t => (!t.context || t.context === 'PJ') && !t.deletedAt),
    [transactions]
  );

  // Transações filtradas pela unidade selecionada
  const filteredTransactions = useMemo(() => {
    if (!selectedCompanyId || selectedCompanyId === 'all') {
      return pjTransactions;
    }
    return pjTransactions.filter(t => t.companyId === selectedCompanyId);
  }, [pjTransactions, selectedCompanyId]);

  // ─── 1. DADOS DE EVOLUÇÃO MENSAL (12 MESES) ──────────────────────────────
  const mesesNomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const chartYear = new Date().getFullYear();
  const chartData = useMemo(() => {
    const inYearMonth = (v, idx) => {
      const d = new Date(v);
      return d.getFullYear() === chartYear && d.getMonth() === idx;
    };
    return mesesNomes.map((name, idx) => {
      const receitas = filteredTransactions
        .filter(t => t.type === 'IN' && t.status === 'PAID' && inYearMonth(t.paymentDate || t.dueDate, idx))
        .reduce((acc, t) => acc + t.amount, 0);
      const despesas = filteredTransactions
        .filter(t => t.type === 'OUT' && t.status === 'PAID' && inYearMonth(t.paymentDate || t.dueDate, idx))
        .reduce((acc, t) => acc + t.amount, 0);
      const boletosPendentes = filteredTransactions
        .filter(t => t.type === 'OUT' && t.status === 'PENDING' && inYearMonth(t.dueDate, idx))
        .reduce((acc, t) => acc + t.amount, 0);
      const saldoLiquido = receitas - despesas;
      return { 
        name, 
        Receitas: receitas, 
        Despesas: despesas, 
        Boletos: boletosPendentes,
        Saldo: saldoLiquido,
        SaldoPositivo: Math.max(0, saldoLiquido),
        SaldoNegativo: Math.min(0, saldoLiquido)
      };
    });
  }, [filteredTransactions]);

  // ─── 2. TOP FORNECEDORES & DISTRIBUIDORAS COM RANKING ──────────────────────
  const totalDespesasGeral = useMemo(() => {
    return filteredTransactions
      .filter(t => t.type === 'OUT' && t.status === 'PAID')
      .reduce((acc, t) => acc + t.amount, 0);
  }, [filteredTransactions]);

  const topFornecedores = useMemo(() => {
    const map = {};
    filteredTransactions
      .filter(t => t.type === 'OUT')
      .forEach(t => {
        const nome = t.entity?.name || 'Fornecedor Não Identificado';
        map[nome] = (map[nome] || 0) + t.amount;
      });

    return Object.entries(map)
      .map(([name, total]) => ({ 
        name, 
        Total: total,
        pct: totalDespesasGeral > 0 ? ((total / totalDespesasGeral) * 100) : 0,
        initials: name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'FN'
      }))
      .sort((a, b) => b.Total - a.Total)
      .slice(0, 5);
  }, [filteredTransactions, totalDespesasGeral]);

  // ─── 3. COMPARATIVO POR UNIDADE DE NEGÓCIO ────────────────────────────────
  const comparativoUnidades = useMemo(() => {
    if (companies.length === 0) return [];
    return companies.map(comp => {
      const rec = pjTransactions
        .filter(t => t.companyId === comp.id && t.type === 'IN' && t.status === 'PAID')
        .reduce((acc, t) => acc + t.amount, 0);
      const desp = pjTransactions
        .filter(t => t.companyId === comp.id && t.type === 'OUT' && t.status === 'PAID')
        .reduce((acc, t) => acc + t.amount, 0);
      const saldo = rec - desp;
      const margem = rec > 0 ? ((saldo / rec) * 100).toFixed(1) : '0.0';
      return {
        name: comp.name,
        Receitas: rec,
        Despesas: desp,
        Saldo: saldo,
        Margem: Number(margem)
      };
    }).sort((a, b) => b.Receitas - a.Receitas);
  }, [pjTransactions, companies]);

  // ─── 4. DESPESAS POR CATEGORIA (DONUT CHART INTERATIVO) ────────────────────
  const despesasPorCategoria = useMemo(() => {
    return categories
      .filter(c => c.type === 'OUT')
      .map((cat, idx) => {
        const total = filteredTransactions
          .filter(t => t.categoryId === cat.id && t.status === 'PAID')
          .reduce((acc, t) => acc + t.amount, 0);
        return { 
          name: cat.name, 
          value: total, 
          color: cat.color || DONUT_COLORS[idx % DONUT_COLORS.length] 
        };
      })
      .filter(c => c.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [categories, filteredTransactions]);

  const totalDespesasCat = despesasPorCategoria.reduce((acc, c) => acc + c.value, 0);

  // ─── ESTATÍSTICAS E SPARKLINE HISTÓRICO ────────────────────────────────────
  const currentMonthIdx = new Date().getMonth();
  const prevMonthIdx = (currentMonthIdx + 11) % 12;

  const sparklineReceitas = useMemo(() => {
    return chartData.slice(Math.max(0, currentMonthIdx - 5), currentMonthIdx + 1).map(d => d.Receitas);
  }, [chartData, currentMonthIdx]);

  const sparklineDespesas = useMemo(() => {
    return chartData.slice(Math.max(0, currentMonthIdx - 5), currentMonthIdx + 1).map(d => d.Despesas);
  }, [chartData, currentMonthIdx]);

  const sparklineSaldo = useMemo(() => {
    return chartData.slice(Math.max(0, currentMonthIdx - 5), currentMonthIdx + 1).map(d => d.Saldo);
  }, [chartData, currentMonthIdx]);

  const sparklineBoletos = useMemo(() => {
    return chartData.slice(Math.max(0, currentMonthIdx - 5), currentMonthIdx + 1).map(d => d.Boletos);
  }, [chartData, currentMonthIdx]);

  // Cálculos de Fluxo e KPIs
  const receitaMes = summary?.receitaMes || 0;
  const despesasMes = summary?.despesasMes || 0;
  const rentabilidade = summary?.rentabilidade || 0;
  const contasVencidas = summary?.contasVencidasHoje || { total: 0, count: 0 };
  
  const saldoAtual = receitaMes - despesasMes;
  const entradasPrevistas = filteredTransactions.filter(t => t.type === 'IN' && t.status === 'PENDING').reduce((a, t) => a + t.amount, 0);
  const saidasPrevistas = filteredTransactions.filter(t => t.type === 'OUT' && t.status === 'PENDING').reduce((a, t) => a + t.amount, 0);
  const saldoProjetado = saldoAtual + entradasPrevistas - saidasPrevistas;

  // Variações percentuais vs mês anterior
  const receitaAnterior = chartData[prevMonthIdx]?.Receitas || 0;
  const variacaoReceita = receitaAnterior > 0 
    ? (((receitaMes - receitaAnterior) / receitaAnterior) * 100).toFixed(1)
    : null;

  const despesaAnterior = chartData[prevMonthIdx]?.Despesas || 0;
  const variacaoDespesa = despesaAnterior > 0 
    ? (((despesasMes - despesaAnterior) / despesaAnterior) * 100).toFixed(1)
    : null;

  // Insights Dinâmicos
  const bestRevenueMonth = useMemo(() => {
    return chartData.reduce((max, cur) => cur.Receitas > max.Receitas ? cur : max, chartData[0]);
  }, [chartData]);

  const totalAcumuladoAno = useMemo(() => {
    return chartData.reduce((acc, cur) => acc + cur.Receitas, 0);
  }, [chartData]);

  const mediaMensalReceita = useMemo(() => {
    return totalAcumuladoAno / 12;
  }, [totalAcumuladoAno]);

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
        <p style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.95rem' }}>Carregando inteligência analítica e fluxo financeiro...</p>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      
      {/* ─── BANNER HERO EXECUTIVO COM FLUXO PROJETADO ───────────────────────────── */}
      <div className="fin-hero-card" style={{
        background: isDark 
          ? 'linear-gradient(135deg, #091328 0%, #112240 50%, #1e3a8a 100%)' 
          : 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #3b82f6 100%)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: isDark ? '0 16px 36px -8px rgba(0, 0, 0, 0.6)' : '0 16px 36px -8px rgba(37, 99, 235, 0.35)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.25rem', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: 6, 
                background: 'rgba(255,255,255,0.18)', 
                padding: '4px 12px', 
                borderRadius: 20, 
                fontSize: '0.72rem', 
                fontWeight: 800, 
                textTransform: 'uppercase', 
                letterSpacing: '0.06em', 
                backdropFilter: 'blur(8px)',
                color: '#ffffff'
              }}>
                <Building2 size={13} color="#93c5fd" /> {currentCompanyName}
              </span>
              <span style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: 6, 
                background: 'rgba(16, 185, 129, 0.22)', 
                border: '1px solid rgba(52, 211, 153, 0.4)',
                padding: '4px 10px', 
                borderRadius: 20, 
                fontSize: '0.72rem', 
                fontWeight: 700, 
                color: '#a7f3d0'
              }}>
                <span className="pulse-dot" /> Sistema Operacional Ativo
              </span>
            </div>

            <h2 style={{ fontSize: '1.75rem', fontWeight: 900, margin: '10px 0 4px', letterSpacing: '-0.03em', color: '#ffffff' }}>
              Painel de Inteligência Financeira & Fluxo de Caixa
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.875rem', margin: 0, maxWidth: '680px', lineHeight: 1.5 }}>
              Visão analítica de faturamento realizado, previsão de recebíveis, gestão de boletos e projeção de liquidez operacional.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button 
              onClick={fetchAll}
              title="Recarregar dados"
              style={{
                background: 'rgba(255,255,255,0.15)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 12,
                backdropFilter: 'blur(8px)',
                padding: '0.65rem 0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
              }}
            >
              <RefreshCw size={16} />
            </button>

            <button 
              onClick={generatePDF}
              className="btn"
              style={{
                background: 'rgba(255,255,255,0.2)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.35)',
                borderRadius: 12,
                backdropFilter: 'blur(10px)',
                padding: '0.65rem 1.25rem',
                fontWeight: 700,
                fontSize: '0.85rem',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}
            >
              <Download size={16} /> Exportar Relatório (PDF)
            </button>
          </div>
        </div>

        {/* Régua de Projeção & Sinais Vitais */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', 
          gap: '1rem', 
          background: 'rgba(0,0,0,0.28)', 
          padding: '1.25rem', 
          borderRadius: 16, 
          border: '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(8px)'
        }}>
          <div>
            <span style={{ fontSize: '0.72rem', opacity: 0.85, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#ffffff' }}>
              🟢 Saldo Realizado (Mês)
            </span>
            <div className="tabular-nums" style={{ fontSize: '1.4rem', fontWeight: 900, color: saldoAtual >= 0 ? '#6ee7b7' : '#fda4af', marginTop: 3 }}>
              {fmt(saldoAtual)}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>
              Receitas quitadas - despesas pagas
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.72rem', opacity: 0.85, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#ffffff' }}>
              📥 Entradas Previstas
            </span>
            <div className="tabular-nums" style={{ fontSize: '1.4rem', fontWeight: 900, color: '#93c5fd', marginTop: 3 }}>
              +{fmt(entradasPrevistas)}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>
              Recebíveis a faturar no período
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.72rem', opacity: 0.85, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#ffffff' }}>
              📤 Boletos & Contas Futuras
            </span>
            <div className="tabular-nums" style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fda4af', marginTop: 3 }}>
              -{fmt(saidasPrevistas)}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>
              Boletos e compras a vencer
            </div>
          </div>

          <div style={{ 
            background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.08) 100%)', 
            padding: '0.9rem 1.15rem', 
            borderRadius: 14, 
            border: '1px solid rgba(255,255,255,0.25)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}>
            <span style={{ fontSize: '0.72rem', opacity: 0.95, fontWeight: 800, color: '#fde047', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              💰 Saldo Projetado Líquido
            </span>
            <div className="tabular-nums" style={{ fontSize: '1.45rem', fontWeight: 900, color: saldoProjetado >= 0 ? '#6ee7b7' : '#fda4af', marginTop: 3 }}>
              {fmt(saldoProjetado)}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
              Liquidez final esperada no caixa
            </div>
          </div>
        </div>
      </div>

      {/* ─── 4 CARDS DE KPI EXECUTIVO COM SPARKLINES ───────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '1.15rem' }}>
        
        {/* Receita do Mês */}
        <div className="kpi-card-v2 accent-green">
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Receita Realizada
              </span>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp size={17} color="var(--success)" />
              </div>
            </div>

            <div className="tabular-nums" style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--success)', letterSpacing: '-0.03em' }}>
              {fmt(receitaMes)}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
            <div>
              {variacaoReceita !== null ? (
                <div style={{ 
                  fontSize: '0.75rem', 
                  fontWeight: 700, 
                  color: Number(variacaoReceita) >= 0 ? 'var(--success-text)' : 'var(--danger-text)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3
                }}>
                  {Number(variacaoReceita) >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  {Number(variacaoReceita) >= 0 ? `+${variacaoReceita}%` : `${variacaoReceita}%`} vs mês ant.
                </div>
              ) : (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Entradas quitadas</span>
              )}
            </div>
            <MiniSparkline data={sparklineReceitas} color="#10b981" />
          </div>
        </div>

        {/* Despesas Pagas */}
        <div className="kpi-card-v2 accent-rose">
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Despesas Pagas
              </span>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--danger-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingDown size={17} color="var(--danger)" />
              </div>
            </div>

            <div className="tabular-nums" style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--danger)', letterSpacing: '-0.03em' }}>
              {fmt(despesasMes)}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
            <div>
              {variacaoDespesa !== null ? (
                <div style={{ 
                  fontSize: '0.75rem', 
                  fontWeight: 700, 
                  color: Number(variacaoDespesa) <= 0 ? 'var(--success-text)' : 'var(--danger-text)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3
                }}>
                  {Number(variacaoDespesa) > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  {Number(variacaoDespesa) >= 0 ? `+${variacaoDespesa}%` : `${variacaoDespesa}%`} vs mês ant.
                </div>
              ) : (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Saídas e compras</span>
              )}
            </div>
            <MiniSparkline data={sparklineDespesas} color="#f43f5e" />
          </div>
        </div>

        {/* Margem Operacional */}
        <div className="kpi-card-v2 accent-blue">
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Margem Operacional
              </span>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--info-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DollarSign size={17} color="var(--info)" />
              </div>
            </div>

            <div className="tabular-nums" style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--info)', letterSpacing: '-0.03em' }}>
              {rentabilidade}%
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              {rentabilidade >= 20 ? (
                <span style={{ color: 'var(--success-text)', fontWeight: 700 }}>⚡ Eficiência alta</span>
              ) : (
                <span style={{ color: 'var(--warning-text)', fontWeight: 700 }}>⚖️ Retenção média</span>
              )}
            </div>
            <MiniSparkline data={sparklineSaldo} color="#0284c7" />
          </div>
        </div>

        {/* Boletos em Atraso */}
        <div className="kpi-card-v2 accent-amber">
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--warning-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Boletos em Atraso
              </span>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--warning-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CreditCard size={17} color="var(--warning)" />
              </div>
            </div>

            <div className="tabular-nums" style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--warning-text)', letterSpacing: '-0.03em' }}>
              {fmt(contasVencidas.total)}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.74rem', color: contasVencidas.count > 0 ? 'var(--warning-text)' : 'var(--success-text)', fontWeight: 700 }}>
              {contasVencidas.count > 0 ? `${contasVencidas.count} boleto(s) pendente(s)` : '✅ Todos em dia'}
            </div>
            <MiniSparkline data={sparklineBoletos} color="#f59e0b" />
          </div>
        </div>

      </div>

      {/* ─── BARRA DE PULSO & INSIGHTS INTELIGENTES ─────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '0.9rem' }}>
        <div className="smart-insight-card">
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(59, 130, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Award size={18} color="var(--brand-blue)" />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Mês Recorde do Ano</div>
            <div style={{ fontWeight: 800, color: 'var(--text-main)', marginTop: 1 }}>
              {bestRevenueMonth.name}: <span className="tabular-nums" style={{ color: 'var(--success)' }}>{fmt(bestRevenueMonth.Receitas)}</span>
            </div>
          </div>
        </div>

        <div className="smart-insight-card">
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(16, 185, 129, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Activity size={18} color="var(--success)" />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Média de Faturamento Anual</div>
            <div style={{ fontWeight: 800, color: 'var(--text-main)', marginTop: 1 }}>
              <span className="tabular-nums">{fmt(mediaMensalReceita)}</span> / mês
            </div>
          </div>
        </div>

        <div className="smart-insight-card">
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(245, 158, 11, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Zap size={18} color="var(--warning)" />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Índice de Cobertura</div>
            <div style={{ fontWeight: 800, color: 'var(--text-main)', marginTop: 1 }}>
              Receitas cobrem <span style={{ color: 'var(--brand-blue)' }}>{despesasMes > 0 ? ((receitaMes / despesasMes) * 100).toFixed(0) : 100}%</span> das despesas
            </div>
          </div>
        </div>
      </div>

      {/* ─── LINHA 1 DE GRÁFICOS: EVOLUÇÃO MULTI-MODO & TOP FORNECEDORES ──────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '1.25rem' }}>
        
        {/* Gráfico 1: Evolução Financeira Anual (12 Meses) com Modo Interativo */}
        <div className="fin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChart3 size={20} color="var(--brand-blue)" /> Fluxo Financeiro (12 Meses)
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {chartMode === 'combined' && 'Comparativo de receitas realizadas e saídas'}
                {chartMode === 'net' && 'Evolução do saldo líquido e lucro operacional'}
                {chartMode === 'all' && 'Fluxo completo com previsão de boletos'}
              </p>
            </div>

            {/* Alternador de Modo do Gráfico */}
            <div className="chart-toggle-group">
              <button 
                onClick={() => setChartMode('combined')}
                className={`chart-toggle-btn ${chartMode === 'combined' ? 'active' : ''}`}
              >
                Receita vs Despesa
              </button>
              <button 
                onClick={() => setChartMode('net')}
                className={`chart-toggle-btn ${chartMode === 'net' ? 'active' : ''}`}
              >
                Saldo Líquido
              </button>
              <button 
                onClick={() => setChartMode('all')}
                className={`chart-toggle-btn ${chartMode === 'all' ? 'active' : ''}`}
              >
                Visão Completa
              </button>
            </div>
          </div>

          <div style={{ width: '100%', height: 310 }}>
            <ResponsiveContainer width="100%" height="100%">
              {chartMode === 'net' ? (
                <BarChart data={chartData} margin={{ top: 15, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSaldoPos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.9}/>
                      <stop offset="100%" stopColor="#059669" stopOpacity={0.7}/>
                    </linearGradient>
                    <linearGradient id="colorSaldoNeg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.9}/>
                      <stop offset="100%" stopColor="#be123c" stopOpacity={0.7}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                  <XAxis dataKey="name" stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<FintechCustomTooltip />} />
                  <ReferenceLine y={0} stroke={isDark ? '#475569' : '#cbd5e1'} strokeDasharray="3 3" />
                  <Bar dataKey="Saldo" fill="#3b82f6" radius={[6, 6, 6, 6]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-saldo-${index}`} fill={entry.Saldo >= 0 ? 'url(#colorSaldoPos)' : 'url(#colorSaldoNeg)'} />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <AreaChart data={chartData} margin={{ top: 15, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRecFin" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.45}/>
                      <stop offset="60%" stopColor="#10b981" stopOpacity={0.12}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="colorDespFin" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.45}/>
                      <stop offset="60%" stopColor="#f43f5e" stopOpacity={0.12}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="colorBolFin" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                  <XAxis dataKey="name" stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<FintechCustomTooltip />} />
                  <Legend 
                    verticalAlign="top" 
                    align="right" 
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ paddingBottom: 12, fontSize: '0.78rem', fontWeight: 600 }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="Receitas" 
                    name="Receitas"
                    stroke="#10b981" 
                    strokeWidth={2.8} 
                    fillOpacity={1} 
                    fill="url(#colorRecFin)" 
                    activeDot={{ r: 6, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="Despesas" 
                    name="Despesas"
                    stroke="#f43f5e" 
                    strokeWidth={2.8} 
                    fillOpacity={1} 
                    fill="url(#colorDespFin)" 
                    activeDot={{ r: 6, fill: '#f43f5e', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                  {chartMode === 'all' && (
                    <Area 
                      type="monotone" 
                      dataKey="Boletos" 
                      name="Boletos Pendentes"
                      stroke="#f59e0b" 
                      strokeWidth={2} 
                      strokeDasharray="4 4"
                      fillOpacity={1} 
                      fill="url(#colorBolFin)" 
                      activeDot={{ r: 5, fill: '#f59e0b' }}
                    />
                  )}
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Top 5 Fornecedores com Ranking & Medalhas */}
        <div className="fin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Truck size={20} color="var(--brand-blue)" /> Top 5 Fornecedores & Custos
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Maiores volumes de saída financeira
              </p>
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-body)', padding: '4px 10px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
              Total: {fmt(topFornecedores.reduce((acc, f) => acc + f.Total, 0))}
            </span>
          </div>

          {topFornecedores.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
              <Truck size={40} style={{ margin: '0 auto 10px', opacity: 0.3, display: 'block' }} />
              <p style={{ fontWeight: 600 }}>Nenhum fornecedor vinculado a despesas ainda.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {topFornecedores.map((forn, idx) => {
                const badgeClass = idx === 0 ? 'rank-badge-1' : idx === 1 ? 'rank-badge-2' : idx === 2 ? 'rank-badge-3' : 'rank-badge-default';
                return (
                  <div key={`forn-${idx}`} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <span className={`rank-badge ${badgeClass}`}>
                          {idx + 1}
                        </span>
                        <span style={{ 
                          fontWeight: 700, 
                          color: 'var(--text-main)', 
                          fontSize: '0.86rem', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis', 
                          whiteSpace: 'nowrap' 
                        }}>
                          {forn.name}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <span className="tabular-nums" style={{ fontWeight: 900, color: 'var(--text-main)', fontSize: '0.88rem' }}>
                          {fmt(forn.Total)}
                        </span>
                        <span style={{ 
                          fontSize: '0.72rem', 
                          fontWeight: 700, 
                          color: 'var(--brand-blue)', 
                          background: 'var(--brand-blue-light)', 
                          padding: '2px 6px', 
                          borderRadius: 6 
                        }}>
                          {forn.pct.toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    {/* Barra de Progresso com Gradiente */}
                    <div style={{ height: 6, background: 'var(--bg-body)', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ 
                        width: `${Math.min(100, Math.max(8, forn.pct))}%`, 
                        height: '100%', 
                        background: idx === 0 
                          ? 'linear-gradient(90deg, #3b82f6, #60a5fa)' 
                          : idx === 1 
                          ? 'linear-gradient(90deg, #10b981, #34d399)' 
                          : 'linear-gradient(90deg, #6366f1, #818cf8)', 
                        borderRadius: 6,
                        transition: 'width 0.5s ease-out' 
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* ─── LINHA 2 DE GRÁFICOS: DONUT DINÂMICO & COMPARATIVO UNIDADES ──────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '1.25rem' }}>
        
        {/* Gráfico 3: Custos por Categoria (Donut Dinâmico com Hover) */}
        <div className="fin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                <PieIcon size={20} color="var(--brand-blue)" /> Distribuição de Custos
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Alocação de saídas por categoria operacional
              </p>
            </div>
          </div>

          {despesasPorCategoria.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
              <PieIcon size={40} style={{ margin: '0 auto 10px', opacity: 0.3, display: 'block' }} />
              <p style={{ fontWeight: 600 }}>Nenhuma despesa categorizada no período.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '1.5rem', alignItems: 'center' }}>
              
              {/* Donut Chart com Centro Informativo Interativo */}
              <div style={{ position: 'relative', width: '100%', height: 230 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={despesasPorCategoria}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={3}
                      dataKey="value"
                      onMouseEnter={(entry) => setHoveredCategory(entry)}
                      onMouseLeave={() => setHoveredCategory(null)}
                    >
                      {despesasPorCategoria.map((entry, index) => (
                        <Cell 
                          key={`cell-donut-${index}`} 
                          fill={entry.color} 
                          style={{
                            outline: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            filter: hoveredCategory?.name === entry.name ? 'drop-shadow(0px 4px 10px rgba(0,0,0,0.3))' : 'none'
                          }}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<FintechCustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>

                {/* Centro do Donut */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  pointerEvents: 'none',
                  maxWidth: '120px'
                }}>
                  <div style={{ 
                    fontSize: '0.68rem', 
                    fontWeight: 800, 
                    textTransform: 'uppercase', 
                    color: 'var(--text-muted)',
                    letterSpacing: '0.04em',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {hoveredCategory ? hoveredCategory.name : 'Total Gasto'}
                  </div>
                  <div className="tabular-nums" style={{ 
                    fontSize: hoveredCategory ? '0.95rem' : '1.05rem', 
                    fontWeight: 900, 
                    color: 'var(--text-main)', 
                    marginTop: 2 
                  }}>
                    {fmt(hoveredCategory ? hoveredCategory.value : totalDespesasCat)}
                  </div>
                  {hoveredCategory && (
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--brand-blue)' }}>
                      {((hoveredCategory.value / totalDespesasCat) * 100).toFixed(1)}%
                    </div>
                  )}
                </div>
              </div>

              {/* Lista de Categorias com Barras Interativas */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, maxHeight: 240, overflowY: 'auto', paddingRight: 4 }}>
                {despesasPorCategoria.map((cat) => {
                  const pct = totalDespesasCat > 0 ? (cat.value / totalDespesasCat) * 100 : 0;
                  const isHovered = hoveredCategory?.name === cat.name;
                  return (
                    <div 
                      key={`cat-list-${cat.name}`}
                      onMouseEnter={() => setHoveredCategory(cat)}
                      onMouseLeave={() => setHoveredCategory(null)}
                      style={{ 
                        cursor: 'pointer',
                        padding: '4px 6px',
                        borderRadius: 8,
                        background: isHovered ? 'var(--bg-hover-row)' : 'transparent',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 3 }}>
                        <span style={{ 
                          fontWeight: isHovered ? 800 : 600, 
                          color: 'var(--text-main)', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 7, 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis', 
                          whiteSpace: 'nowrap' 
                        }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                          {cat.name}
                        </span>
                        <span className="tabular-nums" style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.8rem', whiteSpace: 'nowrap', marginLeft: 6 }}>
                          {fmt(cat.value)} ({pct.toFixed(0)}%)
                        </span>
                      </div>
                      <div style={{ height: 4, background: 'var(--bg-body)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: cat.color, borderRadius: 4, transition: 'width 0.4s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}
        </div>

        {/* Gráfico 4: Comparativo de Unidades de Negócio & Filiais */}
        <div className="fin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building2 size={20} color="var(--brand-blue)" /> Performance por Unidade
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Comparativo de faturamento e resultado líquido
              </p>
            </div>
          </div>

          {comparativoUnidades.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
              <Building2 size={40} style={{ margin: '0 auto 10px', opacity: 0.3, display: 'block' }} />
              <p style={{ fontWeight: 600 }}>Cadastre mais de uma filial em Configurações para habilitar o comparativo.</p>
            </div>
          ) : (
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparativoUnidades} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="recBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.9}/>
                      <stop offset="100%" stopColor="#059669" stopOpacity={0.7}/>
                    </linearGradient>
                    <linearGradient id="despBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.9}/>
                      <stop offset="100%" stopColor="#be123c" stopOpacity={0.7}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                  <XAxis dataKey="name" stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<FintechCustomTooltip />} />
                  <Legend 
                    verticalAlign="top" 
                    align="right" 
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ paddingBottom: 10, fontSize: '0.78rem', fontWeight: 600 }}
                  />
                  <Bar dataKey="Receitas" fill="url(#recBarGrad)" radius={[6, 6, 0, 0]} barSize={20} />
                  <Bar dataKey="Despesas" fill="url(#despBarGrad)" radius={[6, 6, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}

