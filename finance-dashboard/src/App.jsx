import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Receipt, Clock, Wallet,
  Settings as SettingsIcon, LogOut, ArrowRightLeft,
  CalendarDays, FileBarChart2, User, Package
} from 'lucide-react';
import Reports from './components/Reports';
import PersonalFinance from './components/PersonalFinance';
import Dashboard from './components/Dashboard';
import Expenses from './components/Expenses';
import Pending from './components/Pending';
import Receivable from './components/Receivable';
import CalendarView from './components/CalendarView';
import Settings from './components/Settings';
import Login from './components/Login';
import Notifications from './components/Notifications';
import Tutorial from './components/Tutorial';
import WarehouseModule from './components/Warehouse';
import WarehouseLogin from './components/WarehouseLogin';

// ─── Detecta se o usuário está na rota do almoxarifado ───────────────────────
const isWarehouseRoute = () => window.location.pathname.startsWith('/almox');

// ─── APP DO ALMOXARIFADO (/almox) ────────────────────────────────────────────
function WarehouseApp() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('warehouse_token');
    const savedUser = localStorage.getItem('warehouse_user');
    if (token && savedUser) setUser(JSON.parse(savedUser));
    setAuthChecked(true);
  }, []);

  const handleLogin = (userData) => setUser(userData);

  const handleLogout = () => {
    localStorage.removeItem('warehouse_token');
    localStorage.removeItem('warehouse_user');
    setUser(null);
  };

  if (!authChecked) return null;
  if (!user) return <WarehouseLogin onLogin={handleLogin} />;

  return (
    <div style={{ minHeight: '100vh', background: '#f4f7f6', display: 'flex', flexDirection: 'column' }}>
      {/* Topbar do almoxarifado */}
      <header style={{
        height: 64, background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 2rem', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', position: 'sticky', top: 0, zIndex: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #d97706, #b45309)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Package size={20} color="white" />
          </div>
          <div>
            <div style={{ color: 'white', fontWeight: 800, fontSize: '1rem', lineHeight: 1.2 }}>Almoxarifado</div>
            <div style={{ color: '#94a3b8', fontSize: '0.72rem' }}>Magalhães Inteligência</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: 'white', fontSize: '0.875rem', fontWeight: 600, margin: 0 }}>{user.name}</p>
            <p style={{ color: '#64748b', fontSize: '0.72rem', margin: 0 }}>{user.email}</p>
          </div>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #d97706, #b45309)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '0.875rem' }}>
            {user.name?.charAt(0).toUpperCase()}
          </div>
          <button
            onClick={handleLogout}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#fca5a5', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
          >
            <LogOut size={14} /> Sair
          </button>
        </div>
      </header>

      <main style={{ flex: 1, padding: '2rem', maxWidth: 1400, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <WarehouseModule />
      </main>
    </div>
  );
}

// ─── APP FINANCEIRO (/) ───────────────────────────────────────────────────────
function FinanceApp() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      const parsedUser = JSON.parse(savedUser);
      // Se usuário é só WAREHOUSE, redireciona para /almox
      if (parsedUser.module === 'WAREHOUSE') {
        window.location.href = '/almox';
        return;
      }
      setUser(parsedUser);
      const tutorialPref = localStorage.getItem('showTutorial');
      if (tutorialPref !== 'false') setShowTutorial(true);
    }
    setAuthChecked(true);
  }, []);

  const handleLogin = (userData) => {
    // Se usuário é só WAREHOUSE, redireciona
    if (userData.module === 'WAREHOUSE') {
      window.location.href = '/almox';
      return;
    }
    setUser(userData);
    const tutorialPref = localStorage.getItem('showTutorial');
    if (tutorialPref !== 'false') setShowTutorial(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setCurrentView('dashboard');
  };

  if (!authChecked) return null;
  if (!user) return <Login onLogin={handleLogin} />;

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':  return <Dashboard />;
      case 'expenses':   return <Expenses />;
      case 'pending':    return <Pending />;
      case 'receivable': return <Receivable />;
      case 'calendar':   return <CalendarView />;
      case 'reports':    return <Reports />;
      case 'personal':   return <PersonalFinance />;
      case 'settings':   return <Settings />;
      default:           return <Dashboard />;
    }
  };

  const getPageTitle = () => {
    switch (currentView) {
      case 'dashboard':  return 'Painel Financeiro e Fluxo de Caixa';
      case 'expenses':   return 'Histórico de Despesas';
      case 'pending':    return 'Contas a Pagar';
      case 'receivable': return 'Contas a Receber';
      case 'calendar':   return 'Calendário Financeiro';
      case 'reports':    return 'Relatórios Financeiros';
      case 'personal':   return 'Finanças Pessoais';
      case 'settings':   return 'Configurações do Sistema';
      default:           return 'Painel Financeiro';
    }
  };

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div id="tutorial-sidebar-header" className="sidebar-header">
          <div className="icon-bg blue" style={{ width: 32, height: 32, borderRadius: 8 }}>
            <Wallet size={18} />
          </div>
          <span className="brand-title">Magalhaes Inteligencia</span>
        </div>

        <nav id="tutorial-sidebar-nav" className="sidebar-nav">
          <button className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`} onClick={() => setCurrentView('dashboard')}>
            <LayoutDashboard size={20} /> Visão Geral
          </button>

          <div style={{ padding: '0.5rem 1rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginTop: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Transações
          </div>
          <button data-nav="pending" className={`nav-item ${currentView === 'pending' ? 'active' : ''}`} onClick={() => setCurrentView('pending')}>
            <Clock size={20} /> Contas a Pagar
          </button>
          <button data-nav="receivable" className={`nav-item ${currentView === 'receivable' ? 'active' : ''}`} onClick={() => setCurrentView('receivable')}>
            <ArrowRightLeft size={20} /> Contas a Receber
          </button>
          <button data-nav="expenses" className={`nav-item ${currentView === 'expenses' ? 'active' : ''}`} onClick={() => setCurrentView('expenses')}>
            <Receipt size={20} /> Histórico Pago
          </button>

          <div style={{ padding: '0.5rem 1rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginTop: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Planejamento
          </div>
          <button data-nav="calendar" className={`nav-item ${currentView === 'calendar' ? 'active' : ''}`} onClick={() => setCurrentView('calendar')}>
            <CalendarDays size={20} /> Calendário
          </button>
          <button data-nav="reports" className={`nav-item ${currentView === 'reports' ? 'active' : ''}`} onClick={() => setCurrentView('reports')}>
            <FileBarChart2 size={20} /> Relatórios
          </button>

          {/* Separador PF */}
          <div style={{ margin: '0.5rem 1rem', borderTop: '1px solid var(--border-color)' }} />
          <div style={{ padding: '0 1rem 0.5rem', fontSize: '0.7rem', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.8rem' }}>👤</span> Pessoal (PF)
          </div>
          <button data-nav="personal" className={`nav-item ${currentView === 'personal' ? 'active' : ''}`} onClick={() => setCurrentView('personal')} style={{ color: currentView === 'personal' ? 'white' : '#7c3aed', background: currentView === 'personal' ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : 'rgba(124,58,237,0.08)', fontWeight: 600 }}>
            <User size={20} /> Finanças Pessoais
          </button>

          {/* Link para almoxarifado (só ADMIN vê) */}
          {user.module === 'ADMIN' && (
            <>
              <div style={{ margin: '0.5rem 1rem', borderTop: '1px solid var(--border-color)' }} />
              <a href="/almox" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.75rem 1rem', borderRadius: 8, color: '#d97706', background: 'rgba(217,119,6,0.08)', fontWeight: 600, fontSize: '0.875rem', textDecoration: 'none', transition: 'all 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(217,119,6,0.15)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(217,119,6,0.08)'}
              >
                <Package size={20} /> Almoxarifado ↗
              </a>
            </>
          )}

          <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <button data-nav="settings" className={`nav-item ${currentView === 'settings' ? 'active' : ''}`} onClick={() => setCurrentView('settings')}>
              <SettingsIcon size={20} /> Configurações
            </button>
            <button className="nav-item" style={{ color: 'var(--danger)' }} onClick={handleLogout}>
              <LogOut size={20} /> Sair
            </button>
          </div>
        </nav>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)', fontWeight: 600 }}>{getPageTitle()}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <Notifications onNavigate={setCurrentView} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '1px solid var(--border-color)', paddingLeft: '1.5rem' }}>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>{user.name}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user.email}</p>
              </div>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, var(--brand-blue), #1d3080)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.875rem' }}>
                {user.name?.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <div className="page-content">
          {renderView()}
        </div>
      </main>

      {showTutorial && (
        <Tutorial onNavigate={setCurrentView} onFinish={() => setShowTutorial(false)} />
      )}
    </div>
  );
}

// ─── ROTEADOR PRINCIPAL ───────────────────────────────────────────────────────
function App() {
  if (isWarehouseRoute()) return <WarehouseApp />;
  return <FinanceApp />;
}

export default App;
