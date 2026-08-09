const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default API_URL;

// Helper para fazer chamadas autenticadas (com JWT)
export const authFetch = (url, options = {}) => {
  const token = localStorage.getItem('token');
  return fetch(`${API_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
};
