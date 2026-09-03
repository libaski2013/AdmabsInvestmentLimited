import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import {
  LayoutDashboard, Building2, ShoppingCart, Store, Package, Truck, Receipt,
  DollarSign, Users, ClipboardList, UserCheck, Bell, BarChart2, Shield, Settings,
  Fuel, Star, ChevronRight, ChevronDown, ChevronUp, MapPin, Check, X, XCircle,
  Plus, Minus, Send, Search, Edit, TrendingUp, TrendingDown, ArrowUpRight,
  Wallet, AlertTriangle, Menu, LogOut, Printer, Car,
} from 'lucide-react';
import { api, setToken } from '../api.js';
import './tailwind.css';

// ─── ROLE CONFIG (matches the real backend roles — same ones used in the mobile app) ───
const ROLE_CONFIG = {
  ceo: { label: 'CEO / Director', desc: 'Full read & write access to every module', color: 'bg-blue-900', initials: 'CE', Ic: Star, branch: 'Head Office' },
  gm: { label: 'General Manager', desc: 'Full operational access across all branches', color: 'bg-blue-800', initials: 'GM', Ic: Building2, branch: 'Head Office' },
  finance: { label: 'Finance Manager', desc: 'Finance, expenses and approvals', color: 'bg-blue-700', initials: 'FM', Ic: DollarSign, branch: 'Head Office' },
  branch: { label: 'Branch Manager', desc: 'Branch POS, inventory and staff', color: 'bg-blue-600', initials: 'BM', Ic: Store, branch: 'Harare Main' },
  staff: { label: 'Sales Attendant', desc: 'Point of sale and customer operations', color: 'bg-red-600', initials: 'SA', Ic: ShoppingCart, branch: 'Harare Main' },
  fuel: { label: 'Fuel Attendant', desc: 'Fuel station operations and shifts', color: 'bg-red-700', initials: 'FA', Ic: Fuel, branch: 'Fuel Station' },
};

const NAV_GROUPS = [
  { group: 'Overview', items: [{ id: 'dash', label: 'Dashboard', icon: LayoutDashboard }] },
  { group: 'Operations', items: [
    { id: 'pos', label: 'Point of Sale', icon: ShoppingCart },
    { id: 'mkt', label: 'Supermarket POS', icon: Store },
    { id: 'fuel', label: 'Fuel Station', icon: Fuel },
  ] },
  { group: 'Supply Chain', items: [
    { id: 'inv', label: 'Inventory', icon: Package },
    { id: 'proc', label: 'Procurement', icon: Truck },
    { id: 'expenses', label: 'Expenses', icon: Receipt },
  ] },
  { group: 'Finance & Sales', items: [
    { id: 'fin', label: 'Finance', icon: DollarSign },
    { id: 'cust', label: 'Customers', icon: Users },
    { id: 'approvals', label: 'Approvals', icon: ClipboardList },
  ] },
  { group: 'People & System', items: [
    { id: 'staff', label: 'Staff Directory', icon: UserCheck },
    { id: 'rep', label: 'Reports', icon: BarChart2 },
    { id: 'sett', label: 'Company & Branches', icon: Settings },
  ] },
];

const ROLE_MODULES = {
  ceo: ['dash', 'pos', 'mkt', 'fuel', 'inv', 'proc', 'expenses', 'fin', 'cust', 'approvals', 'staff', 'rep', 'sett'],
  gm: ['dash', 'pos', 'mkt', 'fuel', 'inv', 'proc', 'expenses', 'fin', 'cust', 'approvals', 'staff', 'rep', 'sett'],
  finance: ['dash', 'fin', 'expenses', 'approvals', 'cust', 'rep'],
  branch: ['dash', 'pos', 'mkt', 'inv', 'expenses', 'staff', 'rep'],
  staff: ['pos', 'mkt'],
  fuel: ['dash', 'fuel', 'expenses'],
};

