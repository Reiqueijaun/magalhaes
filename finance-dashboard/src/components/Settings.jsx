import { useState, useEffect } from 'react';
import { Plus, Tag, Users, Archive, Trash2, X, BookOpen, GraduationCap } from 'lucide-react';
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

  useEffect(() => { fetchAll(); }, []);

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

  const catOut = categories.filter(c => c.type === 'OUT');
  const catIn  = categories.filter(c => c.type === 'IN');
  const suppliers = entities.filter(e => e.type === 'SUPPLIER');
  const clients   = entities.filter(e => e.type === 'CLIENT');

  return (
    <div className="card" style={{ minHeight: '600px', display: 'flex', padding: 0, overflow: 'hidden' }}>
      {/* Menu lateral de Configurações */}
      <div style={{ width: '250px', borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', padding: '1.5rem', flexShrink: 0 }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '1.5rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em', fontWeight: 700 }}>Cadastros Base</h3>
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
        </nav>
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1, padding: '2rem', overflow: 'auto' }}>

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
                <table style={{ width: '100%', marginBottom: '2rem' }}>
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
                          <button onClick={() => deleteEntity(e.id)} style={{ color: 'var(--danger)', background: 'none' }}><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <h4 style={{ color: 'var(--success)', marginBottom: '0.75rem', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>👤 Clientes</h4>
                <table style={{ width: '100%' }}>
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
                          <button onClick={() => deleteEntity(e.id)} style={{ color: 'var(--danger)', background: 'none' }}><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
              <table style={{ width: '100%', marginBottom: '2rem' }}>
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
                        <button onClick={() => deleteCompany(c.id)} style={{ color: 'var(--danger)', background: 'none' }}><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
              <table style={{ width: '100%', marginBottom: '2rem' }}>
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
                        <button onClick={() => deleteBank(b.id)} style={{ color: 'var(--danger)', background: 'none' }}><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
