import { useState, useEffect, lazy, Suspense } from 'react';
import {
  LayoutDashboard, Receipt, Clock, Wallet,
  Settings as SettingsIcon, LogOut, ArrowRightLeft,
  CalendarDays, FileBarChart2, User, Package, Building2,
  Sun, Moon, Menu, X, MoreHorizontal
} from 'lucide-react';
import Login from './components/Login';
import Notifications from './components/Notifications';
import Tutorial from './components/Tutorial';
import { authFetch, apiLogout } from './config';

// Telas carregadas sob demanda — reduz o bundle inicial (recharts, jsPDF, etc.
// só chegam ao navegador quando a tela correspondente é aberta).
const Reports = lazy(() => import('./components/Reports'));
const PersonalFinance = lazy(() => import('./components/PersonalFinance'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const Expenses = lazy(() => import('./components/Expenses'));
const Pending = lazy(() => import('./components/Pending'));
const Receivable = lazy(() => import('./components/Receivable'));
const CalendarView = lazy(() => import('./components/CalendarView'));
const Settings = lazy(() => import('./components/Settings'));
const WarehouseModule = lazy(() => import('./components/Warehouse'));

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const navigateTo = (view) => {
    setCurrentView(view);
    setMobileMenuOpen(false);
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

  const handleLogout = async () => {
    await apiLogout();
    setUser(null);
    setCurrentView('dashboard');
    setMobileMenuOpen(false);
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
      case 'dashboard':  return 'Visão Geral & Fluxo';
      case 'calendar':   return 'Agenda Diária';
      case 'pending':    return 'Contas a Pagar';
      case 'receivable': return 'Contas a Receber';
      case 'expenses':   return 'Extrato & Histórico';
      case 'reports':    return 'Relatórios & DRE';
      case 'personal':   return 'Finanças PF';
      case 'settings':   return 'Configurações';
      case 'warehouse':  return 'Almoxarifado';
      default:           return 'Painel Financeiro';
    }
  };

  return (
    <div className="app-container">
      {/* Overlay translúcido para fechar drawer no mobile */}
      <div 
        className={`mobile-drawer-overlay ${mobileMenuOpen ? 'active' : ''}`}
        onClick={() => setMobileMenuOpen(false)} 
      />

      <aside className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div id="tutorial-sidebar-header" className="sidebar-header" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--brand-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}>
              <Wallet size={20} color="#ffffff" />
            </div>
            <div>
              <span className="brand-title">Magalhães</span>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Gestão Financeira</div>
            </div>
          </div>
          
          {/* Botão de Fechar Drawer em Mobile */}
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="mobile-menu-btn"
            style={{ display: mobileMenuOpen ? 'inline-flex' : 'none', width: 34, height: 34, minWidth: 34, minHeight: 34 }}
          >
            <X size={18} />
          </button>
        </div>

        <nav id="tutorial-sidebar-nav" className="sidebar-nav">
          {user.module !== 'WAREHOUSE' && (
            <>
              <button className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`} onClick={() => navigateTo('dashboard')}>
                <LayoutDashboard size={18} /> Visão Geral
              </button>

              <button data-nav="calendar" className={`nav-item ${currentView === 'calendar' ? 'active' : ''}`} onClick={() => navigateTo('calendar')}>
                <CalendarDays size={18} /> 📅 Agenda Diária
              </button>

              <div style={{ padding: '0.6rem 0.85rem 0.25rem', fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-dim)', marginTop: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Operação Financeira
              </div>
              <button data-nav="pending" className={`nav-item ${currentView === 'pending' ? 'active' : ''}`} onClick={() => navigateTo('pending')}>
                <Clock size={18} /> Contas a Pagar (Boletos)
              </button>
              <button data-nav="receivable" className={`nav-item ${currentView === 'receivable' ? 'active' : ''}`} onClick={() => navigateTo('receivable')}>
                <ArrowRightLeft size={18} /> Contas a Receber
              </button>
              <button data-nav="expenses" className={`nav-item ${currentView === 'expenses' ? 'active' : ''}`} onClick={() => navigateTo('expenses')}>
                <Receipt size={18} /> Extrato & Histórico
              </button>

              <div style={{ padding: '0.6rem 0.85rem 0.25rem', fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-dim)', marginTop: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Inteligência
              </div>
              <button data-nav="reports" className={`nav-item ${currentView === 'reports' ? 'active' : ''}`} onClick={() => navigateTo('reports')}>
                <FileBarChart2 size={18} /> Relatórios & DRE
              </button>

              <div style={{ margin: '0.5rem 0.5rem', borderTop: '1px solid var(--border-color)' }} />
              <div style={{ padding: '0 0.85rem 0.25rem', fontSize: '0.68rem', fontWeight: 800, color: 'var(--brand-purple)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>👤</span> Finanças PF
              </div>
              <button 
                data-nav="personal" 
                className={`nav-item ${currentView === 'personal' ? 'active' : ''}`} 
                onClick={() => navigateTo('personal')} 
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
                onClick={() => navigateTo('warehouse')}
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
              <button data-nav="settings" className={`nav-item ${currentView === 'settings' ? 'active' : ''}`} onClick={() => navigateTo('settings')}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {/* Hamburger Button para Mobile */}
            <button 
              className="mobile-menu-btn"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir Menu"
            >
              <Menu size={20} />
            </button>
            <h2 style={{ fontSize: '1.2rem', color: 'var(--text-main)', fontWeight: 800, margin: 0 }}>{getPageTitle()}</h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'nowrap' }}>
            {/* Seletor Global de Unidade de Negócio / Empresa */}
            {user.module !== 'WAREHOUSE' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-card)', padding: '5px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-xs)' }}>
                <Building2 size={15} color="var(--brand-blue)" />
                <select 
                  value={selectedCompanyId} 
                  onChange={e => setSelectedCompanyId(e.target.value)} 
                  style={{ border: 'none', background: 'transparent', fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-main)', cursor: 'pointer', outline: 'none', padding: 0, maxWidth: '110px' }}
                >
                  <option value="all">🏢 Todas</option>
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
                minWidth: 36,
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

            {user.module !== 'WAREHOUSE' && <Notifications onNavigate={navigateTo} />}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', borderLeft: '1px solid var(--border-color)', paddingLeft: '0.65rem' }}>
              <div style={{ textAlign: 'right', display: 'none' /* Oculto em mobile via classes se preferir, ou mini */ }}>
                <p style={{ fontSize: '0.8rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>{user.name?.split(' ')[0]}</p>
              </div>
              <div 
                onClick={() => setMobileMenuOpen(true)}
                style={{ width: 34, height: 34, minWidth: 34, borderRadius: '50%', background: 'var(--brand-gradient)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.85rem', boxShadow: '0 2px 8px rgba(37,99,235,0.3)', cursor: 'pointer' }}
                title={`Usuário: ${user.name}`}
              >
                {user.name?.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <div className="page-content">
          <Suspense fallback={<div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>Carregando módulo…</div>}>
            {renderView()}
          </Suspense>
        </div>
      </main>

      {/* ─── BOTTOM NAVIGATION BAR (THUMB ZONE ERGONOMICS) ────────────────── */}
      {user.module !== 'WAREHOUSE' ? (
        <nav className="mobile-bottom-nav">
          <button 
            className={`mobile-nav-btn ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => navigateTo('dashboard')}
          >
            <LayoutDashboard size={20} />
            <span>Visão Geral</span>
          </button>

          <button 
            className={`mobile-nav-btn ${currentView === 'pending' ? 'active' : ''}`}
            onClick={() => navigateTo('pending')}
          >
            <Clock size={20} />
            <span>Pagar</span>
          </button>

          <button 
            className={`mobile-nav-btn ${currentView === 'receivable' ? 'active' : ''}`}
            onClick={() => navigateTo('receivable')}
          >
            <ArrowRightLeft size={20} />
            <span>Receber</span>
          </button>

          <button 
            className={`mobile-nav-btn ${currentView === 'calendar' ? 'active' : ''}`}
            onClick={() => navigateTo('calendar')}
          >
            <CalendarDays size={20} />
            <span>Agenda</span>
          </button>

          <button 
            className={`mobile-nav-btn ${mobileMenuOpen ? 'active' : ''}`}
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu size={20} />
            <span>Mais</span>
          </button>
        </nav>
      ) : (
        <nav className="mobile-bottom-nav" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <button 
            className={`mobile-nav-btn ${currentView === 'warehouse' ? 'active' : ''}`}
            onClick={() => navigateTo('warehouse')}
          >
            <Package size={20} />
            <span>Almoxarifado</span>
          </button>
          <button 
            className="mobile-nav-btn"
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <Sun size={20} color="#fbbf24" /> : <Moon size={20} color="#3b82f6" />}
            <span>Tema</span>
          </button>
          <button 
            className="mobile-nav-btn"
            style={{ color: 'var(--danger)' }}
            onClick={handleLogout}
          >
            <LogOut size={20} />
            <span>Sair</span>
          </button>
        </nav>
      )}

      {showTutorial && user.module !== 'WAREHOUSE' && (
        <Tutorial onNavigate={navigateTo} onFinish={() => setShowTutorial(false)} />
      )}
    </div>
  );
}

export default App;


