import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, CreditCard, Loader, Download } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { authFetch } from '../config';


export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [summaryRes, transRes, catRes] = await Promise.all([
          authFetch('/api/summary'),
          authFetch('/api/transactions'),
          authFetch('/api/categories'),
        ]);
        const summaryData = await summaryRes.json();
        const transData = await transRes.json();
        const catData = await catRes.json();
        setSummary(summaryData);
        setTransactions(transData);
        setCategories(catData);
      } catch (err) {
        console.error('Erro ao carregar dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  // Monta gráfico de barras de despesas por categoria
  const despesasPorCategoria = categories
    .filter(c => c.type === 'OUT')
    .map(cat => {
      const total = transactions
        .filter(t => t.categoryId === cat.id && t.status === 'PAID')
        .reduce((acc, t) => acc + t.amount, 0);
      return { nome: cat.name, valor: total, color: cat.color || 'var(--brand-blue)' };
    })
    .filter(c => c.valor > 0);

  const totalDespesasCat = despesasPorCategoria.reduce((acc, c) => acc + c.valor, 0);

  // Monta dados do gráfico de evolução mensal
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const chartData = meses.map((name, idx) => {
    const receitas = transactions
      .filter(t => t.type === 'IN' && t.status === 'PAID' && new Date(t.paymentDate).getMonth() === idx)
      .reduce((acc, t) => acc + t.amount, 0);
    const despesas = transactions
      .filter(t => t.type === 'OUT' && t.status === 'PAID' && new Date(t.paymentDate).getMonth() === idx)
      .reduce((acc, t) => acc + t.amount, 0);
    return { name, receitas, despesas };
  });

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px', flexDirection: 'column', gap: '1rem' }}>
        <Loader size={40} color="var(--brand-blue)" style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ color: 'var(--text-muted)' }}>Carregando dados do banco...</p>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const receitaMes = summary?.receitaMes || 0;
  const despesasMes = summary?.despesasMes || 0;
  const rentabilidade = summary?.rentabilidade || 0;
  const contasVencidas = summary?.contasVencidasHoje || { total: 0, count: 0 };
  const aReceberHoje = summary?.aReceberHoje || 0;

  // Saldo projetado (simplificado)
  const saldoAtual = receitaMes - despesasMes;
  const entradasPrevistas = transactions.filter(t => t.type === 'IN' && t.status === 'PENDING').reduce((a, t) => a + t.amount, 0);
  const saidasPrevistas = transactions.filter(t => t.type === 'OUT' && t.status === 'PENDING').reduce((a, t) => a + t.amount, 0);
  const saldoProjetado = saldoAtual + entradasPrevistas - saidasPrevistas;

  const generatePDF = () => {
    const doc = new jsPDF();
    
    // Título
    doc.setFontSize(18);
    doc.setTextColor(36, 59, 157); // brand-blue
    doc.text('Relatório Financeiro', 14, 22);
    
    // Subtítulo
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`Magalhaes Inteligencia LTDA - Resumo do Mês`, 14, 30);

    // Resumo
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`Receitas: R$ ${receitaMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 14, 45);
    doc.text(`Despesas: R$ ${despesasMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 14, 52);
    doc.text(`Saldo Projetado: R$ ${saldoProjetado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 14, 59);
    doc.text(`Margem de Lucro: ${rentabilidade}%`, 14, 66);

    // Tabela de Despesas por Categoria
    const tableData = despesasPorCategoria.map(c => [
      c.nome, 
      `R$ ${c.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    ]);

    autoTable(doc, {
      startY: 80,
      head: [['Categoria', 'Total Gasto']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [36, 59, 157] }
    });

    // Tabela das últimas despesas pagas do mês
    const paidExpenses = transactions
      .filter(t => t.type === 'OUT' && t.status === 'PAID')
      .map(t => [
        new Date(t.paymentDate).toLocaleDateString('pt-BR'),
        t.description,
        t.category?.name || '—',
        `R$ ${t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      ]);

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 15,
      head: [['Data', 'Descrição', 'Categoria', 'Valor']],
      body: paidExpenses,
      theme: 'grid',
      headStyles: { fillColor: [36, 59, 157] }
    });

    doc.save('relatorio-magalhaes.pdf');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Barra de Ações Sup */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button id="tutorial-export-pdf" className="btn btn-primary" onClick={generatePDF} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Download size={18} /> Exportar Relatório (PDF)
        </button>
      </div>

      {/* Fluxo de Caixa Projetado */}
      <div className="card" style={{ background: 'linear-gradient(to right, var(--brand-blue), var(--brand-blue-hover))', color: 'white', padding: '2rem' }}>
        <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem', fontWeight: 600, color: 'white', opacity: 0.9 }}>Fluxo de Caixa Projetado (Mês)</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '2rem' }}>
          <div>
            <p style={{ fontSize: '0.875rem', opacity: 0.8 }}>🟢 Saldo Acumulado</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>R$ {saldoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          <div style={{ fontSize: '1.5rem', opacity: 0.5 }}>+</div>
          <div>
            <p style={{ fontSize: '0.875rem', opacity: 0.8 }}>🟢 Entradas Pendentes</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>R$ {entradasPrevistas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          <div style={{ fontSize: '1.5rem', opacity: 0.5 }}>-</div>
          <div>
            <p style={{ fontSize: '0.875rem', opacity: 0.8 }}>🔴 Saídas Pendentes</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>R$ {saidasPrevistas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          <div style={{ fontSize: '1.5rem', opacity: 0.5 }}>=</div>
          <div style={{ backgroundColor: 'rgba(255,255,255,0.15)', padding: '1rem 1.5rem', borderRadius: '12px' }}>
            <p style={{ fontSize: '0.875rem', opacity: 0.9 }}>Saldo Projetado</p>
            <p style={{ fontSize: '2rem', fontWeight: 700 }}>R$ {saldoProjetado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div id="tutorial-summary-cards" className="dashboard-grid">
        <div className="card stat-card">
          <div className="stat-header">
            <span>Receita do Mês</span>
            <div className="icon-bg green"><DollarSign size={20} /></div>
          </div>
          <div className="stat-value">R$ {receitaMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          <div className="stat-footer"><TrendingUp size={14} className="text-success" /><span className="text-success">Mês atual</span></div>
        </div>
        <div className="card stat-card">
          <div className="stat-header">
            <span>Despesas do Mês</span>
            <div className="icon-bg red"><CreditCard size={20} /></div>
          </div>
          <div className="stat-value">R$ {despesasMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          <div className="stat-footer"><TrendingDown size={14} className="text-danger" /><span className="text-danger">Saídas pagas</span></div>
        </div>
        <div className="card stat-card">
          <div className="stat-header">
            <span>Rentabilidade</span>
            <div className="icon-bg blue"><TrendingUp size={20} /></div>
          </div>
          <div className="stat-value">{rentabilidade}%</div>
          <div className="stat-footer"><span className="text-muted">Margem de lucro</span></div>
        </div>
        <div className="card stat-card" style={{ borderColor: 'var(--warning)', borderWidth: '2px' }}>
          <div className="stat-header">
            <span>A Pagar (Vencidas)</span>
            <div className="icon-bg orange"><CreditCard size={20} /></div>
          </div>
          <div className="stat-value">R$ {contasVencidas.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          <div className="stat-footer"><span className="text-danger">{contasVencidas.count} conta(s) em atraso</span></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Gráfico de Evolução */}
        <div id="tutorial-monthly-chart" className="card" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-main)', fontSize: '1.1rem' }}>Evolução Mensal</h3>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorR" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--success)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--success)" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorD" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--danger)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                <Area type="monotone" dataKey="receitas" name="Receitas" stroke="var(--success)" strokeWidth={2} fillOpacity={1} fill="url(#colorR)" />
                <Area type="monotone" dataKey="despesas" name="Despesas" stroke="var(--danger)" strokeWidth={2} fillOpacity={1} fill="url(#colorD)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Para onde vai o dinheiro */}
        <div className="card" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-main)', fontSize: '1.1rem' }}>Para onde está indo meu dinheiro?</h3>
          {despesasPorCategoria.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem 0' }}>
              <p>Nenhuma despesa categorizada ainda.</p>
              <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Cadastre despesas com categorias para ver aqui!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {despesasPorCategoria.map(cat => {
                const pct = totalDespesasCat > 0 ? (cat.valor / totalDespesasCat) * 100 : 0;
                return (
                  <div key={cat.nome}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 500 }}>{cat.nome}</span>
                      <span style={{ fontWeight: 600 }}>R$ {cat.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="progress-container">
                      <div className="progress-bar" style={{ width: `${pct}%`, backgroundColor: cat.color }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
