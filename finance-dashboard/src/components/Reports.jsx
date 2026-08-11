import { useState, useMemo } from 'react';
import { FileBarChart2, Download, SlidersHorizontal, Calendar, Search, TrendingDown, TrendingUp, Wallet, X } from 'lucide-react';
import { authFetch } from '../config';
import { useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const PERIOD_OPTIONS = [
  { label: 'Hoje', value: 'today' },
  { label: 'Esta Semana', value: 'week' },
  { label: 'Este Mês', value: 'month' },
  { label: 'Mês Passado', value: 'last_month' },
  { label: 'Este Trimestre', value: 'quarter' },
  { label: 'Este Ano', value: 'year' },
  { label: 'Período Personalizado', value: 'custom' },
  { label: 'Todos os Registros', value: 'all' },
];

function getPeriodDates(period) {
  const now = new Date();
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

  switch (period) {
    case 'today': return { from: startOf(now), to: endOf(now) };
    case 'week': {
      const day = now.getDay();
      const from = new Date(now); from.setDate(now.getDate() - day);
      const to = new Date(from); to.setDate(from.getDate() + 6);
      return { from: startOf(from), to: endOf(to) };
    }
    case 'month': return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) };
    case 'last_month': return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59) };
    case 'quarter': {
      const q = Math.floor(now.getMonth() / 3);
      return { from: new Date(now.getFullYear(), q * 3, 1), to: new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59) };
    }
    case 'year': return { from: new Date(now.getFullYear(), 0, 1), to: new Date(now.getFullYear(), 11, 31, 23, 59, 59) };
    case 'all': return { from: new Date('2000-01-01'), to: new Date('2099-12-31') };
    default: return null;
  }
}

