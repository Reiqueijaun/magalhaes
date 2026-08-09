import { useState } from 'react';
import { LayoutDashboard, Receipt, Clock, Wallet, Settings as SettingsIcon, LogOut, ArrowRightLeft, CalendarDays } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Expenses from './components/Expenses';
import Pending from './components/Pending';
import Receivable from './components/Receivable';
import CalendarView from './components/CalendarView';
import Settings from './components/Settings';

function App() {
  const [currentView, setCurrentView] = useState('dashboard');

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard />;
      case 'expenses': return <Expenses />;
      case 'pending': return <Pending />;
      case 'receivable': return <Receivable />;
      case 'calendar': return <CalendarView />;
      case 'settings': return <Settings />;
      default: return <Dashboard />;
    }
  };

  const getPageTitle = () => {
    switch (currentView) {
      case 'dashboard': return 'Painel Financeiro e Fluxo de Caixa';
      case 'expenses': return 'Histórico de Despesas';
      case 'pending': return 'Contas a Pagar';
      case 'receivable': return 'Contas a Receber';
      case 'calendar': return 'Calendário Financeiro';
      case 'settings': return 'Configurações do Sistema';
      default: return 'Painel Financeiro';
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="icon-bg blue" style={{ width: 32, height: 32, borderRadius: 8 }}>
            <Wallet size={18} />
          </div>
          <span className="brand-title">Magalhaes Inteligencia</span>
        </div>
        
        <nav className="sidebar-nav">
          <button className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`} onClick={() => setCurrentView('dashboard')}>
            <LayoutDashboard className="icon" size={20} /> Visão Geral
          </button>
          
          <div style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginTop: '0.5rem', textTransform: 'uppercase' }}>
            Transações
          </div>
          <button className={`nav-item ${currentView === 'pending' ? 'active' : ''}`} onClick={() => setCurrentView('pending')}>
            <Clock className="icon" size={20} /> A Pagar (Saídas)
          </button>
          <button className={`nav-item ${currentView === 'receivable' ? 'active' : ''}`} onClick={() => setCurrentView('receivable')}>
            <ArrowRightLeft className="icon" size={20} /> A Receber (Entradas)
          </button>
          <button className={`nav-item ${currentView === 'expenses' ? 'active' : ''}`} onClick={() => setCurrentView('expenses')}>
            <Receipt className="icon" size={20} /> Histórico Pago
          </button>
          
          <div style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginTop: '0.5rem', textTransform: 'uppercase' }}>
            Planejamento
          </div>
          <button className={`nav-item ${currentView === 'calendar' ? 'active' : ''}`} onClick={() => setCurrentView('calendar')}>
            <CalendarDays className="icon" size={20} /> Calendário
          </button>
          
          <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <button className={`nav-item ${currentView === 'settings' ? 'active' : ''}`} onClick={() => setCurrentView('settings')}>
              <SettingsIcon className="icon" size={20} /> Configurações
            </button>
            <button className="nav-item" style={{ color: 'var(--danger)' }}>
              <LogOut className="icon" size={20} /> Sair
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="topbar">
          <div>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)', fontWeight: 600 }}>{getPageTitle()}</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>Administrador</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>admin@magalhaes.com.br</p>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: 'var(--brand-blue-light)', color: 'var(--brand-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
              AD
            </div>
          </div>
        </header>
        
        <div className="page-content">
          {renderView()}
        </div>
      </main>
    </div>
  );
}

export default App;
