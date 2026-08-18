import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Receipt, Clock, Wallet,
  Settings as SettingsIcon, LogOut, ArrowRightLeft,
  CalendarDays, FileBarChart2, User, Package, Building2
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
      case 'dashboard':  return <Dashboard selectedCompanyId={selectedCompanyId} companies={companies} />;
      case 'expenses':   return <Expenses selectedCompanyId={selectedCompanyId} companies={companies} />;
      case 'pending':    return <Pending selectedCompanyId={selectedCompanyId} companies={companies} />;
      case 'receivable': return <Receivable selectedCompanyId={selectedCompanyId} companies={companies} />;
      case 'calendar':   return <CalendarView selectedCompanyId={selectedCompanyId} companies={companies} />;
      case 'reports':    return <Reports selectedCompanyId={selectedCompanyId} companies={companies} />;
      case 'personal':   return <PersonalFinance />;
      case 'settings':   return <Settings />;
      case 'warehouse':  return <WarehouseModule />;
      default:           return <Dashboard selectedCompanyId={selectedCompanyId} companies={companies} />;
    }
  };

  const getPageTitle = () => {
    switch (currentView) {
      case 'dashboard':  return 'Visão Geral & Fluxo de Caixa';
      case 'calendar':   return 'Agenda & Calendário Diário';
      case 'pending':    return 'Contas a Pagar & Boletos de Fornecedores';
      case 'receivable': return 'Contas a Receber & Vendas de Peças';
      case 'expenses':   return 'Extrato & Histórico de Pagamentos';
      case 'reports':    return 'Relatórios Financeiros';
      case 'personal':   return 'Finanças Pessoais';
      case 'settings':   return 'Configurações do Sistema';
      case 'warehouse':  return 'Controle de Almoxarifado';
      default:           return 'Painel Financeiro';
    }
  };

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div id="tutorial-sidebar-header" className="sidebar-header">
          <div className="icon-bg blue" style={{ width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Wallet size={18} />
          </div>
          <span className="brand-title">Magalhães</span>
        </div>

        <nav id="tutorial-sidebar-nav" className="sidebar-nav">
          {user.module !== 'WAREHOUSE' && (
            <>
              <button className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`} onClick={() => setCurrentView('dashboard')}>
                <LayoutDashboard size={20} /> Visão Geral
              </button>

              <button data-nav="calendar" className={`nav-item ${currentView === 'calendar' ? 'active' : ''}`} onClick={() => setCurrentView('calendar')}>
                <CalendarDays size={20} /> 📅 Agenda & Calendário
              </button>

              <div style={{ padding: '0.5rem 1rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginTop: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Gestão de Contas & Boletos
              </div>
              <button data-nav="pending" className={`nav-item ${currentView === 'pending' ? 'active' : ''}`} onClick={() => setCurrentView('pending')}>
                <Clock size={20} /> Contas a Pagar (Boletos)
              </button>
              <button data-nav="receivable" className={`nav-item ${currentView === 'receivable' ? 'active' : ''}`} onClick={() => setCurrentView('receivable')}>
                <ArrowRightLeft size={20} /> Contas a Receber
              </button>
              <button data-nav="expenses" className={`nav-item ${currentView === 'expenses' ? 'active' : ''}`} onClick={() => setCurrentView('expenses')}>
                <Receipt size={20} /> Extrato & Histórico Pago
              </button>

              <div style={{ padding: '0.5rem 1rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginTop: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Análise
              </div>
              <button data-nav="reports" className={`nav-item ${currentView === 'reports' ? 'active' : ''}`} onClick={() => setCurrentView('reports')}>
                <FileBarChart2 size={20} /> Relatórios Financeiros
              </button>

              <div style={{ margin: '0.5rem 1rem', borderTop: '1px solid var(--border-color)' }} />
              <div style={{ padding: '0 1rem 0.5rem', fontSize: '0.7rem', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.8rem' }}>👤</span> Pessoal (PF)
              </div>
              <button data-nav="personal" className={`nav-item ${currentView === 'personal' ? 'active' : ''}`} onClick={() => setCurrentView('personal')} style={{ color: currentView === 'personal' ? 'white' : '#7c3aed', background: currentView === 'personal' ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : 'rgba(124,58,237,0.08)', fontWeight: 600 }}>
                <User size={20} /> Finanças Pessoais
              </button>
            </>
          )}

          {(user.role === 'ADMIN' || user.module === 'ADMIN' || !user.module || user.module === 'WAREHOUSE') && (
            <>
              <div style={{ margin: '0.5rem 1rem', borderTop: '1px solid var(--border-color)' }} />
              <div style={{ padding: '0 1rem 0.5rem', fontSize: '0.7rem', fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.8rem' }}>📦</span> Estoque
              </div>
              <button 
                className={`nav-item ${currentView === 'warehouse' ? 'active' : ''}`} 
                onClick={() => setCurrentView('warehouse')}
                style={{ 
                  color: currentView === 'warehouse' ? 'white' : '#d97706',
                  background: currentView === 'warehouse' ? 'linear-gradient(135deg, #d97706, #b45309)' : 'rgba(217,119,6,0.08)',
                  fontWeight: 600 
                }}
              >
                <Package size={20} /> Almoxarifado
              </button>
            </>
          )}

          <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            {user.module !== 'WAREHOUSE' && (
              <button data-nav="settings" className={`nav-item ${currentView === 'settings' ? 'active' : ''}`} onClick={() => setCurrentView('settings')}>
                <SettingsIcon size={20} /> Configurações
              </button>
            )}
            <button className="nav-item" style={{ color: 'var(--danger)' }} onClick={handleLogout}>
              <LogOut size={20} /> Sair
            </button>
          </div>
        </nav>
      </aside>

      <main className="main-content">
        <header className="topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)', fontWeight: 700, margin: 0 }}>{getPageTitle()}</h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            {/* Seletor Global de Unidade de Negócio / Empresa */}
            {user.module !== 'WAREHOUSE' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', padding: '6px 14px', borderRadius: 10, border: '1px solid #cbd5e1', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <Building2 size={16} color="#243b9d" />
                <select 
                  value={selectedCompanyId} 
                  onChange={e => setSelectedCompanyId(e.target.value)} 
                  style={{ border: 'none', background: 'transparent', fontWeight: 700, fontSize: '0.85rem', color: '#1e293b', cursor: 'pointer', outline: 'none' }}
                >
                  <option value="all">🏢 Todas as Unidades / Empresas</option>
                  {companies.map(c => <option key={c.id} value={c.id}>🏢 {c.name}</option>)}
                </select>
              </div>
            )}

            {user.module !== 'WAREHOUSE' && <Notifications onNavigate={setCurrentView} />}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderLeft: '1px solid var(--border-color)', paddingLeft: '1.25rem' }}>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>{user.name}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{user.module === 'WAREHOUSE' ? 'Almoxarifado' : 'Administrador'}</p>
              </div>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg, var(--brand-blue), #1d3080)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.85rem', boxShadow: '0 2px 6px rgba(36,59,157,0.25)' }}>
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
