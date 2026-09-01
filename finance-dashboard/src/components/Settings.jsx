import { useState, useEffect } from 'react';
import { Plus, Tag, Users, Archive, Trash2, X, BookOpen, GraduationCap, ShieldCheck, KeyRound, UserPlus, Eye, EyeOff, FileClock, DatabaseBackup, Download, RefreshCw, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { authFetch } from '../config';
import { formatDoc } from '../utils';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('categorias');
  const [categories, setCategories] = useState([]);
  const [entities, setEntities] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tutorialEnabled, setTutorialEnabled] = useState(
    localStorage.getItem('showTutorial') !== 'false'
  );

  // Dados do usuário logado (para verificar se é ADMIN)
  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
  })();
  const isAdmin = currentUser.module === 'ADMIN' || currentUser.role === 'ADMIN';

  // Formulários
  const [catModal, setCatModal] = useState(false);
  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState('OUT');
  const [catColor, setCatColor] = useState('#243b9d');

  const [entModal, setEntModal] = useState(false);
  const [entName, setEntName] = useState('');
  const [entDoc, setEntDoc] = useState('');
  const [entType, setEntType] = useState('SUPPLIER');

  const [compModal, setCompModal] = useState(false);
  const [compName, setCompName] = useState('');
  const [compDoc, setCompDoc] = useState('');

  const [bankModal, setBankModal] = useState(false);
  const [bankName, setBankName] = useState('');
  const [bankAgency, setBankAgency] = useState('');
  const [bankAcc, setBankAcc] = useState('');

  // ─── Gerenciamento de Usuários ─────────────────────────────────────
  const [userList, setUserList] = useState([]);
  const [userLoading, setUserLoading] = useState(false);
  const [userMsg, setUserMsg] = useState(null); // { type: 'success'|'error', text }

  // Modal: Novo Usuário
  const [newUserModal, setNewUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserModule, setNewUserModule] = useState('FINANCE');
  const [showNewPwd, setShowNewPwd] = useState(false);

  // Modal: Alterar Módulo
  const [moduleModal, setModuleModal] = useState(null); // user objeto
  const [moduleSelected, setModuleSelected] = useState('FINANCE');

  // Modal: Trocar Senha
  const [pwdModal, setPwdModal] = useState(null); // user objeto
  const [pwdValue, setPwdValue] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  const showUserMsg = (type, text) => {
    setUserMsg({ type, text });
    setTimeout(() => setUserMsg(null), 4000);
  };

  const fetchUsers = async () => {
    setUserLoading(true);
    try {
      const res = await authFetch('/api/auth/users');
      if (res.ok) setUserList(await res.json());
    } catch (e) { console.error(e); }
    finally { setUserLoading(false); }
  };

  const createUser = async (e) => {
    e.preventDefault();
    try {
      const res = await authFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: newUserName, email: newUserEmail, password: newUserPassword, module: newUserModule }),
      });
      const data = await res.json();
      if (!res.ok) { showUserMsg('error', data.error || 'Erro ao criar usuário.'); return; }
      showUserMsg('success', 'Usuário criado com sucesso!');
      setNewUserModal(false);
      setNewUserName(''); setNewUserEmail(''); setNewUserPassword(''); setNewUserModule('FINANCE');
      fetchUsers();
    } catch { showUserMsg('error', 'Erro de conexão.'); }
  };

  const updateModule = async () => {
    if (!moduleModal) return;
    try {
      const res = await authFetch(`/api/auth/users/${moduleModal.id}/module`, {
        method: 'PATCH',
        body: JSON.stringify({ module: moduleSelected }),
      });
      const data = await res.json();
      if (!res.ok) { showUserMsg('error', data.error || 'Erro ao alterar módulo.'); return; }
      showUserMsg('success', 'Módulo atualizado com sucesso!');
      setModuleModal(null);
      fetchUsers();
    } catch { showUserMsg('error', 'Erro de conexão.'); }
  };

  const updatePassword = async () => {
    if (!pwdModal) return;
    try {
      const res = await authFetch(`/api/auth/users/${pwdModal.id}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ newPassword: pwdValue }),
      });
      const data = await res.json();
      if (!res.ok) { showUserMsg('error', data.error || 'Erro ao alterar senha.'); return; }
      showUserMsg('success', 'Senha alterada com sucesso!');
      setPwdModal(null); setPwdValue('');
    } catch { showUserMsg('error', 'Erro de conexão.'); }
  };

  const deleteUser = async (usr) => {
    if (!confirm(`Excluir o usuário "${usr.name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      const res = await authFetch(`/api/auth/users/${usr.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { showUserMsg('error', data.error || 'Erro ao excluir.'); return; }
      showUserMsg('success', 'Usuário excluído.');
      fetchUsers();
    } catch { showUserMsg('error', 'Erro de conexão.'); }
  };

  // ─── Logs do Sistema & Backup (apenas ADMIN) ──────────────────────
  const [logs, setLogs] = useState({ data: [], total: 0, page: 1, totalPages: 1 });
  const [logsMeta, setLogsMeta] = useState({ entityTypes: [], actions: [], total: 0, lastEntryAt: null });
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilters, setLogFilters] = useState({ entityType: '', action: '', search: '', from: '', to: '' });
  const [logDetail, setLogDetail] = useState(null); // registro de log aberto no modal
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupMsg, setBackupMsg] = useState(null); // { type, text }

  const showBackupMsg = (type, text) => {
    setBackupMsg({ type, text });
    setTimeout(() => setBackupMsg(null), 5000);
  };

  const fetchLogsMeta = async () => {
    try {
      const res = await authFetch('/api/admin/logs/meta');
      if (res.ok) setLogsMeta(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchLogs = async (page = 1, override) => {
    const f = override || logFilters;
    setLogsLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), limit: '30' });
      if (f.entityType) p.set('entityType', f.entityType);
      if (f.action) p.set('action', f.action);
      if (f.search) p.set('search', f.search);
      if (f.from) p.set('from', f.from);
      if (f.to) p.set('to', f.to);
      const res = await authFetch(`/api/admin/logs?${p.toString()}`);
      if (res.ok) setLogs(await res.json());
    } catch (e) { console.error(e); }
    finally { setLogsLoading(false); }
  };

  const downloadBackup = async () => {
    setBackupLoading(true);
    try {
      const res = await authFetch('/api/admin/backup');
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        showBackupMsg('error', d.error || 'Não foi possível gerar o backup.');
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const m = cd.match(/filename="?([^"]+)"?/);
      const name = m ? m[1] : `backup-magalhaes-${new Date().toISOString().slice(0, 10)}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showBackupMsg('success', `Backup gerado: ${name} (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
    } catch {
      showBackupMsg('error', 'Erro de conexão ao gerar o backup.');
    } finally {
      setBackupLoading(false);
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [catRes, entRes, compRes, bankRes] = await Promise.all([
        authFetch('/api/categories'),
        authFetch('/api/entities'),
        authFetch('/api/companies'),
        authFetch('/api/bank-accounts'),
      ]);
      setCategories(await catRes.json());
      setEntities(await entRes.json());
      setCompanies(await compRes.json());
      setBankAccounts(await bankRes.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchAll();
    if (isAdmin) fetchUsers();
  }, []);

  // Carrega os logs na primeira vez que a aba de administração é aberta.
  useEffect(() => {
    if (activeTab === 'logs' && isAdmin && logsMeta.entityTypes.length === 0 && logs.data.length === 0) {
      fetchLogsMeta();
      fetchLogs(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isAdmin]);

  const createCategory = async (e) => {
    e.preventDefault();
    await authFetch('/api/categories', {
      method: 'POST',
      body: JSON.stringify({ name: catName, type: catType, color: catColor }),
    });
    setCatName(''); setCatType('OUT'); setCatColor('#243b9d');
    setCatModal(false); fetchAll();
  };

  const deleteCategory = async (id) => {
    if (!confirm('Excluir esta categoria?')) return;
    await authFetch(`/api/categories/${id}`, { method: 'DELETE' });
    fetchAll();
  };

  const createEntity = async (e) => {
    e.preventDefault();
    await authFetch('/api/entities', {
      method: 'POST',
      body: JSON.stringify({ name: entName, document: entDoc, type: entType }),
    });
    setEntName(''); setEntDoc(''); setEntType('SUPPLIER');
    setEntModal(false); fetchAll();
  };

  const deleteEntity = async (id) => {
    if (!confirm('Excluir este registro?')) return;
    await authFetch(`/api/entities/${id}`, { method: 'DELETE' });
    fetchAll();
  };

  const createCompany = async (e) => {
    e.preventDefault();
    await authFetch('/api/companies', {
      method: 'POST', body: JSON.stringify({ name: compName, document: compDoc }),
    });
    setCompName(''); setCompDoc(''); setCompModal(false); fetchAll();
  };
  const deleteCompany = async (id) => {
    if (!confirm('Excluir empresa?')) return;
    await authFetch(`/api/companies/${id}`, { method: 'DELETE' });
    fetchAll();
  };

  const createBank = async (e) => {
    e.preventDefault();
    await authFetch('/api/bank-accounts', {
      method: 'POST', body: JSON.stringify({ name: bankName, agency: bankAgency, account: bankAcc }),
    });
    setBankName(''); setBankAgency(''); setBankAcc(''); setBankModal(false); fetchAll();
  };
  const deleteBank = async (id) => {
    if (!confirm('Excluir conta bancária?')) return;
    await authFetch(`/api/bank-accounts/${id}`, { method: 'DELETE' });
    fetchAll();
  };

  // Cor do "badge" de cada ação no painel de logs.
  const actionStyle = (action = '') => {
    const a = String(action).toUpperCase();
    if (a === 'DELETE' || a.includes('FALHA')) return { background: '#fee2e2', color: '#b91c1c' };
    if (a === 'CREATE' || a === 'LOGIN' || a === 'RESTORE') return { background: '#d1fae5', color: '#065f46' };
    if (a.startsWith('UPDATE') || a.startsWith('ALTERAR') || a === 'PAY' || a === 'ATTACH' || a === 'DEPOSIT') return { background: '#dbeafe', color: '#1d4ed8' };
    if (a === 'BACKUP_DOWNLOAD' || a.includes('SENHA') || a === 'RESET_SENHA') return { background: '#f3e8ff', color: '#7c3aed' };
    if (a.startsWith('ESTOQUE') || a === 'LOGOUT') return { background: '#fef3c7', color: '#b45309' };
    return { background: '#f1f5f9', color: '#475569' };
  };

  const catOut = categories.filter(c => c.type === 'OUT');
  const catIn  = categories.filter(c => c.type === 'IN');
  const suppliers = entities.filter(e => e.type === 'SUPPLIER');
  const clients   = entities.filter(e => e.type === 'CLIENT');

  return (
    <div className="card settings-layout-container">
      {/* Menu lateral de Configurações */}
      <div className="settings-sidebar">
        <h3 style={{ fontSize: '0.75rem', marginBottom: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Cadastros Base</h3>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[
            { key: 'categorias', icon: <Tag size={18} />, label: 'Categorias' },
            { key: 'fornecedores', icon: <Users size={18} />, label: 'Fornecedores e Clientes' },
            { key: 'empresas', icon: <Archive size={18} />, label: 'Empresas / Unidades' },
            { key: 'bancos', icon: <BookOpen size={18} />, label: 'Bancos e Caixas' },
            { key: 'tutorial', icon: <GraduationCap size={18} />, label: 'Tutorial & Ajuda' },
          ].map(({ key, icon, label }) => (
            <button
              key={key}
              id={key === 'categorias' ? 'tutorial-settings-categories' : key === 'tutorial' ? 'tutorial-settings-tutorial' : undefined}
              className={`nav-item ${activeTab === key ? 'active' : ''}`}
              onClick={() => setActiveTab(key)}
              style={{ width: '100%', justifyContent: 'flex-start' }}
            >
              {icon} {label}
            </button>
          ))}

          {/* Aba Usuários — só para ADMIN */}
          {isAdmin && (
            <>
              <div style={{ margin: '0.75rem 0 0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', fontSize: '0.7rem', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={13} /> Administração
              </div>
              <button
                className={`nav-item ${activeTab === 'usuarios' ? 'active' : ''}`}
                onClick={() => setActiveTab('usuarios')}
                style={{ width: '100%', justifyContent: 'flex-start', color: activeTab === 'usuarios' ? 'white' : '#7c3aed', background: activeTab === 'usuarios' ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : 'rgba(124,58,237,0.08)', fontWeight: 600 }}
              >
                <Users size={18} /> Usuários
              </button>
              <button
                className={`nav-item ${activeTab === 'logs' ? 'active' : ''}`}
                onClick={() => setActiveTab('logs')}
                style={{ width: '100%', justifyContent: 'flex-start', color: activeTab === 'logs' ? 'white' : '#7c3aed', background: activeTab === 'logs' ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : 'rgba(124,58,237,0.08)', fontWeight: 600 }}
              >
                <FileClock size={18} /> Logs &amp; Backup
              </button>
            </>
          )}
        </nav>
      </div>

      {/* Conteúdo */}
      <div className="settings-content">

        {/* ─── ABA USUÁRIOS (apenas ADMIN) ─────────────────────────────────── */}
        {activeTab === 'usuarios' && isAdmin && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Gerenciamento de Usuários</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '4px 0 0' }}>
                  Controle quem tem acesso ao sistema e qual módulo cada usuário pode usar
                </p>
              </div>
              <button className="btn btn-primary" onClick={() => setNewUserModal(true)}>
                <UserPlus size={18} /> Novo Usuário
              </button>
            </div>

            {/* Mensagem de feedback */}
            {userMsg && (
              <div style={{
                padding: '0.75rem 1rem', borderRadius: 10, marginBottom: '1rem',
                background: userMsg.type === 'success' ? '#d1fae5' : '#fee2e2',
                color: userMsg.type === 'success' ? '#065f46' : '#991b1b',
                border: `1px solid ${userMsg.type === 'success' ? '#6ee7b7' : '#fca5a5'}`,
                fontWeight: 500, fontSize: '0.875rem',
              }}>
                {userMsg.type === 'success' ? '✅' : '❌'} {userMsg.text}
              </div>
            )}

            {/* Tabela de usuários */}
            {userLoading ? (
              <p style={{ color: 'var(--text-muted)' }}>Carregando usuários...</p>
            ) : userList.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>Nenhum usuário cadastrado.</p>
            ) : (
              <div style={{ border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-body)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Usuário</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>E-mail</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Módulo</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Criado em</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userList.map((u, i) => {
                      const moduleBadge = {
                        FINANCE:   { label: '💰 Financeiro',   bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' },
                        WAREHOUSE: { label: '📦 Almoxarifado', bg: '#fef3c7', color: '#b45309', border: '#fcd34d' },
                        ADMIN:     { label: '🛡️ Administrador', bg: '#f3e8ff', color: '#7c3aed', border: '#c4b5fd' },
                      }[u.module] || { label: u.module, bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
                      const isCurrentUser = u.id === currentUser.id;
                      return (
                        <tr key={u.id} style={{ borderBottom: i < userList.length - 1 ? '1px solid var(--border-color)' : 'none', background: isCurrentUser ? 'rgba(124,58,237,0.03)' : 'transparent' }}>
                          <td style={{ padding: '0.875rem 1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 34, height: 34, borderRadius: '50%', background: isCurrentUser ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : 'linear-gradient(135deg, #243b9d, #1a2a6c)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>
                                {u.name?.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p style={{ margin: 0, fontWeight: 600 }}>{u.name}</p>
                                {isCurrentUser && <p style={{ margin: 0, fontSize: '0.7rem', color: '#7c3aed' }}>← você</p>}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)' }}>{u.email}</td>
                          <td style={{ padding: '0.875rem 1rem', textAlign: 'center' }}>
                            <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, background: moduleBadge.bg, color: moduleBadge.color, border: `1px solid ${moduleBadge.border}`, fontSize: '0.78rem', fontWeight: 600 }}>
                              {moduleBadge.label}
                            </span>
                          </td>
                          <td style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                          </td>
                          <td style={{ padding: '0.875rem 1rem', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                              <button
                                title="Alterar módulo"
                                onClick={() => { setModuleModal(u); setModuleSelected(u.module || 'FINANCE'); }}
                                style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #c4b5fd', background: '#f3e8ff', color: '#7c3aed', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', fontWeight: 600 }}
                              >
                                <ShieldCheck size={14} /> Módulo
                              </button>
                              <button
                                title="Trocar senha"
                                onClick={() => { setPwdModal(u); setPwdValue(''); setShowPwd(false); }}
                                style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #93c5fd', background: '#dbeafe', color: '#1d4ed8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', fontWeight: 600 }}
                              >
                                <KeyRound size={14} /> Senha
                              </button>
                              {!isCurrentUser && (
                                <button
                                  title="Excluir usuário"
                                  onClick={() => deleteUser(u)}
                                  style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid #fca5a5', background: '#fee2e2', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Modal: Novo Usuário ── */}
            {newUserModal && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '2rem', width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Novo Usuário</h3>
                      <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Crie um acesso para alguém no sistema</p>
                    </div>
                    <button onClick={() => setNewUserModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
                  </div>
                  <form onSubmit={createUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4, display: 'block' }}>Nome completo</label>
                      <input className="input" placeholder="Ex: João Silva" value={newUserName} onChange={e => setNewUserName(e.target.value)} required />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4, display: 'block' }}>E-mail</label>
                      <input className="input" type="email" placeholder="Ex: joao@empresa.com" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} required />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4, display: 'block' }}>Senha inicial</label>
                      <div style={{ position: 'relative' }}>
                        <input className="input" type={showNewPwd ? 'text' : 'password'} placeholder="Mín. 6 caracteres" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} required minLength={6} style={{ paddingRight: 40 }} />
                        <button type="button" onClick={() => setShowNewPwd(p => !p)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                          {showNewPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 8, display: 'block' }}>Módulo de acesso</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                        {[
                          { val: 'FINANCE',   icon: '💰', label: 'Financeiro',   desc: 'Acesso ao módulo financeiro', color: '#1d4ed8', bg: '#dbeafe', border: '#93c5fd' },
                          { val: 'WAREHOUSE', icon: '📦', label: 'Almoxarifado', desc: 'Acesso ao estoque',           color: '#b45309', bg: '#fef3c7', border: '#fcd34d' },
                          { val: 'ADMIN',     icon: '🛡️', label: 'Admin',        desc: 'Acesso total ao sistema',    color: '#7c3aed', bg: '#f3e8ff', border: '#c4b5fd' },
                        ].map(m => (
                          <div
                            key={m.val}
                            onClick={() => setNewUserModule(m.val)}
                            style={{ padding: '0.75rem', borderRadius: 10, border: `2px solid ${newUserModule === m.val ? m.border : 'var(--border-color)'}`, background: newUserModule === m.val ? m.bg : 'transparent', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}
                          >
                            <div style={{ fontSize: '1.4rem', marginBottom: 4 }}>{m.icon}</div>
                            <div style={{ fontWeight: 700, fontSize: '0.8rem', color: newUserModule === m.val ? m.color : 'var(--text-main)' }}>{m.label}</div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>{m.desc}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button type="button" onClick={() => setNewUserModal(false)} className="btn" style={{ flex: 1, background: 'var(--bg-body)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>Cancelar</button>
                      <button type="submit" className="btn btn-primary" style={{ flex: 2 }}><UserPlus size={16} /> Criar Usuário</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* ── Modal: Alterar Módulo ── */}
            {moduleModal && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '2rem', width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Alterar Módulo</h3>
                      <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{moduleModal.name}</p>
                    </div>
                    <button onClick={() => setModuleModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: '1.5rem' }}>
                    {[
                      { val: 'FINANCE',   icon: '💰', label: 'Financeiro',   desc: 'Módulo financeiro', color: '#1d4ed8', bg: '#dbeafe', border: '#93c5fd' },
                      { val: 'WAREHOUSE', icon: '📦', label: 'Almoxarifado', desc: 'Módulo estoque',    color: '#b45309', bg: '#fef3c7', border: '#fcd34d' },
                      { val: 'ADMIN',     icon: '🛡️', label: 'Admin',        desc: 'Acesso total',      color: '#7c3aed', bg: '#f3e8ff', border: '#c4b5fd' },
                    ].map(m => (
                      <div
                        key={m.val}
                        onClick={() => setModuleSelected(m.val)}
                        style={{ padding: '0.875rem 0.5rem', borderRadius: 10, border: `2px solid ${moduleSelected === m.val ? m.border : 'var(--border-color)'}`, background: moduleSelected === m.val ? m.bg : 'transparent', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}
                      >
                        <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>{m.icon}</div>
                        <div style={{ fontWeight: 700, fontSize: '0.8rem', color: moduleSelected === m.val ? m.color : 'var(--text-main)' }}>{m.label}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>{m.desc}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setModuleModal(null)} className="btn" style={{ flex: 1, background: 'var(--bg-body)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>Cancelar</button>
                    <button onClick={updateModule} className="btn btn-primary" style={{ flex: 2 }}><ShieldCheck size={16} /> Salvar Módulo</button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Modal: Trocar Senha ── */}
            {pwdModal && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '2rem', width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Trocar Senha</h3>
                      <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{pwdModal.name}</p>
                    </div>
                    <button onClick={() => { setPwdModal(null); setPwdValue(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
                  </div>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, display: 'block' }}>Nova senha</label>
                    <div style={{ position: 'relative' }}>
                      <input className="input" type={showPwd ? 'text' : 'password'} placeholder="Mín. 6 caracteres" value={pwdValue} onChange={e => setPwdValue(e.target.value)} style={{ paddingRight: 40 }} />
                      <button type="button" onClick={() => setShowPwd(p => !p)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setPwdModal(null); setPwdValue(''); }} className="btn" style={{ flex: 1, background: 'var(--bg-body)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>Cancelar</button>
                    <button onClick={updatePassword} disabled={pwdValue.length < 6} className="btn btn-primary" style={{ flex: 2 }}><KeyRound size={16} /> Salvar Senha</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── ABA LOGS & BACKUP (apenas ADMIN) ────────────────────────────── */}
        {activeTab === 'logs' && isAdmin && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Logs do Sistema &amp; Backup</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '4px 0 0' }}>
                Trilha de auditoria de todas as ações sensíveis e exportação completa dos dados. Visível apenas para administradores.
              </p>
            </div>

            {/* ── Card de Backup ── */}
            <div style={{ background: 'var(--bg-body)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: 'linear-gradient(135deg, #059669, #047857)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
                    <DatabaseBackup size={22} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>Backup completo do sistema</p>
                    <p style={{ margin: '2px 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      Baixa um arquivo <code>.json</code> com todos os dados (transações, estoque, cadastros, logs). Senhas nunca são incluídas.
                    </p>
                  </div>
                </div>
                <button className="btn btn-primary" onClick={downloadBackup} disabled={backupLoading} style={{ background: 'linear-gradient(135deg, #059669, #047857)' }}>
                  <Download size={18} /> {backupLoading ? 'Gerando…' : 'Baixar Backup'}
                </button>
              </div>

              {backupMsg && (
                <div style={{
                  marginTop: '1rem', padding: '0.75rem 1rem', borderRadius: 10, fontSize: '0.85rem', fontWeight: 500,
                  background: backupMsg.type === 'success' ? '#d1fae5' : '#fee2e2',
                  color: backupMsg.type === 'success' ? '#065f46' : '#991b1b',
                  border: `1px solid ${backupMsg.type === 'success' ? '#6ee7b7' : '#fca5a5'}`,
                }}>
                  {backupMsg.type === 'success' ? '✅' : '❌'} {backupMsg.text}
                </div>
              )}

              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed var(--border-color)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <strong>Backup automático:</strong> configure a variável <code>BACKUP_TOKEN</code> no servidor e agende um cron externo chamando{' '}
                <code>GET /api/admin/backup/auto</code> com o cabeçalho <code>x-backup-token</code>.
              </div>
            </div>

            {/* ── Filtros dos Logs ── */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem' }}>
              <div style={{ flex: '1 1 180px', minWidth: 140 }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 3, textTransform: 'uppercase' }}>Buscar (usuário / ID)</label>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input className="input" value={logFilters.search} onChange={e => setLogFilters(f => ({ ...f, search: e.target.value }))} onKeyDown={e => e.key === 'Enter' && fetchLogs(1)} placeholder="Nome ou registro" style={{ paddingLeft: 30 }} />
                </div>
              </div>
              <div style={{ flex: '0 1 160px' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 3, textTransform: 'uppercase' }}>Tipo</label>
                <select className="input" value={logFilters.entityType} onChange={e => setLogFilters(f => ({ ...f, entityType: e.target.value }))}>
                  <option value="">Todos</option>
                  {logsMeta.entityTypes.map(t => <option key={t.value} value={t.value}>{t.value} ({t.count})</option>)}
                </select>
              </div>
              <div style={{ flex: '0 1 180px' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 3, textTransform: 'uppercase' }}>Ação</label>
                <select className="input" value={logFilters.action} onChange={e => setLogFilters(f => ({ ...f, action: e.target.value }))}>
                  <option value="">Todas</option>
                  {logsMeta.actions.map(a => <option key={a.value} value={a.value}>{a.value} ({a.count})</option>)}
                </select>
              </div>
              <div style={{ flex: '0 1 130px' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 3, textTransform: 'uppercase' }}>De</label>
                <input className="input" type="date" value={logFilters.from} onChange={e => setLogFilters(f => ({ ...f, from: e.target.value }))} />
              </div>
              <div style={{ flex: '0 1 130px' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 3, textTransform: 'uppercase' }}>Até</label>
                <input className="input" type="date" value={logFilters.to} onChange={e => setLogFilters(f => ({ ...f, to: e.target.value }))} />
              </div>
              <button className="btn btn-primary" onClick={() => fetchLogs(1)} disabled={logsLoading}>
                {logsLoading ? <RefreshCw size={16} className="spin" /> : <Search size={16} />} Filtrar
              </button>
              <button className="btn" onClick={() => { const cleared = { entityType: '', action: '', search: '', from: '', to: '' }; setLogFilters(cleared); fetchLogs(1, cleared); }} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                Limpar
              </button>
            </div>

            {/* ── Tabela de Logs ── */}
            <div style={{ border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: 720 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-body)', borderBottom: '1px solid var(--border-color)' }}>
                      {['Data / Hora', 'Usuário', 'Ação', 'Tipo', 'Registro', 'Ctx', ''].map((h, i) => (
                        <th key={i} style={{ padding: '0.7rem 0.9rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logsLoading ? (
                      <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Carregando logs…</td></tr>
                    ) : logs.data.length === 0 ? (
                      <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum registro encontrado para os filtros aplicados.</td></tr>
                    ) : logs.data.map((l, i) => (
                      <tr key={l.id} style={{ borderBottom: i < logs.data.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                        <td style={{ padding: '0.65rem 0.9rem', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                          {new Date(l.createdAt).toLocaleString('pt-BR')}
                        </td>
                        <td style={{ padding: '0.65rem 0.9rem', fontWeight: 600 }}>{l.userName || '—'}</td>
                        <td style={{ padding: '0.65rem 0.9rem' }}>
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, ...actionStyle(l.action) }}>
                            {l.action}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.9rem', color: 'var(--text-muted)' }}>{l.entityType}</td>
                        <td style={{ padding: '0.65rem 0.9rem', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                          {l.entityId ? `${String(l.entityId).slice(0, 8)}…` : '—'}
                        </td>
                        <td style={{ padding: '0.65rem 0.9rem', color: 'var(--text-muted)' }}>{l.context || '—'}</td>
                        <td style={{ padding: '0.65rem 0.9rem', textAlign: 'right' }}>
                          {(l.before || l.after) && (
                            <button onClick={() => setLogDetail(l)} style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-body)', color: 'var(--brand-blue)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>
                              Detalhes
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.9rem', borderTop: '1px solid var(--border-color)', background: 'var(--bg-body)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span>{logs.total} registro(s) · página {logs.page} de {logs.totalPages}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => fetchLogs(logs.page - 1)} disabled={logs.page <= 1 || logsLoading} style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', cursor: logs.page <= 1 ? 'not-allowed' : 'pointer', opacity: logs.page <= 1 ? 0.5 : 1, display: 'flex', alignItems: 'center' }}>
                    <ChevronLeft size={16} />
                  </button>
                  <button onClick={() => fetchLogs(logs.page + 1)} disabled={logs.page >= logs.totalPages || logsLoading} style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', cursor: logs.page >= logs.totalPages ? 'not-allowed' : 'pointer', opacity: logs.page >= logs.totalPages ? 0.5 : 1, display: 'flex', alignItems: 'center' }}>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Modal de detalhes do log */}
            {logDetail && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setLogDetail(null)}>
                <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '1.75rem', width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{logDetail.action} · {logDetail.entityType}</h3>
                      <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {new Date(logDetail.createdAt).toLocaleString('pt-BR')} · {logDetail.userName || 'sistema'}
                        {logDetail.entityId && <> · <code>{logDetail.entityId}</code></>}
                      </p>
                    </div>
                    <button onClick={() => setLogDetail(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
                  </div>
                  {logDetail.before && (
                    <div style={{ marginBottom: '1rem' }}>
                      <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', margin: '0 0 4px' }}>Antes</p>
                      <pre style={{ background: 'var(--bg-body)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.75rem', fontSize: '0.75rem', overflowX: 'auto', margin: 0 }}>{JSON.stringify(logDetail.before, null, 2)}</pre>
                    </div>
                  )}
                  {logDetail.after && (
                    <div>
                      <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase', margin: '0 0 4px' }}>Depois</p>
                      <pre style={{ background: 'var(--bg-body)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.75rem', fontSize: '0.75rem', overflowX: 'auto', margin: 0 }}>{JSON.stringify(logDetail.after, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TUTORIAL & AJUDA */}
        {activeTab === 'tutorial' && (
          <div>
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.25rem', margin: '0 0 4px' }}>Tutorial & Ajuda</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>Configure a exibição do tutorial interativo do sistema</p>
            </div>

            {/* Card de configuração */}
            <div style={{ background: 'var(--bg-body)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: 'linear-gradient(135deg, #243b9d, #1a2a6c)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                    <GraduationCap size={22} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>Exibir tutorial ao entrar no sistema</p>
                    <p style={{ margin: '2px 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>O tutorial aparece automaticamente após o login</p>
                  </div>
                </div>
                {/* Toggle */}
                <div
                  onClick={() => {
                    const next = !tutorialEnabled;
                    setTutorialEnabled(next);
                    localStorage.setItem('showTutorial', next ? 'true' : 'false');
                  }}
                  style={{
                    width: 48, height: 26, borderRadius: 13,
                    background: tutorialEnabled ? '#243b9d' : '#cbd5e1',
                    cursor: 'pointer', position: 'relative', transition: 'background 0.3s', flexShrink: 0,
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 3,
                    left: tutorialEnabled ? 25 : 3,
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'white', transition: 'left 0.3s',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                  }} />
                </div>
              </div>
            </div>

            {/* Botão reiniciar tutorial */}
            <div style={{ background: 'var(--bg-body)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                    <BookOpen size={22} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>Reiniciar o Tutorial Agora</p>
                    <p style={{ margin: '2px 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Abre o tutorial interativo com todos os 12 passos do sistema</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    localStorage.setItem('showTutorial', 'true');
                    setTutorialEnabled(true);
                    window.location.reload();
                  }}
                  className="btn btn-primary"
                >
                  Ver Tutorial
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CATEGORIAS */}
        {activeTab === 'categorias' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Categorias de Despesas e Receitas</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '4px 0 0' }}>Usadas no gráfico "Para onde vai meu dinheiro"</p>
              </div>
              <button className="btn btn-primary" onClick={() => setCatModal(true)}><Plus size={18}/> Nova Categoria</button>
            </div>

            {loading ? <p style={{ color: 'var(--text-muted)' }}>Carregando...</p> : (
              <>
                <h4 style={{ color: 'var(--danger)', marginBottom: '0.75rem', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📤 Despesas (Saídas)</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '2rem' }}>
                  {catOut.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nenhuma categoria de despesa.</p>}
                  {catOut.map(cat => (
                    <div key={cat.id} style={{ padding: '0.875rem 1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: `4px solid ${cat.color || 'var(--brand-blue)'}` }}>
                      <span style={{ fontWeight: 500 }}>{cat.name}</span>
                      <button onClick={() => deleteCategory(cat.id)} style={{ color: 'var(--danger)', background: 'none', padding: '4px' }}><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>

                <h4 style={{ color: 'var(--success)', marginBottom: '0.75rem', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📥 Receitas (Entradas)</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  {catIn.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nenhuma categoria de receita.</p>}
                  {catIn.map(cat => (
                    <div key={cat.id} style={{ padding: '0.875rem 1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: `4px solid ${cat.color || 'var(--success)'}` }}>
                      <span style={{ fontWeight: 500 }}>{cat.name}</span>
                      <button onClick={() => deleteCategory(cat.id)} style={{ color: 'var(--danger)', background: 'none', padding: '4px' }}><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* FORNECEDORES / CLIENTES */}
        {activeTab === 'fornecedores' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Fornecedores e Clientes</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '4px 0 0' }}>Vinculados às transações no cadastro</p>
              </div>
              <button className="btn btn-primary" onClick={() => setEntModal(true)}><Plus size={18}/> Novo Registro</button>
            </div>

            {loading ? <p style={{ color: 'var(--text-muted)' }}>Carregando...</p> : (
              <>
                <h4 style={{ color: 'var(--brand-blue)', marginBottom: '0.75rem', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🏭 Fornecedores</h4>
                <div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
                  <table style={{ width: '100%', minWidth: '320px' }}>
                    <thead><tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Nome</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', color: 'var(--text-muted)' }}>CPF / CNPJ</th>
                      <th style={{ padding: '0.75rem' }}></th>
                    </tr></thead>
                    <tbody>
                      {suppliers.length === 0 && <tr><td colSpan={3} style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nenhum fornecedor cadastrado.</td></tr>}
                      {suppliers.map(e => (
                        <tr key={e.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.75rem', fontWeight: 500 }}>{e.name}</td>
                          <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{e.document || '—'}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                            <button onClick={() => deleteEntity(e.id)} style={{ color: 'var(--danger)', background: 'none', minHeight: 34, minWidth: 34, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={16} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <h4 style={{ color: 'var(--success)', marginBottom: '0.75rem', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>👤 Clientes</h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: '320px' }}>
                    <thead><tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Nome</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', color: 'var(--text-muted)' }}>CPF / CNPJ</th>
                      <th style={{ padding: '0.75rem' }}></th>
                    </tr></thead>
                    <tbody>
                      {clients.length === 0 && <tr><td colSpan={3} style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nenhum cliente cadastrado.</td></tr>}
                      {clients.map(e => (
                        <tr key={e.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.75rem', fontWeight: 500 }}>{e.name}</td>
                          <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{e.document || '—'}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                            <button onClick={() => deleteEntity(e.id)} style={{ color: 'var(--danger)', background: 'none', minHeight: 34, minWidth: 34, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={16} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'empresas' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Empresas / Unidades de Negócio</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '4px 0 0' }}>Para separar lançamentos de diferentes empresas</p>
              </div>
              <button className="btn btn-primary" onClick={() => setCompModal(true)}><Plus size={18}/> Nova Empresa</button>
            </div>
            {loading ? <p style={{ color: 'var(--text-muted)' }}>Carregando...</p> : (
              <div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
                <table style={{ width: '100%', minWidth: '320px' }}>
                  <thead><tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Empresa</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', color: 'var(--text-muted)' }}>CNPJ</th>
                    <th style={{ padding: '0.75rem' }}></th>
                  </tr></thead>
                  <tbody>
                    {companies.length === 0 && <tr><td colSpan={3} style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nenhuma empresa cadastrada.</td></tr>}
                    {companies.map(c => (
                      <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.75rem', fontWeight: 500 }}>{c.name}</td>
                        <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{c.document || '—'}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                          <button onClick={() => deleteCompany(c.id)} style={{ color: 'var(--danger)', background: 'none', minHeight: 34, minWidth: 34, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'bancos' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Bancos e Caixas</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '4px 0 0' }}>Contas bancárias usadas para baixar pagamentos</p>
              </div>
              <button className="btn btn-primary" onClick={() => setBankModal(true)}><Plus size={18}/> Novo Banco</button>
            </div>
            {loading ? <p style={{ color: 'var(--text-muted)' }}>Carregando...</p> : (
              <div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
                <table style={{ width: '100%', minWidth: '320px' }}>
                  <thead><tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Nome (Banco/Caixa)</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Agência</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Conta</th>
                    <th style={{ padding: '0.75rem' }}></th>
                  </tr></thead>
                  <tbody>
                    {bankAccounts.length === 0 && <tr><td colSpan={4} style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nenhum banco cadastrado.</td></tr>}
                    {bankAccounts.map(b => (
                      <tr key={b.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.75rem', fontWeight: 500 }}>{b.name}</td>
                        <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{b.agency || '—'}</td>
                        <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{b.account || '—'}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                          <button onClick={() => deleteBank(b.id)} style={{ color: 'var(--danger)', background: 'none', minHeight: 34, minWidth: 34, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={16} /></button>
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

      {/* Modal: Nova Categoria */}
      {catModal && (
        <div className="modal-overlay" onClick={() => setCatModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Nova Categoria</h3>
              <button onClick={() => setCatModal(false)} style={{ background: 'none', fontSize: '1.5rem', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <form onSubmit={createCategory}>
              <div className="form-group"><label>Nome da Categoria</label><input type="text" value={catName} onChange={e => setCatName(e.target.value)} placeholder="Ex: Pessoal, Impostos..." required /></div>
              <div className="form-group">
                <label>Tipo</label>
                <select value={catType} onChange={e => setCatType(e.target.value)}>
                  <option value="OUT">📤 Despesa (Saída)</option>
                  <option value="IN">📥 Receita (Entrada)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Cor no Gráfico</label>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <input type="color" value={catColor} onChange={e => setCatColor(e.target.value)} style={{ width: 48, height: 48, border: 'none', padding: 0, cursor: 'pointer', borderRadius: 8 }} />
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Escolha a cor que vai aparecer no gráfico</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setCatModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Salvar Categoria</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Nova Entidade */}
      {entModal && (
        <div className="modal-overlay" onClick={() => setEntModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Novo Fornecedor / Cliente</h3>
              <button onClick={() => setEntModal(false)} style={{ background: 'none', fontSize: '1.5rem', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <form onSubmit={createEntity}>
              <div className="form-group"><label>Nome</label><input type="text" value={entName} onChange={e => setEntName(e.target.value)} placeholder="Nome da empresa ou pessoa" required /></div>
              <div className="form-group">
                <label>CPF / CNPJ (opcional)</label>
                <input type="text" value={entDoc} onChange={e => setEntDoc(formatDoc(e.target.value))} placeholder="00.000.000/0001-00" />
              </div>
              <div className="form-group">
                <label>Tipo</label>
                <select value={entType} onChange={e => setEntType(e.target.value)}>
                  <option value="SUPPLIER">🏭 Fornecedor</option>
                  <option value="CLIENT">👤 Cliente</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEntModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal: Nova Empresa */}
      {compModal && (
        <div className="modal-overlay" onClick={() => setCompModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Nova Empresa / Unidade</h3>
              <button onClick={() => setCompModal(false)} style={{ background: 'none', fontSize: '1.5rem', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <form onSubmit={createCompany}>
              <div className="form-group"><label>Nome da Empresa</label><input type="text" value={compName} onChange={e => setCompName(e.target.value)} required /></div>
              <div className="form-group"><label>CNPJ (opcional)</label><input type="text" value={compDoc} onChange={e => setCompDoc(formatDoc(e.target.value))} /></div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setCompModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Novo Banco */}
      {bankModal && (
        <div className="modal-overlay" onClick={() => setBankModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Nova Conta Bancária / Caixa</h3>
              <button onClick={() => setBankModal(false)} style={{ background: 'none', fontSize: '1.5rem', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <form onSubmit={createBank}>
              <div className="form-group"><label>Nome (ex: Itaú, Nubank, Caixa Físico)</label><input type="text" value={bankName} onChange={e => setBankName(e.target.value)} required /></div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}><label>Agência</label><input type="text" value={bankAgency} onChange={e => setBankAgency(e.target.value)} /></div>
                <div className="form-group" style={{ flex: 1 }}><label>Conta</label><input type="text" value={bankAcc} onChange={e => setBankAcc(e.target.value)} /></div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setBankModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
