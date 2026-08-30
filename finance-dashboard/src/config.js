const API_URL = import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== ''
  ? import.meta.env.VITE_API_URL
  : (import.meta.env.DEV ? 'http://localhost:3001' : '');

export default API_URL;

// Helper para fazer chamadas autenticadas (com JWT)
export const authFetch = (url, options = {}) => {
  const token = localStorage.getItem('token');
  const targetUrl = url.startsWith('http') ? url : `${API_URL}${url}`;
  return fetch(targetUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
};
