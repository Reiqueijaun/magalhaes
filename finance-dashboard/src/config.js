const API_URL = import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== ''
  ? import.meta.env.VITE_API_URL
  : (import.meta.env.DEV ? 'http://localhost:3001' : '');

export default API_URL;

// Limpeza segura de sessão (garante remoção de todos os tokens)
export const clearSession = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('warehouse_token');
  localStorage.removeItem('warehouse_user');
};

// Logout seguro que revoga o token no servidor antes de limpar o storage
export const apiLogout = async () => {
  try {
    const token = localStorage.getItem('token') || localStorage.getItem('warehouse_token');
    if (token) {
      const targetUrl = API_URL.startsWith('http') ? `${API_URL}/api/auth/logout` : `/api/auth/logout`;
      await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
    }
  } catch (e) {
    console.error('Erro ao revogar sessão no servidor:', e);
  } finally {
    clearSession();
  }
};

// Helper para fazer chamadas autenticadas (com JWT)
// Intercepta automaticamente respostas 401 e limpa a sessão expirada
export const authFetch = async (url, options = {}) => {
  const token = localStorage.getItem('token') || localStorage.getItem('warehouse_token');
  const targetUrl = url.startsWith('http') ? url : `${API_URL}${url}`;

  const response = await fetch(targetUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  // Se o servidor retornar 401, o token expirou ou foi invalidado:
  // limpa a sessão e recarrega a página para forçar novo login
  if (response.status === 401) {
    clearSession();
    setTimeout(() => { window.location.reload(); }, 200);
  }

  return response;
};
