const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

function getToken() {
  return localStorage.getItem('admabs_token');
}

export function setToken(token) {
  if (token) localStorage.setItem('admabs_token', token);
  else localStorage.removeItem('admabs_token');
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {}
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  login: (username, password) => request('/auth/login', { method: 'POST', body: { username, password } }),
  me: () => request('/auth/me'),

  dashboard: () => request('/dashboard'),

  products: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/products${qs ? `?${qs}` : ''}`);
  },
  updateProduct: (id, body) => request(`/products/${id}`, { method: 'PATCH', body }),

  customers: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/customers${qs ? `?${qs}` : ''}`);
  },

  suppliers: () => request('/suppliers'),

  purchaseOrders: () => request('/purchase-orders'),
  createPurchaseOrder: (body) => request('/purchase-orders', { method: 'POST', body }),
  updatePurchaseOrder: (id, body) => request(`/purchase-orders/${id}`, { method: 'PATCH', body }),

  sales: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/sales${qs ? `?${qs}` : ''}`);
  },
  createSale: (body) => request('/sales', { method: 'POST', body }),

  expenses: () => request('/expenses'),
  createExpense: (body) => request('/expenses', { method: 'POST', body }),
  updateExpense: (id, body) => request(`/expenses/${id}`, { method: 'PATCH', body }),

  approvals: () => request('/approvals'),
  updateApproval: (id, body) => request(`/approvals/${id}`, { method: 'PATCH', body }),
};