// ─── SHARED UI ───
const Bd = ({ label, v = 'gray' }) => {
  const m = { red: 'bg-red-100 text-red-700', green: 'bg-green-100 text-green-700', blue: 'bg-blue-100 text-blue-700', yellow: 'bg-yellow-100 text-yellow-700', gray: 'bg-gray-100 text-gray-600', orange: 'bg-orange-100 text-orange-700' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${m[v] || m.gray}`}>{label}</span>;
};

const Kpi = ({ label, val, sub, pos, Ic, bg }) => (
  <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-start justify-between gap-3">
    <div className="min-w-0">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-base font-bold text-gray-800 mt-0.5 leading-tight">{val}</p>
      {sub && <p className={`text-xs mt-0.5 flex items-center gap-0.5 ${pos === true ? 'text-green-600' : pos === false ? 'text-red-500' : 'text-gray-400'}`}>{pos === true && <ArrowUpRight size={10} />}{pos === false && <TrendingDown size={10} />}{sub}</p>}
    </div>
    <div className={`${bg} w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0`}><Ic size={16} className="text-white" /></div>
  </div>
);

const Modal = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
    <div className={`bg-white rounded-2xl shadow-2xl flex flex-col ${wide ? 'w-full max-w-3xl' : 'w-full max-w-lg'}`} style={{ maxHeight: '90vh' }}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
        <h3 className="font-black text-blue-900 text-base">{title}</h3>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
      </div>
      <div className="overflow-y-auto p-5 flex-1">{children}</div>
    </div>
  </div>
);

const Tabs = ({ tabs, active, onChange }) => (
  <div className="flex flex-wrap gap-1.5">
    {tabs.map(t => (
      <button key={t.id} onClick={() => onChange(t.id)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${active === t.id ? 'bg-blue-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{t.label}</button>
    ))}
  </div>
);

const fmt = n => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const initialsOf = name => (name || '').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

// ─── LOGIN ───
function LoginScreen({ onLogin }) {
  const roles = Object.entries(ROLE_CONFIG);
  const [picked, setPicked] = useState(null);
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const pick = ([key]) => { setPicked(key); setU(key); setP(key); setErr(''); };
  const submit = async () => {
    if (!picked) { setErr('Select a role first'); return; }
    setLoading(true); setErr('');
    try {
      const res = await api.login(u, p);
      setToken(res.token);
      onLogin(res.user.role);
    } catch (e) {
      setErr(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center font-black text-white text-xl shadow-xl">A</div>
            <div><p className="text-white font-black text-3xl tracking-widest">ADMABS</p><p className="text-blue-300 text-xs tracking-widest">INTEGRATED BUSINESS PLATFORM</p></div>
          </div>
          <p className="text-blue-300 text-sm mt-1">Select a role to sign in — each role determines your screens and permissions</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {roles.map(([key, r]) => {
            const Ic = r.Ic;
            const active = picked === key;
            return (
              <button key={key} onClick={() => pick([key, r])} className={`group text-left rounded-2xl p-4 transition-all border ${active ? 'bg-white bg-opacity-15 border-white border-opacity-40' : 'bg-white bg-opacity-5 hover:bg-opacity-10 border-white border-opacity-10'}`}>
                <div className={`w-10 h-10 ${r.color} rounded-xl flex items-center justify-center shadow-lg mb-3`}><Ic size={17} className="text-white" /></div>
                <p className="font-black text-white text-sm leading-tight mb-1">{r.label}</p>
                <p className="text-blue-300 text-xs leading-relaxed mb-2">{r.desc}</p>
                <span className="text-blue-400 text-xs flex items-center gap-1"><MapPin size={9} />{r.branch}</span>
              </button>
            );
          })}
        </div>
        <div className="bg-white bg-opacity-5 border border-white border-opacity-10 rounded-2xl p-5 space-y-3">
          <div>
            <label className="block text-xs font-bold text-blue-300 tracking-wide mb-1">USERNAME</label>
            <input value={u} onChange={e => setU(e.target.value)} className="w-full bg-white bg-opacity-10 border border-white border-opacity-20 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-opacity-50" />
          </div>
          <div>
            <label className="block text-xs font-bold text-blue-300 tracking-wide mb-1">PASSWORD</label>
            <input type="password" value={p} onChange={e => setP(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} className="w-full bg-white bg-opacity-10 border border-white border-opacity-20 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-opacity-50" />
          </div>
          {err && <p className="text-red-300 text-xs font-semibold">⚠ {err}</p>}
          <button onClick={submit} disabled={loading} className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl text-white font-black text-sm flex items-center justify-center gap-2">
            {loading ? 'Signing in…' : <>Sign in <ChevronRight size={15} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD ───
function DashView() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.dashboard().then(setD).catch(e => setErr(e.message)); }, []);
  const div = d?.revenueByDivision?.length ? d.revenueByDivision : [];
  const colors = { 'Tyres & Batteries': '#1e3a8a', Battery: '#7c3aed', Fuel: '#dc2626', Supermarket: '#059669', Online: '#f59e0b' };
  const grossPct = d && d.revenue ? ((d.grossProfit / d.revenue) * 100).toFixed(1) : null;
  const netPct = d && d.revenue ? ((d.netProfit / d.revenue) * 100).toFixed(1) : null;

  return (
    <div className="space-y-5">
      <div><h2 className="text-xl font-black text-blue-900">Dashboard</h2><p className="text-sm text-gray-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p></div>
      {err && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-3">⚠ Couldn't reach the server: {err}</div>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Total Revenue" val={fmt(d?.revenue)} sub="Month to date" Ic={TrendingUp} bg="bg-blue-900" />
        <Kpi label="Gross Profit" val={fmt(d?.grossProfit)} sub={grossPct ? `${grossPct}% margin` : '—'} pos={true} Ic={Wallet} bg="bg-blue-700" />
        <Kpi label="Net Profit" val={fmt(d?.netProfit)} sub={netPct ? `${netPct}% margin` : '—'} pos={true} Ic={Star} bg="bg-blue-600" />
        <Kpi label="Receivables" val={fmt(d?.receivables)} sub="Outstanding" pos={false} Ic={DollarSign} bg="bg-red-600" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <h3 className="font-bold text-sm text-gray-800 mb-4">Revenue Trend (last 5 months, $'000)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={d?.revenueTrend || []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs><linearGradient id="gf" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1e3a8a" stopOpacity={0.25} /><stop offset="95%" stopColor="#1e3a8a" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
              <XAxis dataKey="m" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="t" name="Tyres" stroke="#1e3a8a" fill="url(#gf)" strokeWidth={2} />
              <Area type="monotone" dataKey="f" name="Fuel" stroke="#dc2626" fill="none" strokeWidth={2} />
              <Area type="monotone" dataKey="s" name="Supermarket" stroke="#059669" fill="none" strokeWidth={2} />
              <Area type="monotone" dataKey="o" name="Online" stroke="#7c3aed" fill="none" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <h3 className="font-bold text-sm text-gray-800 mb-3">Revenue by Division</h3>
          {div.length ? (<>
            <ResponsiveContainer width="100%" height={130}>
              <PieChart><Pie data={div} dataKey="v" nameKey="n" cx="50%" cy="50%" innerRadius={36} outerRadius={54} paddingAngle={3}>{div.map((e, i) => <Cell key={i} fill={colors[e.n] || '#94a3b8'} />)}</Pie><Tooltip formatter={v => fmt(v)} /></PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 mt-2">{div.map((x, i) => (<div key={i} className="flex items-center justify-between text-xs"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colors[x.n] || '#94a3b8' }} /><span className="text-gray-600">{x.n}</span></div><span className="font-bold text-gray-800">{fmt(x.v)}</span></div>))}</div>
          </>) : <p className="text-xs text-gray-400 py-8 text-center">No sales recorded yet this month.</p>}
        </div>
      </div>
      <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
        <h3 className="font-bold text-sm text-gray-800 mb-3">Live Alerts</h3>
        <div className="space-y-2">{(d?.alerts || []).length ? d.alerts.map((a, i) => (<div key={i} className="flex items-start gap-2 p-2.5 rounded-lg text-xs bg-orange-50 text-orange-800"><AlertTriangle size={11} className="flex-shrink-0 mt-0.5" /><span>{a.m}</span></div>)) : <p className="text-xs text-gray-400">No alerts right now.</p>}</div>
      </div>
    </div>
  );
}

// ─── POS (shared cart/checkout logic for both Tyres/Batteries and Supermarket) ───
function usePos(categoryFilter) {
  const [cart, setCart] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [done, setDone] = useState(null);

  useEffect(() => {
    api.products().then(list => setCatalog(list.filter(categoryFilter).map(p => ({ id: p._id, n: p.name, price: p.price, cat: p.category, icon: p.icon }))))
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const add = p => setCart(c => { const e = c.find(i => i.id === p.id); return e ? c.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i) : [...c, { ...p, qty: 1 }]; });
  const changeQty = (id, d) => setCart(c => c.map(i => i.id === id ? { ...i, qty: Math.max(1, i.qty + d) } : i));
  const removeItem = id => setCart(c => c.filter(i => i.id !== id));
  const sub = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const vat = sub * 0.15;
  const total = sub + vat;

  const charge = (paymentMethod) => {
    setSaving(true); setSaveErr('');
    return api.createSale({ items: cart.map(i => ({ product: i.id, name: i.n, category: i.cat, price: i.price, qty: i.qty })), paymentMethod })
      .then(sale => { setDone({ ...sale, sub, vat, total, paymentMethod, items: cart }); setCart([]); })
      .catch(e => setSaveErr(e.message))
      .finally(() => setSaving(false));
  };

  return { cart, catalog, loading, saving, saveErr, done, setDone, add, changeQty, removeItem, sub, vat, total, charge };
}

function PosPanel({ title, color, categoryFilter, categories }) {
  const pos = usePos(categoryFilter);
  const [cat, setCat] = useState('All');
  const [search, setSearch] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const filtered = pos.catalog.filter(p => (cat === 'All' || p.cat === cat) && (!search || p.n.toLowerCase().includes(search.toLowerCase())));

  if (pos.done) {
    const r = pos.done;
    return (
      <Modal title="Receipt" onClose={() => pos.setDone(null)}>
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-2"><Check size={22} className="text-white" /></div>
            <p className="font-black text-green-800">{r.invoiceNumber}</p>
          </div>
          <div className="border border-dashed border-gray-200 rounded-xl p-4 font-mono text-xs bg-gray-50 space-y-1">
            <p className="text-center font-black text-blue-900 mb-2">ADMABS</p>
            {r.items.map((i, j) => <div key={j} className="flex justify-between"><span>{i.n} ×{i.qty}</span><span className="font-bold">{fmt(i.price * i.qty)}</span></div>)}
            <div className="border-t border-dashed border-gray-200 pt-1 mt-1">
              <div className="flex justify-between"><span>VAT 15%</span><span>{fmt(r.vat)}</span></div>
              <div className="flex justify-between font-black"><span>TOTAL</span><span>{fmt(r.total)}</span></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className="flex items-center justify-center gap-1.5 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-600"><Printer size={13} /> Print</button>
            <button onClick={() => pos.setDone(null)} className={`py-2.5 ${color} rounded-xl text-xs font-bold text-white`}>New Sale</button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <div className="space-y-4">
      <div><h2 className="text-xl font-black text-blue-900">{title}</h2><p className="text-sm text-gray-500">Ring up a sale — posts straight to the real backend and updates stock.</p></div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-4">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
            <Search size={12} className="text-gray-400 flex-shrink-0" />
            <input placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)} className="flex-1 text-xs outline-none bg-transparent text-gray-700" />
          </div>
          <Tabs tabs={[{ id: 'All', label: 'All' }, ...categories.map(c => ({ id: c, label: c }))]} active={cat} onChange={setCat} />
          {pos.loading ? <p className="text-xs text-gray-400">Loading…</p> : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {filtered.map((p, i) => (
                <button key={i} onClick={() => pos.add(p)} className="text-left p-3 rounded-xl border border-gray-100 hover:border-blue-300 hover:bg-blue-50 transition-all">
                  <p className="text-xs font-bold text-gray-800 leading-tight">{p.n}</p>
                  <p className="text-xs text-blue-700 font-bold mt-1">{fmt(p.price)}</p>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden self-start">
          <div className={`${color} px-4 py-3 flex items-center justify-between`}>
            <p className="text-white font-black text-sm">Cart · {pos.cart.length} item{pos.cart.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
            {pos.cart.length === 0 && <p className="text-center text-xs text-gray-300 py-6">Cart is empty</p>}
            {pos.cart.map((item, i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-2.5">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-xs font-bold text-gray-800 leading-tight flex-1">{item.n}</p>
                  <button onClick={() => pos.removeItem(item.id)} className="text-gray-300 hover:text-red-500 flex-shrink-0"><X size={11} /></button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button onClick={() => pos.changeQty(item.id, -1)} className="w-6 h-6 rounded bg-gray-200 hover:bg-red-100 flex items-center justify-center"><Minus size={10} /></button>
                    <span className="text-xs font-black w-5 text-center">{item.qty}</span>
                    <button onClick={() => pos.changeQty(item.id, 1)} className="w-6 h-6 rounded bg-gray-200 hover:bg-blue-100 flex items-center justify-center"><Plus size={10} /></button>
                  </div>
                  <p className="text-xs font-black text-blue-900">{fmt(item.price * item.qty)}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 px-4 py-3 space-y-1 text-xs">
            <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{fmt(pos.sub)}</span></div>
            <div className="flex justify-between text-gray-500"><span>VAT 15%</span><span>{fmt(pos.vat)}</span></div>
            <div className="flex justify-between font-black text-blue-900 text-sm pt-1 border-t border-gray-100"><span>TOTAL</span><span>{fmt(pos.total)}</span></div>
          </div>
          <div className="px-4 pb-3 flex flex-wrap gap-1.5">
            {['Cash', 'Card', 'EcoCash', 'Bank Transfer'].map(m => (
              <button key={m} onClick={() => setPayMethod(m)} className={`px-2.5 py-1 rounded-full text-xs font-bold border ${payMethod === m ? 'bg-blue-900 text-white border-blue-900' : 'border-gray-200 text-gray-500'}`}>{m}</button>
            ))}
          </div>
          {pos.saveErr && <p className="px-4 text-xs text-red-600 mb-2">⚠ {pos.saveErr}</p>}
          <div className="p-3 pt-0">
            <button onClick={() => pos.cart.length && pos.charge(payMethod)} disabled={pos.cart.length === 0 || pos.saving} className={`w-full ${color} disabled:opacity-40 text-white font-black text-sm py-3 rounded-xl`}>
              {pos.saving ? 'Processing…' : `Charge ${fmt(pos.total)} →`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const PosView = () => <PosPanel title="Point of Sale" color="bg-red-600" categoryFilter={p => ['Tyre', 'Battery', 'Service'].includes(p.category)} categories={['Tyre', 'Battery', 'Service']} />;
const MktView = () => <PosPanel title="Supermarket POS" color="bg-green-600" categoryFilter={p => ['Grocery', 'Beverages', 'Snacks', 'Household', 'Dairy', 'Bakery'].includes(p.category)} categories={['Grocery', 'Beverages', 'Snacks', 'Household', 'Dairy', 'Bakery']} />;

// ─── INVENTORY ───
function InvView() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  useEffect(() => { api.products().then(setProducts).catch(() => {}).finally(() => setLoading(false)); }, []);
  const low = products.filter(p => p.qty <= p.reorderLevel);
  const filtered = filter === 'low' ? low : products;
  const stockValue = products.reduce((s, p) => s + p.qty * (p.cost || 0), 0);

  return (
    <div className="space-y-5">
      <div><h2 className="text-xl font-black text-blue-900">Inventory</h2><p className="text-sm text-gray-500">Real stock levels across all categories</p></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Total SKUs" val={String(products.length)} Ic={Package} bg="bg-blue-900" />
        <Kpi label="Low Stock" val={String(low.length)} pos={false} Ic={AlertTriangle} bg="bg-red-600" />
        <Kpi label="Stock Value" val={fmt(stockValue)} Ic={DollarSign} bg="bg-blue-700" />
        <Kpi label="Categories" val={String(new Set(products.map(p => p.category)).size)} Ic={Store} bg="bg-blue-600" />
      </div>
      <Tabs tabs={[{ id: 'all', label: 'All' }, { id: 'low', label: `Low Stock (${low.length})` }]} active={filter} onChange={setFilter} />
      {loading ? <p className="text-xs text-gray-400">Loading…</p> : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50"><tr>{['Code', 'Product', 'Category', 'Qty', 'Price'].map(h => <th key={h} className="px-4 py-2.5 text-left font-semibold text-gray-400 uppercase">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-blue-600 font-bold">{p.code}</td>
                    <td className="px-4 py-2.5 font-semibold text-gray-800">{p.name}</td>
                    <td className="px-4 py-2.5"><Bd label={p.category} v="gray" /></td>
                    <td className="px-4 py-2.5 font-bold"><span className={p.qty <= p.reorderLevel ? 'text-red-600' : 'text-gray-800'}>{p.qty}</span></td>
                    <td className="px-4 py-2.5 font-bold">{fmt(p.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PROCUREMENT ───
function ProcView() {
  const [tab, setTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [supplier, setSupplier] = useState('');
  const [lines, setLines] = useState([{ description: '', qty: '', unitCost: '' }]);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(null);

  const load = () => Promise.all([api.purchaseOrders(), api.suppliers()]).then(([o, s]) => { setOrders(o); setSuppliers(s); }).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const addLine = () => setLines(l => [...l, { description: '', qty: '', unitCost: '' }]);
  const removeLine = i => setLines(l => l.filter((_, j) => j !== i));
  const upd = (i, k, v) => setLines(l => l.map((ln, j) => j === i ? { ...ln, [k]: v } : ln));
  const poTotal = lines.reduce((s, l) => s + (parseFloat(l.qty || 0) * parseFloat(l.unitCost || 0)), 0);

  const submit = () => {
    if (!supplier || poTotal === 0) return;
    const items = lines.filter(l => l.description && l.qty && l.unitCost).map(l => ({ description: l.description, qty: parseFloat(l.qty), unitCost: parseFloat(l.unitCost) }));
    api.createPurchaseOrder({ supplier, items }).then(() => { setSubmitted(true); load(); });
  };

  const act = (id, status) => { setBusy(id); api.updatePurchaseOrder(id, { status }).then(load).finally(() => setBusy(null)); };

  return (
    <div className="space-y-5">
      <div><h2 className="text-xl font-black text-blue-900">Procurement</h2><p className="text-sm text-gray-500">Purchase orders and supplier accounts</p></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Open POs" val={String(orders.filter(o => o.status !== 'delivered').length)} Ic={Truck} bg="bg-blue-900" />
        <Kpi label="Pending Approval" val={String(orders.filter(o => o.status === 'pending').length)} pos={false} Ic={AlertTriangle} bg="bg-red-600" />
        <Kpi label="Payables" val={fmt(suppliers.reduce((s, x) => s + x.balance, 0))} Ic={DollarSign} bg="bg-blue-700" />
        <Kpi label="Suppliers" val={String(suppliers.length)} Ic={Building2} bg="bg-blue-600" />
      </div>
      <Tabs tabs={[{ id: 'orders', label: 'Purchase Orders' }, { id: 'suppliers', label: 'Suppliers' }, { id: 'newpo', label: 'Create PO' }]} active={tab} onChange={setTab} />
      {loading ? <p className="text-xs text-gray-400">Loading…</p> : <>
        {tab === 'orders' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto"><table className="w-full text-xs">
              <thead className="bg-gray-50"><tr>{['PO Number', 'Supplier', 'Total', 'Status', ''].map(h => <th key={h} className="px-4 py-2.5 text-left font-semibold text-gray-400 uppercase whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map((o, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono font-bold text-blue-700">{o.poNumber}</td>
                    <td className="px-4 py-2.5 font-semibold text-gray-800">{o.supplier?.name}</td>
                    <td className="px-4 py-2.5 font-bold">{fmt(o.amount)}</td>
                    <td className="px-4 py-2.5"><Bd label={o.status} v={o.status === 'delivered' ? 'green' : o.status === 'pending' ? 'yellow' : 'blue'} /></td>
                    <td className="px-4 py-2.5">
                      {o.status === 'pending' && <button disabled={busy === o._id} onClick={() => act(o._id, 'approved')} className="text-xs font-bold text-blue-700 hover:underline">Approve</button>}
                      {o.status === 'approved' && <button disabled={busy === o._id} onClick={() => act(o._id, 'delivered')} className="text-xs font-bold text-green-700 hover:underline">Mark Delivered</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )}
        {tab === 'suppliers' && (
          <div className="space-y-3">
            {suppliers.map((s, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-start justify-between gap-3">
                <div><p className="font-bold text-sm text-gray-800">{s.name}</p><p className="text-xs text-gray-400 mt-0.5">{s.type} · {s.ordersCount} orders</p></div>
                <p className={`font-black text-sm ${s.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>{s.balance > 0 ? fmt(s.balance) : 'Clear'}</p>
              </div>
            ))}
          </div>
        )}
        {tab === 'newpo' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            {submitted ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3"><Check size={22} className="text-white" /></div>
                <p className="font-black text-green-800 text-lg">PO Created!</p>
                <button onClick={() => { setSubmitted(false); setLines([{ description: '', qty: '', unitCost: '' }]); setSupplier(''); setTab('orders'); }} className="mt-4 px-5 py-2 bg-blue-900 text-white text-sm rounded-xl font-bold">Done</button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Supplier</label>
                  <select value={supplier} onChange={e => setSupplier(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs bg-gray-50 outline-none">
                    <option value="">Select…</option>
                    {suppliers.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2"><h4 className="font-bold text-sm text-gray-800">Order Lines</h4><button onClick={addLine} className="text-xs text-blue-700 font-bold flex items-center gap-1"><Plus size={11} /> Add</button></div>
                  <div className="space-y-2">
                    {lines.map((l, i) => (
                      <div key={i} className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-xl p-2.5">
                        <input placeholder="Description" value={l.description} onChange={e => upd(i, 'description', e.target.value)} className="col-span-5 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white outline-none" />
                        <input type="number" placeholder="Qty" value={l.qty} onChange={e => upd(i, 'qty', e.target.value)} className="col-span-2 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center bg-white outline-none" />
                        <input type="number" placeholder="Unit Cost" value={l.unitCost} onChange={e => upd(i, 'unitCost', e.target.value)} className="col-span-3 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center bg-white outline-none" />
                        <div className="col-span-1 text-xs font-bold text-blue-900 text-center">{l.qty && l.unitCost ? fmt(l.qty * l.unitCost) : ''}</div>
                        <div className="col-span-1 flex justify-end">{lines.length > 1 && <button onClick={() => removeLine(i)} className="w-6 h-6 rounded bg-red-100 hover:bg-red-200 flex items-center justify-center text-red-600"><X size={10} /></button>}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between bg-blue-50 rounded-xl px-4 py-3"><span className="text-sm font-bold text-blue-900">Total</span><span className="text-lg font-black text-blue-900">{fmt(poTotal)}</span></div>
                </div>
                <button onClick={submit} disabled={!supplier || poTotal === 0} className="w-full py-3 bg-blue-900 disabled:opacity-40 text-white font-black rounded-xl flex items-center justify-center gap-2"><Send size={14} /> Submit PO</button>
              </div>
            )}
          </div>
        )}
      </>}
    </div>
  );
}

// ─── EXPENSES ───
function ExpensesView() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [form, setForm] = useState({ description: '', amount: '', category: 'Admin', branch: '' });
  const load = () => api.expenses().then(setItems).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);
  const act = (id, status) => { setBusy(id); api.updateExpense(id, { status }).then(load).finally(() => setBusy(null)); };
  const submit = () => { if (!form.description || !form.amount) return; api.createExpense({ ...form, amount: parseFloat(form.amount) }).then(() => { setForm({ description: '', amount: '', category: 'Admin', branch: '' }); load(); }); };
  const pending = items.filter(e => e.status === 'pending');

  return (
    <div className="space-y-5">
      <div><h2 className="text-xl font-black text-blue-900">Expenses</h2><p className="text-sm text-gray-500">Branch expenses and claims</p></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Total Claims" val={String(items.length)} Ic={Receipt} bg="bg-blue-900" />
        <Kpi label="Pending" val={fmt(pending.reduce((s, e) => s + e.amount, 0))} pos={false} Ic={AlertTriangle} bg="bg-yellow-500" />
        <Kpi label="Approved" val={String(items.filter(e => e.status === 'approved').length)} Ic={Check} bg="bg-green-600" />
        <Kpi label="Rejected" val={String(items.filter(e => e.status === 'rejected').length)} Ic={X} bg="bg-red-600" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {loading ? <p className="text-xs text-gray-400 p-4">Loading…</p> : items.filter(e => e.status !== 'rejected').map(e => (
            <div key={e._id} className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
              <div><div className="flex flex-wrap items-center gap-2 mb-0.5"><Bd label={e.category} v="gray" /><span className="text-xs text-gray-400">{e.branch || '—'} · {e.submittedBy}</span></div><p className="text-xs font-bold text-gray-800">{e.description}</p></div>
              <div className="flex items-center gap-2">
                <div className="text-right"><p className="font-black text-sm text-blue-900">{fmt(e.amount)}</p><Bd label={e.status} v={e.status === 'approved' ? 'green' : 'yellow'} /></div>
                {e.status === 'pending' && <div className="flex gap-1"><button disabled={busy === e._id} onClick={() => act(e._id, 'approved')} className="p-1.5 rounded bg-green-50 text-green-600"><Check size={12} /></button><button disabled={busy === e._id} onClick={() => act(e._id, 'rejected')} className="p-1.5 rounded bg-red-50 text-red-600"><X size={12} /></button></div>}
              </div>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3 self-start">
          <h4 className="font-bold text-sm text-gray-800">Submit Claim</h4>
          <input placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-gray-50 outline-none" />
          <input type="number" placeholder="Amount" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-gray-50 outline-none" />
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-gray-50 outline-none">
            {['Vehicle', 'Admin', 'Entertainment', 'Utilities', 'Facilities'].map(c => <option key={c}>{c}</option>)}
          </select>
          <input placeholder="Branch" value={form.branch} onChange={e => setForm(f => ({ ...f, branch: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-gray-50 outline-none" />
          <button onClick={submit} disabled={!form.description || !form.amount} className="w-full py-2.5 bg-blue-900 disabled:opacity-40 text-white text-xs font-bold rounded-xl">Submit</button>
        </div>
      </div>
    </div>
  );
}

// ─── CUSTOMERS ───
function CustView() {
  const [customers, setCustomers] = useState([]);
  const [selId, setSelId] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.customers().then(list => { setCustomers(list); if (list[0]) setSelId(list[0]._id); }).catch(() => {}).finally(() => setLoading(false)); }, []);
  const sel = customers.find(c => c._id === selId);
  const creditOut = customers.reduce((s, c) => s + (c.balance > 0 ? c.balance : 0), 0);

  return (
    <div className="space-y-5">
      <div><h2 className="text-xl font-black text-blue-900">Customers & Fleet</h2><p className="text-sm text-gray-500">Accounts, credit balances and loyalty</p></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Customers" val={String(customers.length)} Ic={Users} bg="bg-blue-900" />
        <Kpi label="Fleet & Corporate" val={String(customers.filter(c => c.type !== 'Retail').length)} Ic={Truck} bg="bg-blue-700" />
        <Kpi label="Credit Outstanding" val={fmt(creditOut)} pos={false} Ic={DollarSign} bg="bg-red-600" />
        <Kpi label="Loyalty Points Issued" val={String(customers.reduce((s, c) => s + (c.loyaltyPoints || 0), 0))} Ic={Star} bg="bg-blue-600" />
      </div>
      {loading ? <p className="text-xs text-gray-400">Loading…</p> : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-2 space-y-2">
            {customers.map(c => (
              <button key={c._id} onClick={() => setSelId(c._id)} className={`w-full text-left bg-white rounded-xl border p-3.5 shadow-sm transition-all hover:shadow-md ${selId === c._id ? 'border-blue-400 ring-1 ring-blue-200' : 'border-gray-100'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-black flex-shrink-0 ${c.type === 'Corporate' ? 'bg-purple-600' : c.type === 'Fleet' ? 'bg-blue-700' : 'bg-gray-600'}`}>{initialsOf(c.name)}</div>
                    <div className="min-w-0"><p className="text-xs font-black text-gray-800 truncate">{c.name}</p><p className="text-xs text-gray-400">{c.type}</p></div>
                  </div>
                  {c.balance > 0 ? <p className="text-xs font-bold text-red-600">{fmt(c.balance)}</p> : <p className="text-xs font-bold text-green-600">Clear</p>}
                </div>
              </button>
            ))}
          </div>
          {sel && (
            <div className="lg:col-span-3">
              <div className="bg-blue-900 rounded-xl p-5 text-white">
                <div className="flex items-start justify-between gap-3 mb-4"><div><h3 className="font-black text-lg">{sel.name}</h3><p className="text-sm opacity-70">{sel.type} · {sel.visits} visits</p></div></div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[['Phone', sel.phone || '—'], ['Balance', fmt(sel.balance)], ['Loyalty Points', String(sel.loyaltyPoints || 0)], ['Last Visit', sel.lastVisit ? new Date(sel.lastVisit).toLocaleDateString() : '—']].map(([k, v], i) => (
                    <div key={i} className="bg-white bg-opacity-10 rounded-xl p-2.5"><p className="opacity-60 mb-0.5">{k}</p><p className="font-bold">{v}</p></div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── APPROVALS ───
function ApprovalsView({ onChanged }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const load = () => api.approvals().then(setItems).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);
  const act = (id, status) => { setBusy(id); api.updateApproval(id, { status }).then(() => { load(); onChanged && onChanged(); }).finally(() => setBusy(null)); };
  const pending = items.filter(i => i.status === 'pending');

  return (
    <div className="space-y-5">
      <div><h2 className="text-xl font-black text-blue-900">Approvals</h2><p className="text-sm text-gray-500">Review and authorise pending requests</p></div>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center"><p className="text-2xl font-black text-yellow-700">{pending.length}</p><p className="text-xs font-bold text-yellow-600">Awaiting</p></div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center"><p className="text-2xl font-black text-green-700">{items.filter(i => i.status === 'approved').length}</p><p className="text-xs font-bold text-green-600">Approved</p></div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center"><p className="text-2xl font-black text-red-700">{items.filter(i => i.status === 'rejected').length}</p><p className="text-xs font-bold text-red-600">Rejected</p></div>
      </div>
      {loading ? <p className="text-xs text-gray-400">Loading…</p> : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item._id} className={`bg-white rounded-xl border shadow-sm p-4 ${item.status === 'pending' ? 'border-yellow-200' : 'border-gray-100'}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2"><Bd label={item.type} v="blue" /><Bd label={item.priority} v={item.priority === 'high' ? 'red' : item.priority === 'medium' ? 'orange' : 'gray'} /><Bd label={item.status} v={item.status === 'approved' ? 'green' : item.status === 'rejected' ? 'red' : 'yellow'} /></div>
                  <p className="text-sm font-bold text-gray-800">{item.description}</p>
                  <p className="text-xs text-gray-400 mt-1">{item.requestedBy} · {new Date(item.createdAt).toLocaleDateString()} · <span className="font-bold text-gray-700">{fmt(item.amount)}</span></p>
                </div>
                {item.status === 'pending' ? (
                  <div className="flex gap-2 flex-shrink-0">
                    <button disabled={busy === item._id} onClick={() => act(item._id, 'rejected')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-red-600 text-xs font-bold"><XCircle size={12} /> Reject</button>
                    <button disabled={busy === item._id} onClick={() => act(item._id, 'approved')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-900 text-white text-xs font-bold"><Check size={12} /> Approve</button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── FINANCE ───
function FinView() {
  const [d, setD] = useState(null);
  useEffect(() => { api.dashboard().then(setD).catch(() => {}); }, []);
  return (
    <div className="space-y-5">
      <div><h2 className="text-xl font-black text-blue-900">Finance</h2><p className="text-sm text-gray-500">Month-to-date position, from live sales and expenses</p></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Revenue MTD" val={fmt(d?.revenue)} Ic={TrendingUp} bg="bg-blue-900" />
        <Kpi label="Gross Profit" val={fmt(d?.grossProfit)} Ic={Wallet} bg="bg-blue-700" />
        <Kpi label="Net Profit" val={fmt(d?.netProfit)} Ic={Star} bg="bg-blue-600" />
        <Kpi label="Receivables" val={fmt(d?.receivables)} pos={false} Ic={DollarSign} bg="bg-red-600" />
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        <div className="px-5 py-2.5 bg-blue-900 flex justify-between text-xs font-black text-white"><span>REVENUE BY DIVISION</span><span>{fmt(d?.revenue)}</span></div>
        {(d?.revenueByDivision || []).map((x, i) => (
          <div key={i} className="px-5 py-2.5 flex justify-between text-xs pl-10"><span className="text-gray-500">{x.n}</span><span className="font-semibold">{fmt(x.v)}</span></div>
        ))}
        <div className="px-5 py-3 bg-green-50 flex justify-between text-sm font-black"><span className="text-green-900">NET PROFIT</span><span className="text-green-800">{fmt(d?.netProfit)}</span></div>
      </div>
      <p className="text-xs text-gray-400">Full ledger, VAT and bank reconciliation are on the mobile app's Finance module and coming to this view next.</p>
    </div>
  );
}

// ─── STAFF DIRECTORY ───
function StaffView() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  useEffect(() => { api.users().then(setUsers).catch(e => setErr(e.message)).finally(() => setLoading(false)); }, []);
  return (
    <div className="space-y-5">
      <div><h2 className="text-xl font-black text-blue-900">Staff Directory</h2><p className="text-sm text-gray-500">Registered accounts and roles</p></div>
      {err && <p className="text-xs text-red-600">{err === 'Forbidden' ? "Your role doesn't have access to the staff directory." : err}</p>}
      {loading ? <p className="text-xs text-gray-400">Loading…</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {users.map(u => {
            const rc = ROLE_CONFIG[u.role];
            return (
              <div key={u._id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 ${rc?.color || 'bg-gray-500'} rounded-xl flex items-center justify-center text-white text-xs font-black flex-shrink-0`}>{initialsOf(u.name)}</div>
                  <div><p className="text-sm font-bold text-gray-800">{u.name}</p><p className="text-xs text-gray-500 mt-0.5">{rc?.label || u.role}</p><p className="text-xs text-gray-400 mt-0.5">{u.branch?.name || '—'}</p></div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-50 flex justify-between items-center text-xs"><span className="text-gray-400">{u.username}</span><Bd label={u.active ? 'Active' : 'Inactive'} v={u.active ? 'green' : 'red'} /></div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── REPORTS ───
function RepView() {
  const [d, setD] = useState(null);
  useEffect(() => { api.dashboard().then(setD).catch(() => {}); }, []);
  return (
    <div className="space-y-5">
      <div><h2 className="text-xl font-black text-blue-900">Reports</h2><p className="text-sm text-gray-500">Revenue trend built from real sales data</p></div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-black text-gray-800 mb-4">Monthly Revenue Trend ($'000)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={d?.revenueTrend || []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
            <XAxis dataKey="m" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip /><Legend />
            <Bar dataKey="t" name="Tyres" fill="#1e3a8a" radius={[3, 3, 0, 0]} />
            <Bar dataKey="f" name="Fuel" fill="#dc2626" radius={[3, 3, 0, 0]} />
            <Bar dataKey="s" name="Supermarket" fill="#059669" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── FUEL (not yet backed by real tank/pump data — honest placeholder) ───
function FuelView() {
  return (
    <div className="flex flex-col items-center justify-center h-80 text-center">
      <div className="w-16 h-16 bg-red-700 rounded-2xl flex items-center justify-center mb-4 shadow-lg"><Fuel size={28} className="text-white" /></div>
      <h2 className="text-xl font-black text-gray-800">Fuel Station Operations</h2>
      <p className="text-sm text-gray-400 mt-2 max-w-sm">Tank dips, pump shifts and reconciliation exist in the mobile app on sample data today — wiring them to real numbers here is next up.</p>
      <Bd label="Coming Next" v="orange" />
    </div>
  );
}

// ─── COMPANY & BRANCHES ───
function SettView() {
  const [branches, setBranches] = useState([]);
  useEffect(() => { api.branches().then(setBranches).catch(() => {}); }, []);
  return (
    <div className="space-y-5">
      <div><h2 className="text-xl font-black text-blue-900">Company & Branches</h2><p className="text-sm text-gray-500">Registered branches</p></div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-xs">
          <thead className="bg-gray-50"><tr>{['Branch', 'Type', 'Manager', 'Staff'].map(h => <th key={h} className="px-4 py-2.5 text-left font-semibold text-gray-400 uppercase">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-50">
            {branches.map((b, i) => (
              <tr key={i} className="hover:bg-gray-50"><td className="px-4 py-3 font-bold text-gray-800">{b.name}</td><td className="px-4 py-3"><Bd label={b.type} v="gray" /></td><td className="px-4 py-3 text-gray-600">{b.manager}</td><td className="px-4 py-3 text-gray-500">{b.staffCount}</td></tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}

const SECTIONS = { dash: DashView, pos: PosView, mkt: MktView, fuel: FuelView, inv: InvView, proc: ProcView, expenses: ExpensesView, fin: FinView, cust: CustView, staff: StaffView, rep: RepView, sett: SettView };

// ─── SHELL ───
export default function DesktopApp() {
  const [role, setRole] = useState(null);
  const [active, setActive] = useState('dash');
  const [sideOpen, setSideOpen] = useState(true);
  const [pendingApprovals, setPendingApprovals] = useState(0);

  const refreshApprovals = () => api.approvals().then(list => setPendingApprovals(list.filter(a => a.status === 'pending').length)).catch(() => {});
  useEffect(() => { if (role) refreshApprovals(); }, [role]);

  if (!role) return <LoginScreen onLogin={r => { setRole(r); const allowed = ROLE_MODULES[r] || []; setActive(allowed[0] || 'dash'); }} />;

  const rc = ROLE_CONFIG[role];
  const allowedModules = ROLE_MODULES[role] || [];
  const navGroups = NAV_GROUPS.map(g => ({ ...g, items: g.items.filter(i => allowedModules.includes(i.id)) })).filter(g => g.items.length > 0);
  const allNavItems = navGroups.flatMap(g => g.items);
  const activeLabel = allNavItems.find(n => n.id === active)?.label || 'Dashboard';

  const renderView = () => {
    if (active === 'approvals') return <ApprovalsView onChanged={refreshApprovals} />;
    const V = SECTIONS[active];
    return V ? <V /> : <DashView />;
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden" style={{ fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      <aside className={`${sideOpen ? 'w-60' : 'w-16'} bg-blue-900 flex flex-col flex-shrink-0 transition-all duration-300 overflow-hidden`}>
        <div className={`flex items-center gap-2.5 px-3 py-4 border-b border-blue-800 flex-shrink-0 ${!sideOpen ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 bg-red-600 rounded-xl flex items-center justify-center font-black text-white text-sm flex-shrink-0 shadow-lg">A</div>
          {sideOpen && <div><p className="font-black text-white text-sm tracking-widest leading-none">ADMABS</p><p className="text-blue-400 text-xs mt-0.5">Business Platform</p></div>}
        </div>
        {sideOpen && (
          <div className="mx-2 mt-2 mb-1 p-2.5 rounded-xl border border-blue-800 flex items-center gap-2.5">
            <div className={`w-8 h-8 ${rc.color} rounded-lg flex items-center justify-center text-white text-xs font-black flex-shrink-0`}>{rc.initials}</div>
            <div className="min-w-0"><p className="text-white text-xs font-bold leading-tight truncate">{rc.label}</p><p className="text-blue-400 text-xs truncate">{rc.branch}</p></div>
          </div>
        )}
        <nav className="flex-1 overflow-y-auto py-2 px-1.5 space-y-3">
          {navGroups.map(group => (
            <div key={group.group}>
              {sideOpen && <p className="text-blue-400 text-xs font-bold uppercase tracking-widest px-2 py-1 mt-1" style={{ fontSize: 9, opacity: 0.5 }}>{group.group}</p>}
              {group.items.map(n => {
                const Ic = n.icon;
                const badge = n.id === 'approvals' ? pendingApprovals : null;
                return (
                  <button key={n.id} onClick={() => setActive(n.id)} title={n.label} className={`w-full flex items-center gap-2.5 px-2 py-2.5 rounded-xl transition-all font-medium relative ${active === n.id ? 'bg-red-600 text-white shadow-sm' : 'text-blue-300 hover:bg-blue-800 hover:text-white'} ${!sideOpen ? 'justify-center' : ''}`}>
                    <Ic size={15} className="flex-shrink-0" />
                    {sideOpen && <span className="text-xs truncate">{n.label}</span>}
                    {badge > 0 && sideOpen && <span className="ml-auto bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-black flex-shrink-0">{badge}</span>}
                    {badge > 0 && !sideOpen && <span className="absolute top-1 right-1 bg-red-500 w-2 h-2 rounded-full" />}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="border-t border-blue-800 p-2 space-y-1 flex-shrink-0">
          <button onClick={() => setRole(null)} className={`w-full flex items-center gap-2 px-2 py-2 rounded-xl text-blue-300 hover:bg-blue-800 hover:text-white transition-colors ${!sideOpen ? 'justify-center' : ''}`}>
            <LogOut size={13} className="flex-shrink-0" />{sideOpen && <span className="text-xs">Switch Role</span>}
          </button>
          <button onClick={() => setSideOpen(!sideOpen)} className={`w-full flex items-center gap-2 px-2 py-2 rounded-xl text-blue-300 hover:bg-blue-800 hover:text-white transition-colors ${!sideOpen ? 'justify-center' : ''}`}>
            <Menu size={13} className="flex-shrink-0" />{sideOpen && <span className="text-xs">Collapse</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0 shadow-sm">
          <div><h1 className="text-sm font-black text-gray-900">{activeLabel}</h1><p className="text-xs text-gray-400">{rc.label} · {rc.branch}</p></div>
          <div className="flex items-center gap-3">
            {allowedModules.includes('approvals') && (
              <button onClick={() => setActive('approvals')} className="relative p-2 rounded-lg hover:bg-gray-100">
                <ClipboardList size={17} className="text-gray-500" />
                {pendingApprovals > 0 && <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-black">{pendingApprovals}</span>}
              </button>
            )}
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setRole(null)} title="Switch role">
              <div className={`w-8 h-8 ${rc.color} rounded-full flex items-center justify-center text-white text-xs font-black`}>{rc.initials}</div>
              <div className="hidden md:block text-left"><p className="text-xs font-black text-gray-800 leading-none">{rc.label}</p><p className="text-xs text-blue-600 font-semibold mt-0.5 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> Switch Role</p></div>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-5">{renderView()}</main>
      </div>
    </div>
  );
}
