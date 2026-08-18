import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown, DollarSign, CreditCard, Loader, Download, Building2, Truck, PieChart as PieIcon, BarChart3, ArrowUpRight, ArrowDownRight, Sparkles } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { authFetch } from '../config';

const fmt = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const DONUT_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];

export default function Dashboard({ selectedCompanyId = 'all', companies = [] }) {
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);

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
        return { name: cat.name, value: total, color: cat.color || '#243b9d' };
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
    ? 'Todas as Unidades' 
    : (companies.find(c => c.id === selectedCompanyId)?.name || 'Unidade Selecionada');

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setTextColor(36, 59, 157);
    doc.text('Relatório Executivo de Inteligência Financeira', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text(`Unidade: ${currentCompanyName} | Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Receita do Mês: ${fmt(receitaMes)}`, 14, 42);
    doc.text(`Despesas Pagas: ${fmt(despesasMes)}`, 14, 49);
    doc.text(`Saldo Projetado: ${fmt(saldoProjetado)}`, 14, 56);
    doc.text(`Margem de Lucro Operacional: ${rentabilidade}%`, 14, 63);

    const catData = despesasPorCategoria.map(c => [c.name, fmt(c.value)]);
    autoTable(doc, {
      startY: 75,
      head: [['Categoria de Custo', 'Total Pago']],
      body: catData,
      theme: 'grid',
      headStyles: { fillColor: [36, 59, 157] }
    });

    doc.save(`relatorio-executivo-${selectedCompanyId}.pdf`);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px', flexDirection: 'column', gap: '1rem' }}>
        <Loader size={40} color="#243b9d" style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ color: '#64748b', fontWeight: 600 }}>Carregando dados executivos e gráficos...</p>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      
      {/* ─── BANNER EXECUTIVO COM FLUXO PROJETADO ───────────────────────────── */}
      <div style={{ 
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #243b9d 100%)', 
        borderRadius: 16, 
        padding: '1.75rem 2rem', 
        color: 'white',
        boxShadow: '0 10px 25px -5px rgba(36,59,157,0.3)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.12)', padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <Building2 size={13} color="#93c5fd" /> {currentCompanyName}
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '8px 0 2px', letterSpacing: '-0.02em' }}>
              Painel de Inteligência Financeira & Fluxo de Caixa
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem', margin: 0 }}>
              Visão consolidada de receitas, despesas com fornecedores e projeção de liquidez.
            </p>
          </div>

          <button 
            onClick={generatePDF}
            style={{
              padding: '0.65rem 1.25rem',
              background: 'rgba(255,255,255,0.15)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              backdropFilter: 'blur(6px)',
              transition: 'all 0.2s'
            }}
          >
            <Download size={16} /> Exportar Relatório Executivo (PDF)
          </button>
        </div>

        {/* Régua de Projeção */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', background: 'rgba(255,255,255,0.06)', padding: '1.25rem', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
          <div>
            <span style={{ fontSize: '0.75rem', opacity: 0.8, fontWeight: 600 }}>🟢 Saldo Realizado do Mês</span>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: saldoAtual >= 0 ? '#86efac' : '#fca5a5', marginTop: 2 }}>
              {fmt(saldoAtual)}
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', opacity: 0.8, fontWeight: 600 }}>📥 Entradas Futuras Previstas</span>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#93c5fd', marginTop: 2 }}>
              +{fmt(entradasPrevistas)}
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', opacity: 0.8, fontWeight: 600 }}>📤 Boletos / Dívidas Futuras</span>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fca5a5', marginTop: 2 }}>
              -{fmt(saidasPrevistas)}
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.12)', padding: '0.75rem 1rem', borderRadius: 10 }}>
            <span style={{ fontSize: '0.75rem', opacity: 0.9, fontWeight: 700, color: '#fde047' }}>💰 Saldo Projetado no Fechamento</span>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: saldoProjetado >= 0 ? '#86efac' : '#fca5a5', marginTop: 2 }}>
              {fmt(saldoProjetado)}
            </div>
          </div>
        </div>
      </div>

      {/* ─── 4 CARDS DE KPI EXECUTIVO ───────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
        
        <div style={{ background: 'white', borderRadius: 14, padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Receita do Mês</span>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={18} color="#10b981" />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#10b981' }}>{fmt(receitaMes)}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <ArrowUpRight size={14} color="#10b981" /> Entradas quitadas no período
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: 14, padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Despesas Pagas</span>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingDown size={18} color="#ef4444" />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#ef4444' }}>{fmt(despesasMes)}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <ArrowDownRight size={14} color="#ef4444" /> Saídas operacionais / boletos quitados
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: 14, padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Margem Operacional</span>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={18} color="#0284c7" />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0284c7' }}>{rentabilidade}%</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
            Rentabilidade líquida da operação
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: 14, padding: '1.25rem', border: '1px solid #fed7aa', borderLeft: '4px solid #f97316', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9a3412', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Boletos em Atraso</span>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#ffedd5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CreditCard size={18} color="#ea580c" />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#ea580c' }}>{fmt(contasVencidas.total)}</div>
          <div style={{ fontSize: '0.75rem', color: '#c2410c', marginTop: 4, fontWeight: 600 }}>
            {contasVencidas.count} boleto(s) vencido(s) aguardando baixa
          </div>
        </div>

      </div>

      {/* ─── LINHA 1 DE GRÁFICOS: EVOLUÇÃO MENSAL & TOP FORNECEDORES ──────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '1.5rem' }}>
        
        {/* Gráfico 1: Evolução Mensal (Área) */}
        <div style={{ background: 'white', borderRadius: 14, padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1e293b' }}>
                📈 Evolução de Receitas vs Despesas (12 Meses)
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                Histórico comparativo do fluxo financeiro mensal
              </p>
            </div>
          </div>

          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorDesp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => fmt(v)} />
                <Legend />
                <Area type="monotone" dataKey="Receitas" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRec)" />
                <Area type="monotone" dataKey="Despesas" stroke="#ef4444" strokeWidth={2.5} fillOpacity={1} fill="url(#colorDesp)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Top 5 Fornecedores (Barras Horizontais) */}
        <div style={{ background: 'white', borderRadius: 14, padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Truck size={18} color="#243b9d" /> Top 5 Fornecedores & Distribuidoras
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                Onde está concentrado o maior volume de compras e boletos
              </p>
            </div>
          </div>

          {topFornecedores.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#94a3b8' }}>
              <Truck size={36} style={{ margin: '0 auto 8px', opacity: 0.3, display: 'block' }} />
              <p>Nenhum fornecedor vinculado a despesas ainda.</p>
            </div>
          ) : (
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topFornecedores} layout="vertical" margin={{ top: 10, right: 30, left: 40, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} width={130} />
                  <Tooltip formatter={v => fmt(v)} />
                  <Bar dataKey="Total" fill="#243b9d" radius={[0, 6, 6, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

      </div>

      {/* ─── LINHA 2 DE GRÁFICOS: COMPARATIVO UNIDADES & DONUT CATEGORIAS ────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '1.5rem' }}>
        
        {/* Gráfico 3: Comparativo de Unidades de Negócio */}
        <div style={{ background: 'white', borderRadius: 14, padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building2 size={18} color="#243b9d" /> Comparativo entre Unidades de Negócio
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                Receitas e Despesas de cada filial / empresa
              </p>
            </div>
          </div>

          {comparativoUnidades.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#94a3b8' }}>
              <Building2 size={36} style={{ margin: '0 auto 8px', opacity: 0.3, display: 'block' }} />
              <p>Cadastre mais de uma unidade em Configurações para ver o comparativo.</p>
            </div>
          ) : (
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparativoUnidades} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => fmt(v)} />
                  <Legend />
                  <Bar dataKey="Receitas" fill="#10b981" radius={[6, 6, 0, 0]} barSize={26} />
                  <Bar dataKey="Despesas" fill="#ef4444" radius={[6, 6, 0, 0]} barSize={26} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Gráfico 4: Distribuição por Categorias (Donut Chart) */}
        <div style={{ background: 'white', borderRadius: 14, padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                <PieIcon size={18} color="#243b9d" /> Distribuição de Custos por Categoria
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                Onde estão alocados os gastos da unidade
              </p>
            </div>
          </div>

          {despesasPorCategoria.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#94a3b8' }}>
              <PieIcon size={36} style={{ margin: '0 auto 8px', opacity: 0.3, display: 'block' }} />
              <p>Nenhuma despesa categorizada no período.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '1.5rem', alignItems: 'center' }}>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={despesasPorCategoria}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {despesasPorCategoria.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={v => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Lista de Categorias com Barras */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 260, overflowY: 'auto' }}>
                {despesasPorCategoria.map((cat, idx) => {
                  const pct = totalDespesasCat > 0 ? (cat.value / totalDespesasCat) * 100 : 0;
                  const color = DONUT_COLORS[idx % DONUT_COLORS.length];
                  return (
                    <div key={cat.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 2 }}>
                        <span style={{ fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                          {cat.name}
                        </span>
                        <span style={{ fontWeight: 700, color: '#1e293b' }}>{fmt(cat.value)} ({pct.toFixed(1)}%)</span>
                      </div>
                      <div style={{ height: 5, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4 }} />
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
