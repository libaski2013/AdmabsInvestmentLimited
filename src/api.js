const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:4000/api');

function getToken() {
  return localStorage.getItem('admabs_token');
}

export function setToken(token) {
  if (token) localStorage.setItem('admabs_token', token);
  else localStorage.removeItem('admabs_token');
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = body ? { 'Content-Type': 'application/json' } : {};
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

async function requestBlob(path) {
  const headers = {}; const token = getToken(); if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  if (!res.ok) { let message=`Request failed (${res.status})`; try { const data=await res.json(); if(data?.error)message=data.error; } catch {} throw new Error(message); }
  return res.blob();
}

export const api = {
  login: (username, password) => request('/auth/login', { method: 'POST', body: { username, password } }),
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  heartbeat: () => request('/sessions/heartbeat', { method: 'POST' }),
  serverTime: () => request('/time'),

  dashboard: () => request('/dashboard'),
  storeProducts: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/store/products${qs ? `?${qs}` : ''}`);
  },
  branches: () => request('/branches'),
  users: () => request('/users'),
  superAdminStatus: () => request('/users/super-admin-status'),
  createBranch: body => request('/branches', { method: 'POST', body }),
  updateBranch: (id, body) => request(`/branches/${id}`, { method: 'PATCH', body }),
  deleteBranch: id => request(`/branches/${id}`, { method: 'DELETE' }),
  outlets: () => request('/outlets'),
  createOutlet: body => request('/outlets', { method: 'POST', body }),
  updateOutlet: (id, body) => request(`/outlets/${id}`, { method: 'PATCH', body }),
  permissions: () => request('/permissions'),
  createUser: body => request('/users', { method: 'POST', body }),
  updateUser: (id, body) => request(`/users/${id}`, { method: 'PATCH', body }),

  products: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/products${qs ? `?${qs}` : ''}`);
  },
  updateProduct: (id, body) => request(`/products/${id}`, { method: 'PATCH', body }),
  createProduct: body => request('/products', { method: 'POST', body }),
  deleteProduct: id => request(`/products/${id}`, { method: 'DELETE' }),
  scanProduct: code => request(`/products/scan/${encodeURIComponent(code)}`),
  receiveProductStock: (id, body) => request(`/products/${id}/stock`, { method: 'POST', body }),
  stockMovements: () => request('/stock-movements'),

  customers: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/customers${qs ? `?${qs}` : ''}`);
  },
  createCustomer: body => request('/customers', { method: 'POST', body }),
  updateCustomer: (id, body) => request(`/customers/${id}`, { method: 'PATCH', body }),
  deleteCustomer: id => request(`/customers/${id}`, { method: 'DELETE' }),

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
  journals: () => request('/accounting/journals'),
  createJournal: (body) => request('/accounting/journals', { method: 'POST', body }),
  fuelOverview: () => request('/fuel/overview'),
  createFuelTank: body => request('/fuel/tanks', { method: 'POST', body }),
  createFuelPump: body => request('/fuel/pumps', { method: 'POST', body }),
  openFuelShift: body => request('/fuel/shifts/open', { method: 'POST', body }),
  closeFuelShift: (id, body) => request(`/fuel/shifts/${id}/close`, { method: 'PATCH', body }),
  reviewFuelShift: (id, body) => request(`/fuel/shifts/${id}/review`, { method: 'PATCH', body }),
  createFuelDip: body => request('/fuel/dips', { method: 'POST', body }),
  reviewFuelDip: (id, body) => request(`/fuel/dips/${id}/review`, { method: 'PATCH', body }),
  createFuelDelivery: body => request('/fuel/deliveries', { method: 'POST', body }),
  financialAnalytics: (params = {}) => { const qs = new URLSearchParams(params).toString(); return request(`/analytics/financial${qs ? `?${qs}` : ''}`); },
  reconciliations: () => request('/reconciliations'),
  prepareReconciliation: params => request(`/reconciliations/prepare?${new URLSearchParams(params)}`),
  createReconciliation: body => request('/reconciliations', { method: 'POST', body }),
  reviewReconciliation: (id, body) => request(`/reconciliations/${id}`, { method: 'PATCH', body }),
  siteContent: () => request('/site/content'),
  updateSiteContent: body => request('/site/content', { method: 'PATCH', body }),
  payrollEmployees: () => request('/payroll/employees'),
  updatePayrollEmployee: (id, body) => request(`/payroll/employees/${id}`, { method: 'PATCH', body }),
  payrollRuns: () => request('/payroll/runs'),
  createPayrollRun: body => request('/payroll/runs', { method: 'POST', body }),
  updatePayrollRun: (id, body) => request(`/payroll/runs/${id}`, { method: 'PATCH', body }),
  smsCampaigns: () => request('/sms/campaigns'),
  createSmsCampaign: body => request('/sms/campaigns', { method: 'POST', body }),
  currencyConvert: params => request(`/tools/currency?${new URLSearchParams(params)}`),
  backupJson: () => request('/data/backup'),
  exportExcel: () => requestBlob('/data/export.xlsx'),
  restoreJson: body => request('/data/restore', { method: 'POST', body }),
  importExcel: body => request('/data/import.xlsx', { method: 'POST', body }),
  dataAudit: () => request('/data/audit'),
  performance: params => request(`/performance?${new URLSearchParams(params)}`),
  createReward: body => request('/performance/rewards', { method: 'POST', body }),
  updateReward: (id, body) => request(`/performance/rewards/${id}`, { method: 'PATCH', body }),
  activeSessions: () => request('/attendance/active'),
  attendanceHistory: (days = 7) => request(`/attendance/history?days=${days}`),
  shiftSchedules: () => request('/shift-schedules'),
  createShiftSchedule: body => request('/shift-schedules', { method: 'POST', body }),
  updateShiftSchedule: (id, body) => request(`/shift-schedules/${id}`, { method: 'PATCH', body }),
  workShifts: () => request('/work-shifts'),
  startWorkShift: body => request('/work-shifts/start', { method: 'POST', body }),
  closeWorkShift: (id, body) => request(`/work-shifts/${id}/close`, { method: 'PATCH', body }),
  reviewWorkShift: (id, body) => request(`/work-shifts/${id}/review`, { method: 'PATCH', body }),
  demoBatches: () => request('/demo/batches'),
  seedDemoData: body => request('/demo/seed', { method: 'POST', body }),
  deleteDemoBatch: id => request(`/demo/batches/${id}`, { method: 'DELETE' }),
};
