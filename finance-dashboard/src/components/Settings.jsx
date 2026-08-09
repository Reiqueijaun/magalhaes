import { useState } from 'react';
import { Plus, Tag, Users, Archive } from 'lucide-react';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('categorias');

  const [categorias] = useState(['Pessoal', 'Fornecedores', 'Impostos', 'Aluguel', 'Energia', 'Combustível', 'Material de Escritório']);
  const [fornecedores] = useState(['Transportadora XYZ', 'Aluguel Galpão', 'Internet Corporativa', 'Softwares (SaaS)']);

  return (
    <div className="card" style={{ minHeight: '600px', display: 'flex', padding: 0 }}>
      {/* Settings Menu */}
      <div style={{ width: '250px', borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Configurações Base</h3>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button 
            className={`nav-item ${activeTab === 'categorias' ? 'active' : ''}`}
            onClick={() => setActiveTab('categorias')}
            style={{ width: '100%', justifyContent: 'flex-start' }}
          >
            <Tag size={18} /> Categorias
          </button>
          <button 
            className={`nav-item ${activeTab === 'fornecedores' ? 'active' : ''}`}
            onClick={() => setActiveTab('fornecedores')}
            style={{ width: '100%', justifyContent: 'flex-start' }}
          >
            <Users size={18} /> Fornecedores e Clientes
          </button>
          <button 
            className={`nav-item ${activeTab === 'bancos' ? 'active' : ''}`}
            onClick={() => setActiveTab('bancos')}
            style={{ width: '100%', justifyContent: 'flex-start' }}
          >
            <Archive size={18} /> Bancos e Caixas
          </button>
        </nav>
      </div>

      {/* Settings Content */}
      <div style={{ flex: 1, padding: '2rem' }}>
        {activeTab === 'categorias' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Gerenciar Categorias de Despesas</h2>
              <button className="btn btn-primary"><Plus size={18}/> Nova Categoria</button>
            </div>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Estas categorias são usadas para gerar o gráfico "Para onde vai meu dinheiro?".
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
              {categorias.map((cat, idx) => (
                <div key={idx} style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{cat}</span>
                  <button style={{ color: 'var(--danger)', background: 'none' }}>Excluir</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'fornecedores' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Gerenciar Fornecedores e Clientes</h2>
              <button className="btn btn-primary"><Plus size={18}/> Novo Registro</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
              {fornecedores.map((f, idx) => (
                <div key={idx} style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{f}</span>
                  <button style={{ color: 'var(--brand-blue)', background: 'none', fontWeight: 600 }}>Editar</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'bancos' && (
          <div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Bancos e Caixas</h2>
            <p style={{ color: 'var(--text-muted)' }}>Módulo em desenvolvimento...</p>
          </div>
        )}
      </div>
    </div>
  );
}
