import { useState, useEffect, useRef } from 'react';
import {
  Package, Warehouse, AlertTriangle,
  Plus, Search, Edit2, Trash2, X, Check, Upload, MapPin,
  Truck, BarChart2, ArrowUpCircle, ArrowDownCircle, ShoppingCart,
  RotateCcw, Settings, Eye, FileText,
  DollarSign, Hash, Tag, Box, Layers, TrendingDown
} from 'lucide-react';
import API_URL from '../config.js';
const API = API_URL;

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtNum = (v, dec = 2) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('pt-BR') : '—';

const MOVEMENT_TYPES = {
  ENTRY:      { label: 'Entrada',    icon: ArrowUpCircle,   color: '#10b981', bg: '#d1fae5' },
  EXIT:       { label: 'Saída',      icon: ArrowDownCircle, color: '#ef4444', bg: '#fee2e2' },
  SALE:       { label: 'Venda',      icon: ShoppingCart,    color: '#3b82f6', bg: '#dbeafe' },
  ADJUSTMENT: { label: 'Ajuste',     icon: Settings,        color: '#f59e0b', bg: '#fef3c7' },
  RETURN:     { label: 'Devolução',  icon: RotateCcw,       color: '#8b5cf6', bg: '#ede9fe' },
};

const UNITS = ['UN', 'KG', 'CX', 'MT', 'LT', 'M²', 'PC', 'RL', 'PR', 'TON'];

