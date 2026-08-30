import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Receipt, Clock, Wallet,
  Settings as SettingsIcon, LogOut, ArrowRightLeft,
  CalendarDays, FileBarChart2, User, Package, Building2,
  Sun, Moon
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
import { authFetch } from './config';

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  // Tema Dark / Light
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('magalhaes_theme');
    if (saved) return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('magalhaes_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Unidades de Negócio / Empresas
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('all');

  const fetchCompanies = async () => {
    try {
      const res = await authFetch('/api/companies');
      if (res.ok) {
        setCompanies(await res.json());
      }
    } catch (e) {
      console.error('Erro ao carregar unidades:', e);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      if (parsedUser.module === 'WAREHOUSE') {
        setCurrentView('warehouse');
      }
      fetchCompanies();
      const tutorialPref = localStorage.getItem('showTutorial');
      if (tutorialPref !== 'false') setShowTutorial(true);
    }
    setAuthChecked(true);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    if (userData.module === 'WAREHOUSE') {
      setCurrentView('warehouse');
    }
    fetchCompanies();
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
      case 'dashboard':  return <Dashboard selectedCompanyId={selectedCompanyId} companies={companies} theme={theme} />;
      case 'expenses':   return <Expenses selectedCompanyId={selectedCompanyId} companies={companies} theme={theme} />;
      case 'pending':    return <Pending selectedCompanyId={selectedCompanyId} companies={companies} theme={theme} />;
      case 'receivable': return <Receivable selectedCompanyId={selectedCompanyId} companies={companies} theme={theme} />;
      case 'calendar':   return <CalendarView selectedCompanyId={selectedCompanyId} companies={companies} theme={theme} />;
      case 'reports':    return <Reports selectedCompanyId={selectedCompanyId} companies={companies} theme={theme} />;
      case 'personal':   return <PersonalFinance theme={theme} />;
      case 'settings':   return <Settings theme={theme} />;
      case 'warehouse':  return <WarehouseModule theme={theme} />;
      default:           return <Dashboard selectedCompanyId={selectedCompanyId} companies={companies} theme={theme} />;
    }
  };

  const getPageTitle = () => {
    switch (currentView) {
      case 'dashboard':  return 'Visão Geral & Fluxo de Caixa';
      case 'calendar':   return 'Agenda & Calendário Diário';
      case 'pending':    return 'Contas a Pagar & Boletos';
      case 'receivable': return 'Contas a Receber & Vendas';
      case 'expenses':   return 'Extrato & Histórico Pago';
      case 'reports':    return 'Relatórios & DRE Financeiro';
      case 'personal':   return 'Finanças Pessoais (PF)';
      case 'settings':   return 'Configurações do Sistema';
      case 'warehouse':  return 'Controle de Almoxarifado';
      default:           return 'Painel Financeiro';
    }
  };

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div id="tutorial-sidebar-header" className="sidebar-header">
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--brand-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}>
            <Wallet size={20} color="#ffffff" />
          </div>
          <div>
            <span className="brand-title">Magalhães</span>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Gestão Financeira</div>
          </div>
        </div>

        <nav id="tutorial-sidebar-nav" className="sidebar-nav">
          {user.module !== 'WAREHOUSE' && (
            <>
              <button className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`} onClick={() => setCurrentView('dashboard')}>
                <LayoutDashboard size={18} /> Visão Geral
              </button>

              <button data-nav="calendar" className={`nav-item ${currentView === 'calendar' ? 'active' : ''}`} onClick={() => setCurrentView('calendar')}>
                <CalendarDays size={18} /> 📅 Agenda Diária
              </button>

              <div style={{ padding: '0.6rem 0.85rem 0.25rem', fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-dim)', marginTop: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Operação Financeira
              </div>
              <button data-nav="pending" className={`nav-item ${currentView === 'pending' ? 'active' : ''}`} onClick={() => setCurrentView('pending')}>
                <Clock size={18} /> Contas a Pagar (Boletos)
              </button>
              <button data-nav="receivable" className={`nav-item ${currentView === 'receivable' ? 'active' : ''}`} onClick={() => setCurrentView('receivable')}>
                <ArrowRightLeft size={18} /> Contas a Receber
              </button>
              <button data-nav="expenses" className={`nav-item ${currentView === 'expenses' ? 'active' : ''}`} onClick={() => setCurrentView('expenses')}>
                <Receipt size={18} /> Extrato & Histórico
              </button>

              <div style={{ padding: '0.6rem 0.85rem 0.25rem', fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-dim)', marginTop: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Inteligência
              </div>
              <button data-nav="reports" className={`nav-item ${currentView === 'reports' ? 'active' : ''}`} onClick={() => setCurrentView('reports')}>
                <FileBarChart2 size={18} /> Relatórios & DRE
              </button>

              <div style={{ margin: '0.5rem 0.5rem', borderTop: '1px solid var(--border-color)' }} />
              <div style={{ padding: '0 0.85rem 0.25rem', fontSize: '0.68rem', fontWeight: 800, color: 'var(--brand-purple)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>👤</span> Finanças PF
              </div>
              <button 
                data-nav="personal" 
                className={`nav-item ${currentView === 'personal' ? 'active' : ''}`} 
                onClick={() => setCurrentView('personal')} 
                style={{ 
                  color: currentView === 'personal' ? '#ffffff' : 'var(--brand-purple)', 
                  background: currentView === 'personal' ? 'var(--brand-purple-gradient)' : 'rgba(124,58,237,0.08)', 
                  fontWeight: 600,
                  borderColor: currentView === 'personal' ? 'transparent' : 'rgba(124,58,237,0.2)'
                }}
              >
                <User size={18} /> Finanças Pessoais
              </button>
            </>
          )}

          {(user.role === 'ADMIN' || user.module === 'ADMIN' || !user.module || user.module === 'WAREHOUSE') && (
            <>
              <div style={{ margin: '0.5rem 0.5rem', borderTop: '1px solid var(--border-color)' }} />
              <div style={{ padding: '0 0.85rem 0.25rem', fontSize: '0.68rem', fontWeight: 800, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>📦</span> Operação Estoque
              </div>
              <button 
                className={`nav-item ${currentView === 'warehouse' ? 'active' : ''}`} 
                onClick={() => setCurrentView('warehouse')}
                style={{ 
                  color: currentView === 'warehouse' ? '#ffffff' : '#d97706',
                  background: currentView === 'warehouse' ? 'linear-gradient(135deg, #d97706, #b45309)' : 'rgba(217,119,6,0.08)',
                  fontWeight: 600,
                  borderColor: currentView === 'warehouse' ? 'transparent' : 'rgba(217,119,6,0.2)'
                }}
              >
                <Package size={18} /> Almoxarifado
              </button>
            </>
          )}

          <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
            {user.module !== 'WAREHOUSE' && (
              <button data-nav="settings" className={`nav-item ${currentView === 'settings' ? 'active' : ''}`} onClick={() => setCurrentView('settings')}>
                <SettingsIcon size={18} /> Configurações
              </button>
            )}
            <button className="nav-item" style={{ color: 'var(--danger)' }} onClick={handleLogout}>
              <LogOut size={18} /> Sair do Sistema
            </button>
          </div>
        </nav>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <h2 style={{ fontSize: '1.2rem', color: 'var(--text-main)', fontWeight: 800, margin: 0 }}>{getPageTitle()}</h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
            {/* Seletor Global de Unidade de Negócio / Empresa */}
            {user.module !== 'WAREHOUSE' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', padding: '5px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-xs)' }}>
                <Building2 size={16} color="var(--brand-blue)" />
                <select 
                  value={selectedCompanyId} 
                  onChange={e => setSelectedCompanyId(e.target.value)} 
                  style={{ border: 'none', background: 'transparent', fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-main)', cursor: 'pointer', outline: 'none', padding: 0 }}
                >
                  <option value="all">🏢 Todas as Unidades</option>
                  {companies.map(c => <option key={c.id} value={c.id}>🏢 {c.name}</option>)}
                </select>
              </div>
            )}

            {/* Alternador de Tema Dark / Light */}
            <button
              onClick={toggleTheme}
              style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: 'var(--shadow-xs)'
              }}
              title={theme === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
            >
              {theme === 'dark' ? <Sun size={17} color="#fbbf24" /> : <Moon size={17} color="#3b82f6" />}
            </button>

            {user.module !== 'WAREHOUSE' && <Notifications onNavigate={setCurrentView} />}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderLeft: '1px solid var(--border-color)', paddingLeft: '0.85rem' }}>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '0.82rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>{user.name}</p>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>{user.module === 'WAREHOUSE' ? 'Almoxarifado' : 'Administrador'}</p>
              </div>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--brand-gradient)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.85rem', boxShadow: '0 2px 8px rgba(37,99,235,0.3)' }}>
                {user.name?.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <div className="page-content">
          {renderView()}
        </div>
      </main>

      {showTutorial && user.module !== 'WAREHOUSE' && (
        <Tutorial onNavigate={setCurrentView} onFinish={() => setShowTutorial(false)} />
      )}
    </div>
  );
}

export default App;

