import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, itemName, itemValue, confirmText = 'Excluir Definitivamente', loading = false }) {
  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={onClose}
    >
      <div 
        style={{
          background: 'white',
          borderRadius: '16px',
          maxWidth: '460px',
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
          border: '1px solid #fecaca',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Top bar warning banner */}
        <div style={{ background: '#fef2f2', padding: '1.25rem 1.5rem', borderBottom: '1px solid #fee2e2', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', flexShrink: 0 }}>
            <AlertTriangle size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, color: '#991b1b', fontSize: '1.05rem', fontWeight: 700 }}>
              {title || 'Confirmar Exclusão'}
            </h3>
            <p style={{ margin: '2px 0 0', color: '#b91c1c', fontSize: '0.8rem' }}>
              Ação irreversível no fluxo financeiro
            </p>
          </div>
          <button 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.5rem' }}>
          <p style={{ margin: 0, color: '#4b5563', fontSize: '0.92rem', lineHeight: '1.5' }}>
            {message || 'Você tem certeza que deseja excluir este registro? Essa ação não poderá ser desfeita.'}
          </p>

          {(itemName || itemValue) && (
            <div style={{ marginTop: '1rem', padding: '0.875rem 1rem', background: '#f9fafb', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
              {itemName && (
                <div style={{ fontWeight: 600, color: '#1f2937', fontSize: '0.9rem', marginBottom: itemValue ? '4px' : 0 }}>
                  {itemName}
                </div>
              )}
              {itemValue && (
                <div style={{ fontWeight: 800, color: '#dc2626', fontSize: '1.1rem' }}>
                  {itemValue}
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                flex: 1,
                padding: '0.75rem',
                borderRadius: '10px',
                border: '1px solid #d1d5db',
                background: 'white',
                color: '#374151',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              style={{
                flex: 1.2,
                padding: '0.75rem',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                color: 'white',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: loading ? 'wait' : 'pointer',
                boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)',
              }}
            >
              {loading ? 'Excluindo...' : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
