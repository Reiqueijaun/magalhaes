import { useState, useMemo, useEffect } from 'react';
import {
  FileBarChart2, Download, SlidersHorizontal, Calendar, Search,
  TrendingDown, TrendingUp, Wallet, X, Building2, Tag, Filter, CheckCircle2
} from 'lucide-react';
import { authFetch } from '../config';
import { formatDateBR } from '../utils';
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

export default function Reports({ selectedCompanyId = 'all', companies = [], theme = 'light' }) {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generated, setGenerated] = useState(false);
  const [activeTab, setActiveTab] = useState('geral'); // 'geral' | 'futuras' | 'lixeira'

  // Lixeira (registros excluídos, restauráveis)
  const [trash, setTrash] = useState([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [trashMsg, setTrashMsg] = useState('');

  const loadTrash = async () => {
    setTrashLoading(true);
    try {
      const res = await authFetch('/api/transactions/trash');
      setTrash(res.ok ? await res.json() : []);
    } catch { setTrash([]); }
    finally { setTrashLoading(false); }
  };

  const restoreItem = async (id) => {
    setTrashMsg('');
    try {
      const res = await authFetch(`/api/transactions/${id}/restore`, { method: 'PATCH' });
      if (res.ok) { setTrashMsg('Registro restaurado com sucesso.'); loadTrash(); }
      else setTrashMsg('Não foi possível restaurar o registro.');
    } catch { setTrashMsg('Erro de conexão ao restaurar.'); }
  };

  useEffect(() => {
    if (activeTab === 'lixeira') loadTrash();
  }, [activeTab]);

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
  const [filterCompany, setFilterCompany] = useState(selectedCompanyId || 'all');
  const [filterMinValue, setFilterMinValue] = useState('');
  const [filterMaxValue, setFilterMaxValue] = useState('');

  useEffect(() => {
    if (selectedCompanyId) {
      setFilterCompany(selectedCompanyId);
    }
  }, [selectedCompanyId]);

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
      // Nunca inclui finanças pessoais (PF) no relatório da empresa.
      if (t.context && t.context !== 'PJ') return false;
      const refDate = new Date(t.status === 'PAID' && t.paymentDate ? t.paymentDate : t.dueDate);
      if (refDate < dates.from || refDate > dates.to) return false;
      if (filterCompany !== 'all' && t.companyId !== filterCompany) return false;
      if (filterType !== 'all' && t.type !== filterType) return false;
      if (filterStatus !== 'all' && t.status !== filterStatus) return false;
      if (filterCategory !== 'all' && t.categoryId !== filterCategory) return false;
      if (filterEntity !== 'all' && t.entityId !== filterEntity) return false;
      if (filterMinValue && t.amount < parseFloat(filterMinValue)) return false;
      if (filterMaxValue && t.amount > parseFloat(filterMaxValue)) return false;
      return true;
    });
  }, [generated, transactions, period, customFrom, customTo, filterCompany, filterType, filterStatus, filterCategory, filterEntity, filterMinValue, filterMaxValue]);

  const summary = useMemo(() => {
    const totalOut = filteredData.filter(t => t.type === 'OUT').reduce((a, b) => a + b.amount, 0);
    const totalIn  = filteredData.filter(t => t.type === 'IN').reduce((a, b) => a + b.amount, 0);
    const paid = filteredData.filter(t => t.status === 'PAID').reduce((a, b) => a + b.amount, 0);
    return { totalOut, totalIn, saldo: totalIn - totalOut, paid, count: filteredData.length };
  }, [filteredData]);

  const fmt = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  const fmtDate = (d) => formatDateBR(d);

  const statusLabel = (s) => ({ PAID: 'Pago', PENDING: 'Pendente', OVERDUE: 'Vencido' }[s] || s);
  const typeLabel = (t) => t === 'IN' ? 'Receita' : 'Despesa';

  // Lógica de Contas Futuras
  const provisaoData = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    let dateLimitMax = null;
    if (provisaoFilter === 'month') {
      dateLimitMax = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (provisaoFilter !== 'all') {
      const days = parseInt(provisaoFilter);
      dateLimitMax = new Date(now);
      dateLimitMax.setDate(dateLimitMax.getDate() + days);
      dateLimitMax.setHours(23, 59, 59);
    }

    const futurePending = transactions.filter(t => {
      if (t.status !== 'PENDING') return false;
      if (t.context && t.context !== 'PJ') return false;
      const due = new Date(t.dueDate);
      if (dateLimitMax && due > dateLimitMax) return false;
      return true;
    });

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>Relatórios & DRE Gerencial</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Acompanhamento analítico e projeção futura de caixa</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className={`btn ${activeTab === 'geral' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => setActiveTab('geral')}
            style={{ fontWeight: 800 }}
          >
            Relatório Geral
          </button>
          <button
            className={`btn ${activeTab === 'futuras' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('futuras')}
            style={{ fontWeight: 800 }}
          >
            Provisões / Contas Futuras
          </button>
          <button
            className={`btn ${activeTab === 'lixeira' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('lixeira')}
            style={{ fontWeight: 800 }}
          >
            Lixeira
          </button>
        </div>
      </div>

      {activeTab === 'geral' && (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '1.25rem', alignItems: 'start' }}>
        
        {/* ── Painel de Filtros ── */}
        <div className="fin-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SlidersHorizontal size={18} color="var(--brand-blue)" />
              <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)' }}>Parâmetros</span>
            </div>
            {generated && filteredData.length > 0 && (
              <button className="btn btn-secondary" onClick={handleGeneratePDF} style={{ padding: '4px 10px', fontSize: '0.8rem', gap: 4, minHeight: 34 }}>
                <Download size={14} /> PDF
              </button>
            )}
          </div>

          {/* Unidade / Empresa */}
          <div className="form-group">
            <label>Unidade / Empresa</label>
            <select value={filterCompany} onChange={e => { setFilterCompany(e.target.value); setGenerated(false); }}>
              <option value="all">🏢 Todas as Unidades</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Período */}
          <div className="form-group">
            <label>Período</label>
            <select value={period} onChange={e => { setPeriod(e.target.value); setGenerated(false); }}>
              {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {period === 'custom' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: '0.75rem' }}>
              <div className="form-group">
                <label>De</label>
                <input type="date" value={customFrom} onChange={e => { setCustomFrom(e.target.value); setGenerated(false); }} />
              </div>
              <div className="form-group">
                <label>Até</label>
                <input type="date" value={customTo} onChange={e => { setCustomTo(e.target.value); setGenerated(false); }} />
              </div>
            </div>
          )}

          {/* Tipo */}
          <div className="form-group">
            <label>Tipo</label>
            <select value={filterType} onChange={e => { setFilterType(e.target.value); setGenerated(false); }}>
              <option value="all">Todos (Receitas e Despesas)</option>
              <option value="OUT">Só Despesas (Saídas)</option>
              <option value="IN">Só Receitas (Entradas)</option>
            </select>
          </div>

          {/* Status */}
          <div className="form-group">
            <label>Status</label>
            <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setGenerated(false); }}>
              <option value="all">Todos os Status</option>
              <option value="PAID">✅ Pagos / Recebidos</option>
              <option value="PENDING">🕐 Pendentes</option>
            </select>
          </div>

          {/* Categoria */}
          <div className="form-group">
            <label>Categoria</label>
            <select value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setGenerated(false); }}>
              <option value="all">Todas as Categorias</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Fornecedor/Cliente */}
          <div className="form-group">
            <label>Fornecedor / Cliente</label>
            <select value={filterEntity} onChange={e => { setFilterEntity(e.target.value); setGenerated(false); }}>
              <option value="all">Todos</option>
              {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>

          {/* Range de Valor */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 120px), 1fr))', gap: '0.75rem' }}>
            <div className="form-group">
              <label>Valor Mín.</label>
              <input type="number" placeholder="0,00" value={filterMinValue} onChange={e => { setFilterMinValue(e.target.value); setGenerated(false); }} />
            </div>
            <div className="form-group">
              <label>Valor Máx.</label>
              <input type="number" placeholder="∞" value={filterMaxValue} onChange={e => { setFilterMaxValue(e.target.value); setGenerated(false); }} />
            </div>
          </div>

          {/* Botão Gerar */}
          <button
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.85rem', fontSize: '0.95rem', marginTop: '0.25rem', gap: 8 }}
            onClick={() => setGenerated(true)}
            disabled={loading}
          >
            <FileBarChart2 size={18} /> Gerar Relatório
          </button>

          {generated && (
            <button onClick={() => setGenerated(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center', minHeight: 34 }}>
              <X size={14} /> Limpar resultados
            </button>
          )}
        </div>

        {/* ── Resultado ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {!generated ? (
            <div className="fin-card" style={{ padding: '3rem 1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--brand-blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileBarChart2 size={28} color="var(--brand-blue)" />
              </div>
              <div>
                <p style={{ fontWeight: 800, fontSize: '1.05rem', margin: 0, color: 'var(--text-main)' }}>Monte seu relatório executivo</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '6px 0 0' }}>Escolha os filtros e clique em "Gerar Relatório"</p>
              </div>
            </div>
          ) : loading ? (
            <div className="fin-card" style={{ padding: '3rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)' }}>Carregando dados...</p>
            </div>
          ) : (
            <>
              {/* Cards de Resumo */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: '0.85rem' }}>
                {[
                  { label: 'Registros', value: summary.count, icon: Search, color: 'var(--brand-blue)', bg: 'var(--brand-blue-light)' },
                  { label: 'Total Receitas', value: fmt(summary.totalIn), icon: TrendingUp, color: 'var(--success)', bg: 'var(--success-bg)' },
                  { label: 'Total Despesas', value: fmt(summary.totalOut), icon: TrendingDown, color: 'var(--danger)', bg: 'var(--danger-bg)' },
                  { label: 'Saldo Período', value: fmt(summary.saldo), icon: Wallet, color: summary.saldo >= 0 ? 'var(--success)' : 'var(--danger)', bg: summary.saldo >= 0 ? 'var(--success-bg)' : 'var(--danger-bg)' },
                ].map(card => {
                  const Icon = card.icon;
                  return (
                    <div key={card.label} className="fin-card" style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{card.label}</span>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon size={14} color={card.color} />
                        </div>
                      </div>
                      <div className="tabular-nums" style={{ fontSize: '1.15rem', fontWeight: 900, color: card.color }}>
                        {card.value}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tabela */}
              <div className="fin-table-container">
                {filteredData.length === 0 ? (
                  <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Calendar size={40} style={{ opacity: 0.3, margin: '0 auto 12px', display: 'block' }} />
                    <p style={{ fontWeight: 800, color: 'var(--text-main)' }}>Nenhum registro encontrado para os filtros selecionados.</p>
                  </div>
                ) : (
                  <table className="fin-table">
                    <thead>
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
                            <td className="tabular-nums" style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.82rem' }}>{fmtDate(refDate)}</td>
                            <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>{t.description}</td>
                            <td>
                              <span className={`badge-pill ${isIn ? 'badge-pill-success' : 'badge-pill-danger'}`}>
                                {isIn ? '▲ Receita' : '▼ Despesa'}
                              </span>
                            </td>
                            <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{t.category?.name || '—'}</td>
                            <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{t.entity?.name || '—'}</td>
                            <td>
                              <span className={`badge-pill ${isPaid ? 'badge-pill-success' : 'badge-pill-warning'}`}>
                                {statusLabel(t.status)}
                              </span>
                            </td>
                            <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 900, color: isIn ? 'var(--success)' : 'var(--danger)' }}>
                              {isIn ? '+' : '-'} {fmt(t.amount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot style={{ borderTop: '2px solid var(--border-color)', backgroundColor: 'var(--bg-body)' }}>
                      <tr>
                        <td colSpan={6} style={{ padding: '0.85rem 1.25rem', fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                          Total Líquido ({summary.count} registros)
                        </td>
                        <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 900, padding: '0.85rem 1.25rem', color: summary.saldo >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: '1.1rem' }}>
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
        <div className="fin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>Provisões e Contas Futuras</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0' }}>Previsão de fluxo agrupada por mês e unidade</p>
            </div>
            <button className="btn btn-primary" onClick={handleGenerateProvisaoPDF} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Download size={16} /> Exportar PDF Detalhado
            </button>
          </div>

          {/* Filtros de prazo */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '1.25rem', padding: '0.75rem', background: 'var(--bg-body)', borderRadius: 'var(--radius-md)', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', marginRight: 2, textTransform: 'uppercase' }}>Filtrar prazo:</span>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 }}>
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
                  className={`filter-pill ${provisaoFilter === opt.value ? 'active' : ''}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Carregando dados...</p>
          ) : provisaoData.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>Nenhuma conta pendente ou futura encontrada para o período selecionado.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {provisaoData.map(mes => (
                <div key={mes.key} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <div style={{ background: 'var(--bg-body)', padding: '0.85rem 1.15rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap', gap: 8 }}>
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>Mês: {mes.label}</h4>
                    <div style={{ display: 'flex', gap: '0.85rem', fontSize: '0.82rem', fontWeight: 800, flexWrap: 'wrap' }}>
                      <span className="tabular-nums" style={{ color: 'var(--success)' }}>+ {fmt(mes.totalIn)}</span>
                      <span className="tabular-nums" style={{ color: 'var(--danger)' }}>- {fmt(mes.totalOut)}</span>
                      <span className="tabular-nums" style={{ color: mes.saldo >= 0 ? 'var(--success)' : 'var(--danger)' }}>Prev: {fmt(mes.saldo)}</span>
                    </div>
                  </div>
                  <div style={{ padding: '1.15rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--bg-card)' }}>
                    {mes.companies.map(comp => (
                      <div key={comp.name}>
                        <div style={{ margin: '0 0 0.5rem', color: 'var(--brand-blue)', fontSize: '0.85rem', fontWeight: 800, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                          <span>🏢 {comp.name}</span>
                          <span className="tabular-nums" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Despesas: {fmt(comp.totalOut)}</span>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', fontSize: '0.82rem' }}>
                            <tbody>
                              {comp.items.map(t => (
                                <tr key={t.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                  <td className="tabular-nums" style={{ padding: '0.45rem 0', color: 'var(--text-muted)', width: '85px', whiteSpace: 'nowrap' }}>{fmtDate(t.dueDate)}</td>
                                  <td style={{ padding: '0.45rem 0', fontWeight: 700, color: 'var(--text-main)' }}>{t.description}</td>
                                  <td style={{ padding: '0.45rem 0', color: 'var(--text-muted)' }}>{t.category?.name || '—'}</td>
                                  <td className="tabular-nums" style={{ padding: '0.45rem 0', textAlign: 'right', fontWeight: 800, color: t.type === 'IN' ? 'var(--success)' : 'var(--danger)', whiteSpace: 'nowrap' }}>
                                    {t.type === 'IN' ? '+' : '-'} {fmt(t.amount)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'lixeira' && (
        <div className="fin-card">
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>Lixeira</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0' }}>
              Registros excluídos (empresa). Nada é apagado do banco — você pode restaurar a qualquer momento.
            </p>
          </div>

          {trashMsg && (
            <div className="badge-pill badge-pill-success" style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: 10, fontSize: '0.85rem', marginBottom: '1rem' }}>
              {trashMsg}
            </div>
          )}

          {trashLoading ? (
            <p style={{ color: 'var(--text-muted)' }}>Carregando lixeira...</p>
          ) : trash.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>A lixeira está vazia.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="fin-table">
                <thead>
                  <tr>
                    <th>Excluído em</th>
                    <th>Descrição</th>
                    <th>Tipo</th>
                    <th>Vencimento</th>
                    <th style={{ textAlign: 'right' }}>Valor</th>
                    <th style={{ textAlign: 'center' }}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {trash.map(t => (
                    <tr key={t.id}>
                      <td className="tabular-nums" style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.82rem' }}>{fmtDate(t.deletedAt)}</td>
                      <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>{t.description}</td>
                      <td>
                        <span className={`badge-pill ${t.type === 'IN' ? 'badge-pill-success' : 'badge-pill-danger'}`}>
                          {t.type === 'IN' ? '▲ Receita' : '▼ Despesa'}
                        </span>
                      </td>
                      <td className="tabular-nums" style={{ color: 'var(--text-muted)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{fmtDate(t.dueDate)}</td>
                      <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 900, color: t.type === 'IN' ? 'var(--success)' : 'var(--danger)' }}>
                        {fmt(t.amount)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: '0.8rem', minHeight: 32 }} onClick={() => restoreItem(t.id)}>
                          Restaurar
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
    </div>
  );
}

