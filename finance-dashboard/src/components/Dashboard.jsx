import { TrendingUp, DollarSign, CreditCard } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const chartData = [
  { name: 'Jan', receitas: 4000, despesas: 2400 },
  { name: 'Fev', receitas: 3000, despesas: 1398 },
  { name: 'Mar', receitas: 2000, despesas: 9800 },
  { name: 'Abr', receitas: 2780, despesas: 3908 },
  { name: 'Mai', receitas: 1890, despesas: 4800 },
  { name: 'Jun', receitas: 2390, despesas: 3800 },
  { name: 'Jul', receitas: 3490, despesas: 4300 },
  { name: 'Ago', receitas: 5000, despesas: 2100 },
];

const despesasCategorias = [
  { nome: 'Pessoal', valor: 42000, color: 'var(--brand-blue)' },
  { nome: 'Fornecedores', valor: 31000, color: '#3b82f6' },
  { nome: 'Impostos', valor: 18000, color: '#6366f1' },
  { nome: 'Aluguel', valor: 7000, color: '#8b5cf6' },
  { nome: 'Energia', valor: 4200, color: '#ec4899' },
  { nome: 'Combustível', valor: 3800, color: '#f43f5e' },
  { nome: 'Outros', valor: 9500, color: 'var(--text-muted)' },
];
const totalDespesas = despesasCategorias.reduce((acc, curr) => acc + curr.valor, 0);

export default function Dashboard() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Fluxo de Caixa Automático */}
      <div className="card" style={{ background: 'linear-gradient(to right, var(--brand-blue), var(--brand-blue-hover))', color: 'white', padding: '2rem' }}>
        <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem', fontWeight: 600, color: 'white', opacity: 0.9 }}>Fluxo de Caixa (Próximos 30 dias)</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '2rem' }}>
          <div>
            <p style={{ fontSize: '0.875rem', opacity: 0.8 }}>🟢 Saldo Atual</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>R$ 84.350,00</p>
          </div>
          <div style={{ fontSize: '1.5rem', opacity: 0.5 }}>+</div>
          <div>
            <p style={{ fontSize: '0.875rem', opacity: 0.8 }}>🟢 Entradas Previstas</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>R$ 92.000,00</p>
          </div>
          <div style={{ fontSize: '1.5rem', opacity: 0.5 }}>-</div>
          <div>
            <p style={{ fontSize: '0.875rem', opacity: 0.8 }}>🔴 Saídas Previstas</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>R$ 76.000,00</p>
          </div>
          <div style={{ fontSize: '1.5rem', opacity: 0.5 }}>=</div>
          <div style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '1rem 1.5rem', borderRadius: '12px' }}>
            <p style={{ fontSize: '0.875rem', opacity: 0.9 }}>Saldo Projetado</p>
            <p style={{ fontSize: '2rem', fontWeight: 700 }}>R$ 100.350,00</p>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card stat-card">
          <div className="stat-header">
            <span>Receita do Mês</span>
            <div className="icon-bg green"><DollarSign size={20} /></div>
          </div>
          <div className="stat-value">R$ 52.400,00</div>
          <div className="stat-footer"><TrendingUp size={14} className="text-success" /><span className="text-success">+12.5%</span></div>
        </div>
        <div className="card stat-card" style={{ borderColor: 'var(--danger)', borderWidth: '2px' }}>
          <div className="stat-header">
            <span>Contas a Pagar (Hoje)</span>
            <div className="icon-bg red"><CreditCard size={20} /></div>
          </div>
          <div className="stat-value">R$ 4.820,00</div>
          <div className="stat-footer"><span className="text-danger">3 contas vencendo</span></div>
        </div>
        <div className="card stat-card" style={{ borderColor: 'var(--success)', borderWidth: '2px' }}>
          <div className="stat-header">
            <span>A Receber (Hoje)</span>
            <div className="icon-bg green"><DollarSign size={20} /></div>
          </div>
          <div className="stat-value">R$ 8.400,00</div>
          <div className="stat-footer"><span className="text-success">2 cobranças</span></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'stretch' }}>
        
        {/* Gráfico de Evolução Financeira */}
        <div className="card" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-main)', fontSize: '1.1rem' }}>Evolução Mensal</h3>
          <div style={{ width: '100%', height: 350 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReceitas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--success)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--success)" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorDespesas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--danger)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="receitas" stroke="var(--success)" strokeWidth={2} fillOpacity={1} fill="url(#colorReceitas)" />
                <Area type="monotone" dataKey="despesas" stroke="var(--danger)" strokeWidth={2} fillOpacity={1} fill="url(#colorDespesas)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Para onde está indo meu dinheiro? */}
        <div className="card" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-main)', fontSize: '1.1rem' }}>Para onde está indo meu dinheiro? (Mês Atual)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {despesasCategorias.map(cat => {
              const percentage = (cat.valor / totalDespesas) * 100;
              return (
                <div key={cat.nome}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 500 }}>{cat.nome}</span>
                    <span style={{ fontWeight: 600 }}>R$ {cat.valor.toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="progress-container">
                    <div className="progress-bar" style={{ width: `${percentage}%`, backgroundColor: cat.color }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