const token = () => localStorage.getItem('token');
const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` });

// ─── API calls ────────────────────────────────────────────────────────────────
const api = {
  get: (path) => fetch(`${API}${path}`, { headers: authHeaders() }).then(r => r.json()),
  post: (path, body) => fetch(`${API}${path}`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) }).then(r => r.json()),
  patch: (path, body) => fetch(`${API}${path}`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify(body) }).then(r => r.json()),
  del: (path) => fetch(`${API}${path}`, { method: 'DELETE', headers: authHeaders() }).then(r => r.json()),
};

// ─── Subcomponents ────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color = '#243b9d', bg = '#eef1f8', alert }) {
  return (
    <div style={{
      background: 'white', borderRadius: 12, padding: '1.25rem 1.5rem',
      border: `1px solid ${alert ? '#fee2e2' : '#e2e8f0'}`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      display: 'flex', flexDirection: 'column', gap: 8,
      transition: 'transform 0.2s, box-shadow 0.2s',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.1)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: alert ? '#fee2e2' : bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={18} color={alert ? '#ef4444' : color} />
        </div>
      </div>
      <div style={{ fontSize: '1.7rem', fontWeight: 800, color: alert ? '#ef4444' : '#1e293b' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{sub}</div>}
    </div>
  );
}

function Badge({ type }) {
  const t = MOVEMENT_TYPES[type] || {};
  const Icon = t.icon || Box;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, background: t.bg, color: t.color }}>
      <Icon size={11} /> {t.label}
    </span>
  );
}

function StockBar({ current, min }) {
  if (!min || min === 0) return null;
  const pct = Math.min((current / min) * 100, 100);
  const color = pct <= 30 ? '#ef4444' : pct <= 70 ? '#f59e0b' : '#10b981';
  return (
    <div style={{ width: '100%', background: '#f1f5f9', borderRadius: 99, height: 6 }}>
      <div style={{ width: `${pct}%`, background: color, borderRadius: 99, height: 6, transition: 'width 0.4s ease' }} />
    </div>
  );
}

// ─── MODAL: Produto ───────────────────────────────────────────────────────────
function ProductModal({ product, locations, suppliers, categories, onSave, onClose }) {
  const [form, setForm] = useState(product ? {
    name: product.name, description: product.description || '', code: product.code,
    manufacturerCode: product.manufacturerCode || '', unit: product.unit || 'UN',
    category: product.category || 'Geral', minStock: product.minStock || 0,
    costPrice: product.costPrice || 0, salePrice: product.salePrice || 0,
    locationId: product.locationId || '', supplierId: product.supplierId || '',
  } : {
    name: '', description: '', code: '', manufacturerCode: '', unit: 'UN',
    category: 'Geral', minStock: 0, costPrice: 0, salePrice: 0, locationId: '', supplierId: '',
  });
  const [imagePreview, setImagePreview] = useState(null);
  const [imageB64, setImageB64] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef();

  // Load existing image
  useEffect(() => {
    if (product?.hasImage) {
      api.get(`/api/warehouse/products/${product.id}/image`)
        .then(d => { if (d.imageUrl) setImagePreview(d.imageUrl); });
    }
  }, [product]);

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setErr('Imagem muito grande. Máximo 2MB.'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { setImagePreview(ev.target.result); setImageB64(ev.target.result); };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!form.name || !form.code) { setErr('Nome e código são obrigatórios.'); return; }
    setSaving(true); setErr('');
    try {
      let saved;
      if (product) {
        saved = await api.patch(`/api/warehouse/products/${product.id}`, form);
        if (imageB64) await api.patch(`/api/warehouse/products/${product.id}/image`, { imageUrl: imageB64 });
      } else {
        saved = await api.post('/api/warehouse/products', { ...form, imageUrl: imageB64 });
      }
      if (saved.error) { setErr(saved.error); setSaving(false); return; }
      onSave();
    } catch { setErr('Erro ao salvar produto.'); }
    setSaving(false);
  };

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 720, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px rgba(0,0,0,0.2)', animation: 'modalIn 0.25s ease' }}>
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, #243b9d 0%, #1d3080 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Package size={20} color="white" />
            <span style={{ color: 'white', fontWeight: 700, fontSize: '1.05rem' }}>{product ? 'Editar Produto' : 'Novo Produto'}</span>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: 6, color: 'white', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div style={{ overflow: 'auto', padding: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '0.85rem' }}>
          {/* Imagem */}
          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div onClick={() => fileRef.current?.click()} style={{ width: 80, height: 80, borderRadius: 12, border: '2px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', background: '#f8fafc', flexShrink: 0 }}>
              {imagePreview ? <img src={imagePreview} alt="produto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Upload size={24} color="#94a3b8" />}
            </div>
            <div>
              <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155', margin: 0 }}>Foto do Produto</p>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '2px 0 6px' }}>PNG, JPG — máx 2MB</p>
              <button onClick={() => fileRef.current?.click()} style={{ padding: '6px 12px', background: '#eef1f8', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, color: '#243b9d', cursor: 'pointer', minHeight: 34 }}>
                {imagePreview ? 'Trocar Imagem' : 'Carregar Imagem'}
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImage} />
          </div>

          {/* Campos */}
          {[
            { label: 'Nome do Produto *', key: 'name', col: '1/-1' },
            { label: 'Código Interno *', key: 'code', placeholder: 'Ex: MAG-001' },
            { label: 'Código do Fabricante', key: 'manufacturerCode', placeholder: 'Ex: FAB-XYZ-123' },
          ].map(({ label, key, col, placeholder }) => (
            <div key={key} style={{ gridColumn: col || 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>{label}</label>
              <input value={form[key]} onChange={e => f(key, e.target.value)} placeholder={placeholder || ''} style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.875rem', outline: 'none' }} />
            </div>
          ))}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Categoria</label>
            <select value={form.category} onChange={e => f('category', e.target.value)} style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.875rem' }}>
              <option value="Geral">Geral</option>
              {(categories||[]).filter(Boolean).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Unidade</label>
            <select value={form.unit} onChange={e => f('unit', e.target.value)} style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.875rem' }}>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Estoque Mínimo</label>
            <input type="number" value={form.minStock} onChange={e => f('minStock', e.target.value)} min="0" step="0.01" style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.875rem' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Preço de Custo (R$)</label>
            <input type="number" value={form.costPrice} onChange={e => f('costPrice', e.target.value)} min="0" step="0.01" style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.875rem' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Preço de Venda (R$)</label>
            <input type="number" value={form.salePrice} onChange={e => f('salePrice', e.target.value)} min="0" step="0.01" style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.875rem' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Localização</label>
            <select value={form.locationId} onChange={e => f('locationId', e.target.value)} style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.875rem' }}>
              <option value="">— Sem localização —</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Fornecedor</label>
            <select value={form.supplierId} onChange={e => f('supplierId', e.target.value)} style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.875rem' }}>
              <option value="">— Sem fornecedor —</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Descrição</label>
            <textarea value={form.description} onChange={e => f('description', e.target.value)} rows={2} placeholder="Descrição detalhada do produto..." style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.875rem', resize: 'vertical', fontFamily: 'inherit' }} />
          </div>

          {err && <div style={{ gridColumn: '1/-1', background: '#fee2e2', color: '#ef4444', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}>{err}</div>}
        </div>

        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '0.6rem 1.2rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, fontWeight: 500, cursor: 'pointer', minHeight: 38 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '0.6rem 1.4rem', background: 'linear-gradient(135deg, #243b9d, #1d3080)', color: 'white', borderRadius: 8, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, minHeight: 38 }}>
            {saving ? '...' : <><Check size={16} /> Salvar</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL: Movimentação ──────────────────────────────────────────────────────
function MovementModal({ products, onSave, onClose, defaultType }) {
  const [form, setForm] = useState({ productId: '', type: defaultType || 'ENTRY', quantity: 1, unitPrice: 0, reason: '', document: '', date: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const selectedProduct = products.find(p => p.id === form.productId);

  useEffect(() => {
    if (selectedProduct) f('unitPrice', selectedProduct.costPrice || 0);
  }, [form.productId]);

  const isAdjustment = form.type === 'ADJUSTMENT';
  const adjustDelta = isAdjustment && selectedProduct
    ? Number(form.quantity) - Number(selectedProduct.currentStock || 0)
    : null;

  const handleSave = async () => {
    if (!form.productId) { setErr('Selecione um produto.'); return; }
    if (form.quantity === '' || !isFinite(Number(form.quantity)) || Number(form.quantity) < 0) { setErr('Informe uma quantidade válida.'); return; }
    if (!isAdjustment && Number(form.quantity) <= 0) { setErr('Quantidade deve ser maior que zero.'); return; }
    setSaving(true); setErr('');
    const res = await api.post('/api/warehouse/movements', { ...form, quantity: Number(form.quantity), unitPrice: Number(form.unitPrice) });
    if (res.error) { setErr(res.error); setSaving(false); return; }
    if (res.warning) alert('⚠️ ' + res.warning);
    onSave(res);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 520, boxShadow: '0 25px 50px rgba(0,0,0,0.2)', animation: 'modalIn 0.25s ease' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', borderRadius: '16px 16px 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Layers size={20} color="white" />
            <span style={{ color: 'white', fontWeight: 700, fontSize: '1.05rem' }}>Novo Lançamento</span>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: 6, color: 'white', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Tipo */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Tipo de Lançamento</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.entries(MOVEMENT_TYPES).map(([k, t]) => {
                const Icon = t.icon;
                return (
                  <button key={k} onClick={() => f('type', k)} style={{ padding: '6px 12px', borderRadius: 8, border: `2px solid ${form.type === k ? t.color : '#e2e8f0'}`, background: form.type === k ? t.bg : 'white', color: form.type === k ? t.color : '#64748b', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s', minHeight: 36 }}>
                    <Icon size={13} /> {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Produto */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Produto *</label>
            <select value={form.productId} onChange={e => f('productId', e.target.value)} style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.875rem' }}>
              <option value="">— Selecione o produto —</option>
              {products.filter(Boolean).map(p => <option key={p.id} value={p.id}>{p.code} — {p.name} (Estoque: {fmtNum(p.currentStock, 2)} {p.unit})</option>)}
            </select>
          </div>

          {selectedProduct && (
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: '0.75rem', border: '1px solid #e2e8f0', fontSize: '0.8rem', color: '#475569' }}>
              <strong>Estoque atual:</strong> {fmtNum(selectedProduct.currentStock, 2)} {selectedProduct.unit} |
              <strong> Mínimo:</strong> {fmtNum(selectedProduct.minStock, 2)} {selectedProduct.unit} |
              <strong> Local:</strong> {selectedProduct.locationLabel || '—'}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                {isAdjustment ? 'Contagem física (novo saldo) *' : 'Quantidade *'}
              </label>
              <input type="number" value={form.quantity} onChange={e => f('quantity', e.target.value)} min={isAdjustment ? '0' : '0.001'} step="0.001" style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.875rem' }} />
              {isAdjustment && adjustDelta != null && (
                <span style={{ fontSize: '0.72rem', color: adjustDelta === 0 ? '#64748b' : adjustDelta > 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                  {adjustDelta === 0 ? 'Sem alteração de saldo' : `Ajuste de ${adjustDelta > 0 ? '+' : ''}${adjustDelta} ${selectedProduct?.unit || ''}`}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Preço Unitário (R$)</label>
              <input type="number" value={form.unitPrice} onChange={e => f('unitPrice', e.target.value)} min="0" step="0.01" style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.875rem' }} />
            </div>
          </div>

          {Number(form.quantity) > 0 && Number(form.unitPrice) > 0 && (
            <div style={{ background: '#eef1f8', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.85rem', fontWeight: 700, color: '#243b9d', textAlign: 'right' }}>
              Total: {fmt(Number(form.quantity) * Number(form.unitPrice))}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Data</label>
              <input type="date" value={form.date} onChange={e => f('date', e.target.value)} style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.875rem' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Documento (NF, Pedido…)</label>
              <input value={form.document} onChange={e => f('document', e.target.value)} placeholder="Ex: NF 12345" style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.875rem' }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Motivo / Discriminação</label>
            <input value={form.reason} onChange={e => f('reason', e.target.value)} placeholder="Ex: Compra de reposição, Venda ao cliente X..." style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.875rem' }} />
          </div>

          {err && <div style={{ background: '#fee2e2', color: '#ef4444', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}>{err}</div>}
        </div>

        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '0.6rem 1.2rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, fontWeight: 500, cursor: 'pointer', minHeight: 38 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '0.6rem 1.4rem', background: 'linear-gradient(135deg, #1e293b, #334155)', color: 'white', borderRadius: 8, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, minHeight: 38 }}>
            {saving ? '...' : <><Check size={16} /> Registrar</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL: Produto Detalhe ───────────────────────────────────────────────────
function ProductDetailModal({ product, movements, onClose }) {
  const [imageUrl, setImageUrl] = useState(null);

  useEffect(() => {
    if (product?.hasImage) {
      api.get(`/api/warehouse/products/${product.id}/image`).then(d => { if (d.imageUrl) setImageUrl(d.imageUrl); });
    }
  }, [product]);

  const prdMovements = movements.filter(m => m.productId === product.id).slice(0, 20);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 700, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px rgba(0,0,0,0.2)', animation: 'modalIn 0.25s ease' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, #243b9d, #1d3080)', borderRadius: '16px 16px 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Eye size={20} color="white" />
            <span style={{ color: 'white', fontWeight: 700, fontSize: '1.05rem' }}>Ficha do Produto</span>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: 6, color: 'white', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ overflow: 'auto', padding: '1.25rem' }}>
          {/* Ficha Principal */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ width: 100, height: 100, borderRadius: 12, overflow: 'hidden', border: '2px solid #e2e8f0', flexShrink: 0, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {imageUrl ? <img src={imageUrl} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Package size={40} color="#cbd5e1" />}
            </div>
            <div style={{ flex: '1 1 200px', minWidth: 0 }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>{product.name}</h3>
              {product.description && <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 8 }}>{product.description}</p>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[
                  { icon: Hash, label: 'Cód. Interno', val: product.code },
                  { icon: FileText, label: 'Cód. Fabricante', val: product.manufacturerCode || '—' },
                  { icon: Tag, label: 'Categoria', val: product.category },
                  { icon: Box, label: 'Unidade', val: product.unit },
                  { icon: MapPin, label: 'Localização', val: product.locationLabel || '—' },
                  { icon: Truck, label: 'Fornecedor', val: product.supplierName || '—' },
                ].map(({ icon: Icon, label, val }) => (
                  <div key={label} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '4px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icon size={12} color="#64748b" />
                    <span style={{ color: '#64748b' }}>{label}:</span>
                    <strong style={{ color: '#334155' }}>{val}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Estoque e Preços */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 130px), 1fr))', gap: 8, marginBottom: 20 }}>
            {[
              { label: 'Estoque Atual', val: `${fmtNum(product.currentStock)} ${product.unit}`, color: product.currentStock <= product.minStock && product.minStock > 0 ? '#ef4444' : '#10b981' },
              { label: 'Estoque Mínimo', val: `${fmtNum(product.minStock)} ${product.unit}`, color: '#f59e0b' },
              { label: 'Preço de Custo', val: fmt(product.costPrice), color: '#64748b' },
              { label: 'Preço de Venda', val: fmt(product.salePrice), color: '#243b9d' },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.65rem 0.85rem' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Estoque bar */}
          {product.minStock > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginBottom: 4 }}>
                <span>Nível de estoque</span>
                <span>{Math.round((product.currentStock / product.minStock) * 100)}% do mínimo</span>
              </div>
              <StockBar current={product.currentStock} min={product.minStock} />
            </div>
          )}

          {/* Histórico */}
          <div>
            <h4 style={{ fontWeight: 700, color: '#243b9d', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <BarChart2 size={16} /> Últimas Movimentações
            </h4>
            {prdMovements.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Nenhuma movimentação registrada.</p>
            ) : (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['Data', 'Tipo', 'Qtd', 'Preço Unit.', 'Total', 'Motivo', 'Por'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {prdMovements.map(m => (
                      <tr key={m.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '7px 12px', fontSize: '0.78rem' }}>{fmtDate(m.date)}</td>
                        <td style={{ padding: '7px 12px' }}><Badge type={m.type} /></td>
                        <td style={{ padding: '7px 12px', fontSize: '0.78rem', fontWeight: 600 }}>{fmtNum(m.quantity)}</td>
                        <td style={{ padding: '7px 12px', fontSize: '0.78rem' }}>{fmt(m.unitPrice)}</td>
                        <td style={{ padding: '7px 12px', fontSize: '0.78rem', fontWeight: 600 }}>{fmt(m.totalPrice)}</td>
                        <td style={{ padding: '7px 12px', fontSize: '0.78rem', color: '#64748b' }}>{m.reason || '—'}</td>
                        <td style={{ padding: '7px 12px', fontSize: '0.78rem', color: '#94a3b8' }}>{m.createdBy || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL: Foto do Produto ───────────────────────────────────────────────────
function ProductPhotoModal({ product, onClose }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.get(`/api/warehouse/products/${product.id}/image`)
      .then(d => { if (alive) { setImageUrl(d?.imageUrl || null); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [product]);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, backdropFilter: 'blur(4px)', padding: '2rem' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 16, maxWidth: 'min(92vw, 640px)', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px rgba(0,0,0,0.35)', animation: 'modalIn 0.2s ease' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.name}</div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{product.code}</div>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: 6, color: '#475569', cursor: 'pointer', flexShrink: 0 }}><X size={18} /></button>
        </div>
        <div style={{ padding: '1.25rem', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
          {loading ? (
            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Carregando imagem...</span>
          ) : imageUrl ? (
            <img src={imageUrl} alt={product.name} style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 8 }} />
          ) : (
            <div style={{ textAlign: 'center', color: '#94a3b8' }}>
              <Package size={48} style={{ opacity: 0.4, marginBottom: 8 }} />
              <p style={{ fontSize: '0.85rem' }}>Este produto não possui foto.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── TABS ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'dashboard', label: 'Dashboard',    icon: BarChart2 },
  { id: 'products',  label: 'Produtos',     icon: Package },
  { id: 'movements', label: 'Lançamentos',  icon: Layers },
  { id: 'sales',     label: 'Baixas/Vendas',icon: ShoppingCart },
  { id: 'settings',  label: 'Configurações',icon: Settings },
];

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function WarehouseModule() {
  const [tab, setTab] = useState('dashboard');
  const [productsData, setProductsData] = useState({ data: [], total: 0, page: 1, totalPages: 1 });
  const [productPage, setProductPage] = useState(1);
  const [movData, setMovData] = useState({ data: [], total: 0, page: 1, totalPages: 1 });
  const [movPage, setMovPage] = useState(1);
  const [salesData, setSalesData] = useState({ data: [], total: 0, page: 1, totalPages: 1 });
  const [salesPage, setSalesPage] = useState(1);
  const [simpleProducts, setSimpleProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showProductModal, setShowProductModal] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [showMovModal, setShowMovModal] = useState(false);
  const [movDefaultType, setMovDefaultType] = useState('ENTRY');
  const [viewProduct, setViewProduct] = useState(null);
  const [photoProduct, setPhotoProduct] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [movFilter, setMovFilter] = useState({ type: '', productId: '', from: '', to: '' });

  // Settings sub-tabs
  const [settingsTab, setSettingsTab] = useState('locations');
  const [newLoc, setNewLoc] = useState({ aisle: '', shelf: '', position: '' });
  const [newSup, setNewSup] = useState({ name: '', document: '', contact: '', email: '', phone: '' });
  const [newCat, setNewCat] = useState({ name: '', color: '#64748b' });

  // Confirm modal
  const [confirmModal, setConfirmModal] = useState(null); // { title, message, onConfirm }

  const askConfirm = (title, message, onConfirm) => setConfirmModal({ title, message, onConfirm });

  const loadBaseData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const results = await Promise.allSettled([
        api.get('/api/warehouse/locations'),
        api.get('/api/warehouse/suppliers'),
        api.get('/api/warehouse/summary'),
        api.get('/api/warehouse/products-search')
      ]);
      const val = (r) => (r.status === 'fulfilled' ? r.value : null);
      const [locs, sups, sum, simProds] = results.map(val);
      setLocations(Array.isArray(locs) ? locs : []);
      setSuppliers(Array.isArray(sups) ? sups : []);
      setSummary(sum && !sum.error ? sum : null);
      setSimpleProducts(Array.isArray(simProds) ? simProds : []);
    } catch (e) {
      console.error('Erro ao carregar dados base:', e);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => { loadBaseData(true); }, []);

  useEffect(() => {
    if (tab === 'products') {
      const q = new URLSearchParams({ page: productPage, limit: 50 });
      if (search) q.append('search', search);
      if (filterCat) q.append('category', filterCat);
      api.get(`/api/warehouse/products?${q.toString()}`).then(res => {
        if (!res.error) setProductsData(res);
      });
    }
  }, [tab, productPage, search, filterCat]);

  useEffect(() => {
    if (tab === 'movements') {
      const q = new URLSearchParams({ page: movPage, limit: 50 });
      if (movFilter.type) q.append('type', movFilter.type);
      if (movFilter.productId) q.append('productId', movFilter.productId);
      if (movFilter.from) q.append('from', movFilter.from);
      if (movFilter.to) q.append('to', movFilter.to);
      api.get(`/api/warehouse/movements?${q.toString()}`).then(res => {
        if (!res.error) setMovData(res);
      });
    }
  }, [tab, movPage, movFilter]);

  useEffect(() => {
    if (tab === 'sales') {
      const q = new URLSearchParams({ page: salesPage, limit: 50, fetchTypes: 'SALE,EXIT' });
      if (movFilter.productId) q.append('productId', movFilter.productId);
      if (movFilter.from) q.append('from', movFilter.from);
      if (movFilter.to) q.append('to', movFilter.to);
      api.get(`/api/warehouse/movements?${q.toString()}`).then(res => {
        if (!res.error) setSalesData(res);
      });
    }
  }, [tab, salesPage, movFilter]);

  const onSaveProduct = () => {
    setShowProductModal(false);
    setProductPage(1); 
    loadBaseData(false);
    const q = new URLSearchParams({ page: 1, limit: 50 });
    if (search) q.append('search', search);
    if (filterCat) q.append('category', filterCat);
    api.get(`/api/warehouse/products?${q.toString()}`).then(res => {
      if (!res.error) setProductsData(res);
    });
  };

  const onSaveMovement = () => {
    setShowMovModal(false);
    setMovPage(1);
    setSalesPage(1);
    loadBaseData(false);
    
    const q1 = new URLSearchParams({ page: 1, limit: 50 });
    api.get(`/api/warehouse/movements?${q1.toString()}`).then(res => !res.error && setMovData(res));
    
    const q2 = new URLSearchParams({ page: 1, limit: 50, fetchTypes: 'SALE,EXIT' });
    api.get(`/api/warehouse/movements?${q2.toString()}`).then(res => !res.error && setSalesData(res));
  };


  const uniqueCategories = [...new Set(simpleProducts.map(p => p.category))].filter(Boolean).sort();
  const filteredProducts = productsData.data || [];
  const filteredMovements = movData.data || [];
  const sales = salesData.data || [];

  const handleDeleteProduct = async (id) => {
    askConfirm(
      'Excluir Produto',
      'Tem certeza? O produto e todo o histórico de movimentações serão excluídos permanentemente.',
      async () => {
        await api.del(`/api/warehouse/products/${id}`);
        setProductsData(p => ({ ...p, data: p.data.filter(x => x.id !== id) }));
        loadBaseData(false);
      }
    );
  };

  const handleDeleteLocation = async (id) => {
    askConfirm(
      'Excluir Localização',
      'Tem certeza que deseja excluir esta localização?',
      async () => {
        await api.del(`/api/warehouse/locations/${id}`);
        setLocations(l => l.filter(x => x.id !== id));
      }
    );
  };

  const handleDeleteSupplier = async (id) => {
    askConfirm(
      'Excluir Fornecedor',
      'Tem certeza que deseja excluir este fornecedor?',
      async () => {
        await api.del(`/api/warehouse/suppliers/${id}`);
        setSuppliers(s => s.filter(x => x.id !== id));
      }
    );
  };

  const handleAddLocation = async () => {
    if (!newLoc.aisle || !newLoc.shelf || !newLoc.position) return alert('Preencha corredor, prateleira e posição.');
    await api.post('/api/warehouse/locations', newLoc);
    setNewLoc({ aisle: '', shelf: '', position: '' });
    loadBaseData(false);
  };

  const handleAddSupplier = async () => {
    if (!newSup.name) return alert('Nome do fornecedor é obrigatório.');
    await api.post('/api/warehouse/suppliers', newSup);
    setNewSup({ name: '', document: '', contact: '', email: '', phone: '' });
    loadBaseData(false);
  };

  const handleAddCategory = async () => {
    if (!newCat.name) return alert('Nome da categoria é obrigatório.');
    await api.post('/api/warehouse/categories', newCat);
    setNewCat({ name: '', color: '#64748b' });
    loadBaseData(false);
  };

  const handleDeleteCategory = async (id) => {
    askConfirm(
      'Excluir Categoria',
      'Tem certeza? Os produtos desta categoria ficarão com a categoria "Geral".',
      async () => {
        await api.del(`/api/warehouse/categories/${id}`);
        setCategories(c => c.filter(x => x.id !== id));
      }
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#64748b' }}>
        <div style={{ textAlign: 'center' }}>
          <Warehouse size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p>Carregando almoxarifado...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, margin: '0 auto', width: '100%' }}>
      {/* Modal de Confirmação */}
      {confirmModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 420, boxShadow: '0 25px 50px rgba(0,0,0,0.2)', animation: 'modalIn 0.2s ease', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #fee2e2', background: 'linear-gradient(135deg, #ef4444, #dc2626)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={20} color="white" />
              <span style={{ color: 'white', fontWeight: 700, fontSize: '1rem' }}>{confirmModal.title}</span>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <p style={{ fontSize: '0.9rem', color: '#475569', margin: 0, lineHeight: 1.6 }}>{confirmModal.message}</p>
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setConfirmModal(null)} style={{ padding: '0.6rem 1.2rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem', color: '#64748b' }}>
                Cancelar
              </button>
              <button onClick={async () => { await confirmModal.onConfirm(); setConfirmModal(null); }} style={{ padding: '0.6rem 1.4rem', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Trash2 size={15} /> Excluir
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #243b9d 100%)', borderRadius: 16, padding: '1.25rem 1.5rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', boxShadow: '0 8px 24px rgba(36,59,157,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Warehouse size={24} color="white" />
          </div>
          <div>
            <h1 style={{ color: 'white', fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>Almoxarifado</h1>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', margin: 0 }}>Controle de estoque e movimentações</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => { setMovDefaultType('ENTRY'); setShowMovModal(true); }} style={{ padding: '0.55rem 1rem', background: '#10b981', border: 'none', borderRadius: 10, color: 'white', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', minHeight: 38 }}>
            <ArrowUpCircle size={16} /> Entrada
          </button>
          <button onClick={() => { setMovDefaultType('EXIT'); setShowMovModal(true); }} style={{ padding: '0.55rem 1rem', background: '#ef4444', border: 'none', borderRadius: 10, color: 'white', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', minHeight: 38 }}>
            <ArrowDownCircle size={16} /> Saída
          </button>
          <button onClick={() => { setEditProduct(null); setShowProductModal(true); }} style={{ padding: '0.55rem 1rem', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 10, color: 'white', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', minHeight: 38 }}>
            <Plus size={16} /> Produto
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: '1.25rem', background: 'white', padding: 6, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflowX: 'auto', maxWidth: '100%' }}>
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: '1 0 auto', padding: '0.55rem 0.85rem', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.2s', background: tab === t.id ? 'linear-gradient(135deg, #243b9d, #1d3080)' : 'transparent', color: tab === t.id ? 'white' : '#64748b', boxShadow: tab === t.id ? '0 2px 8px rgba(36,59,157,0.3)' : 'none', whiteSpace: 'nowrap', minHeight: 38 }}>
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ─── TAB: DASHBOARD ──────────────────────────────────────────────── */}
      {tab === 'dashboard' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
            <StatCard icon={Package} label="Produtos Cadastrados" value={summary?.totalProducts || 0} sub="itens ativos no sistema" color="#243b9d" />
            <StatCard icon={DollarSign} label="Valor em Estoque" value={fmt(summary?.totalValue)} sub="custo total dos itens" color="#10b981" bg="#d1fae5" />
            <StatCard icon={Box} label="Total de Itens" value={fmtNum(summary?.totalItems, 0)} sub="unidades em estoque" color="#3b82f6" bg="#dbeafe" />
            <StatCard icon={AlertTriangle} label="Estoque Baixo" value={summary?.lowStockCount || 0} sub="produtos abaixo do mínimo" alert={(summary?.lowStockCount || 0) > 0} />
          </div>

          {/* Movimentos do mês */}
          {summary?.movementsByType?.length > 0 && (
            <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#243b9d', marginBottom: 16 }}>Movimentações do Mês Atual</h3>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {summary.movementsByType.map(m => {
                  const t = MOVEMENT_TYPES[m.type] || {};
                  const Icon = t.icon || Box;
                  return (
                    <div key={m.type} style={{ background: t.bg || '#f8fafc', border: `1px solid ${t.color || '#e2e8f0'}22`, borderRadius: 10, padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Icon size={20} color={t.color || '#64748b'} />
                      <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: t.color || '#64748b' }}>{t.label || m.type}</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>{m.count} mov. — {fmt(m.total)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Alertas de estoque baixo */}
          {summary?.lowStockItems?.length > 0 && (
            <div style={{ background: 'white', borderRadius: 12, border: '1px solid #fecaca', padding: '1.25rem 1.5rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ef4444', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} /> Alertas: Estoque Abaixo do Mínimo
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {summary.lowStockItems.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.6rem 0.75rem', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
                    <AlertTriangle size={16} color="#ef4444" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>{p.name} <span style={{ fontWeight: 400, color: '#64748b', fontSize: '0.78rem' }}>({p.code})</span></div>
                      <StockBar current={p.currentStock} min={p.minStock} />
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                      <strong style={{ color: '#ef4444' }}>{fmtNum(p.currentStock)}</strong> / {fmtNum(p.minStock)} {p.unit}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{p.locationLabel || '—'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(!summary?.lowStockItems?.length && !summary?.movementsByType?.length) && (
            <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
              <Warehouse size={48} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
              <p style={{ fontWeight: 600 }}>Almoxarifado vazio</p>
              <p style={{ fontSize: '0.85rem' }}>Cadastre produtos e registre movimentações para ver o dashboard.</p>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: PRODUTOS ───────────────────────────────────────────────── */}
      {tab === 'products' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input value={search} onChange={e => { setSearch(e.target.value); setProductPage(1); }} placeholder="Buscar por nome, código..." style={{ width: '100%', padding: '0.55rem 0.75rem 0.55rem 2rem', border: '1px solid #e2e8f0', borderRadius: 9, fontSize: '0.875rem', background: 'white' }} />
            </div>
            <select value={filterCat} onChange={e => { setFilterCat(e.target.value); setProductPage(1); }} style={{ padding: '0.55rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 9, fontSize: '0.875rem', background: 'white', minWidth: 160 }}>
              <option value="">Todas as categorias</option>
              {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={() => { setEditProduct(null); setShowProductModal(true); }} style={{ padding: '0.55rem 1.1rem', background: 'linear-gradient(135deg, #243b9d, #1d3080)', color: 'white', borderRadius: 9, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', border: 'none' }}>
              <Plus size={16} /> Novo Produto
            </button>
          </div>

          <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            {filteredProducts.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                <Package size={40} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
                <p style={{ fontWeight: 600 }}>{search || filterCat ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado'}</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['Foto', 'Produto', 'Códigos', 'Categoria', 'Localização', 'Estoque', 'Custo', 'Venda', 'Ações'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map(p => {
                      const lowStock = p.minStock > 0 && p.currentStock <= p.minStock;
                      return (
                        <tr key={p.id} style={{ borderTop: '1px solid #f1f5f9', transition: 'background 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#fafbff'}
                          onMouseLeave={e => e.currentTarget.style.background = ''}
                        >
                          <td style={{ padding: '10px 14px' }}>
                            <div
                              onClick={p.hasImage ? () => setPhotoProduct(p) : undefined}
                              title={p.hasImage ? 'Ver foto do produto' : undefined}
                              style={{ width: 44, height: 44, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid #e2e8f0', cursor: p.hasImage ? 'zoom-in' : 'default' }}
                            >
                              {p.hasImage ? (
                                <ProductThumb id={p.id} />
                              ) : (
                                <Package size={18} color="#cbd5e1" />
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1e293b' }}>{p.name}</div>
                            {p.description && <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 1 }}>{p.description.slice(0, 40)}{p.description.length > 40 ? '...' : ''}</div>}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontSize: '0.75rem' }}>
                              <span style={{ background: '#eef1f8', color: '#243b9d', padding: '2px 7px', borderRadius: 5, fontWeight: 700, display: 'inline-block' }}>{p.code}</span>
                              {p.manufacturerCode && <div style={{ color: '#94a3b8', marginTop: 2 }}>{p.manufacturerCode}</div>}
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ fontSize: '0.78rem', background: '#f1f5f9', padding: '2px 8px', borderRadius: 6, color: '#475569' }}>{p.category}</span>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            {p.locationLabel ? (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: '#475569' }}>
                                <MapPin size={12} /> {p.locationLabel}
                              </span>
                            ) : <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>—</span>}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: lowStock ? '#ef4444' : '#1e293b' }}>
                              {fmtNum(p.currentStock)} {p.unit}
                            </div>
                            {p.minStock > 0 && (
                              <div style={{ marginTop: 3, width: 80 }}><StockBar current={p.currentStock} min={p.minStock} /></div>
                            )}
                            {lowStock && <div style={{ fontSize: '0.68rem', color: '#ef4444', marginTop: 1 }}>⚠ Abaixo do mínimo</div>}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: '0.82rem', color: '#64748b' }}>{fmt(p.costPrice)}</td>
                          <td style={{ padding: '10px 14px', fontSize: '0.82rem', fontWeight: 600, color: '#243b9d' }}>{fmt(p.salePrice)}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button onClick={() => setViewProduct(p)} title="Ver ficha" style={{ padding: 6, background: '#eef1f8', border: 'none', borderRadius: 7, cursor: 'pointer', color: '#243b9d' }}><Eye size={14} /></button>
                              <button onClick={() => { setEditProduct(p); setShowProductModal(true); }} title="Editar" style={{ padding: 6, background: '#eef1f8', border: 'none', borderRadius: 7, cursor: 'pointer', color: '#243b9d' }}><Edit2 size={14} /></button>
                              <button onClick={() => handleDeleteProduct(p.id)} title="Excluir" style={{ padding: 6, background: '#fee2e2', border: 'none', borderRadius: 7, cursor: 'pointer', color: '#ef4444' }}><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div style={{ marginTop: 8, fontSize: '0.75rem', color: '#94a3b8', textAlign: 'right', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{filteredProducts.length} produto(s) na página</span>
            {productsData.totalPages > 1 && (
              <div style={{ display: 'flex', gap: 10 }}>
                <button disabled={productPage === 1} onClick={() => setProductPage(p => p - 1)} style={{ padding: '0.3rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: 6, background: productPage === 1 ? '#f8fafc' : 'white', cursor: productPage === 1 ? 'not-allowed' : 'pointer', fontWeight: 600 }}>Anterior</button>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, padding: '0.3rem' }}>Página {productsData.page} de {productsData.totalPages}</span>
                <button disabled={productPage === productsData.totalPages} onClick={() => setProductPage(p => p + 1)} style={{ padding: '0.3rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: 6, background: productPage === productsData.totalPages ? '#f8fafc' : 'white', cursor: productPage === productsData.totalPages ? 'not-allowed' : 'pointer', fontWeight: 600 }}>Próxima</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB: LANÇAMENTOS ────────────────────────────────────────────── */}
      {tab === 'movements' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: '1rem', flexWrap: 'wrap' }}>
            <select value={movFilter.type} onChange={e => setMovFilter(p => ({ ...p, type: e.target.value }))} style={{ padding: '0.55rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 9, fontSize: '0.875rem', background: 'white' }}>
              <option value="">Todos os tipos</option>
              {Object.entries(MOVEMENT_TYPES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
            </select>
            <select value={movFilter.productId} onChange={e => setMovFilter(p => ({ ...p, productId: e.target.value }))} style={{ padding: '0.55rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 9, fontSize: '0.875rem', background: 'white', minWidth: 200 }}>
              <option value="">Todos os produtos</option>
              {simpleProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="date" value={movFilter.from} onChange={e => setMovFilter(p => ({ ...p, from: e.target.value }))} style={{ padding: '0.55rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 9, fontSize: '0.875rem', background: 'white' }} />
            <input type="date" value={movFilter.to} onChange={e => setMovFilter(p => ({ ...p, to: e.target.value }))} style={{ padding: '0.55rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 9, fontSize: '0.875rem', background: 'white' }} />
            <button onClick={() => { setMovDefaultType('ENTRY'); setShowMovModal(true); }} style={{ marginLeft: 'auto', padding: '0.55rem 1.1rem', background: 'linear-gradient(135deg, #243b9d, #1d3080)', color: 'white', borderRadius: 9, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', border: 'none' }}>
              <Plus size={16} /> Novo Lançamento
            </button>
          </div>

          <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            {filteredMovements.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                <Layers size={40} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
                <p style={{ fontWeight: 600 }}>Nenhuma movimentação encontrada</p>
              </div>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        {['Data/Hora', 'Tipo', 'Produto', 'Qtd', 'Preço Unit.', 'Total', 'Documento', 'Motivo', 'Por'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMovements.filter(Boolean).map(m => (
                        <tr key={m.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '9px 14px', fontSize: '0.78rem', color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDateTime(m.date)}</td>
                          <td style={{ padding: '9px 14px' }}><Badge type={m.type} /></td>
                          <td style={{ padding: '9px 14px' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#1e293b' }}>{m.productName}</div>
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{m.productCode}</div>
                          </td>
                          <td style={{ padding: '9px 14px', fontWeight: 700, fontSize: '0.85rem' }}>{fmtNum(m.quantity)} {m.productUnit}</td>
                          <td style={{ padding: '9px 14px', fontSize: '0.82rem' }}>{fmt(m.unitPrice)}</td>
                          <td style={{ padding: '9px 14px', fontWeight: 700, fontSize: '0.85rem', color: m.type === 'ENTRY' || m.type === 'RETURN' ? '#10b981' : '#ef4444' }}>{fmt(m.totalPrice)}</td>
                          <td style={{ padding: '9px 14px', fontSize: '0.78rem', color: '#64748b' }}>{m.document || '—'}</td>
                          <td style={{ padding: '9px 14px', fontSize: '0.78rem', color: '#64748b', maxWidth: 150 }}><span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.reason || '—'}</span></td>
                          <td style={{ padding: '9px 14px', fontSize: '0.75rem', color: '#94a3b8' }}>{m.createdBy || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #f1f5f9', fontSize: '0.75rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{filteredMovements.length} lançamento(s)</span>
                  <span>Total: <strong style={{ color: '#1e293b' }}>{fmt(filteredMovements.reduce((s, m) => s + (m.totalPrice || 0), 0))}</strong></span>
                </div>
              </>
            )}
          </div>
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{filteredMovements.length} lançamento(s) na página</span>
            {movData.totalPages > 1 && (
              <div style={{ display: 'flex', gap: 10 }}>
                <button disabled={movPage === 1} onClick={() => setMovPage(p => p - 1)} style={{ padding: '0.3rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: 6, background: movPage === 1 ? '#f8fafc' : 'white', cursor: movPage === 1 ? 'not-allowed' : 'pointer', fontWeight: 600 }}>Anterior</button>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, padding: '0.3rem' }}>Página {movData.page} de {movData.totalPages}</span>
                <button disabled={movPage === movData.totalPages} onClick={() => setMovPage(p => p + 1)} style={{ padding: '0.3rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: 6, background: movPage === movData.totalPages ? '#f8fafc' : 'white', cursor: movPage === movData.totalPages ? 'not-allowed' : 'pointer', fontWeight: 600 }}>Próxima</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB: BAIXAS / VENDAS ────────────────────────────────────────── */}
      {tab === 'sales' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: '1rem', flexWrap: 'wrap' }}>
            <select value={movFilter.productId} onChange={e => setMovFilter(p => ({ ...p, productId: e.target.value }))} style={{ padding: '0.55rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 9, fontSize: '0.875rem', background: 'white', minWidth: 200 }}>
              <option value="">Todos os produtos</option>
              {simpleProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="date" value={movFilter.from} onChange={e => setMovFilter(p => ({ ...p, from: e.target.value }))} style={{ padding: '0.55rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 9, fontSize: '0.875rem', background: 'white' }} />
            <input type="date" value={movFilter.to} onChange={e => setMovFilter(p => ({ ...p, to: e.target.value }))} style={{ padding: '0.55rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 9, fontSize: '0.875rem', background: 'white' }} />
            <button onClick={() => { setMovDefaultType('SALE'); setShowMovModal(true); }} style={{ marginLeft: 'auto', padding: '0.55rem 1.1rem', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', borderRadius: 9, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', border: 'none' }}>
              <ShoppingCart size={16} /> Registrar Baixa
            </button>
          </div>

          {/* Resumo de vendas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
            <StatCard icon={ShoppingCart} label="Total Baixas (Filtro)" value={salesData.total} sub="saídas e vendas filtradas" color="#3b82f6" bg="#dbeafe" />
            <StatCard icon={TrendingDown} label="Qtd. Total Saída" value={fmtNum(sales.reduce((s, m) => s + m.quantity, 0), 0) + ' (Pág)'} sub="unidades baixadas" color="#ef4444" bg="#fee2e2" />
            <StatCard icon={DollarSign} label="Valor Total" value={fmt(sales.reduce((s, m) => s + (m.totalPrice || 0), 0)) + ' (Pág)'} sub="valor baixas/vendas" color="#10b981" bg="#d1fae5" />
          </div>

          <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            {sales.length === 0 ? (
              <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#94a3b8' }}>
                <ShoppingCart size={40} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
                <p style={{ fontWeight: 600 }}>Nenhuma baixa ou venda registrada</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['Data', 'Tipo', 'Produto', 'Código', 'Qtd', 'Preço Unit.', 'Total', 'Documento', 'Discriminação', 'Por'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sales.filter(Boolean).map(m => (
                      <tr key={m.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '9px 14px', fontSize: '0.78rem', color: '#64748b' }}>{fmtDate(m.date)}</td>
                        <td style={{ padding: '9px 14px' }}><Badge type={m.type} /></td>
                        <td style={{ padding: '9px 14px', fontWeight: 600, fontSize: '0.82rem', color: '#1e293b' }}>{m.productName}</td>
                        <td style={{ padding: '9px 14px' }}><span style={{ background: '#eef1f8', color: '#243b9d', padding: '2px 7px', borderRadius: 5, fontSize: '0.72rem', fontWeight: 700 }}>{m.productCode}</span></td>
                        <td style={{ padding: '9px 14px', fontWeight: 700 }}>{fmtNum(m.quantity)} {m.productUnit}</td>
                        <td style={{ padding: '9px 14px', fontSize: '0.82rem' }}>{fmt(m.unitPrice)}</td>
                        <td style={{ padding: '9px 14px', fontWeight: 800, color: '#ef4444' }}>{fmt(m.totalPrice)}</td>
                        <td style={{ padding: '9px 14px', fontSize: '0.78rem', color: '#64748b' }}>{m.document || '—'}</td>
                        <td style={{ padding: '9px 14px', fontSize: '0.78rem', color: '#64748b' }}>{m.reason || '—'}</td>
                        <td style={{ padding: '9px 14px', fontSize: '0.75rem', color: '#94a3b8' }}>{m.createdBy || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                      <td colSpan={4} style={{ padding: '10px 14px', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>TOTAL</td>
                      <td style={{ padding: '10px 14px', fontWeight: 800 }}>{fmtNum(sales.reduce((s, m) => s + m.quantity, 0), 0)}</td>
                      <td />
                      <td style={{ padding: '10px 14px', fontWeight: 800, color: '#ef4444', fontSize: '0.95rem' }}>{fmt(sales.reduce((s, m) => s + (m.totalPrice || 0), 0))}</td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
          {salesData.totalPages > 1 && (
            <div style={{ marginTop: 15, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
              <button disabled={salesPage === 1} onClick={() => setSalesPage(p => p - 1)} style={{ padding: '0.3rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: 6, background: salesPage === 1 ? '#f8fafc' : 'white', cursor: salesPage === 1 ? 'not-allowed' : 'pointer', fontWeight: 600 }}>Anterior</button>
              <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, padding: '0.3rem' }}>Página {salesData.page} de {salesData.totalPages}</span>
              <button disabled={salesPage === salesData.totalPages} onClick={() => setSalesPage(p => p + 1)} style={{ padding: '0.3rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: 6, background: salesPage === salesData.totalPages ? '#f8fafc' : 'white', cursor: salesPage === salesData.totalPages ? 'not-allowed' : 'pointer', fontWeight: 600 }}>Próxima</button>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: CONFIGURAÇÕES ──────────────────────────────────────────── */}
      {tab === 'settings' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '1.25rem', alignItems: 'start' }}>
          {/* Sub-tabs */}
          <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: '0.6rem', display: 'flex', flexDirection: 'column', gap: 4, height: 'fit-content' }}>
            {[
              { id: 'locations', icon: MapPin, label: 'Localizações' },
              { id: 'suppliers', icon: Truck, label: 'Fornecedores' },
              { id: 'categories', icon: Tag, label: 'Categorias' }
            ].map(t => {
              const Icon = t.icon;
              return (
                <button key={t.id} onClick={() => setSettingsTab(t.id)} style={{ padding: '0.6rem 0.75rem', border: 'none', borderRadius: 8, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', background: settingsTab === t.id ? '#eef1f8' : 'transparent', color: settingsTab === t.id ? '#243b9d' : '#64748b', minHeight: 38 }}>
                  <Icon size={15} /> {t.label}
                </button>
              );
            })}
          </div>

          <div>
            {settingsTab === 'locations' && (
              <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0' }}>
                  <h3 style={{ fontWeight: 700, color: '#243b9d', fontSize: '1rem', marginBottom: 12 }}>Gerenciar Localizações</h3>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    {[
                      { key: 'aisle', label: 'Corredor', placeholder: 'A' },
                      { key: 'shelf', label: 'Prateleira', placeholder: '01' },
                      { key: 'position', label: 'Posição', placeholder: '01' },
                    ].map(({ key, label, placeholder }) => (
                      <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>{label}</label>
                        <input value={newLoc[key]} onChange={e => setNewLoc(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} maxLength={5} style={{ width: 80, padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.85rem' }} />
                      </div>
                    ))}
                    {newLoc.aisle && newLoc.shelf && newLoc.position && (
                      <div style={{ padding: '0.5rem 0.75rem', background: '#eef1f8', borderRadius: 8, fontWeight: 700, color: '#243b9d', fontSize: '0.85rem' }}>
                        {`${newLoc.aisle.toUpperCase()}-${String(newLoc.shelf).padStart(2,'0')}-${String(newLoc.position).padStart(2,'0')}`}
                      </div>
                    )}
                    <button onClick={handleAddLocation} style={{ padding: '0.5rem 1rem', background: 'linear-gradient(135deg, #243b9d, #1d3080)', color: 'white', borderRadius: 8, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, border: 'none', fontSize: '0.85rem' }}>
                      <Plus size={14} /> Adicionar
                    </button>
                  </div>
                </div>
                {locations.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                    <MapPin size={32} style={{ margin: '0 auto 8px', opacity: 0.3, display: 'block' }} />
                    <p>Nenhuma localização cadastrada</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', padding: '1.5rem' }}>
                    {locations.map(l => (
                      <div key={l.id} style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
                        <div>
                          <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.1rem' }}>{l.label}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Corredor {l.aisle} · Prat. {l.shelf}</div>
                        </div>
                        <button onClick={() => {
                          if(confirm('Excluir?')) {
                            api.del(`/api/warehouse/locations/${l.id}`).then(() => loadBaseData(false));
                          }
                        }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}><Trash2 size={16} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {settingsTab === 'suppliers' && (
              <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0' }}>
                  <h3 style={{ fontWeight: 700, color: '#243b9d', fontSize: '1rem', marginBottom: 12 }}>Gerenciar Fornecedores</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
                    {[
                      { key: 'name', label: 'Nome *', placeholder: 'Fornecedor ABC Ltda' },
                      { key: 'document', label: 'CNPJ', placeholder: '00.000.000/0001-00' },
                      { key: 'contact', label: 'Contato', placeholder: 'Nome do contato' },
                      { key: 'email', label: 'E-mail', placeholder: 'email@fornecedor.com' },
                      { key: 'phone', label: 'Telefone', placeholder: '(00) 00000-0000' },
                    ].map(({ key, label, placeholder }) => (
                      <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>{label}</label>
                        <input value={newSup[key]} onChange={e => setNewSup(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.82rem' }} />
                      </div>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <button onClick={handleAddSupplier} style={{ width: '100%', padding: '0.5rem 1rem', background: 'linear-gradient(135deg, #243b9d, #1d3080)', color: 'white', borderRadius: 8, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: 'none', fontSize: '0.85rem' }}>
                        <Plus size={14} /> Adicionar
                      </button>
                    </div>
                  </div>
                </div>
                {suppliers.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                    <Truck size={32} style={{ margin: '0 auto 8px', opacity: 0.3, display: 'block' }} />
                    <p>Nenhum fornecedor cadastrado</p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          {['Nome', 'CNPJ', 'Contato', 'E-mail', 'Telefone', ''].map(h => (
                            <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {suppliers.map(s => (
                          <tr key={s.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 14px', fontWeight: 600, fontSize: '0.85rem' }}>{s.name}</td>
                            <td style={{ padding: '8px 14px', fontSize: '0.8rem', color: '#64748b' }}>{s.document || '—'}</td>
                            <td style={{ padding: '8px 14px', fontSize: '0.8rem', color: '#64748b' }}>{s.contact || '—'}</td>
                            <td style={{ padding: '8px 14px', fontSize: '0.8rem', color: '#64748b' }}>{s.email || '—'}</td>
                            <td style={{ padding: '8px 14px', fontSize: '0.8rem', color: '#64748b' }}>{s.phone || '—'}</td>
                            <td style={{ padding: '8px 14px' }}>
                              <button onClick={() => handleDeleteSupplier(s.id)} style={{ padding: '4px 8px', background: '#fee2e2', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#ef4444' }}><Trash2 size={13} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {settingsTab === 'categories' && (
              <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0' }}>
                  <h3 style={{ fontWeight: 700, color: '#243b9d', fontSize: '1rem', marginBottom: 12 }}>Gerenciar Categorias</h3>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 150 }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Nome da Categoria *</label>
                      <input value={newCat.name} onChange={e => setNewCat(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Elétrica, Hidráulica, EPI..." style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.85rem' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 60 }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Cor</label>
                      <input type="color" value={newCat.color} onChange={e => setNewCat(p => ({ ...p, color: e.target.value }))} style={{ padding: '0', border: '1px solid #e2e8f0', borderRadius: 8, height: '36px', width: '50px', cursor: 'pointer' }} />
                    </div>
                    <button onClick={handleAddCategory} style={{ padding: '0.5rem 1rem', background: 'linear-gradient(135deg, #243b9d, #1d3080)', color: 'white', borderRadius: 8, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, border: 'none', fontSize: '0.85rem' }}>
                      <Plus size={14} /> Adicionar
                    </button>
                  </div>
                </div>
                {categories?.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                    <Tag size={32} style={{ margin: '0 auto 8px', opacity: 0.3, display: 'block' }} />
                    <p>Nenhuma categoria cadastrada</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', padding: '1.5rem' }}>
                    {(categories||[]).filter(Boolean).map(c => (
                      <div key={c.id} style={{ padding: '1rem', border: `1px solid ${c.color}44`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: `${c.color}11` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 12, height: 12, borderRadius: '50%', background: c.color }} />
                          <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.95rem' }}>{c.name}</div>
                        </div>
                        <button onClick={() => handleDeleteCategory(c.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}><Trash2 size={16} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── MODALS ───────────────────────────────────────────────────────── */}
      {showProductModal && (
        <ProductModal
          product={editProduct}
          locations={locations}
          suppliers={suppliers}
          categories={categories}
          onSave={() => { setEditProduct(null); onSaveProduct(); }}
          onClose={() => { setShowProductModal(false); setEditProduct(null); }}
        />
      )}

      {showMovModal && (
        <MovementModal
          products={simpleProducts}
          defaultType={movDefaultType}
          onSave={onSaveMovement}
          onClose={() => setShowMovModal(false)}
        />
      )}

      {viewProduct && (
        <ProductDetailModal
          product={viewProduct}
          movements={movData.data || []}
          onClose={() => setViewProduct(null)}
        />
      )}

      {photoProduct && (
        <ProductPhotoModal
          product={photoProduct}
          onClose={() => setPhotoProduct(null)}
        />
      )}
    </div>
  );
}

// Thumbnail lazy-loader para a tabela (evita carregar todas as imagens de uma vez)
function ProductThumb({ id }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    api.get(`/api/warehouse/products/${id}/image`).then(d => { if (d.imageUrl) setSrc(d.imageUrl); });
  }, [id]);
  if (!src) return <Package size={18} color="#cbd5e1" />;
  return <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
}
