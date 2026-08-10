import { useState, useEffect } from 'react';
import { LayoutDashboard, Receipt, Clock, Wallet, Settings as SettingsIcon, LogOut, ArrowRightLeft, CalendarDays, FileBarChart2, User } from 'lucide-react';
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


function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  // Checa se já existe token salvo no navegador
  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
      // Exibe tutorial se preferência não foi desativada
      const tutorialPref = localStorage.getItem('showTutorial');
      if (tutorialPref !== 'false') {
        setShowTutorial(true);
      }
    }
    setAuthChecked(true);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    // Mostra tutorial se o usuário ainda não desativou
    const tutorialPref = localStorage.getItem('showTutorial');
    if (tutorialPref !== 'false') {
      setShowTutorial(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setCurrentView('dashboard');
  };

  // Aguarda checar o token antes de renderizar
  if (!authChecked) return null;

  // Exibe tela de login se não autenticado
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
            <Clock size={20} /> A Pagar
          </button>
          <button data-nav="receivable" className={`nav-item ${currentView === 'receivable' ? 'active' : ''}`} onClick={() => setCurrentView('receivable')}>
            <ArrowRightLeft size={20} /> A Receber
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

export default App;