export default function Reports() {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generated, setGenerated] = useState(false);
  const [activeTab, setActiveTab] = useState('geral'); // 'geral' | 'futuras'

  // Filtro da aba Provisões
  const [provisaoFilter, setProvisaoFilter] = useState('all'); // 'all' | '7' | '15' | '30' | '60' | 'month'

  // Filtros
  const [period, setPeriod] = useState('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [filterType, setFilterType] = useState('all');    // all | IN | OUT
  const [filterStatus, setFilterStatus] = useState('all'); // all | PAID | PENDING
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterEntity, setFilterEntity] = useState('all');
  const [filterMinValue, setFilterMinValue] = useState('');
  const [filterMaxValue, setFilterMaxValue] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [tRes, cRes, eRes] = await Promise.all([
          authFetch('/api/transactions'),
          authFetch('/api/categories'),
          authFetch('/api/entities'),
        ]);
        setTransactions(await tRes.json());
        setCategories(await cRes.json());
        setEntities(await eRes.json());
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const filteredData = useMemo(() => {
    if (!generated) return [];

    let dates;
    if (period === 'custom') {
      if (!customFrom || !customTo) return [];
      dates = { from: new Date(customFrom + 'T00:00:00'), to: new Date(customTo + 'T23:59:59') };
    } else {
      dates = getPeriodDates(period);
    }

    return transactions.filter(t => {
      const refDate = new Date(t.status === 'PAID' && t.paymentDate ? t.paymentDate : t.dueDate);
      if (refDate < dates.from || refDate > dates.to) return false;
      if (filterType !== 'all' && t.type !== filterType) return false;
      if (filterStatus !== 'all' && t.status !== filterStatus) return false;
      if (filterCategory !== 'all' && t.categoryId !== filterCategory) return false;
      if (filterEntity !== 'all' && t.entityId !== filterEntity) return false;
      if (filterMinValue && t.amount < parseFloat(filterMinValue)) return false;
      if (filterMaxValue && t.amount > parseFloat(filterMaxValue)) return false;
      return true;
    });
  }, [generated, transactions, period, customFrom, customTo, filterType, filterStatus, filterCategory, filterEntity, filterMinValue, filterMaxValue]);

  const summary = useMemo(() => {
    const totalOut = filteredData.filter(t => t.type === 'OUT').reduce((a, b) => a + b.amount, 0);
    const totalIn  = filteredData.filter(t => t.type === 'IN').reduce((a, b) => a + b.amount, 0);
    const paid = filteredData.filter(t => t.status === 'PAID').reduce((a, b) => a + b.amount, 0);
    return { totalOut, totalIn, saldo: totalIn - totalOut, paid, count: filteredData.length };
  }, [filteredData]);

  const fmt = (v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  const fmtDate = (d) => new Date(d).toLocaleDateString('pt-BR');

  const statusLabel = (s) => ({ PAID: 'Pago', PENDING: 'Pendente', OVERDUE: 'Vencido' }[s] || s);
  const typeLabel = (t) => t === 'IN' ? 'Receita' : 'Despesa';

  // Lógica de Contas Futuras
  const provisaoData = useMemo(() => {
    // Filtra transações pendentes (PJ ou sem context definido, pois é a rota /api/transactions)
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Calcular data limite conforme filtro de prazo
    let dateLimitMax = null;
    if (provisaoFilter === 'month') {
      dateLimitMax = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59); // fim do mês corrente
    } else if (provisaoFilter !== 'all') {
      const days = parseInt(provisaoFilter);
      dateLimitMax = new Date(now);
      dateLimitMax.setDate(dateLimitMax.getDate() + days);
      dateLimitMax.setHours(23, 59, 59);
    }

    const futurePending = transactions.filter(t => {
      if (t.status !== 'PENDING') return false;
      // Aceita context PJ ou ausente (pré-migração)
      if (t.context && t.context !== 'PJ') return false;
      const due = new Date(t.dueDate);
      if (dateLimitMax && due > dateLimitMax) return false;
      return true;
    });

    // Agrupar por Mês-Ano e depois por Empresa
    const groups = {};
    futurePending.forEach(t => {
      const d = new Date(t.dueDate);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      const monthKey = `${y}-${m < 10 ? '0'+m : m}`;
      const compId = t.company?.id || 'Sem Empresa';
      const compName = t.company?.name || 'Geral / Sem Empresa';

      if (!groups[monthKey]) groups[monthKey] = { label: `${m < 10 ? '0'+m : m}/${y}`, totalIn: 0, totalOut: 0, companies: {} };
      if (!groups[monthKey].companies[compId]) groups[monthKey].companies[compId] = { name: compName, totalIn: 0, totalOut: 0, items: [] };

      const g = groups[monthKey];
      const cg = g.companies[compId];
      cg.items.push(t);
      if (t.type === 'IN') { g.totalIn += t.amount; cg.totalIn += t.amount; }
      else { g.totalOut += t.amount; cg.totalOut += t.amount; }
    });

    return Object.entries(groups).sort((a,b) => a[0].localeCompare(b[0])).map(([key, data]) => ({
      key, label: data.label, totalIn: data.totalIn, totalOut: data.totalOut, saldo: data.totalIn - data.totalOut,
      companies: Object.values(data.companies).sort((a,b) => b.totalOut - a.totalOut)
    }));
  }, [transactions, provisaoFilter]);

  const handleGeneratePDF = () => {
    const doc = new jsPDF();
    const periodLabel = PERIOD_OPTIONS.find(p => p.value === period)?.label || 'Personalizado';

    // Header
    doc.setFillColor(36, 59, 157);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Magalhães Inteligência Financeira', 14, 13);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Relatório: ${periodLabel}`, 14, 22);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 130, 22);

    // Summary box
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMO DO RELATÓRIO', 14, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Total de Registros: ${summary.count}`, 14, 50);
    doc.text(`Total de Receitas: ${fmt(summary.totalIn)}`, 80, 50);
    doc.text(`Total de Despesas: ${fmt(summary.totalOut)}`, 145, 50);
    doc.text(`Saldo do Período: ${fmt(summary.saldo)}`, 14, 57);

    // Table
    autoTable(doc, {
      startY: 65,
      head: [['Data', 'Descrição', 'Tipo', 'Categoria', 'Fornecedor/Cliente', 'Status', 'Valor (R$)']],
      body: filteredData.map(t => [
        fmtDate(t.status === 'PAID' && t.paymentDate ? t.paymentDate : t.dueDate),
        t.description,
        typeLabel(t.type),
        t.category?.name || '—',
        t.entity?.name || '—',
        statusLabel(t.status),
        fmt(t.amount),
      ]),
      headStyles: { fillColor: [36, 59, 157], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 247, 255] },
      columnStyles: { 6: { halign: 'right', fontStyle: 'bold' } },
    });

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Página ${i} de ${pageCount}`, 105, 290, { align: 'center' });
    }

    doc.save(`relatorio-${period}-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleGenerateProvisaoPDF = () => {
    const doc = new jsPDF();
    doc.setFillColor(36, 59, 157);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Magalhães Inteligência Financeira', 14, 13);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Relatório de Provisões (Contas Futuras)`, 14, 22);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 130, 22);

    let currentY = 40;
    
    provisaoData.forEach(mes => {
      doc.setTextColor(40, 40, 40);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`Mês: ${mes.label} (Previsto: ${fmt(mes.saldo)})`, 14, currentY);
      currentY += 5;
      
      mes.companies.forEach(comp => {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100);
        doc.text(`Empresa: ${comp.name} | Receitas: ${fmt(comp.totalIn)} | Despesas: ${fmt(comp.totalOut)}`, 14, currentY + 5);
        
        autoTable(doc, {
          startY: currentY + 8,
          head: [['Data', 'Descrição', 'Categoria', 'Valor']],
          body: comp.items.map(t => [
            fmtDate(t.dueDate),
            t.description,
            t.category?.name || '—',
            `${t.type === 'IN' ? '+' : '-'} ${fmt(t.amount)}`
          ]),
          theme: 'grid',
          headStyles: { fillColor: [240, 240, 240], textColor: [40,40,40] },
          styles: { fontSize: 8 },
          margin: { left: 14 }
        });
        currentY = doc.lastAutoTable.finalY + 10;
      });
      currentY += 10;
    });

    doc.save(`provisoes-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const selectStyle = {
    width: '100%', padding: '0.6rem 0.75rem', borderRadius: 8,
    border: '1px solid var(--border-color)', background: 'var(--bg-card)',
    color: 'var(--text-main)', fontSize: '0.875rem',
  };

  const inputStyle = {
    width: '100%', padding: '0.6rem 0.75rem', borderRadius: 8,
    border: '1px solid var(--border-color)', background: 'var(--bg-card)',
    color: 'var(--text-main)', fontSize: '0.875rem',
  };

  const labelStyle = { fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem', display: 'block' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Relatórios Financeiros</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Acompanhamento e previsão de caixa</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className={`btn ${activeTab === 'geral' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('geral')}>Relatório Geral</button>
          <button className={`btn ${activeTab === 'futuras' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('futuras')}>Provisões / Futuro</button>
        </div>
      </div>

      {activeTab === 'geral' && (
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* ── Painel de Filtros ── */}
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'sticky', top: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.25rem' }}>
              <SlidersHorizontal size={18} style={{ color: 'var(--brand-blue)' }} />
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Filtros</span>
            </div>
            {generated && filteredData.length > 0 && (
              <button className="btn btn-primary" onClick={handleGeneratePDF} style={{ padding: '4px 8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Download size={14} /> PDF
              </button>
            )}
          </div>

          {/* Período */}
          <div>
            <label style={labelStyle}>Período</label>
            <select style={selectStyle} value={period} onChange={e => { setPeriod(e.target.value); setGenerated(false); }}>
              {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {period === 'custom' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={labelStyle}>De</label>
                <input type="date" style={inputStyle} value={customFrom} onChange={e => { setCustomFrom(e.target.value); setGenerated(false); }} />
              </div>
              <div>
                <label style={labelStyle}>Até</label>
                <input type="date" style={inputStyle} value={customTo} onChange={e => { setCustomTo(e.target.value); setGenerated(false); }} />
              </div>
            </div>
          )}

          {/* Tipo */}
          <div>
            <label style={labelStyle}>Tipo</label>
            <select style={selectStyle} value={filterType} onChange={e => { setFilterType(e.target.value); setGenerated(false); }}>
              <option value="all">Todos (Receitas e Despesas)</option>
              <option value="OUT">Só Despesas (Saídas)</option>
              <option value="IN">Só Receitas (Entradas)</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label style={labelStyle}>Status</label>
            <select style={selectStyle} value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setGenerated(false); }}>
              <option value="all">Todos os Status</option>
              <option value="PAID">✅ Pagos / Recebidos</option>
              <option value="PENDING">🕐 Pendentes</option>
              <option value="OVERDUE">🔴 Vencidos</option>
            </select>
          </div>

          {/* Categoria */}
          <div>
            <label style={labelStyle}>Categoria</label>
            <select style={selectStyle} value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setGenerated(false); }}>
              <option value="all">Todas as Categorias</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Fornecedor/Cliente */}
          <div>
            <label style={labelStyle}>Fornecedor / Cliente</label>
            <select style={selectStyle} value={filterEntity} onChange={e => { setFilterEntity(e.target.value); setGenerated(false); }}>
              <option value="all">Todos</option>
              {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>

          {/* Range de Valor */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Valor Mín.</label>
              <input type="number" placeholder="0,00" style={inputStyle} value={filterMinValue} onChange={e => { setFilterMinValue(e.target.value); setGenerated(false); }} />
            </div>
            <div>
              <label style={labelStyle}>Valor Máx.</label>
              <input type="number" placeholder="∞" style={inputStyle} value={filterMaxValue} onChange={e => { setFilterMaxValue(e.target.value); setGenerated(false); }} />
            </div>
          </div>

          {/* Botão Gerar */}
          <button
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.75rem', fontSize: '0.95rem', marginTop: '0.25rem' }}
            onClick={() => setGenerated(true)}
            disabled={loading}
          >
            <FileBarChart2 size={18} /> Gerar Relatório
          </button>

          {generated && (
            <button onClick={() => setGenerated(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
              <X size={14} /> Limpar resultados
            </button>
          )}
        </div>

        {/* ── Resultado ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {!generated ? (
            <div className="card" style={{ padding: '4rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 64, height: 64, borderRadius: 16, background: 'linear-gradient(135deg, #243b9d22, #243b9d44)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileBarChart2 size={32} style={{ color: 'var(--brand-blue)' }} />
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: '1rem', margin: 0 }}>Monte seu relatório</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '4px 0 0' }}>Escolha os filtros ao lado e clique em "Gerar Relatório"</p>
              </div>
            </div>
          ) : loading ? (
            <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)' }}>Carregando dados...</p>
            </div>
          ) : (
            <>
              {/* Cards de Resumo */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                {[
                  { label: 'Registros', value: summary.count, icon: <Search size={18} />, color: 'blue', raw: null },
                  { label: 'Total Receitas', value: fmt(summary.totalIn), icon: <TrendingUp size={18} />, color: 'green', raw: summary.totalIn },
                  { label: 'Total Despesas', value: fmt(summary.totalOut), icon: <TrendingDown size={18} />, color: 'red', raw: summary.totalOut },
                  { label: 'Saldo', value: fmt(summary.saldo), icon: <Wallet size={18} />, color: summary.saldo >= 0 ? 'green' : 'red', raw: summary.saldo },
                ].map(card => (
                  <div key={card.label} className="card stat-card" style={{ borderLeft: `4px solid ${card.color === 'green' ? 'var(--success)' : card.color === 'red' ? 'var(--danger)' : 'var(--brand-blue)'}` }}>
                    <div className="stat-header">
                      <span style={{ fontSize: '0.8rem' }}>{card.label}</span>
                      <div className={`icon-bg ${card.color === 'green' ? 'green' : card.color === 'red' ? 'red' : 'blue'}`}>{card.icon}</div>
                    </div>
                    <div className="stat-value" style={{ fontSize: '1.15rem', color: card.raw < 0 ? 'var(--danger)' : 'inherit' }}>{card.value}</div>
                  </div>
                ))}
              </div>

              {/* Tabela */}
              <div className="card table-container" style={{ padding: 0 }}>
                {filteredData.length === 0 ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Calendar size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                    <p>Nenhum registro encontrado para os filtros selecionados.</p>
                  </div>
                ) : (
                  <table>
                    <thead style={{ backgroundColor: 'var(--bg-body)' }}>
                      <tr>
                        <th>Data</th>
                        <th>Descrição</th>
                        <th>Tipo</th>
                        <th>Categoria</th>
                        <th>Fornecedor/Cliente</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.map(t => {
                        const isIn = t.type === 'IN';
                        const isPaid = t.status === 'PAID';
                        const refDate = t.status === 'PAID' && t.paymentDate ? t.paymentDate : t.dueDate;
                        return (
                          <tr key={t.id}>
                            <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{fmtDate(refDate)}</td>
                            <td style={{ fontWeight: 500 }}>{t.description}</td>
                            <td>
                              <span style={{
                                padding: '2px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700,
                                backgroundColor: isIn ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                                color: isIn ? 'var(--success)' : 'var(--danger)',
                              }}>
                                {isIn ? '▲ Receita' : '▼ Despesa'}
                              </span>
                            </td>
                            <td style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t.category?.name || '—'}</td>
                            <td style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t.entity?.name || '—'}</td>
                            <td>
                              <span style={{
                                padding: '2px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700,
                                backgroundColor: isPaid ? 'rgba(34,197,94,0.12)' : 'rgba(234,179,8,0.12)',
                                color: isPaid ? 'var(--success)' : '#ca8a04',
                              }}>
                                {statusLabel(t.status)}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: isIn ? 'var(--success)' : 'var(--danger)' }}>
                              {isIn ? '+' : '-'} {fmt(t.amount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot style={{ borderTop: '2px solid var(--border-color)', backgroundColor: 'var(--bg-body)' }}>
                      <tr>
                        <td colSpan={6} style={{ padding: '0.75rem 1rem', fontWeight: 700, fontSize: '0.9rem' }}>
                          Total ({summary.count} registros)
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, padding: '0.75rem 1rem', color: summary.saldo >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                          {fmt(summary.saldo)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      )}

      {activeTab === 'futuras' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Provisões e Contas Futuras</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '4px 0 0' }}>Previsão de caixa agrupada por mês e por empresa (apenas contas pendentes)</p>
            </div>
            <button className="btn btn-primary" onClick={handleGenerateProvisaoPDF} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Download size={18} /> Exportar PDF Detalhado
            </button>
          </div>

          {/* Filtros de prazo */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '1.5rem', padding: '0.75rem 1rem', background: 'var(--bg-body)', borderRadius: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginRight: 4 }}>Filtrar por prazo:</span>
            {[
              { value: 'all', label: 'Todos' },
              { value: '7', label: 'Próx. 7 dias' },
              { value: '15', label: 'Próx. 15 dias' },
              { value: '30', label: 'Próx. 30 dias' },
              { value: '60', label: 'Próx. 60 dias' },
              { value: 'month', label: 'Este Mês' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setProvisaoFilter(opt.value)}
                style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                  border: provisaoFilter === opt.value ? '2px solid var(--brand-blue)' : '1px solid var(--border-color)',
                  background: provisaoFilter === opt.value ? 'var(--brand-blue)' : 'var(--bg-card)',
                  color: provisaoFilter === opt.value ? 'white' : 'var(--text-main)',
                  transition: 'all 0.15s',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {loading ? (
            <p>Carregando dados...</p>
          ) : provisaoData.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>Nenhuma conta pendente ou futura encontrada para o período selecionado.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {provisaoData.map(mes => (
                <div key={mes.key} style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ background: 'var(--bg-body)', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Mês: {mes.label}</h4>
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem', fontWeight: 600 }}>
                      <span style={{ color: 'var(--success)' }}>+ {fmt(mes.totalIn)}</span>
                      <span style={{ color: 'var(--danger)' }}>- {fmt(mes.totalOut)}</span>
                      <span style={{ color: mes.saldo >= 0 ? 'var(--success)' : 'var(--danger)' }}>Previsto: {fmt(mes.saldo)}</span>
                    </div>
                  </div>
                  <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {mes.companies.map(comp => (
                      <div key={comp.name}>
                        <h5 style={{ margin: '0 0 0.75rem', color: 'var(--brand-blue)', fontSize: '0.95rem', display: 'flex', justifyContent: 'space-between' }}>
                          <span>🏢 {comp.name}</span>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Despesas: {fmt(comp.totalOut)}</span>
                        </h5>
                        <table style={{ width: '100%', fontSize: '0.85rem' }}>
                          <tbody>
                            {comp.items.map(t => (
                              <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '0.5rem 0', color: 'var(--text-muted)', width: '80px' }}>{fmtDate(t.dueDate)}</td>
                                <td style={{ padding: '0.5rem 0', fontWeight: 500 }}>{t.description}</td>
                                <td style={{ padding: '0.5rem 0', color: 'var(--text-muted)' }}>{t.category?.name || '—'}</td>
                                <td style={{ padding: '0.5rem 0', textAlign: 'right', fontWeight: 600, color: t.type === 'IN' ? 'var(--success)' : 'var(--danger)' }}>
                                  {t.type === 'IN' ? '+' : '-'} {fmt(t.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
