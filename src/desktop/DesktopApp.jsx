import React, { useState, useEffect, useRef } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import {
  LayoutDashboard, Building2, ShoppingCart, Store, Package, Truck, Receipt,
  DollarSign, Users, ClipboardList, UserCheck, Bell, BarChart2, Shield, Settings,
  Fuel, Star, ChevronRight, ChevronDown, ChevronUp, MapPin, Check, X, XCircle,
  Plus, Minus, Send, Search, Edit, TrendingUp, TrendingDown, ArrowUpRight,
  Wallet, AlertTriangle, Menu, LogOut, Printer, Car, Clock, Eye, EyeOff,
} from 'lucide-react';
import { api, setToken } from '../api.js';
import './tailwind.css';

// ─── ROLE CONFIG (matches the real backend roles — same ones used in the mobile app) ───
const ROLE_CONFIG = {
  super_admin: { label: 'Super Administrator', desc: 'System owner with complete configuration control', color: 'bg-slate-950', initials: 'SA', Ic: Shield, branch: 'All company locations' },
  ceo: { label: 'CEO / Director', desc: 'Full read & write access to every module', color: 'bg-blue-900', initials: 'CE', Ic: Star, branch: 'Head Office' },
  gm: { label: 'General Manager', desc: 'Full operational access across all branches', color: 'bg-blue-800', initials: 'GM', Ic: Building2, branch: 'Head Office' },
  finance: { label: 'Finance Manager', desc: 'Finance, expenses and approvals', color: 'bg-blue-700', initials: 'FM', Ic: DollarSign, branch: 'Head Office' },
  branch: { label: 'Branch Manager', desc: 'Branch POS, inventory and staff', color: 'bg-blue-600', initials: 'BM', Ic: Store, branch: 'Harare Main' },
  staff: { label: 'Sales Attendant', desc: 'Point of sale and customer operations', color: 'bg-red-600', initials: 'SA', Ic: ShoppingCart, branch: 'Harare Main' },
  fuel: { label: 'Fuel Attendant', desc: 'Fuel station operations and shifts', color: 'bg-red-700', initials: 'FA', Ic: Fuel, branch: 'Fuel Station' },
  accountant: { label: 'Accountant', desc: 'Ledgers, journals and reconciliation', color: 'bg-purple-700', initials: 'AC', Ic: Receipt, branch: 'Head Office' },
  sub_manager: { label: 'Sub Manager', desc: 'Assigned outlet operations', color: 'bg-blue-600', initials: 'SM', Ic: Store, branch: 'Assigned outlet' },
  cashier: { label: 'Cashier', desc: 'POS and register closing', color: 'bg-red-600', initials: 'CA', Ic: ShoppingCart, branch: 'Assigned outlet' },
  storekeeper: { label: 'Storekeeper', desc: 'Receiving, stock counts and transfers', color: 'bg-slate-700', initials: 'SK', Ic: Package, branch: 'Assigned outlet' },
  auditor: { label: 'Auditor', desc: 'Read-only records and audit trail', color: 'bg-gray-700', initials: 'AU', Ic: Shield, branch: 'All assigned branches' },
  driver: { label: 'Driver', desc: 'Company transport and delivery employee', color: 'bg-cyan-700', initials: 'DR', Ic: Truck, branch: 'Assigned branch' },
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
    { id: 'reconcile', label: 'Daily Reconciliation', icon: Wallet },
    { id: 'approvals', label: 'Approvals', icon: ClipboardList },
  ] },
  { group: 'People & System', items: [
    { id: 'staff', label: 'Staff Directory', icon: UserCheck },
    { id: 'rep', label: 'Reports', icon: BarChart2 },
    { id: 'sett', label: 'Company & Branches', icon: Settings },
    { id: 'website', label: 'Website Manager', icon: Store },
    { id: 'payroll', label: 'Payroll', icon: DollarSign },
    { id: 'sms', label: 'SMS Centre', icon: Send },
    { id: 'tools', label: 'Admin Tools', icon: Settings },
    { id: 'performance', label: 'Performance & Rewards', icon: Star },
    { id: 'attendance', label: 'Attendance & Shifts', icon: Clock },
  ] },
];
const NAV_HELP={dash:'View current business performance and alerts',pos:'Sell tyres, rims, batteries and services',mkt:'Sell supermarket items by scan or search',fuel:'Manage tanks, pumps, shifts, dips and deliveries',inv:'Manage outlet stock and search authorized locations',proc:'Create and approve purchase orders',expenses:'Record and review operating expenses',fin:'View accounting and profitability',cust:'Manage retail, fleet and corporate customers',reconcile:'Close sales, cash and stock for the day',approvals:'Review transactions awaiting approval',staff:'Manage staff roles, branches and permissions',rep:'Generate filtered operational reports',sett:'Configure company branches and outlets',website:'Update website content and online products',payroll:'Manage salaries and monthly payroll',sms:'Send staff and customer announcements',tools:'Currency conversion, backup, restore and data transfer',performance:'Review employee results and approve rewards',attendance:'See active logins, attendance history and outlet schedules'};

const ROLE_MODULES = {
  super_admin: ['dash', 'pos', 'mkt', 'fuel', 'inv', 'proc', 'expenses', 'fin', 'cust', 'reconcile', 'approvals', 'staff', 'rep', 'sett', 'website', 'payroll', 'sms', 'tools', 'performance', 'attendance'],
  ceo: ['dash', 'pos', 'mkt', 'fuel', 'inv', 'proc', 'expenses', 'fin', 'cust', 'reconcile', 'approvals', 'staff', 'rep', 'payroll', 'sms', 'tools', 'performance', 'attendance'],
  gm: ['dash', 'pos', 'mkt', 'fuel', 'inv', 'proc', 'expenses', 'fin', 'cust', 'reconcile', 'approvals', 'staff', 'rep', 'sett', 'payroll', 'sms', 'performance'],
  finance: ['dash', 'fin', 'expenses', 'reconcile', 'approvals', 'cust', 'rep', 'payroll', 'performance'],
  branch: ['dash', 'pos', 'mkt', 'inv', 'expenses', 'reconcile', 'staff', 'rep', 'performance'],
  staff: ['pos', 'mkt', 'rep', 'performance'],
  fuel: ['dash', 'fuel', 'expenses', 'performance'],
  accountant: ['dash', 'fin', 'expenses', 'reconcile', 'cust', 'rep', 'payroll', 'performance'],
  sub_manager: ['dash', 'pos', 'mkt', 'fuel', 'inv', 'expenses', 'reconcile', 'staff', 'rep', 'performance'],
  cashier: ['pos', 'mkt', 'rep', 'performance'],
  storekeeper: ['dash', 'inv', 'proc', 'performance'],
  procurement: ['dash', 'proc', 'inv', 'performance'],
  technician: ['performance'],
  auditor: ['dash', 'inv', 'expenses', 'fin', 'cust', 'rep', 'performance'],
  driver: ['performance'],
};

const PERMISSION_MODULES = { 'staff.view': 'staff', 'staff.manage': 'staff', 'branches.manage': 'sett', 'system.settings.manage': 'sett', 'website.manage': 'website', 'reconciliation.create': 'reconcile', 'reconciliation.review': 'reconcile', 'reports.view': 'rep', 'inventory.create': 'inv', 'inventory.update': 'inv', 'inventory.search_all':'inv', 'customers.manage': 'cust', 'procurement.manage': 'proc', 'expenses.manage': 'expenses', 'accounting.journal.create': 'fin', 'pos.sale.create': 'pos', 'payroll.manage':'payroll', 'sms.manage':'sms', 'data.manage':'tools', 'performance.manage':'performance', 'attendance.view':'attendance', 'shifts.manage':'attendance' };
const DIVISION_MODULES = {
  tyres: ['pos','inv','cust','rep','performance'], supermarket: ['mkt','inv','cust','rep','performance'], fuel: ['fuel','reconcile','expenses','performance'],
  warehouse: ['inv','proc','performance'], head_office: ['dash','fin','expenses','cust','rep','staff','sett','website','approvals','payroll','sms','performance'],
};
function modulesForUser(account) {
  const role = account?.role; const granted = (account?.permissions || []).map(p => PERMISSION_MODULES[p]).filter(Boolean);
  if (['super_admin','ceo','gm'].includes(role)) return [...new Set([...(ROLE_MODULES[role] || []), ...granted])];
  const divisions = [...new Set((account?.outlets || []).map(outlet => outlet.division).filter(Boolean))];
  if (!divisions.length) return [...new Set([...(ROLE_MODULES[role] || []), ...granted])];
  const business = new Set(divisions.flatMap(division => DIVISION_MODULES[division] || []));
  const base = ['branch','sub_manager'].includes(role)
    ? ['dash','reconcile',...business]
    : (ROLE_MODULES[role] || []).filter(module => business.has(module));
  return [...new Set([...base, ...granted])];
}

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

function CodeScanner({ title = 'Scan Barcode or QR Code', onDetected, onClose }) {
  const videoRef = useRef(null); const streamRef = useRef(null); const frameRef = useRef(null);
  const [manual,setManual]=useState(''); const [cameraError,setCameraError]=useState(''); const [scanning,setScanning]=useState(false);
  const stop=()=>{if(frameRef.current)cancelAnimationFrame(frameRef.current);streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null;};
  useEffect(()=>stop,[]);
  const accept=code=>{if(!code)return;stop();onDetected(String(code).trim());};
  const start=async()=>{setCameraError('');if(!('BarcodeDetector'in window)){setCameraError('Camera barcode detection is not supported by this browser. Use a USB scanner or enter the code below.');return}try{const detector=new window.BarcodeDetector({formats:['qr_code','ean_13','ean_8','code_128','code_39','upc_a','upc_e']});const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}}});streamRef.current=stream;setScanning(true);await new Promise(resolve=>requestAnimationFrame(resolve));videoRef.current.srcObject=stream;await videoRef.current.play();const scan=async()=>{try{const codes=await detector.detect(videoRef.current);if(codes[0]?.rawValue){accept(codes[0].rawValue);return}}catch{}frameRef.current=requestAnimationFrame(scan)};scan()}catch(e){setCameraError(e.message||'Camera permission was not granted.')}};
  return <Modal title={title} onClose={()=>{stop();onClose()}}><div className="space-y-4"><div className="rounded-xl overflow-hidden bg-slate-950 min-h-48 grid place-items-center">{scanning?<video ref={videoRef} className="w-full h-64 object-cover" muted playsInline/>:<div className="text-center p-6"><Search className="text-blue-300 mx-auto" size={38}/><p className="text-white text-sm font-bold mt-3">Use the device camera to scan</p><button onClick={start} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-black">Start camera scanner</button></div>}</div>{cameraError&&<p className="text-xs text-orange-700 bg-orange-50 p-3 rounded-xl">{cameraError}</p>}<form onSubmit={e=>{e.preventDefault();accept(manual)}} className="flex gap-2"><input autoFocus value={manual} onChange={e=>setManual(e.target.value)} placeholder="Scan with USB reader or enter code" className="flex-1 border rounded-xl px-3 py-2.5 text-sm"/><button className="px-4 bg-blue-900 text-white rounded-xl text-xs font-black">Find</button></form><p className="text-xs text-gray-400">USB and Bluetooth scanners work automatically as keyboard input. Camera scanning supports QR, EAN, UPC, Code 39 and Code 128 formats.</p></div></Modal>;
}

const Tabs = ({ tabs, active, onChange }) => (
  <div className="flex flex-wrap gap-1.5">
    {tabs.map(t => (
      <button key={t.id} onClick={() => onChange(t.id)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${active === t.id ? 'bg-blue-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{t.label}</button>
    ))}
  </div>
);

const fmt = n => `GH₵ ${Number(n || 0).toLocaleString('en-GH', { maximumFractionDigits: 2 })}`;
const initialsOf = name => (name || '').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

// ─── LOGIN ───
function LoginScreen({ onLogin }) {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const submit = async () => {
    if (!u.trim() || !p) { setErr('Enter your username and password'); return; }
    setLoading(true); setErr('');
    try {
      const res = await api.login(u, p);
      setToken(res.token);
      onLogin(res.user);
    } catch (e) {
      setErr(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <img src="/admabs-app-icon.png" alt="ADMABS" className="w-14 h-14 rounded-2xl object-contain bg-white p-1 shadow-xl" />
            <div><p className="text-white font-black text-3xl tracking-widest">ADMABS</p><p className="text-blue-300 text-xs tracking-widest">INTEGRATED BUSINESS PLATFORM</p></div>
          </div>
          <p className="text-blue-200 text-sm mt-3">Secure staff access</p>
          <p className="text-blue-400 text-xs mt-1">Your assigned role, branch and outlet will load automatically.</p>
        </div>
        <div className="bg-white/10 backdrop-blur border border-white/15 rounded-2xl p-6 space-y-4 shadow-2xl">
          <div>
            <label className="block text-xs font-bold text-blue-300 tracking-wide mb-1">USERNAME</label>
            <input value={u} onChange={e => setU(e.target.value)} className="w-full bg-white bg-opacity-10 border border-white border-opacity-20 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-opacity-50" />
          </div>
          <div>
            <label className="block text-xs font-bold text-blue-300 tracking-wide mb-1">PASSWORD</label>
            <div className="relative"><input type={showPassword ? 'text' : 'password'} value={p} onChange={e => setP(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} className="w-full bg-white bg-opacity-10 border border-white border-opacity-20 rounded-xl pl-3 pr-11 py-2.5 text-sm text-white outline-none focus:border-opacity-50" /><button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Hide password':'Show password'} title={showPassword?'Hide password':'Show password'} className="absolute inset-y-0 right-0 px-3 text-blue-200 hover:text-white">{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div>
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
    api.products().then(list => setCatalog(list.filter(categoryFilter).map(p => ({ id: p._id, n: p.name, price: p.price, cat: p.category, icon: p.icon, code: p.code, barcode: p.barcode, qrCode: p.qrCode, available: p.qty }))))
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const add = p => setCart(c => { const e = c.find(i => i.id === p.id); return e ? c.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i) : [...c, { ...p, qty: 1 }]; });
  const changeQty = (id, d) => setCart(c => c.map(i => i.id === id ? { ...i, qty: Math.max(1, i.qty + d) } : i));
  const removeItem = id => setCart(c => c.filter(i => i.id !== id));
  const sub = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const vat = sub * 0.15;
  const total = sub + vat;

  const charge = (paymentMethod, workShift) => {
    setSaving(true); setSaveErr('');
    return api.createSale({ items: cart.map(i => ({ product: i.id, name: i.n, category: i.cat, price: i.price, qty: i.qty })), paymentMethod, workShift })
      .then(sale => { setDone({ ...sale, sub, vat, total, paymentMethod, items: cart }); setCart([]); })
      .catch(e => setSaveErr(e.message))
      .finally(() => setSaving(false));
  };

  return { cart, catalog, loading, saving, saveErr, done, setDone, add, changeQty, removeItem, sub, vat, total, charge };
}

function SupermarketShiftControl({ user, onShift }) {
  const [shifts,setShifts]=useState([]),[modal,setModal]=useState(''),[value,setValue]=useState('0'),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const load=()=>api.workShifts().then(list=>{setShifts(list);const open=list.find(s=>s.status==='open'&&String(s.attendant?._id||s.attendant)===String(user?.id));onShift?.(open||null)}).catch(e=>setError(e.message));
  useEffect(()=>{load()},[]);
  const open=shifts.find(s=>s.status==='open'&&String(s.attendant?._id||s.attendant)===String(user?.id));
  const submit=async()=>{setBusy(true);setError('');try{if(modal==='start')await api.startWorkShift({outlet:user?.outlets?.find(o=>o.division==='supermarket')?._id,openingFloat:Number(value||0)});else await api.closeWorkShift(open._id,{actualCash:Number(value||0)});setModal('');setValue('0');await load()}catch(e){setError(e.message)}finally{setBusy(false)}};
  return <><div className={`rounded-xl border p-3 flex flex-wrap items-center justify-between gap-3 ${open?'bg-green-50 border-green-200':'bg-white'}`}><div><p className="text-xs font-black text-gray-800">{open?`${open.workShift==='night'?'Night':'Day'} supermarket shift is open`:'No supermarket shift started'}</p><p className="text-xs text-gray-500">{open?`Started ${new Date(open.startedAt).toLocaleString()} · ${open.number}`:'Start your scheduled shift before recording sales.'}</p></div>{open?<button onClick={()=>{setValue('0');setModal('close')}} className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-black">Close Shift</button>:<button onClick={()=>{setValue('0');setModal('start')}} className="px-4 py-2 bg-green-700 text-white rounded-xl text-xs font-black">Start Shift</button>}</div>{error&&<p className="text-xs text-red-600 bg-red-50 p-2 rounded-lg">⚠ {error}</p>}{modal&&<Modal title={modal==='start'?'Start supermarket shift':'Close supermarket shift'} onClose={()=>setModal('')}><div className="space-y-3"><p className="text-xs text-gray-500">Times are recorded by the ADMABS server in Ghana time and cannot be changed from this device.</p><label className="block text-xs font-bold text-gray-600">{modal==='start'?'Opening cash float':'Physical cash handed over'}<input autoFocus type="number" min="0" step="0.01" value={value} onChange={e=>setValue(e.target.value)} className="mt-1 w-full border rounded-xl p-3"/></label><button disabled={busy} onClick={submit} className="w-full py-3 bg-blue-900 text-white rounded-xl font-black disabled:opacity-40">{busy?'Saving…':modal==='start'?'Start scheduled shift':'Submit shift for manager approval'}</button></div></Modal>}</>;
}

function PosPanel({ title, color, categoryFilter, categories, user, shiftControlled = false }) {
  const pos = usePos(categoryFilter);
  const [site, setSite] = useState({});
  const [cat, setCat] = useState('All');
  const [search, setSearch] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [catalogView,setCatalogView]=useState('thumbnail');
  const [workShift, setWorkShift] = useState(() => (new Date().getHours() >= 18 || new Date().getHours() < 6 ? 'night' : 'day'));
  const allowsNight=['super_admin','ceo','gm'].includes(user?.role)||(user?.outlets||[]).some(o=>o.runs24Hours);
  useEffect(()=>{if(!allowsNight)setWorkShift('day')},[allowsNight]);
  const [scanner,setScanner]=useState(false); const [scanError,setScanError]=useState('');
  useEffect(() => { api.siteContent().then(setSite).catch(() => {}); }, []);
  const filtered = pos.catalog.filter(p => (cat === 'All' || p.cat === cat) && (!search || p.n.toLowerCase().includes(search.toLowerCase())));
  const printReceipt = () => { document.body.classList.add('printing-receipt'); window.print(); setTimeout(() => document.body.classList.remove('printing-receipt'), 250); };

  if (pos.done) {
    const r = pos.done;
    return (
      <Modal title="Receipt" onClose={() => pos.setDone(null)}>
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-2"><Check size={22} className="text-white" /></div>
            <p className="font-black text-green-800">{r.invoiceNumber}</p>
          </div>
          <div className="receipt-print border border-dashed border-gray-200 rounded-xl p-4 font-mono text-xs bg-gray-50 space-y-1">
            <div className="text-center mb-3"><img src={site.logoUrl || '/admabs-logo.png'} alt="ADMABS Investments Ltd." className="h-14 max-w-56 object-contain mx-auto mb-1" /><p className="font-black text-blue-900">{site.companyName || 'ADMABS INVESTMENTS LTD.'}</p><p className="text-gray-500">SALES RECEIPT</p></div>
            <div className="flex justify-between"><span>Invoice</span><b>{r.invoiceNumber}</b></div>
            <div className="flex justify-between"><span>Date</span><span>{new Date(r.createdAt || Date.now()).toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Shift</span><span className="capitalize">{r.workShift || 'day'}</span></div>
            {r.items.map((i, j) => <div key={j} className="flex justify-between"><span>{i.n} ×{i.qty}</span><span className="font-bold">{fmt(i.price * i.qty)}</span></div>)}
            <div className="border-t border-dashed border-gray-200 pt-1 mt-1">
              <div className="flex justify-between"><span>VAT 15%</span><span>{fmt(r.vat)}</span></div>
              <div className="flex justify-between"><span>Payment</span><span>{r.paymentMethod}</span></div>
              <div className="flex justify-between font-black"><span>TOTAL</span><span>{fmt(r.total)}</span></div>
            </div>
            {(site.phone || site.email || site.address) && <div className="text-center text-gray-500 pt-2 mt-2 border-t border-dashed"><p>{site.address}</p><p>{[site.phone, site.email].filter(Boolean).join(' · ')}</p></div>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={printReceipt} className="flex items-center justify-center gap-1.5 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-600"><Printer size={13} /> Print</button>
            <button onClick={() => pos.setDone(null)} className={`py-2.5 ${color} rounded-xl text-xs font-bold text-white`}>New Sale</button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <div className="space-y-4">
      <div><h2 className="text-xl font-black text-blue-900">{title}</h2><p className="text-sm text-gray-500">Ring up a sale — posts straight to the real backend and updates stock.</p></div>
      {shiftControlled&&<SupermarketShiftControl user={user} onShift={shift=>shift&&setWorkShift(shift.workShift)}/>} 
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-4">
          <div className="flex gap-2"><div className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2"><Search size={12} className="text-gray-400 flex-shrink-0" /><input placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)} className="flex-1 text-xs outline-none bg-transparent text-gray-700" /></div><button onClick={()=>{setScanner(true);setScanError('')}} className={`${color} text-white px-4 rounded-xl text-xs font-black`}>▣ Scan</button></div>
          {scanError&&<p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">⚠ {scanError}</p>}
          <div className="flex flex-wrap justify-between gap-2"><Tabs tabs={[{ id: 'All', label: 'All' }, ...categories.map(c => ({ id: c, label: c }))]} active={cat} onChange={setCat} /><div className="flex border rounded-lg p-1"><button onClick={()=>setCatalogView('thumbnail')} className={`px-2 py-1 rounded text-xs font-bold ${catalogView==='thumbnail'?'bg-blue-900 text-white':'text-gray-500'}`}>▦</button><button onClick={()=>setCatalogView('list')} className={`px-2 py-1 rounded text-xs font-bold ${catalogView==='list'?'bg-blue-900 text-white':'text-gray-500'}`}>☰</button></div></div>
          {pos.loading ? <p className="text-xs text-gray-400">Loading…</p> : (
            <div className={catalogView==='thumbnail'?'grid grid-cols-2 md:grid-cols-3 gap-2':'divide-y border rounded-xl overflow-hidden'}>
              {filtered.map((p, i) => (
                <button key={i} onClick={() => pos.add(p)} className={`text-left p-3 hover:border-blue-300 hover:bg-blue-50 transition-all ${catalogView==='thumbnail'?'rounded-xl border border-gray-100':'flex justify-between items-center'}`}>
                  <div><p className="text-xs font-bold text-gray-800 leading-tight">{p.n}</p><p className="text-xs text-gray-400 mt-1">{p.code} · Stock {p.available}</p></div>
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
          <div className="px-4 pb-3 flex gap-2"><span className="text-xs font-bold text-gray-500 py-1">Shift:</span>{(allowsNight?['day','night']:['day']).map(s=><button key={s} onClick={()=>setWorkShift(s)} className={`px-3 py-1 rounded-full text-xs font-bold ${workShift===s?'bg-red-600 text-white':'bg-gray-100 text-gray-500'}`}>{s==='day'?'Day':'Night'}</button>)}{!allowsNight&&<span title="Night sales are available only when this outlet is marked as 24-hour." className="text-xs text-gray-400 py-1 cursor-help">Day-only outlet ⓘ</span>}</div>
          {pos.saveErr && <p className="px-4 text-xs text-red-600 mb-2">⚠ {pos.saveErr}</p>}
          <div className="p-3 pt-0">
            <button onClick={() => pos.cart.length && pos.charge(payMethod, workShift)} disabled={pos.cart.length === 0 || pos.saving} className={`w-full ${color} disabled:opacity-40 text-white font-black text-sm py-3 rounded-xl`}>
              {pos.saving ? 'Processing…' : `Charge ${fmt(pos.total)} →`}
            </button>
          </div>
        </div>
      </div>
      {scanner&&<CodeScanner title={`${title} — Scan Product`} onClose={()=>setScanner(false)} onDetected={code=>{const product=pos.catalog.find(p=>[p.code,p.barcode,p.qrCode].filter(Boolean).includes(code));setScanner(false);if(!product){setScanError(`No product found for ${code} in this outlet`);return}if(product.available<=0){setScanError(`${product.n} is out of stock`);return}pos.add(product);setScanError('')}}/>}
    </div>
  );
}

const PosView = ({user}) => <PosPanel user={user} title="Point of Sale" color="bg-red-600" categoryFilter={p => ['Tyre', 'Rim', 'Battery', 'Service'].includes(p.category)} categories={['Tyre', 'Rim', 'Battery', 'Service']} />;
const MktView = ({user}) => <PosPanel user={user} shiftControlled title="Supermarket POS" color="bg-green-600" categoryFilter={p => ['Grocery', 'Beverages', 'Snacks', 'Household', 'Dairy', 'Bakery'].includes(p.category)} categories={['Grocery', 'Beverages', 'Snacks', 'Household', 'Dairy', 'Bakery']} />;

// ─── INVENTORY ───
function InvView({ user }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [view,setView]=useState('list'); const [division,setDivision]=useState('tyres'); const [search,setSearch]=useState(''); const [branchFilter,setBranchFilter]=useState(''); const [outletFilter,setOutletFilter]=useState(''); const [searchAll,setSearchAll]=useState(false);
  const [edit, setEdit] = useState(null); const [form, setForm] = useState({}); const [branches, setBranches] = useState([]); const [outlets, setOutlets] = useState([]); const [err, setErr] = useState('');
  const [scanner,setScanner]=useState(false); const [restock,setRestock]=useState(null); const [stockForm,setStockForm]=useState({quantity:'',reference:'',notes:''});
  const load = () => api.products({q:search,branch:branchFilter,outlet:outletFilter,allOutlets:searchAll?'true':''}).then(setProducts).catch(e => setErr(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); Promise.all([api.branches(), api.outlets()]).then(([b,o]) => { setBranches(b); setOutlets(o); }).catch(() => {}); }, []);
  const canEdit = ['ceo','gm','branch','sub_manager','storekeeper'].includes(user?.role) || user?.permissions?.includes('inventory.update');
  const canSearchAll=['super_admin','ceo','gm'].includes(user?.role)||user?.permissions?.includes('inventory.search_all');
  const save = async e => { e.preventDefault(); setErr(''); try { const body = { ...form, barcode: form.barcode || form.code, qrCode: form.qrCode || form.code, qty: Number(form.qty), reorderLevel: Number(form.reorderLevel), price: Number(form.price), cost: Number(form.cost), websiteVisible: form.websiteVisible !== false }; edit === 'new' ? await api.createProduct(body) : await api.updateProduct(edit._id, body); setEdit(null); await load(); } catch (x) { setErr(x.message); } };
  const handleStockScan = async code => { setScanner(false); try { const product = await api.scanProduct(code); setRestock(product); setStockForm({ quantity:'', reference:'', notes:'' }); } catch { setEdit('new'); setForm({ code, barcode:code, qrCode:code, category:'Grocery', qty:0, reorderLevel:5, price:0, cost:0, websiteVisible:false }); setErr('Code is new. Complete the product details to register it.'); } };
  const low = products.filter(p => p.qty <= p.reorderLevel);
  const divisionCategories=division==='supermarket'?['Grocery','Beverages','Snacks','Household','Bakery','Dairy']:['Tyre','Rim','Battery','Lubricant','Service'];
  const filtered = (filter === 'low' ? low : products).filter(p=>divisionCategories.includes(p.category));
  const stockValue = products.reduce((s, p) => s + p.qty * (p.cost || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-black text-blue-900">Inventory by Outlet</h2><p className="text-sm text-gray-500">Automotive and supermarket stock are separated and held independently at each outlet</p></div><div className="flex gap-2"><div className="flex border rounded-xl bg-white p-1"><button onClick={()=>setView('thumbnail')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${view==='thumbnail'?'bg-blue-900 text-white':'text-gray-500'}`}>▦ Thumbnails</button><button onClick={()=>setView('list')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${view==='list'?'bg-blue-900 text-white':'text-gray-500'}`}>☰ List</button></div>{canEdit && <><button onClick={()=>setScanner(true)} className="px-4 py-2 border border-blue-200 text-blue-900 rounded-xl text-xs font-black">▣ Scan to Stock</button><button onClick={() => { setEdit('new'); setForm({ category:division==='supermarket'?'Grocery':'Tyre', qty:0, reorderLevel:5, price:0, cost:0, websiteVisible:true }); }} className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-black">+ Add Product</button></>}</div></div>
      {err && <p className="text-xs text-red-600">⚠ {err}</p>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Total SKUs" val={String(products.length)} Ic={Package} bg="bg-blue-900" />
        <Kpi label="Low Stock" val={String(low.length)} pos={false} Ic={AlertTriangle} bg="bg-red-600" />
        <Kpi label="Stock Value" val={fmt(stockValue)} Ic={DollarSign} bg="bg-blue-700" />
        <Kpi label="Categories" val={String(new Set(products.map(p => p.category)).size)} Ic={Store} bg="bg-blue-600" />
      </div>
      <div className="bg-white border rounded-xl p-3 space-y-3"><Tabs tabs={[{id:'tyres',label:'Tyres, Rims & Batteries'},{id:'supermarket',label:'Supermarket Inventory'}]} active={division} onChange={setDivision}/><div className="grid md:grid-cols-5 gap-2"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Product, code or barcode" className="border rounded-xl px-3 py-2 text-xs"/><select value={branchFilter} onChange={e=>{setBranchFilter(e.target.value);setOutletFilter('')}} className="border rounded-xl px-3 py-2 text-xs bg-white"><option value="">All available branches</option>{branches.map(b=><option key={b._id} value={b._id}>{b.name}</option>)}</select><select value={outletFilter} onChange={e=>setOutletFilter(e.target.value)} className="border rounded-xl px-3 py-2 text-xs bg-white"><option value="">All available outlets</option>{outlets.filter(o=>!branchFilter||(o.branch?._id||o.branch)===branchFilter).map(o=><option key={o._id} value={o._id}>{o.name}</option>)}</select>{canSearchAll?<label className="flex items-center gap-2 text-xs font-bold p-2"><input type="checkbox" checked={searchAll} onChange={e=>setSearchAll(e.target.checked)}/> Search across company</label>:<div/>}<button onClick={load} className="bg-blue-900 text-white rounded-xl text-xs font-black">Search stock</button></div><Tabs tabs={[{ id: 'all', label: 'All Stock' }, { id: 'low', label: `Low Stock (${low.filter(p=>divisionCategories.includes(p.category)).length})` }]} active={filter} onChange={setFilter} /></div>
      {loading ? <p className="text-xs text-gray-400">Loading…</p> : (
        view==='list'?<div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50"><tr>{['Code', 'Product', 'Category', 'Location', 'Qty', 'Price', 'Website', 'Action'].map(h => <th key={h} className="px-4 py-2.5 text-left font-semibold text-gray-400 uppercase">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-blue-600 font-bold">{p.code}</td>
                    <td className="px-4 py-2.5 font-semibold text-gray-800">{p.name}</td>
                    <td className="px-4 py-2.5"><Bd label={p.category} v="gray" /></td>
                    <td className="px-4 py-2.5 text-gray-500">{p.branch?.name||branches.find(b => b._id === p.branch)?.name || '—'}{(p.outlet?.name||outlets.find(o => o._id === p.outlet)?.name) ? ` / ${p.outlet?.name||outlets.find(o => o._id === p.outlet)?.name}` : ''}</td>
                    <td className="px-4 py-2.5 font-bold"><span className={p.qty <= p.reorderLevel ? 'text-red-600' : 'text-gray-800'}>{p.qty}</span></td>
                    <td className="px-4 py-2.5 font-bold">{fmt(p.price)}</td>
                    <td className="px-4 py-2.5"><Bd label={p.websiteVisible !== false ? (p.qty ? 'Live' : 'Out of stock') : 'Hidden'} v={p.websiteVisible !== false && p.qty ? 'green' : 'gray'} /></td>
                    <td className="px-4 py-2.5">{canEdit && <button onClick={() => { setEdit(p); setForm({...p,branch:p.branch?._id||p.branch,outlet:p.outlet?._id||p.outlet}); }} className="text-blue-700 font-bold">Edit</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>:<div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">{filtered.map(p=><div key={p._id} className="bg-white border rounded-xl p-4 shadow-sm"><div className="h-28 bg-gray-50 rounded-lg grid place-items-center overflow-hidden mb-3">{p.imageUrl?<img src={p.imageUrl} className="w-full h-full object-contain"/>:<span className="text-4xl">{p.icon||'📦'}</span>}</div><p className="font-black text-sm">{p.name}</p><p className="text-xs text-gray-400">{p.code} · {p.category}</p><p className="text-xs text-gray-500 mt-1">{p.branch?.name||'—'} / {p.outlet?.name||'—'}</p><div className="flex justify-between mt-3"><b className={p.qty<=p.reorderLevel?'text-red-600':'text-blue-900'}>{p.qty} in stock</b><b>{fmt(p.price)}</b></div>{canEdit&&<button onClick={()=>{setEdit(p);setForm({...p,branch:p.branch?._id||p.branch,outlet:p.outlet?._id||p.outlet})}} className="mt-3 w-full border rounded-lg py-2 text-xs font-bold text-blue-800">Edit</button>}</div>)}</div>
      )}
      {edit && <Modal title={edit === 'new' ? 'Add Inventory Item' : 'Edit Inventory Item'} wide onClose={() => setEdit(null)}><form onSubmit={save} className="space-y-3"><div className="grid md:grid-cols-2 gap-3"><label className="text-xs font-bold text-gray-500">Code<input required value={form.code || ''} onChange={e=>setForm({...form,code:e.target.value})} className="mt-1 w-full border rounded-xl p-2.5" /></label><label className="text-xs font-bold text-gray-500">Product name<input required value={form.name || ''} onChange={e=>setForm({...form,name:e.target.value})} className="mt-1 w-full border rounded-xl p-2.5" /></label><label className="text-xs font-bold text-gray-500">Category<select value={form.category || 'Tyre'} onChange={e=>setForm({...form,category:e.target.value})} className="mt-1 w-full border rounded-xl p-2.5 bg-white">{['Tyre','Rim','Battery','Lubricant','Grocery','Beverages','Snacks','Household','Bakery','Dairy','Service'].map(x=><option key={x}>{x}</option>)}</select></label><label className="text-xs font-bold text-gray-500">Branch<select required value={form.branch || ''} onChange={e=>setForm({...form,branch:e.target.value,outlet:''})} className="mt-1 w-full border rounded-xl p-2.5 bg-white"><option value="">Select branch</option>{branches.map(b=><option key={b._id} value={b._id}>{b.name}</option>)}</select></label><label className="text-xs font-bold text-gray-500">Outlet / shop<select value={form.outlet || ''} onChange={e=>setForm({...form,outlet:e.target.value})} className="mt-1 w-full border rounded-xl p-2.5 bg-white"><option value="">Branch-level stock</option>{outlets.filter(o => !form.branch || (o.branch?._id || o.branch) === form.branch).map(o=><option key={o._id} value={o._id}>{o.name} · {o.division}</option>)}</select></label>{[['qty','Quantity'],['reorderLevel','Reorder level'],['cost','Unit cost'],['price','Selling price']].map(([k,l])=><label key={k} className="text-xs font-bold text-gray-500">{l}<input type="number" min="0" step="0.01" value={form[k] ?? ''} onChange={e=>setForm({...form,[k]:e.target.value})} className="mt-1 w-full border rounded-xl p-2.5" /></label>)}</div><label className="block text-xs font-bold text-gray-500">Description<textarea value={form.description || ''} onChange={e=>setForm({...form,description:e.target.value})} className="mt-1 w-full border rounded-xl p-2.5" /></label><label className="block text-xs font-bold text-gray-500">Product image URL or data image<input value={form.imageUrl || ''} onChange={e=>setForm({...form,imageUrl:e.target.value})} className="mt-1 w-full border rounded-xl p-2.5" /></label><label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={form.websiteVisible !== false} onChange={e=>setForm({...form,websiteVisible:e.target.checked})} /> Show this item on the public website</label><button className="w-full bg-red-600 text-white rounded-xl py-3 font-black text-sm">Save inventory record</button>{edit !== 'new' && user?.role === 'ceo' && <button type="button" onClick={async()=>{if(confirm('Archive this product and remove it from the website?')){await api.deleteProduct(edit._id);setEdit(null);load();}}} className="w-full text-red-600 text-xs font-bold">Archive product</button>}</form></Modal>}
      {scanner&&<CodeScanner title="Scan Product for Stock Receipt" onClose={()=>setScanner(false)} onDetected={handleStockScan}/>}
      {restock&&<Modal title={`Receive Stock — ${restock.name}`} onClose={()=>setRestock(null)}><form onSubmit={async e=>{e.preventDefault();try{await api.receiveProductStock(restock._id,{...stockForm,quantity:Number(stockForm.quantity)});setRestock(null);await load()}catch(x){setErr(x.message)}}} className="space-y-3"><div className="bg-blue-50 rounded-xl p-3 text-sm"><b>{restock.code}</b><span className="text-gray-500"> · Current stock: {restock.qty}</span><p className="text-xs mt-1">Barcode: {restock.barcode||'—'} · QR: {restock.qrCode||'—'}</p></div><label className="block text-xs font-bold text-gray-500">Quantity received<input autoFocus required type="number" min="1" value={stockForm.quantity} onChange={e=>setStockForm({...stockForm,quantity:e.target.value})} className="mt-1 w-full border rounded-xl p-2.5"/></label><label className="block text-xs font-bold text-gray-500">Delivery note / GRN reference<input value={stockForm.reference} onChange={e=>setStockForm({...stockForm,reference:e.target.value})} className="mt-1 w-full border rounded-xl p-2.5"/></label><label className="block text-xs font-bold text-gray-500">Notes<textarea value={stockForm.notes} onChange={e=>setStockForm({...stockForm,notes:e.target.value})} className="mt-1 w-full border rounded-xl p-2.5"/></label><button className="w-full py-3 bg-green-600 text-white rounded-xl font-black">Receive and update stock</button></form></Modal>}
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
function CustView({ user }) {
  const [customers, setCustomers] = useState([]);
  const [selId, setSelId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal,setModal]=useState(null); const [form,setForm]=useState({type:'Retail'}); const [branches,setBranches]=useState([]); const [outlets,setOutlets]=useState([]); const [err,setErr]=useState('');
  const load=()=>api.customers().then(list => { setCustomers(list); if (list[0]&&!selId) setSelId(list[0]._id); }).catch(e=>setErr(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); Promise.all([api.branches(),api.outlets()]).then(([b,o])=>{setBranches(b);setOutlets(o);}).catch(()=>{}); }, []);
  const save=async e=>{e.preventDefault();setErr('');try{modal==='new'?await api.createCustomer(form):await api.updateCustomer(modal._id,form);setModal(null);await load();}catch(x){setErr(x.message);}};
  const sel = customers.find(c => c._id === selId);
  const creditOut = customers.reduce((s, c) => s + (c.balance > 0 ? c.balance : 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex justify-between"><div><h2 className="text-xl font-black text-blue-900">Customers & Fleet</h2><p className="text-sm text-gray-500">Branch-linked accounts, credit balances and loyalty</p></div><button onClick={()=>{setModal('new');setForm({type:'Retail',branch:user?.branch?._id||'',outlet:''});}} className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-black">+ Add Customer</button></div>
      {err&&<p className="text-xs text-red-600">⚠ {err}</p>}
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
                <div className="flex items-start justify-between gap-3 mb-4"><div><h3 className="font-black text-lg">{sel.name}</h3><p className="text-sm opacity-70">{sel.type} · {sel.visits} visits</p></div><button onClick={()=>{setModal(sel);setForm(sel);}} className="text-xs font-bold bg-white/10 px-3 py-2 rounded-lg">Edit</button></div>
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
      {modal&&<Modal title={modal==='new'?'Add Customer':'Edit Customer'} onClose={()=>setModal(null)}><form onSubmit={save} className="space-y-3">{[['name','Full / company name'],['phone','Phone'],['email','Email']].map(([k,l])=><label key={k} className="block text-xs font-bold text-gray-500">{l}<input required={k==='name'} value={form[k]||''} onChange={e=>setForm({...form,[k]:e.target.value})} className="mt-1 w-full border rounded-xl p-2.5"/></label>)}<label className="block text-xs font-bold text-gray-500">Customer type<select value={form.type||'Retail'} onChange={e=>setForm({...form,type:e.target.value})} className="mt-1 w-full border rounded-xl p-2.5 bg-white">{['Retail','Fleet','Corporate'].map(x=><option key={x}>{x}</option>)}</select></label><div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold text-gray-500">Branch<select value={form.branch||''} onChange={e=>setForm({...form,branch:e.target.value,outlet:''})} className="mt-1 w-full border rounded-xl p-2.5 bg-white"><option value="">Unassigned</option>{branches.map(b=><option key={b._id} value={b._id}>{b.name}</option>)}</select></label><label className="text-xs font-bold text-gray-500">Outlet<select value={form.outlet||''} onChange={e=>setForm({...form,outlet:e.target.value})} className="mt-1 w-full border rounded-xl p-2.5 bg-white"><option value="">Branch level</option>{outlets.filter(o=>!form.branch||(o.branch?._id||o.branch)===form.branch).map(o=><option key={o._id} value={o._id}>{o.name}</option>)}</select></label></div><button className="w-full py-3 bg-red-600 text-white font-black rounded-xl">Save customer</button></form></Modal>}
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
        <Kpi label="Gross Profit" val={fmt(d?.grossProfit)} sub={`${d?.grossMargin || 0}% margin`} pos={true} Ic={Wallet} bg="bg-blue-700" />
        <Kpi label="Net Profit" val={fmt(d?.netProfit)} sub={`${d?.netMargin || 0}% margin`} pos={true} Ic={Star} bg="bg-blue-600" />
        <Kpi label="Inventory at Cost" val={fmt(d?.inventoryValue)} Ic={Package} bg="bg-red-600" />
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          <div className="px-5 py-3 bg-blue-900 flex justify-between text-xs font-black text-white"><span>MANAGEMENT PROFIT & LOSS</span><span>MONTH TO DATE</span></div>
          {[['Revenue', d?.revenue], ['Cost of goods sold', -(d?.cogs || 0)], ['Gross profit', d?.grossProfit], ['Operating expenses', -(d?.expenses || 0)], ['Net profit', d?.netProfit]].map(([label,value], i) => <div key={label} className={`px-5 py-3 flex justify-between text-sm ${i === 2 || i === 4 ? 'font-black bg-slate-50 text-blue-950' : 'text-slate-600'}`}><span>{label}</span><span>{fmt(value)}</span></div>)}
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-black text-blue-950 text-sm">Collections by payment method</h3>
          <div className="mt-4 space-y-3">{(d?.paymentMix || []).length ? d.paymentMix.map(item => <div key={item.name}><div className="flex justify-between text-xs mb-1"><span className="text-slate-500">{item.name}</span><span className="font-bold">{fmt(item.value)}</span></div><div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-red-600 rounded-full" style={{ width: `${Math.min(100, d?.revenue ? item.value / d.revenue * 100 : 0)}%` }} /></div></div>) : <p className="text-xs text-slate-400">No posted collections in this period.</p>}</div>
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-3">{[['Double-entry ledger','Every posted sale creates a balanced accounting journal.'],['Controlled corrections','Posted records are reversed or voided, never silently deleted.'],['Branch drill-down','Reports respect each user’s assigned branches and outlets.']].map(([title,body]) => <div key={title} className="bg-blue-50 border border-blue-100 rounded-xl p-4"><p className="text-xs font-black text-blue-950">{title}</p><p className="text-xs text-blue-700 mt-1 leading-relaxed">{body}</p></div>)}</div>
    </div>
  );
}

// ─── STAFF DIRECTORY ───
function StaffView({ user }) {
  const [users, setUsers] = useState([]);
  const [view, setView] = useState('thumbnail');
  const [superAdminExists,setSuperAdminExists]=useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [modal,setModal]=useState(null); const [form,setForm]=useState({role:'staff',permissions:[],branches:[],outlets:[]}); const [branches,setBranches]=useState([]); const [outlets,setOutlets]=useState([]); const [permissions,setPermissions]=useState([]);
  const [showStaffPassword,setShowStaffPassword]=useState(false);
  const load=()=>api.users().then(setUsers).catch(e => setErr(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); Promise.all([api.branches(),api.outlets()]).then(([b,o])=>{setBranches(b);setOutlets(o)}).catch(()=>{}); api.superAdminStatus().then(x=>setSuperAdminExists(x.exists)).catch(()=>{}); if(user?.role==='super_admin')api.permissions().then(setPermissions).catch(()=>{}); }, []);
  const canManage=user?.role==='super_admin'; const canBootstrap=user?.role==='ceo'&&superAdminExists===false;
  const save=async e=>{e.preventDefault();setErr('');try{const body={...form,branch:form.branch||undefined,branches:form.branch?[form.branch]:[],outlets:form.outlets||[]};modal==='new'?await api.createUser(body):await api.updateUser(modal._id,body);setModal(null);await load();}catch(x){setErr(x.message);}};
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-black text-blue-900">Staff, Roles & Permissions</h2><p className="text-sm text-gray-500">Assign people to branches, outlets and only the controls they need</p></div><div className="flex gap-2"><div className="flex border rounded-xl bg-white p-1"><button onClick={()=>setView('thumbnail')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${view==='thumbnail'?'bg-blue-900 text-white':'text-gray-500'}`}>▦ Thumbnails</button><button onClick={()=>setView('list')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${view==='list'?'bg-blue-900 text-white':'text-gray-500'}`}>☰ List</button></div>{(canManage||canBootstrap)&&<button onClick={()=>{setModal('new');setForm({role:canBootstrap?'super_admin':'staff',permissions:[],outlets:[]});}} className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-black">{canBootstrap?'Create Super Admin':'+ Add Staff'}</button>}</div></div>
      {canBootstrap&&<div className="bg-orange-50 border border-orange-200 text-orange-800 rounded-xl p-3 text-xs"><b>One-time setup:</b> create the independent Super Admin account. After this, only that account can manage users, roles and system access.</div>}
      {user?.role==='ceo'&&superAdminExists===true&&<div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-3 text-xs"><b>Super Admin protected:</b> an active Super Admin already exists. A second account cannot be created.</div>}
      {err && <p className="text-xs text-red-600">{err === 'Forbidden' ? "Your role doesn't have access to the staff directory." : err}</p>}
      {loading ? <p className="text-xs text-gray-400">Loading…</p> : (
        <div className={view==='thumbnail'?'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3':'bg-white border rounded-xl divide-y overflow-hidden'}>
          {users.map(u => {
            const rc = ROLE_CONFIG[u.role];
            return (
              <div key={u._id} className={view==='thumbnail'?'bg-white rounded-xl border border-gray-100 shadow-sm p-4':'px-4 py-3 flex flex-wrap items-center gap-4'}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 ${rc?.color || 'bg-gray-500'} rounded-xl flex items-center justify-center text-white text-xs font-black flex-shrink-0`}>{initialsOf(u.name)}</div>
                  <div className="min-w-48"><p className="text-sm font-bold text-gray-800">{u.name}</p><p className="text-xs text-gray-500 mt-0.5">{rc?.label || u.role}</p><p className="text-xs text-gray-400 mt-0.5">{u.branch?.name || '—'}</p></div>
                </div>
                <div className={view==='thumbnail'?'mt-3 pt-3 border-t border-gray-50 flex justify-between items-center text-xs':'flex-1 min-w-52 flex justify-between items-center text-xs gap-4'}><span className="text-gray-400">{u.username}</span><Bd label={u.active ? 'Active' : 'Inactive'} v={u.active ? 'green' : 'red'} /></div>
                {canManage&&u.role!=='super_admin'&&<button onClick={()=>{setModal(u);setForm({...u,branch:u.branch?._id||'',branches:(u.branches||[]).map(b=>b._id),outlets:(u.outlets||[]).map(o=>o._id),password:''});}} className={view==='thumbnail'?'mt-3 w-full border border-blue-100 text-blue-800 rounded-lg py-2 text-xs font-bold':'border border-blue-100 text-blue-800 rounded-lg px-4 py-2 text-xs font-bold'}>Edit access</button>}
              </div>
            );
          })}
        </div>
      )}
      {modal&&<Modal wide title={modal==='new'?(canBootstrap?'Create Independent Super Admin':'Add Staff Account'):'Edit Staff Access'} onClose={()=>{setModal(null);setShowStaffPassword(false)}}><form onSubmit={save} className="space-y-4"><div className="grid md:grid-cols-2 gap-3">{[['name','Full name'],['username','Username'],['employeeNumber','Employee number'],['phone','Mobile number'],['jobTitle','Job title / position'],['department','Department'],['password',modal==='new'?'Temporary password':'New password (optional)']].map(([k,l])=><label key={k} className="text-xs font-bold text-gray-500">{l}<div className={k==='password'?'relative':''}><input required={k==='name'||k==='username'||(k==='password'&&modal==='new')} type={k==='password'?(showStaffPassword?'text':'password'):'text'} value={form[k]||''} onChange={e=>setForm({...form,[k]:e.target.value})} className={`mt-1 w-full border rounded-xl p-2.5 ${k==='password'?'pr-11':''}`}/>{k==='password'&&<button type="button" onClick={()=>setShowStaffPassword(v=>!v)} aria-label={showStaffPassword?'Hide password':'Show password'} className="absolute right-0 top-1 bottom-0 px-3 text-gray-500">{showStaffPassword?<EyeOff size={16}/>:<Eye size={16}/>}</button>}</div></label>)}<label className="text-xs font-bold text-gray-500">Role<select disabled={canBootstrap} value={form.role||'staff'} onChange={e=>setForm({...form,role:e.target.value})} className="mt-1 w-full border rounded-xl p-2.5 bg-white">{['super_admin','ceo','gm','finance','accountant','branch','sub_manager','staff','cashier','fuel','storekeeper','procurement','technician','driver','auditor'].filter(r=>r!=='super_admin'||canBootstrap).map(r=><option key={r} value={r}>{(ROLE_CONFIG[r]?.label||r).replaceAll('_',' ')}</option>)}</select></label><label className="text-xs font-bold text-gray-500">Primary branch<select value={form.branch||''} onChange={e=>setForm({...form,branch:e.target.value,outlets:[]})} className="mt-1 w-full border rounded-xl p-2.5 bg-white"><option value="">Company-wide / none</option>{branches.map(b=><option key={b._id} value={b._id}>{b.name}</option>)}</select></label></div>{canManage&&<><div><p className="text-xs font-black text-blue-950 mb-2">Assigned outlets</p><div className="grid md:grid-cols-3 gap-2">{outlets.filter(o=>!form.branch||(o.branch?._id||o.branch)===form.branch).map(o=><label key={o._id} className="flex gap-2 p-2 border rounded-lg text-xs"><input type="checkbox" checked={(form.outlets||[]).includes(o._id)} onChange={e=>setForm({...form,outlets:e.target.checked?[...(form.outlets||[]),o._id]:(form.outlets||[]).filter(x=>x!==o._id)})}/>{o.name} · {o.division}</label>)}</div></div><div><p className="text-xs font-black text-blue-950 mb-2">Additional privileges</p><div className="grid md:grid-cols-2 gap-2">{permissions.map(p=><label key={p} className="flex gap-2 p-2 border rounded-lg text-xs"><input type="checkbox" checked={(form.permissions||[]).includes(p)} onChange={e=>setForm({...form,permissions:e.target.checked?[...(form.permissions||[]),p]:(form.permissions||[]).filter(x=>x!==p)})}/>{p.replaceAll('.',' › ')}</label>)}</div></div><label className="flex gap-2 text-xs font-bold"><input type="checkbox" checked={form.active!==false} onChange={e=>setForm({...form,active:e.target.checked})}/> Account active</label></>}<button className="w-full py-3 bg-red-600 text-white rounded-xl font-black">{canBootstrap?'Activate Super Admin':'Save role and access'}</button></form></Modal>}
    </div>
  );
}

// ─── REPORTS ───
function RepView({ user }) {
  const now=new Date(), six=new Date(now.getFullYear(),now.getMonth()-5,1);
  const [filters,setFilters]=useState({start:six.toISOString().slice(0,10),end:now.toISOString().slice(0,10),branch:'',product:'',shift:''}); const [d,setD]=useState(null); const [branches,setBranches]=useState([]); const [err,setErr]=useState('');
  const load=()=>api.financialAnalytics(Object.fromEntries(Object.entries(filters).filter(([,v])=>v))).then(setD).catch(e=>setErr(e.message));
  const exportCsv=()=>{if(!d)return;const personal=['staff','cashier','fuel'].includes(user?.role);const rows=personal?[['Period','My Sales'],...(d.monthly||[]).map(x=>[x.month,x.revenue]),[],['Transactions',d.summary?.transactionCount],['Fuel Shifts',d.summary?.fuelShiftCount],['Fuel Litres',d.summary?.fuelLitres],['Fuel Collections',d.summary?.fuelCollections]]:[['Period','Revenue','Cost of Goods','Gross Profit'],...(d.monthly||[]).map(x=>[x.month,x.revenue,x.cogs,x.profit]),[],['Summary','Amount'],['Revenue',d.summary?.revenue],['Gross Profit',d.summary?.grossProfit],['Expenses',d.summary?.expenses],['Net Profit',d.summary?.netProfit]];const csv=rows.map(row=>row.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download=`admabs-report-${filters.start}-${filters.end}.csv`;a.click();URL.revokeObjectURL(url)};
  useEffect(()=>{load();api.branches().then(setBranches).catch(()=>{});},[]);
  const chart=[...(d?.monthly||[]).map(x=>({month:x.month,actual:x.revenue})),...(d?.forecast||[]).map(x=>({month:x.month,forecast:x.forecast,low:x.low,high:x.high}))];
  return <div className="space-y-5"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-black text-blue-900">Financial Analytics & Forecast</h2><p className="text-sm text-gray-500">Filter actual sales, margins, branches and products; forecast uses recent weighted growth with a ±15% range</p></div><div className="flex gap-2"><button onClick={exportCsv} disabled={!d} className="px-3 py-2 border border-blue-200 text-blue-900 rounded-xl text-xs font-bold disabled:opacity-40">Download CSV</button><button onClick={()=>window.print()} className="px-3 py-2 bg-blue-900 text-white rounded-xl text-xs font-bold"><Printer size={13} className="inline mr-1"/>Print report</button></div></div>
    <div className="bg-white border rounded-xl p-4 grid md:grid-cols-6 gap-3"><input type="date" value={filters.start} onChange={e=>setFilters({...filters,start:e.target.value})} className="border rounded-xl p-2 text-sm"/><input type="date" value={filters.end} onChange={e=>setFilters({...filters,end:e.target.value})} className="border rounded-xl p-2 text-sm"/><select value={filters.shift} onChange={e=>setFilters({...filters,shift:e.target.value})} className="border rounded-xl p-2 text-sm bg-white"><option value="">All shifts</option><option value="day">Day shift</option><option value="night">Night shift</option></select><select value={filters.branch} onChange={e=>setFilters({...filters,branch:e.target.value})} className="border rounded-xl p-2 text-sm bg-white"><option value="">All assigned branches</option>{branches.map(b=><option key={b._id} value={b._id}>{b.name}</option>)}</select><select value={filters.product} onChange={e=>setFilters({...filters,product:e.target.value})} className="border rounded-xl p-2 text-sm bg-white"><option value="">All products</option>{(d?.products||[]).map(p=><option key={p._id} value={p._id}>{p.name}</option>)}</select><button onClick={load} className="bg-blue-900 text-white rounded-xl font-black text-sm">Generate report</button></div>{err&&<p className="text-red-600 text-xs">⚠ {err}</p>}
    {!['staff','cashier','fuel'].includes(user?.role)&&<div className="grid grid-cols-2 lg:grid-cols-6 gap-3"><Kpi label="Revenue" val={fmt(d?.summary?.revenue)} Ic={TrendingUp} bg="bg-blue-900"/><Kpi label="Gross Profit" val={fmt(d?.summary?.grossProfit)} Ic={Wallet} bg="bg-blue-700"/><Kpi label="Expenses" val={fmt(d?.summary?.expenses)} Ic={Receipt} bg="bg-red-600"/><Kpi label="Net Profit" val={fmt(d?.summary?.netProfit)} Ic={Star} bg="bg-blue-600"/><Kpi label="Inventory Value" val={fmt(d?.summary?.inventoryValue)} Ic={Package} bg="bg-slate-700"/><Kpi label="Forecast Growth" val={`${d?.summary?.forecastGrowthPercent||0}%`} Ic={BarChart2} bg="bg-purple-700"/></div>}
    {['staff','cashier','fuel'].includes(user?.role)&&<div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><Kpi label="My Transactions" val={String(d?.summary?.transactionCount||0)} Ic={Receipt} bg="bg-blue-900"/><Kpi label="Fuel Shifts" val={String(d?.summary?.fuelShiftCount||0)} Ic={Fuel} bg="bg-red-600"/><Kpi label="Fuel Litres" val={`${Number(d?.summary?.fuelLitres||0).toLocaleString()} L`} Ic={Fuel} bg="bg-blue-700"/><Kpi label="Fuel Collections" val={fmt(d?.summary?.fuelCollections)} Ic={Wallet} bg="bg-green-700"/></div>}
    <div className="bg-white rounded-xl border p-5"><h3 className="font-black text-blue-950 mb-4">Actual Revenue and Three-Month Forecast</h3><ResponsiveContainer width="100%" height={300}><AreaChart data={chart}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="month" tick={{fontSize:11}}/><YAxis tick={{fontSize:11}}/><Tooltip formatter={v=>fmt(v)}/><Legend/><Area type="monotone" dataKey="actual" name="Actual revenue" stroke="#1e3a8a" fill="#dbeafe" strokeWidth={3}/><Area type="monotone" dataKey="forecast" name="Forecast" stroke="#dc2626" fill="#fee2e2" strokeDasharray="6 4" strokeWidth={3}/><Area type="monotone" dataKey="high" name="High case" stroke="#16a34a" fill="none"/><Area type="monotone" dataKey="low" name="Low case" stroke="#f59e0b" fill="none"/></AreaChart></ResponsiveContainer></div>
    <div className="grid lg:grid-cols-2 gap-5"><div className="bg-white rounded-xl border p-5"><h3 className="font-black mb-4">Revenue by Branch</h3>{(d?.byBranch||[]).map((x,i)=><div key={x.name} className="flex justify-between py-2 border-b text-sm"><span>{i+1}. {x.name}</span><b>{fmt(x.value)}</b></div>)}</div><div className="bg-white rounded-xl border p-5"><h3 className="font-black mb-4">Top Products</h3>{(d?.topProducts||[]).map((x,i)=><div key={x.name} className="flex justify-between py-2 border-b text-sm"><span>{i+1}. {x.name}</span><b>{fmt(x.value)}</b></div>)}</div></div>
  </div>;
}

// ─── FUEL STATION ───
function FuelView({ user }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('overview');
  const [action, setAction] = useState(null);
  const [form, setForm] = useState({});
  const [branches, setBranches] = useState([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const canManage = ['ceo', 'gm', 'branch', 'sub_manager'].includes(user?.role);
  const load = () => api.fuelOverview().then(setData).catch(e => setError(e.message));
  useEffect(() => { load(); api.branches().then(setBranches).catch(() => {}); }, []);
  const m = data?.metrics || {};
  const input = (key, label, type = 'text', extra = {}) => (
    <label className="block"><span className="block text-xs font-bold text-gray-500 mb-1">{label}</span><input type={type} value={form[key] ?? ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" {...extra} /></label>
  );
  const select = (key, label, options) => (
    <label className="block"><span className="block text-xs font-bold text-gray-500 mb-1">{label}</span><select value={form[key] || ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"><option value="">Select…</option>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
  );
  const openAction = (type, defaults = {}) => { setAction(type); setForm(defaults); setError(''); setNotice(''); };
  const save = async e => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      if (action === 'tank') await api.createFuelTank({ ...form, capacityLitres: Number(form.capacityLitres), currentLitres: Number(form.currentLitres), reorderLevelLitres: Number(form.reorderLevelLitres) });
      if (action === 'pump') await api.createFuelPump({ ...form, pricePerLitre: Number(form.pricePerLitre), nozzles: [{ code: form.nozzleCode, label: form.nozzleLabel || form.nozzleCode, meterReading: Number(form.meterReading) }] });
      if (action === 'open') await api.openFuelShift({ ...form, openingMeter: Number(form.openingMeter) });
      if (action === 'close') await api.closeFuelShift(form.id, { closingMeter: Number(form.closingMeter), testLitres: Number(form.testLitres), varianceReason: form.varianceReason, payments: { cash: Number(form.cash), card: Number(form.card), mobileMoney: Number(form.mobileMoney), credit: Number(form.credit) } });
      if (action === 'dip') await api.createFuelDip({ ...form, closingDipLitres: Number(form.closingDipLitres), waterLevelMm: Number(form.waterLevelMm), temperatureC: form.temperatureC === '' ? undefined : Number(form.temperatureC) });
      if (action === 'delivery') await api.createFuelDelivery({ ...form, orderedLitres: Number(form.orderedLitres), dispatchedLitres: Number(form.dispatchedLitres), receivedLitres: Number(form.receivedLitres), sealNumbers: String(form.sealNumbers || '').split(',').map(x => x.trim()).filter(Boolean), sealsIntact: form.sealsIntact !== 'false' });
      setAction(null); setNotice('Record saved successfully'); await load();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const review = async (kind, id, status) => {
    setBusy(true); setError('');
    try { kind === 'shift' ? await api.reviewFuelShift(id, { status }) : await api.reviewFuelDip(id, { status }); setNotice(`Record ${status}`); await load(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const tanks = data?.tanks || [], pumps = data?.pumps || [], shifts = data?.shifts || [], dips = data?.dips || [], deliveries = data?.deliveries || [];
  const pct = tank => Math.min(100, Math.max(0, tank.capacityLitres ? tank.currentLitres / tank.capacityLitres * 100 : 0));
  const date = value => value ? new Date(value).toLocaleString() : '—';
  const statusColor = s => s === 'approved' || s === 'active' ? 'green' : s === 'queried' || s === 'offline' ? 'red' : s === 'open' ? 'blue' : 'orange';
  const empty = text => <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">{text}</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-xl font-black text-blue-900">Fuel Station Operations</h2><p className="text-sm text-gray-500">Pump custody, wet stock, deliveries and daily reconciliation</p></div>
        <div className="flex gap-2"><button onClick={load} className="px-3 py-2 text-xs font-bold border rounded-xl bg-white">Refresh</button><button onClick={() => openAction('open')} disabled={!pumps.length} className="px-3 py-2 text-xs font-black rounded-xl bg-red-600 text-white disabled:opacity-40">+ Open Shift</button></div>
      </div>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-3">⚠ {error}</div>}
      {notice && <div className="bg-green-50 border border-green-200 text-green-700 text-xs rounded-xl p-3">✓ {notice}</div>}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="Fuel on Hand" val={`${Number(m.litresOnHand || 0).toLocaleString()} L`} sub={`${m.lowTanks || 0} tanks below reorder`} Ic={Fuel} bg="bg-blue-900" />
        <Kpi label="Sold Today" val={`${Number(m.litresSoldToday || 0).toLocaleString()} L`} sub="Closed pump shifts" Ic={TrendingUp} bg="bg-blue-700" />
        <Kpi label="Expected Revenue" val={fmt(m.expectedRevenueToday)} sub="Meter-derived" Ic={DollarSign} bg="bg-blue-600" />
        <Kpi label="Collection Variance" val={fmt(m.collectionVarianceToday)} sub="Actual less expected" pos={m.collectionVarianceToday >= 0} Ic={AlertTriangle} bg="bg-red-600" />
        <Kpi label="Open Shifts" val={m.openShifts || 0} sub="Nozzles in custody" Ic={UserCheck} bg="bg-slate-700" />
      </div>
      <Tabs active={tab} onChange={setTab} tabs={[{ id: 'overview', label: 'Overview' }, { id: 'shifts', label: 'Pump Shifts' }, { id: 'dips', label: 'Tank Dips' }, { id: 'deliveries', label: 'Deliveries' }, { id: 'setup', label: 'Tanks & Pumps' }]} />

      {tab === 'overview' && <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border shadow-sm p-4"><div className="flex justify-between mb-3"><h3 className="font-black text-gray-800">Tank Levels</h3><button onClick={() => openAction('dip')} disabled={!tanks.length} className="text-xs font-bold text-blue-700 disabled:opacity-40">Record dip</button></div>{tanks.length ? <div className="space-y-4">{tanks.map(t => <div key={t._id}><div className="flex justify-between text-xs mb-1"><span className="font-bold">{t.code} · {t.name} <span className="text-gray-400 uppercase">{t.product}</span></span><span>{Number(t.currentLitres).toLocaleString()} / {Number(t.capacityLitres).toLocaleString()} L</span></div><div className="h-2.5 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${pct(t) <= 20 ? 'bg-red-600' : 'bg-blue-700'}`} style={{ width: `${pct(t)}%` }} /></div></div>)}</div> : <p className="text-sm text-gray-400 py-5 text-center">No tanks configured.</p>}</div>
        <div className="bg-white rounded-xl border shadow-sm p-4"><h3 className="font-black text-gray-800 mb-3">Controls Requiring Attention</h3><div className="space-y-2">{shifts.filter(s => ['open', 'submitted', 'queried'].includes(s.status)).slice(0, 6).map(s => <div key={s._id} className="flex items-center justify-between rounded-xl bg-gray-50 p-3"><div><p className="text-xs font-bold">{s.number} · {s.pump?.name}</p><p className="text-xs text-gray-400">{s.attendant?.name} · {date(s.openedAt)}</p></div><Bd label={s.status} v={statusColor(s.status)} /></div>)}{!shifts.some(s => ['open', 'submitted', 'queried'].includes(s.status)) && <p className="text-sm text-gray-400 py-5 text-center">No open controls or pending reviews.</p>}</div></div>
      </div>}

      {tab === 'shifts' && (shifts.length ? <div className="bg-white rounded-xl border shadow-sm overflow-x-auto"><table className="w-full text-xs"><thead className="bg-gray-50"><tr>{['Shift / Pump','Attendant','Meter','Litres','Expected','Collected','Variance','Status','Action'].map(h => <th key={h} className="px-3 py-3 text-left text-gray-400 uppercase">{h}</th>)}</tr></thead><tbody className="divide-y">{shifts.map(s => <tr key={s._id}><td className="px-3 py-3 font-bold">{s.number}<br/><span className="text-gray-400">{s.pump?.code} / {s.nozzleCode}</span></td><td className="px-3">{s.attendant?.name}</td><td className="px-3">{s.openingMeter} → {s.closingMeter ?? 'Open'}</td><td className="px-3 font-bold">{s.litresSold || 0} L</td><td className="px-3">{fmt(s.expectedAmount)}</td><td className="px-3">{fmt(s.actualCollected)}</td><td className={`px-3 font-bold ${s.cashVariance < 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(s.cashVariance)}</td><td className="px-3"><Bd label={s.status} v={statusColor(s.status)} /></td><td className="px-3"><div className="flex gap-1">{s.status === 'open' && <button onClick={() => openAction('close', { id: s._id, closingMeter: s.openingMeter, testLitres: 0, cash: 0, card: 0, mobileMoney: 0, credit: 0 })} className="text-blue-700 font-bold">Close</button>}{canManage && s.status === 'submitted' && <><button disabled={busy} onClick={() => review('shift', s._id, 'approved')} className="text-green-700 font-bold">Approve</button><button disabled={busy} onClick={() => review('shift', s._id, 'queried')} className="text-red-600 font-bold">Query</button></>}</div></td></tr>)}</tbody></table></div> : empty('No pump shifts recorded yet.'))}

      {tab === 'dips' && <div className="space-y-3"><div className="flex justify-end"><button onClick={() => openAction('dip')} disabled={!tanks.length} className="px-3 py-2 text-xs font-black bg-blue-900 text-white rounded-xl disabled:opacity-40">+ Record Dip</button></div>{dips.length ? <div className="bg-white rounded-xl border shadow-sm overflow-x-auto"><table className="w-full text-xs"><thead className="bg-gray-50"><tr>{['Dip','Tank','Measured','Book Closing','Actual Dip','Variance','Status','Review'].map(h => <th key={h} className="px-3 py-3 text-left text-gray-400 uppercase">{h}</th>)}</tr></thead><tbody className="divide-y">{dips.map(d => <tr key={d._id}><td className="px-3 py-3 font-bold">{d.number}</td><td className="px-3">{d.tank?.code} · {d.tank?.product}</td><td className="px-3">{date(d.measuredAt)}</td><td className="px-3">{d.theoreticalClosingLitres} L</td><td className="px-3 font-bold">{d.closingDipLitres} L</td><td className={`px-3 font-bold ${Math.abs(d.variancePercent) > 0.5 ? 'text-red-600' : 'text-green-600'}`}>{d.varianceLitres} L ({d.variancePercent}%)</td><td className="px-3"><Bd label={d.status} v={statusColor(d.status)} /></td><td className="px-3">{canManage && d.status === 'pending' && <div className="flex gap-2"><button onClick={() => review('dip', d._id, 'approved')} className="text-green-700 font-bold">Approve</button><button onClick={() => review('dip', d._id, 'queried')} className="text-red-600 font-bold">Query</button></div>}</td></tr>)}</tbody></table></div> : empty('No tank dips recorded yet.')}</div>}

      {tab === 'deliveries' && <div className="space-y-3"><div className="flex justify-end"><button onClick={() => openAction('delivery')} disabled={!tanks.length} className="px-3 py-2 text-xs font-black bg-blue-900 text-white rounded-xl disabled:opacity-40">+ Receive Delivery</button></div>{deliveries.length ? <div className="bg-white rounded-xl border shadow-sm overflow-x-auto"><table className="w-full text-xs"><thead className="bg-gray-50"><tr>{['Receipt','Tank','Supplier / Note','Dispatched','Received','Variance','Seals','Date'].map(h => <th key={h} className="px-3 py-3 text-left text-gray-400 uppercase">{h}</th>)}</tr></thead><tbody className="divide-y">{deliveries.map(d => <tr key={d._id}><td className="px-3 py-3 font-bold">{d.number}</td><td className="px-3">{d.tank?.code}</td><td className="px-3">{d.supplier}<br/><span className="text-gray-400">{d.deliveryNote}</span></td><td className="px-3">{d.dispatchedLitres} L</td><td className="px-3 font-bold">{d.receivedLitres} L</td><td className={d.varianceLitres < 0 ? 'px-3 text-red-600 font-bold' : 'px-3'}>{d.varianceLitres} L</td><td className="px-3"><Bd label={d.sealsIntact ? 'Intact' : 'Broken'} v={d.sealsIntact ? 'green' : 'red'} /></td><td className="px-3">{date(d.receivedAt)}</td></tr>)}</tbody></table></div> : empty('No fuel deliveries recorded yet.')}</div>}

      {tab === 'setup' && <div className="space-y-4"><div className="flex flex-wrap justify-between gap-2"><p className="text-xs text-blue-700 bg-blue-50 rounded-xl p-3"><b>Nozzle:</b> the dispensing handle/hose on a fuel pump. Each nozzle keeps its own meter reading.</p><div className="flex gap-2">{canManage && <><button onClick={() => openAction('tank')} className="px-3 py-2 text-xs font-bold border border-blue-200 text-blue-800 rounded-xl">+ Tank</button><button onClick={() => openAction('pump')} disabled={!tanks.length} className="px-3 py-2 text-xs font-black bg-blue-900 text-white rounded-xl disabled:opacity-40">+ Pump</button></>}</div></div><div className="grid lg:grid-cols-2 gap-5"><div className="bg-white border rounded-xl p-4"><h3 className="font-black mb-3">Tanks</h3>{tanks.map(t => <div key={t._id} className="flex justify-between py-2 border-b text-xs"><span className="font-bold">{t.code} · {t.name}</span><span>{t.product.toUpperCase()} · {t.capacityLitres.toLocaleString()} L</span></div>)}{!tanks.length && <p className="text-sm text-gray-400">No tanks configured.</p>}</div><div className="bg-white border rounded-xl p-4"><h3 className="font-black mb-3">Pumps & Nozzles</h3>{pumps.map(p => <div key={p._id} className="flex justify-between py-2 border-b text-xs"><span className="font-bold">{p.code} · {p.name}</span><span>{p.nozzles.map(n => `${n.code}: ${n.meterReading} L`).join(', ')} · {fmt(p.pricePerLitre)}/L</span></div>)}{!pumps.length && <p className="text-sm text-gray-400">No pumps configured.</p>}</div></div></div>}

      {action && <Modal title={{ tank: 'Add Fuel Tank', pump: 'Add Pump & Nozzle', open: 'Open Pump Shift', close: 'Close & Reconcile Shift', dip: 'Record Tank Dip', delivery: 'Receive Fuel Delivery' }[action]} onClose={() => setAction(null)}><form onSubmit={save} className="space-y-3">
        {action === 'tank' && <>{select('branch', 'Branch', branches.map(b => ({ value: b._id, label: `${b.name} · ${b.type}` })))}<div className="grid grid-cols-2 gap-3">{input('code','Tank code')}{input('name','Tank name')}</div>{select('product','Product',[{value:'petrol',label:'Petrol'},{value:'diesel',label:'Diesel'},{value:'premium',label:'Premium'},{value:'lpg',label:'LPG'}])}<div className="grid grid-cols-3 gap-3">{input('capacityLitres','Capacity (L)','number',{min:1})}{input('currentLitres','Opening stock (L)','number',{min:0})}{input('reorderLevelLitres','Reorder level (L)','number',{min:0})}</div></>}
        {action === 'pump' && <>{select('tank','Supply tank',tanks.map(t => ({value:t._id,label:`${t.code} · ${t.name}`})))}<div className="grid grid-cols-2 gap-3">{input('code','Pump code')}{input('name','Pump name')}</div>{input('pricePerLitre','Selling price / litre','number',{min:0,step:'0.01'})}<div className="grid grid-cols-3 gap-3">{input('nozzleCode','Nozzle code')}{input('nozzleLabel','Nozzle label')}{input('meterReading','Opening totalizer','number',{min:0,step:'0.01'})}</div></>}
        {action === 'open' && <>{select('pump','Pump',pumps.filter(p => p.status === 'active').map(p => ({value:p._id,label:`${p.code} · ${p.name} (${p.product})`})))}{select('nozzleCode','Nozzle',pumps.find(p => p._id === form.pump)?.nozzles.filter(n => n.active).map(n => ({value:n.code,label:`${n.label} · saved meter ${n.meterReading}`})) || [])}{input('openingMeter','Verified opening meter','number',{min:0,step:'0.01'})}{input('notes','Handover notes')}</>}
        {action === 'close' && <><div className="grid grid-cols-2 gap-3">{input('closingMeter','Closing meter','number',{min:0,step:'0.01'})}{input('testLitres','Authorised test litres','number',{min:0,step:'0.01'})}</div><p className="text-xs font-black text-blue-900 pt-1">Collections by tender</p><div className="grid grid-cols-2 gap-3">{input('cash','Cash','number',{min:0,step:'0.01'})}{input('card','Card','number',{min:0,step:'0.01'})}{input('mobileMoney','Mobile money','number',{min:0,step:'0.01'})}{input('credit','Approved credit','number',{min:0,step:'0.01'})}</div>{input('varianceReason','Variance / handover note')}</>}
        {action === 'dip' && <>{select('tank','Tank',tanks.map(t => ({value:t._id,label:`${t.code} · ${t.name} · ${t.currentLitres} L book stock`})))}<div className="grid grid-cols-3 gap-3">{input('closingDipLitres','Measured litres','number',{min:0,step:'0.01'})}{input('waterLevelMm','Water (mm)','number',{min:0,step:'0.1'})}{input('temperatureC','Temperature °C','number',{step:'0.1'})}</div>{input('notes','Observation / explanation')}</>}
        {action === 'delivery' && <>{select('tank','Receiving tank',tanks.map(t => ({value:t._id,label:`${t.code} · ${t.name}`})))}<div className="grid grid-cols-2 gap-3">{input('supplier','Supplier')}{input('deliveryNote','Delivery note')}</div><div className="grid grid-cols-2 gap-3">{input('tankerRegistration','Tanker registration')}{input('driver','Driver')}</div><div className="grid grid-cols-3 gap-3">{input('orderedLitres','Ordered L','number',{min:0})}{input('dispatchedLitres','Dispatch L','number',{min:0})}{input('receivedLitres','Received L','number',{min:0})}</div>{input('sealNumbers','Seal numbers (comma separated)')}{select('sealsIntact','Seal condition',[{value:'true',label:'All seals intact'},{value:'false',label:'Broken / mismatch'}])}{input('notes','Receiving notes')}</>}
        {error && <p className="text-xs text-red-600 font-bold">⚠ {error}</p>}<button disabled={busy} className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black text-sm py-3 rounded-xl">{busy ? 'Saving…' : 'Save controlled record'}</button>
      </form></Modal>}
    </div>
  );
}

// ─── COMPANY & BRANCHES ───
function SettView() {
  const [branches,setBranches]=useState([]),[outlets,setOutlets]=useState([]); const [modal,setModal]=useState(null),[form,setForm]=useState({}),[err,setErr]=useState('');
  const [demoBatches,setDemoBatches]=useState([]),[demoBusy,setDemoBusy]=useState(false);
  const load=()=>Promise.all([api.branches(),api.outlets(),api.demoBatches()]).then(([b,o,d])=>{setBranches(b);setOutlets(o);setDemoBatches(d)}).catch(e=>setErr(e.message)); useEffect(()=>{load()},[]);
  const save=async e=>{e.preventDefault();try{if(modal.type==='branch')modal.item?await api.updateBranch(modal.item._id,form):await api.createBranch({...form,divisions:form.divisions||[]});else modal.item?await api.updateOutlet(modal.item._id,form):await api.createOutlet(form);setModal(null);load();}catch(x){setErr(x.message)}};
  return <div className="space-y-5"><div className="flex justify-between"><div><h2 className="text-xl font-black text-blue-900">Company, Branches & Outlets</h2><p className="text-sm text-gray-500">Super Admin controls the legal branch structure and each shop location</p></div><div className="flex gap-2"><button onClick={()=>{setModal({type:'branch'});setForm({type:'Tyres & Batteries',divisions:['tyres'],active:true})}} className="px-3 py-2 border border-blue-200 text-blue-900 rounded-xl text-xs font-bold">+ Branch</button><button onClick={()=>{setModal({type:'outlet'});setForm({division:'tyres',active:true})}} className="px-3 py-2 bg-red-600 text-white rounded-xl text-xs font-black">+ Outlet</button></div></div>{err&&<p className="text-xs text-red-600">⚠ {err}</p>}
    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-black text-orange-900">Demo Data Control</h3><p className="text-xs text-orange-700 mt-1">Generated generated records are isolated by batch. Deleting a batch leaves all genuine records untouched.</p></div>{!demoBatches.some(x=>x.status==='ready'||x.status==='creating')&&<button disabled={demoBusy} onClick={async()=>{setDemoBusy(true);setErr('');try{await api.seedDemoData({label:'ADMABS operational flow demonstration'});await load()}catch(x){setErr(x.message)}finally{setDemoBusy(false)}}} className="px-4 py-2 bg-orange-600 text-white rounded-xl text-xs font-black">{demoBusy?'Generating…':'Generate Full Demo Dataset'}</button>}</div>{demoBatches.map(b=><div key={b._id} className="mt-3 bg-white/70 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black">{b.label} · {b.code}</p><p className="text-xs text-gray-500">{Object.values(b.counts||{}).reduce((s,n)=>s+n,0).toLocaleString()} records · {b.status}</p></div>{b.status!=='deleted'&&<button disabled={demoBusy} onClick={async()=>{if(confirm('Delete only this generated demo batch?')){setDemoBusy(true);try{await api.deleteDemoBatch(b._id);await load()}catch(x){setErr(x.message)}finally{setDemoBusy(false)}}}} className="px-3 py-2 border border-red-200 text-red-700 rounded-xl text-xs font-bold">Delete Demo Data</button>}</div>)}</div>
    <div className="grid lg:grid-cols-2 gap-5"><div className="bg-white rounded-xl border p-4"><h3 className="font-black mb-3">Branches</h3>{branches.map(b=><div key={b._id} className="flex justify-between items-center py-3 border-b"><div><p className="font-bold text-sm">{b.name}</p><p className="text-xs text-gray-400">{b.code||'No code'} · {b.type} · {(b.divisions||[]).join(', ')}</p></div><div className="flex gap-2"><button onClick={()=>{setModal({type:'branch',item:b});setForm(b)}} className="text-xs text-blue-700 font-bold">Edit</button><button onClick={async()=>{if(confirm(`Delete ${b.name}?`)){try{await api.deleteBranch(b._id);load()}catch(x){setErr(x.message)}}}} className="text-xs text-red-600 font-bold">Delete</button></div></div>)}</div><div className="bg-white rounded-xl border p-4"><h3 className="font-black mb-3">Outlets / Shops</h3>{outlets.map(o=><div key={o._id} className="flex justify-between items-center py-3 border-b"><div><p className="font-bold text-sm">{o.name}</p><p className="text-xs text-gray-400">{o.code} · {o.branch?.name} · {o.division} · {o.runs24Hours?'24-hour Day/Night':'Day only'}</p></div><button onClick={()=>{setModal({type:'outlet',item:o});setForm({...o,branch:o.branch?._id})}} className="text-xs text-blue-700 font-bold">Edit</button></div>)}</div></div>
    {modal&&<Modal title={`${modal.item?'Edit':'Add'} ${modal.type==='branch'?'Branch':'Outlet'}`} onClose={()=>setModal(null)}><form onSubmit={save} className="space-y-3">{modal.type==='branch'?<>{[['name','Branch name'],['code','Code'],['manager','Manager name'],['address','Address'],['region','Region'],['phone','Phone']].map(([k,l])=><label key={k} className="block text-xs font-bold text-gray-500">{l}<input required={k==='name'} value={form[k]||''} onChange={e=>setForm({...form,[k]:e.target.value})} className="mt-1 w-full border rounded-xl p-2.5"/></label>)}<label className="block text-xs font-bold text-gray-500">Branch type<select value={form.type||''} onChange={e=>setForm({...form,type:e.target.value})} className="mt-1 w-full border rounded-xl p-2.5 bg-white">{['Tyres & Batteries','Filling Station','Supermarket','Administration'].map(x=><option key={x}>{x}</option>)}</select></label><div><p className="text-xs font-bold text-gray-500 mb-2">Divisions at this branch</p><div className="flex flex-wrap gap-2">{['tyres','fuel','supermarket','warehouse','head_office'].map(d=><label key={d} className="border rounded-lg p-2 text-xs"><input type="checkbox" checked={(form.divisions||[]).includes(d)} onChange={e=>setForm({...form,divisions:e.target.checked?[...(form.divisions||[]),d]:(form.divisions||[]).filter(x=>x!==d)})}/> {d}</label>)}</div></div></>:<>{[['code','Outlet code'],['name','Outlet name']].map(([k,l])=><label key={k} className="block text-xs font-bold text-gray-500">{l}<input required value={form[k]||''} onChange={e=>setForm({...form,[k]:e.target.value})} className="mt-1 w-full border rounded-xl p-2.5"/></label>)}<label className="block text-xs font-bold text-gray-500">Parent branch<select required value={form.branch||''} onChange={e=>setForm({...form,branch:e.target.value})} className="mt-1 w-full border rounded-xl p-2.5 bg-white"><option value="">Select</option>{branches.map(b=><option key={b._id} value={b._id}>{b.name}</option>)}</select></label><label className="block text-xs font-bold text-gray-500">Division<select value={form.division||'tyres'} onChange={e=>setForm({...form,division:e.target.value})} className="mt-1 w-full border rounded-xl p-2.5 bg-white">{['tyres','fuel','supermarket','warehouse','head_office'].map(x=><option key={x}>{x}</option>)}</select></label><label className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs"><input type="checkbox" checked={Boolean(form.runs24Hours)} onChange={e=>setForm({...form,runs24Hours:e.target.checked})}/><span><b>24-hour Day/Night operation</b><br/><span className="text-blue-700">Enable only for outlets that genuinely operate overnight.</span></span></label></>}<button className="w-full py-3 bg-red-600 text-white rounded-xl font-black">Save location</button></form></Modal>}
  </div>;
}

function ReconcileView({user}) {
  const [items,setItems]=useState([]),[branches,setBranches]=useState([]),[outlets,setOutlets]=useState([]),[form,setForm]=useState({businessDate:new Date().toISOString().slice(0,10),counted:{}}),[prepared,setPrepared]=useState(null),[err,setErr]=useState('');
  const load=()=>api.reconciliations().then(setItems).catch(e=>setErr(e.message)); useEffect(()=>{load();Promise.all([api.branches(),api.outlets()]).then(([b,o])=>{setBranches(b);setOutlets(o)}).catch(()=>{})},[]);
  const prepare=async()=>{try{setPrepared(await api.prepareReconciliation({branch:form.branch,outlet:form.outlet||'',date:form.businessDate}));setErr('')}catch(x){setErr(x.message)}};
  const submit=async()=>{try{await api.createReconciliation({...form,stockCountValue:Number(form.stockCountValue),counted:Object.fromEntries(['cash','card','mobileMoney','bank','credit'].map(k=>[k,Number(form.counted?.[k]||0)]))});setPrepared(null);load()}catch(x){setErr(x.message)}};
  const canReview=['super_admin','ceo','gm','finance','accountant','branch','sub_manager'].includes(user?.role)||user?.permissions?.includes('reconciliation.review');
  return <div className="space-y-5"><div><h2 className="text-xl font-black text-blue-900">Daily Sales, Cash & Stock Reconciliation</h2><p className="text-sm text-gray-500">Compare system sales with physical tenders and closing stock for each shop</p></div>{err&&<p className="text-xs text-red-600">⚠ {err}</p>}<div className="bg-white border rounded-xl p-4 grid md:grid-cols-4 gap-3"><input type="date" value={form.businessDate} onChange={e=>setForm({...form,businessDate:e.target.value})} className="border rounded-xl p-2 text-sm"/><select value={form.branch||''} onChange={e=>setForm({...form,branch:e.target.value,outlet:''})} className="border rounded-xl p-2 bg-white text-sm"><option value="">Select branch</option>{branches.map(b=><option key={b._id} value={b._id}>{b.name}</option>)}</select><select value={form.outlet||''} onChange={e=>setForm({...form,outlet:e.target.value})} className="border rounded-xl p-2 bg-white text-sm"><option value="">Whole branch</option>{outlets.filter(o=>!form.branch||(o.branch?._id||o.branch)===form.branch).map(o=><option key={o._id} value={o._id}>{o.name}</option>)}</select><button onClick={prepare} className="bg-blue-900 text-white rounded-xl font-black">Prepare closing</button></div>
    {prepared&&<div className="bg-white border rounded-xl p-5"><div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4"><Kpi label="System Sales" val={fmt(prepared.expected.total)} Ic={DollarSign} bg="bg-blue-900"/><Kpi label="Transactions" val={prepared.salesCount} Ic={Receipt} bg="bg-blue-700"/><Kpi label="Book Stock" val={fmt(prepared.stockBookValue)} Ic={Package} bg="bg-red-600"/><Kpi label="SKUs Counted" val={prepared.skuCount} Ic={ClipboardList} bg="bg-slate-700"/></div><p className="font-black text-sm mb-3">Physical collection totals</p><div className="grid md:grid-cols-5 gap-3">{['cash','card','mobileMoney','bank','credit'].map(k=><label key={k} className="text-xs font-bold text-gray-500">{k.replace('mobileMoney','Mobile money')}<input type="number" min="0" step="0.01" value={form.counted?.[k]||''} onChange={e=>setForm({...form,counted:{...form.counted,[k]:e.target.value}})} className="mt-1 w-full border rounded-xl p-2"/><span className="block mt-1 text-blue-700">Expected {fmt(prepared.expected[k])}</span></label>)}</div><label className="block text-xs font-bold text-gray-500 mt-3">Physical closing stock value<input type="number" value={form.stockCountValue??prepared.stockBookValue} onChange={e=>setForm({...form,stockCountValue:e.target.value})} className="mt-1 w-full border rounded-xl p-2.5"/></label><label className="block text-xs font-bold text-gray-500 mt-3">Variance explanation<textarea value={form.explanation||''} onChange={e=>setForm({...form,explanation:e.target.value})} className="mt-1 w-full border rounded-xl p-2.5"/></label><button onClick={submit} className="mt-4 w-full py-3 bg-red-600 text-white rounded-xl font-black">Submit end-of-day reconciliation</button></div>}
    <div className="bg-white border rounded-xl overflow-x-auto"><table className="w-full text-xs"><thead className="bg-gray-50"><tr>{['Date','Branch / Outlet','Expected','Counted','Cash Variance','Stock Variance','Status','Review'].map(h=><th key={h} className="p-3 text-left text-gray-400 uppercase">{h}</th>)}</tr></thead><tbody className="divide-y">{items.map(x=><tr key={x._id}><td className="p-3">{new Date(x.businessDate).toLocaleDateString()}</td><td className="p-3 font-bold">{x.branch?.name} / {x.outlet?.name||'All'}</td><td className="p-3">{fmt(x.expected?.total)}</td><td className="p-3">{fmt(x.counted?.total)}</td><td className={`p-3 font-bold ${x.variance<0?'text-red-600':'text-green-600'}`}>{fmt(x.variance)}</td><td className="p-3">{fmt(x.stockVariance)}</td><td className="p-3"><Bd label={x.status} v={x.status==='approved'?'green':x.status==='queried'?'red':'orange'}/></td><td className="p-3">{canReview&&x.status==='submitted'&&<div className="flex gap-2"><button onClick={()=>api.reviewReconciliation(x._id,{status:'approved'}).then(load)} className="text-green-700 font-bold">Approve</button><button onClick={()=>api.reviewReconciliation(x._id,{status:'queried'}).then(load)} className="text-red-600 font-bold">Query</button></div>}</td></tr>)}</tbody></table></div>
  </div>;
}

function PayrollView(){
  const [employees,setEmployees]=useState([]),[runs,setRuns]=useState([]),[period,setPeriod]=useState(new Date().toISOString().slice(0,7)),[editing,setEditing]=useState(null),[err,setErr]=useState('');
  const load=()=>Promise.all([api.payrollEmployees(),api.payrollRuns()]).then(([e,r])=>{setEmployees(e);setRuns(r)}).catch(x=>setErr(x.message)); useEffect(()=>{load()},[]);
  const create=async()=>{try{await api.createPayrollRun({period});await load()}catch(x){setErr(x.message)}};
  return <div className="space-y-5"><div><h2 className="text-xl font-black text-blue-900">General Payroll</h2><p className="text-sm text-gray-500">Salary register for attendants, managers, drivers, technicians and all other employees</p></div>{err&&<p className="text-xs text-red-600">⚠ {err}</p>}<div className="bg-white border rounded-xl p-4 flex flex-wrap gap-3 items-end"><label className="text-xs font-bold text-gray-500">Payroll month<input type="month" value={period} onChange={e=>setPeriod(e.target.value)} className="block mt-1 border rounded-xl p-2"/></label><button onClick={create} className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-black">Generate payroll</button></div><div className="grid lg:grid-cols-3 gap-4"><div className="lg:col-span-2 bg-white border rounded-xl overflow-x-auto"><table className="w-full text-xs"><thead className="bg-gray-50"><tr>{['Employee','Position','Department','Branch','Basic Salary',''].map(h=><th key={h} className="p-3 text-left text-gray-400 uppercase">{h}</th>)}</tr></thead><tbody className="divide-y">{employees.map(e=><tr key={e._id}><td className="p-3 font-bold">{e.name}<br/><span className="font-normal text-gray-400">{e.employeeNumber||e.username}</span></td><td className="p-3">{e.jobTitle||ROLE_CONFIG[e.role]?.label||e.role}</td><td className="p-3">{e.department||'—'}</td><td className="p-3">{e.branch?.name||'—'}</td><td className="p-3 font-bold">{fmt(e.basicSalary)}</td><td className="p-3"><button onClick={()=>setEditing(e)} className="text-blue-700 font-bold">Salary setup</button></td></tr>)}</tbody></table></div><div className="space-y-3">{runs.map(r=><div key={r._id} className="bg-white border rounded-xl p-4"><div className="flex justify-between"><b>{r.period}</b><Bd label={r.status} v={r.status==='paid'?'green':r.status==='approved'?'blue':'yellow'}/></div><p className="text-xl font-black text-blue-900 mt-2">{fmt(r.netTotal)}</p><p className="text-xs text-gray-400">{r.lines?.length||0} employees</p><div className="flex gap-2 mt-3">{r.status==='draft'&&<button onClick={()=>api.updatePayrollRun(r._id,{status:'approved'}).then(load)} className="text-xs font-bold text-blue-700">Approve</button>}{r.status==='approved'&&<button onClick={()=>api.updatePayrollRun(r._id,{status:'paid'}).then(load)} className="text-xs font-bold text-green-700">Mark paid</button>}</div></div>)}</div></div>{editing&&<Modal title={`Payroll setup — ${editing.name}`} onClose={()=>setEditing(null)}><form onSubmit={async e=>{e.preventDefault();try{await api.updatePayrollEmployee(editing._id,{jobTitle:editing.jobTitle,department:editing.department,phone:editing.phone,basicSalary:Number(editing.basicSalary)});setEditing(null);load()}catch(x){setErr(x.message)}}} className="space-y-3">{[['jobTitle','Job title / position'],['department','Department'],['phone','Mobile number'],['basicSalary','Monthly basic salary']].map(([k,l])=><label key={k} className="block text-xs font-bold text-gray-500">{l}<input type={k==='basicSalary'?'number':'text'} value={editing[k]||''} onChange={e=>setEditing({...editing,[k]:e.target.value})} className="mt-1 w-full border rounded-xl p-2.5"/></label>)}<button className="w-full py-3 bg-blue-900 text-white rounded-xl font-black">Save payroll profile</button></form></Modal>}</div>
}

function SmsView(){
  const [campaigns,setCampaigns]=useState([]),[form,setForm]=useState({audience:'both',message:''}),[err,setErr]=useState(''),[busy,setBusy]=useState(false);const load=()=>api.smsCampaigns().then(setCampaigns).catch(x=>setErr(x.message));useEffect(()=>{load()},[]);
  const send=async()=>{setBusy(true);setErr('');try{await api.createSmsCampaign(form);setForm({...form,message:''});await load()}catch(x){setErr(x.message)}finally{setBusy(false)}};
  return <div className="space-y-5"><div><h2 className="text-xl font-black text-blue-900">SMS Communication Centre</h2><p className="text-sm text-gray-500">Prepare announcements for employees, customers or both groups</p></div>{err&&<p className="text-xs text-red-600">⚠ {err}</p>}<div className="grid lg:grid-cols-3 gap-5"><div className="bg-white border rounded-xl p-5 space-y-3"><label className="block text-xs font-bold text-gray-500">Audience<select value={form.audience} onChange={e=>setForm({...form,audience:e.target.value})} className="mt-1 w-full border rounded-xl p-2.5 bg-white"><option value="employees">All employees with phone numbers</option><option value="customers">All customers with phone numbers</option><option value="both">Employees and customers</option></select></label><label className="block text-xs font-bold text-gray-500">Message<textarea maxLength="480" rows="7" value={form.message} onChange={e=>setForm({...form,message:e.target.value})} className="mt-1 w-full border rounded-xl p-2.5"/></label><p className="text-xs text-gray-400">{form.message.length}/480 characters</p><button onClick={send} disabled={busy||!form.message.trim()} className="w-full py-3 bg-red-600 text-white rounded-xl font-black disabled:opacity-40">{busy?'Queuing…':'Queue SMS campaign'}</button><p className="text-xs text-orange-700 bg-orange-50 p-3 rounded-xl">Campaigns remain queued until the production SMS gateway credentials are configured.</p></div><div className="lg:col-span-2 bg-white border rounded-xl overflow-x-auto"><table className="w-full text-xs"><thead className="bg-gray-50"><tr>{['Date','Audience','Message','Recipients','Status'].map(h=><th key={h} className="p-3 text-left text-gray-400 uppercase">{h}</th>)}</tr></thead><tbody className="divide-y">{campaigns.map(c=><tr key={c._id}><td className="p-3">{new Date(c.createdAt).toLocaleString()}</td><td className="p-3 capitalize">{c.audience}</td><td className="p-3 max-w-sm">{c.message}</td><td className="p-3 font-bold">{c.recipientCount}</td><td className="p-3"><Bd label={c.status} v={c.status==='sent'?'green':c.status==='failed'?'red':'yellow'}/></td></tr>)}</tbody></table></div></div></div>
}

function PerformanceView({user}){
  const now=new Date(),start=new Date(now.getFullYear(),now.getMonth(),1).toISOString().slice(0,10);const [filters,setFilters]=useState({start,end:now.toISOString().slice(0,10)}),[data,setData]=useState({metrics:[],rewards:[]}),[reward,setReward]=useState(null),[err,setErr]=useState('');
  const load=()=>api.performance(filters).then(setData).catch(x=>setErr(x.message));useEffect(()=>{load()},[]);const canReward=['super_admin','ceo','gm'].includes(user?.role)||user?.permissions?.includes('performance.manage');
  return <div className="space-y-5"><div><h2 className="text-xl font-black text-blue-900">Employee Performance & Rewards</h2><p className="text-sm text-gray-500">Scores combine approved transactions, sales or fuel activity, and controlled cash variance</p></div>{err&&<p className="text-xs text-red-600">⚠ {err}</p>}<div className="bg-white border rounded-xl p-4 flex flex-wrap gap-3"><input type="date" value={filters.start} onChange={e=>setFilters({...filters,start:e.target.value})} className="border rounded-xl p-2 text-sm"/><input type="date" value={filters.end} onChange={e=>setFilters({...filters,end:e.target.value})} className="border rounded-xl p-2 text-sm"/><button onClick={load} className="px-5 bg-blue-900 text-white rounded-xl text-xs font-black">Calculate performance</button><span title="Score: up to 45 points for approved controls, 35 for activity and 20 for low cash variance. Non-sales roles remain Not Rated until role-specific measures are added." className="w-7 h-7 rounded-full bg-blue-100 text-blue-800 font-black grid place-items-center cursor-help">?</span></div><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{data.metrics.map((m,i)=><div key={m.employee._id} className="bg-white border rounded-xl p-4"><div className="flex justify-between"><div><p className="font-black text-gray-800">{i+1}. {m.employee.name}</p><p className="text-xs text-gray-400">{m.employee.jobTitle||ROLE_CONFIG[m.employee.role]?.label||m.employee.role} · {m.employee.branch?.name||'—'}</p></div><div className={`w-14 h-14 rounded-full grid place-items-center text-white font-black ${m.score===null?'bg-gray-400':m.score>=85?'bg-green-600':m.score>=70?'bg-blue-700':m.score>=55?'bg-orange-500':'bg-red-600'}`}>{m.score??'—'}</div></div><div className="grid grid-cols-2 gap-2 mt-4 text-xs"><div className="bg-gray-50 rounded-lg p-2">Sales<br/><b>{m.salesCount} · {fmt(m.revenue)}</b></div><div className="bg-gray-50 rounded-lg p-2">Fuel<br/><b>{m.fuelShiftCount} shifts · {m.fuelLitres} L</b></div><div className="bg-gray-50 rounded-lg p-2">Approved<br/><b>{m.approvedCount}</b></div><div className="bg-gray-50 rounded-lg p-2">Variance<br/><b>{fmt(m.variance)}</b></div></div><div className="flex justify-between items-center mt-3"><Bd label={m.rating} v={m.score===null?'gray':m.score>=70?'green':m.score>=55?'yellow':'red'}/>{canReward&&<button onClick={()=>setReward({employee:m.employee._id,name:m.employee.name,periodStart:filters.start,periodEnd:filters.end,title:m.score>=85?'Outstanding Performance':'Performance Recognition',amount:0,points:m.score||0})} className="text-xs font-bold text-blue-700">Add reward</button>}</div></div>)}</div><div className="bg-white border rounded-xl overflow-x-auto"><table className="w-full text-xs"><thead className="bg-gray-50"><tr>{['Employee','Reward','Period','Amount','Points','Status',''].map(h=><th key={h} className="p-3 text-left text-gray-400 uppercase">{h}</th>)}</tr></thead><tbody className="divide-y">{data.rewards.map(r=><tr key={r._id}><td className="p-3 font-bold">{r.employee?.name}</td><td className="p-3">{r.title}</td><td className="p-3">{new Date(r.periodStart).toLocaleDateString()}–{new Date(r.periodEnd).toLocaleDateString()}</td><td className="p-3">{fmt(r.amount)}</td><td className="p-3">{r.points}</td><td className="p-3"><Bd label={r.status} v={r.status==='paid'?'green':r.status==='cancelled'?'red':'blue'}/></td><td className="p-3">{canReward&&r.status==='approved'&&<button onClick={()=>api.updateReward(r._id,{status:'paid'}).then(load)} className="text-green-700 font-bold">Mark paid</button>}</td></tr>)}</tbody></table></div>{reward&&<Modal title={`Reward — ${reward.name}`} onClose={()=>setReward(null)}><form onSubmit={async e=>{e.preventDefault();try{await api.createReward(reward);setReward(null);load()}catch(x){setErr(x.message)}}} className="space-y-3"><label className="block text-xs font-bold">Reward title<input value={reward.title} onChange={e=>setReward({...reward,title:e.target.value})} className="mt-1 w-full border rounded-xl p-2.5"/></label><label className="block text-xs font-bold">Cash reward<input type="number" min="0" value={reward.amount} onChange={e=>setReward({...reward,amount:e.target.value})} className="mt-1 w-full border rounded-xl p-2.5"/></label><label className="block text-xs font-bold">Reward points<input type="number" min="0" value={reward.points} onChange={e=>setReward({...reward,points:e.target.value})} className="mt-1 w-full border rounded-xl p-2.5"/></label><label className="block text-xs font-bold">Notes<textarea value={reward.notes||''} onChange={e=>setReward({...reward,notes:e.target.value})} className="mt-1 w-full border rounded-xl p-2.5"/></label><button className="w-full py-3 bg-red-600 text-white rounded-xl font-black">Approve reward</button></form></Modal>}</div>
}

function AdminToolsView(){
  const currencies=['GHS','USD','EUR','GBP','CNY','NGN','ZAR','AED','CAD','JPY'];
  const [fx,setFx]=useState({amount:1,from:'USD',to:'GHS'}),[rate,setRate]=useState(null),[backup,setBackup]=useState(null),[file,setFile]=useState(null),[mode,setMode]=useState('merge'),[confirmText,setConfirmText]=useState(''),[audit,setAudit]=useState([]),[busy,setBusy]=useState(''),[msg,setMsg]=useState('');
  const loadAudit=()=>api.dataAudit().then(setAudit).catch(()=>{});useEffect(()=>{loadAudit()},[]);
  const convert=async()=>{setBusy('fx');setMsg('');try{setRate(await api.currencyConvert(fx))}catch(x){setMsg(x.message)}finally{setBusy('')}};
  const download=(blob,name)=>{const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url)};
  const exportJson=async()=>{setBusy('json');try{const data=await api.backupJson();download(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),`admabs-backup-${new Date().toISOString().slice(0,10)}.json`);loadAudit()}catch(x){setMsg(x.message)}finally{setBusy('')}};
  const exportExcel=async()=>{setBusy('excel');try{download(await api.exportExcel(),`admabs-backup-${new Date().toISOString().slice(0,10)}.xlsx`);loadAudit()}catch(x){setMsg(x.message)}finally{setBusy('')}};
  const readFile=chosen=>{setFile(chosen);setBackup(null);setMsg('');if(chosen?.name.toLowerCase().endsWith('.json')){const reader=new FileReader();reader.onload=()=>{try{setBackup(JSON.parse(reader.result))}catch{setMsg('Invalid JSON backup file')}};reader.readAsText(chosen)}};
  const restore=async()=>{if(confirmText!=='RESTORE ADMABS'||!file)return;setBusy('restore');setMsg('');try{if(file.name.toLowerCase().endsWith('.json'))await api.restoreJson({backup,mode,confirmation:confirmText});else{const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(file)});await api.importExcel({data,mode,confirmation:confirmText})}setMsg('Data import completed successfully. Sign in again if user records changed.');loadAudit()}catch(x){setMsg(x.message)}finally{setBusy('')}};
  return <div className="space-y-5"><div><h2 className="text-xl font-black text-blue-900">Admin Tools</h2><p className="text-sm text-gray-500">Live currency rates, protected backups, restores and portable data exports</p></div>{msg&&<p className={`text-xs font-bold p-3 rounded-xl ${/success/i.test(msg)?'bg-green-50 text-green-700':'bg-orange-50 text-orange-700'}`}>{msg}</p>}<div className="grid lg:grid-cols-2 gap-5"><div className="bg-white border rounded-xl p-5 space-y-4"><div className="flex items-center gap-2"><h3 className="font-black text-blue-950">Live Currency Converter</h3><span title="Rates update from central-bank sources and are cached for 15 minutes." className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 text-xs font-black grid place-items-center cursor-help">?</span></div><div className="grid grid-cols-3 gap-2"><input type="number" value={fx.amount} onChange={e=>setFx({...fx,amount:e.target.value})} className="border rounded-xl p-2"/><select value={fx.from} onChange={e=>setFx({...fx,from:e.target.value})} className="border rounded-xl p-2 bg-white">{currencies.map(c=><option key={c}>{c}</option>)}</select><select value={fx.to} onChange={e=>setFx({...fx,to:e.target.value})} className="border rounded-xl p-2 bg-white">{currencies.map(c=><option key={c}>{c}</option>)}</select></div><button onClick={convert} disabled={busy==='fx'} className="w-full py-3 bg-blue-900 text-white rounded-xl font-black">{busy==='fx'?'Updating rate…':'Convert with live rate'}</button>{rate&&<div className="bg-blue-50 rounded-xl p-4"><p className="text-2xl font-black text-blue-950">{Number(rate.result).toLocaleString(undefined,{maximumFractionDigits:4})} {rate.to}</p><p className="text-xs text-blue-700 mt-1">1 {rate.from} = {rate.rate} {rate.to} · {rate.date}</p><p className="text-xs text-gray-400 mt-1">{rate.source}</p></div>}</div><div className="bg-white border rounded-xl p-5 space-y-4"><div className="flex items-center gap-2"><h3 className="font-black text-blue-950">Backup & Export</h3><span title="JSON preserves the full system structure. Excel stores every record in an import-safe workbook." className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 text-xs font-black grid place-items-center cursor-help">?</span></div><p className="text-xs text-gray-500">Download all operational collections, including users, outlets, inventory, sales, payroll and accounting records.</p><div className="grid grid-cols-2 gap-2"><button onClick={exportJson} disabled={!!busy} className="py-3 border border-blue-200 text-blue-900 rounded-xl text-xs font-black">{busy==='json'?'Preparing…':'Export JSON'}</button><button onClick={exportExcel} disabled={!!busy} className="py-3 bg-green-700 text-white rounded-xl text-xs font-black">{busy==='excel'?'Preparing…':'Export Excel'}</button></div></div></div><div className="bg-red-50 border border-red-200 rounded-xl p-5 space-y-4"><div className="flex items-center gap-2"><h3 className="font-black text-red-900">Import & Restore</h3><span title="Merge updates matching IDs and adds missing records. Replace deletes current data before restoring the file." className="w-5 h-5 rounded-full bg-red-200 text-red-800 text-xs font-black grid place-items-center cursor-help">?</span></div><div className="grid md:grid-cols-3 gap-3"><input type="file" accept=".json,.xlsx" onChange={e=>readFile(e.target.files[0])} className="bg-white border rounded-xl p-2 text-xs"/><select value={mode} onChange={e=>setMode(e.target.value)} className="bg-white border rounded-xl p-2 text-xs"><option value="merge">Merge with current data</option><option value="replace">Replace entire system</option></select><input value={confirmText} onChange={e=>setConfirmText(e.target.value)} placeholder="Type RESTORE ADMABS" className="bg-white border rounded-xl p-2 text-xs"/></div><button onClick={restore} disabled={!file||confirmText!=='RESTORE ADMABS'||!!busy} className="px-5 py-3 bg-red-700 disabled:opacity-40 text-white rounded-xl text-xs font-black">{busy==='restore'?'Restoring…':'Import selected backup'}</button><p className="text-xs text-red-700">Replace mode is destructive. Export a fresh backup first. A replacement file must contain an active Super Admin account.</p></div><div className="bg-white border rounded-xl overflow-x-auto"><table className="w-full text-xs"><thead className="bg-gray-50"><tr>{['Time','Action','Format','Mode','Records','Performed by'].map(h=><th key={h} className="p-3 text-left text-gray-400 uppercase">{h}</th>)}</tr></thead><tbody className="divide-y">{audit.map(x=><tr key={x._id}><td className="p-3">{new Date(x.createdAt).toLocaleString()}</td><td className="p-3 capitalize font-bold">{x.action}</td><td className="p-3 uppercase">{x.format}</td><td className="p-3">{x.mode||'—'}</td><td className="p-3">{x.records||0}</td><td className="p-3">{x.performedBy?.name||'System'}</td></tr>)}</tbody></table></div></div>
}

function AttendanceView({user}){
  const [tab,setTab]=useState('live'),[live,setLive]=useState({sessions:[],serverTime:null}),[history,setHistory]=useState([]),[schedules,setSchedules]=useState([]),[outlets,setOutlets]=useState([]),[form,setForm]=useState(null),[err,setErr]=useState('');
  const canManage=user?.role==='super_admin'||user?.permissions?.includes('shifts.manage');
  const load=()=>Promise.all([api.activeSessions(),api.attendanceHistory(7),api.shiftSchedules(),api.outlets()]).then(([a,h,s,o])=>{setLive(a);setHistory(h);setSchedules(s);setOutlets(o.filter(x=>['fuel','supermarket'].includes(x.division)))}).catch(e=>setErr(e.message));
  useEffect(()=>{load();const id=setInterval(load,60000);return()=>clearInterval(id)},[]);
  const duration=start=>{const seconds=Math.max(0,Math.floor((new Date(live.serverTime||Date.now())-new Date(start))/1000));return seconds>=3600?`${Math.floor(seconds/3600)}h ${Math.floor(seconds%3600/60)}m`:`${Math.floor(seconds/60)}m`};
  const save=async e=>{e.preventDefault();setErr('');try{await api.createShiftSchedule({...form,daysOfWeek:[0,1,2,3,4,5,6],earlyStartMinutes:Number(form.earlyStartMinutes||30),lateStartMinutes:Number(form.lateStartMinutes||120)});setForm(null);await load()}catch(x){setErr(x.message)}};
  return <div className="space-y-5"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-black text-blue-900">Attendance & Shift Control</h2><p className="text-sm text-gray-500">Live login presence and scheduled fuel or supermarket shifts, using authoritative server time</p></div><div className="text-right"><p className="text-xs font-bold text-blue-900">Ghana server time</p><p className="text-xs text-gray-500">{live.serverTime?new Date(live.serverTime).toLocaleString('en-GH',{timeZone:'Africa/Accra'}):'Synchronising…'}</p></div></div>{err&&<p className="text-xs text-red-600 bg-red-50 p-3 rounded-xl">⚠ {err}</p>}<Tabs active={tab} onChange={setTab} tabs={[{id:'live',label:`Logged in now (${live.sessions.length})`},{id:'history',label:'Login attendance'},{id:'schedules',label:'Shift schedules'}]}/>
  {tab==='live'&&<div className="bg-white border rounded-xl overflow-x-auto"><table className="w-full text-xs"><thead className="bg-gray-50"><tr>{['Employee','Role','Branch','Outlet','Login time','Session length','Last active'].map(h=><th key={h} className="p-3 text-left text-gray-400 uppercase">{h}</th>)}</tr></thead><tbody className="divide-y">{live.sessions.map(s=><tr key={s._id}><td className="p-3 font-black">{s.user?.name}<p className="font-normal text-gray-400">{s.user?.username}</p></td><td className="p-3">{ROLE_CONFIG[s.user?.role]?.label||s.user?.role}</td><td className="p-3">{s.branchIds?.map(x=>x.name).join(', ')||'Company-wide'}</td><td className="p-3">{s.outletIds?.map(x=>x.name).join(', ')||'—'}</td><td className="p-3">{new Date(s.loggedInAt).toLocaleString('en-GH',{timeZone:'Africa/Accra'})}</td><td className="p-3 font-black text-blue-900">{duration(s.loggedInAt)}</td><td className="p-3"><Bd label="Online" v="green"/><p className="text-gray-400 mt-1">{new Date(s.lastSeenAt).toLocaleTimeString('en-GH',{timeZone:'Africa/Accra'})}</p></td></tr>)}</tbody></table>{!live.sessions.length&&<p className="p-8 text-center text-gray-400 text-sm">No active sessions found.</p>}</div>}
  {tab==='history'&&<div className="bg-white border rounded-xl overflow-x-auto"><table className="w-full text-xs"><thead className="bg-gray-50"><tr>{['Employee','Branch / outlet','Logged in','Last activity','Logged out','Duration'].map(h=><th key={h} className="p-3 text-left text-gray-400 uppercase">{h}</th>)}</tr></thead><tbody className="divide-y">{history.map(s=><tr key={s._id}><td className="p-3 font-bold">{s.user?.name}<p className="font-normal text-gray-400">{ROLE_CONFIG[s.user?.role]?.label||s.user?.role}</p></td><td className="p-3">{s.branchIds?.map(x=>x.name).join(', ')||'Company-wide'}<p className="text-gray-400">{s.outletIds?.map(x=>x.name).join(', ')}</p></td><td className="p-3">{new Date(s.loggedInAt).toLocaleString('en-GH',{timeZone:'Africa/Accra'})}</td><td className="p-3">{new Date(s.lastSeenAt).toLocaleString('en-GH',{timeZone:'Africa/Accra'})}</td><td className="p-3">{s.loggedOutAt?new Date(s.loggedOutAt).toLocaleString('en-GH',{timeZone:'Africa/Accra'}):'Session active / expired'}</td><td className="p-3 font-bold">{duration(s.loggedInAt)}</td></tr>)}</tbody></table></div>}
  {tab==='schedules'&&<div className="space-y-3"><div className="flex justify-end">{canManage&&<button onClick={()=>setForm({name:'Day Shift',workShift:'day',startTime:'06:00',endTime:'18:00',earlyStartMinutes:30,lateStartMinutes:120,outlet:''})} className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-black">+ Add Schedule</button>}</div><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{schedules.map(s=><div key={s._id} className="bg-white border rounded-xl p-4"><div className="flex justify-between"><div><p className="font-black">{s.name}</p><p className="text-xs text-gray-400 capitalize">{s.division} · {s.outlet?.name}</p></div><Bd label={s.active?'Active':'Disabled'} v={s.active?'green':'gray'}/></div><p className="text-2xl font-black text-blue-900 mt-4">{s.startTime} – {s.endTime}</p><p className="text-xs text-gray-500 capitalize">{s.workShift} · Ghana time</p>{canManage&&<button onClick={()=>api.updateShiftSchedule(s._id,{active:!s.active}).then(load).catch(x=>setErr(x.message))} className="mt-3 text-xs font-bold text-blue-700">{s.active?'Disable':'Enable'} schedule</button>}</div>)}</div></div>}
  {form&&<Modal title="Add outlet shift schedule" onClose={()=>setForm(null)}><form onSubmit={save} className="space-y-3"><label className="block text-xs font-bold">Outlet<select required value={form.outlet} onChange={e=>{const o=outlets.find(x=>x._id===e.target.value);setForm({...form,outlet:e.target.value,division:o?.division})}} className="mt-1 w-full border rounded-xl p-2.5 bg-white"><option value="">Select outlet</option>{outlets.map(o=><option key={o._id} value={o._id}>{o.name} · {o.division}{o.runs24Hours?' · 24 hours':''}</option>)}</select></label><label className="block text-xs font-bold">Schedule name<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="mt-1 w-full border rounded-xl p-2.5"/></label><div className="grid grid-cols-2 gap-2"><label className="text-xs font-bold">Start time<input required type="time" value={form.startTime} onChange={e=>setForm({...form,startTime:e.target.value})} className="mt-1 w-full border rounded-xl p-2.5"/></label><label className="text-xs font-bold">End time<input required type="time" value={form.endTime} onChange={e=>setForm({...form,endTime:e.target.value})} className="mt-1 w-full border rounded-xl p-2.5"/></label></div><label className="block text-xs font-bold">Shift type<select value={form.workShift} onChange={e=>setForm({...form,workShift:e.target.value,name:e.target.value==='night'?'Night Shift':'Day Shift'})} className="mt-1 w-full border rounded-xl p-2.5 bg-white"><option value="day">Day</option><option value="night">Night (24-hour outlets only)</option></select></label><p className="text-xs text-gray-500 bg-blue-50 p-3 rounded-xl">This default schedule applies every day to assigned attendants at the selected outlet. Staff-specific and weekday assignment can be added through advanced editing.</p><button className="w-full py-3 bg-blue-900 text-white rounded-xl font-black">Save schedule</button></form></Modal>}</div>;
}

function WebsiteView() {
  const [form,setForm]=useState({}),[products,setProducts]=useState([]),[saving,setSaving]=useState(false),[msg,setMsg]=useState(''); useEffect(()=>{Promise.all([api.siteContent(),api.products()]).then(([c,p])=>{setForm(c);setProducts(p.filter(x=>['Tyre','Rim','Battery'].includes(x.category)))})},[]);
  const upload=(key,file)=>{if(!file)return;if(file.size>1500000){setMsg('Image must be below 1.5 MB');return}const reader=new FileReader();reader.onload=()=>setForm(f=>({...f,[key]:reader.result}));reader.readAsDataURL(file)};
  const save=async()=>{setSaving(true);try{setForm(await api.updateSiteContent(form));setMsg('Website content published')}catch(x){setMsg(x.message)}finally{setSaving(false)}};
  return <div className="space-y-5"><div><h2 className="text-xl font-black text-blue-900">Website & Online Store Manager</h2><p className="text-sm text-gray-500">Change company copy, logo and hero image; online products come directly from branch inventory</p></div>{msg&&<p className="text-xs font-bold text-blue-700">{msg}</p>}<div className="grid lg:grid-cols-3 gap-5"><div className="lg:col-span-2 bg-white border rounded-xl p-5 space-y-3">{[['companyName','Company name'],['announcement','Top announcement'],['heroEyebrow','Hero label'],['heroTitle','Main headline'],['heroText','Hero paragraph'],['aboutTitle','About heading'],['aboutText','About paragraph'],['phone','Phone'],['email','Email'],['address','Address']].map(([k,l])=><label key={k} className="block text-xs font-bold text-gray-500">{l}{k.endsWith('Text')?<textarea value={form[k]||''} onChange={e=>setForm({...form,[k]:e.target.value})} className="mt-1 w-full border rounded-xl p-2.5"/>:<input value={form[k]||''} onChange={e=>setForm({...form,[k]:e.target.value})} className="mt-1 w-full border rounded-xl p-2.5"/>}</label>)}<button onClick={save} disabled={saving} className="w-full py-3 bg-red-600 text-white rounded-xl font-black">{saving?'Publishing…':'Publish website changes'}</button></div><div className="space-y-4"><div className="bg-white border rounded-xl p-4"><p className="font-black text-sm mb-3">Company logo</p>{form.logoUrl&&<img src={form.logoUrl} className="w-full h-32 object-contain border rounded-xl mb-3"/>}<input type="file" accept="image/*" onChange={e=>upload('logoUrl',e.target.files[0])} className="text-xs"/></div><div className="bg-white border rounded-xl p-4"><p className="font-black text-sm mb-3">Hero picture</p>{form.heroImageUrl&&<img src={form.heroImageUrl} className="w-full h-40 object-cover border rounded-xl mb-3"/>}<input type="file" accept="image/*" onChange={e=>upload('heroImageUrl',e.target.files[0])} className="text-xs"/></div><div className="bg-blue-950 text-white rounded-xl p-4"><p className="text-2xl font-black">{products.length}</p><p className="text-xs text-blue-300">Tyres, rims and batteries linked to website</p><p className="text-xs text-blue-300 mt-2">Use Inventory to change product pictures, descriptions, prices and visibility.</p></div></div></div></div>;
}

const SECTIONS = { dash: DashView, pos: PosView, mkt: MktView, fuel: FuelView, inv: InvView, proc: ProcView, expenses: ExpensesView, fin: FinView, cust: CustView, reconcile: ReconcileView, staff: StaffView, rep: RepView, sett: SettView, website: WebsiteView, payroll: PayrollView, sms: SmsView, tools: AdminToolsView, performance: PerformanceView, attendance: AttendanceView };

// ─── SHELL ───
export default function DesktopApp() {
  const [user, setUser] = useState(null);
  const role = user?.role || null;
  const [active, setActive] = useState('dash');
  const [sideOpen, setSideOpen] = useState(true);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [serverOffset,setServerOffset]=useState(0);
  const [,setClockTick]=useState(0);

  const refreshApprovals = () => api.approvals().then(list => setPendingApprovals(list.filter(a => a.status === 'pending').length)).catch(() => {});
  useEffect(() => { if (role) refreshApprovals(); }, [role]);
  useEffect(()=>{if(!role)return;const sync=()=>api.heartbeat().then(x=>setServerOffset(new Date(x.serverTime).getTime()-Date.now())).catch(()=>{});sync();const heartbeat=setInterval(sync,45000);const clock=setInterval(()=>setClockTick(x=>x+1),1000);return()=>{clearInterval(heartbeat);clearInterval(clock)}},[role]);

  if (!role) return <LoginScreen onLogin={account => { setUser(account); const allowed = modulesForUser(account); setActive(allowed[0] || 'dash'); }} />;

  const rc = ROLE_CONFIG[role];
  const assignmentLabel = user?.outlets?.map(o => o.name).join(', ') || user?.branches?.map(b => b.name).join(', ') || user?.branch?.name || rc.branch;
  const allowedModules = modulesForUser(user);
  const navGroups = NAV_GROUPS.map(g => ({ ...g, items: g.items.filter(i => allowedModules.includes(i.id)) })).filter(g => g.items.length > 0);
  const allNavItems = navGroups.flatMap(g => g.items);
  const activeLabel = allNavItems.find(n => n.id === active)?.label || 'Dashboard';

  const renderView = () => {
    if (active === 'approvals') return <ApprovalsView onChanged={refreshApprovals} />;
    const V = SECTIONS[active];
    return V ? <V user={user} /> : <DashView />;
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden" style={{ fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      <aside className={`${sideOpen ? 'w-60' : 'w-16'} bg-blue-900 flex flex-col flex-shrink-0 transition-all duration-300 overflow-hidden`}>
        <div className={`flex items-center gap-2.5 px-3 py-4 border-b border-blue-800 flex-shrink-0 ${!sideOpen ? 'justify-center' : ''}`}>
          <img src="/admabs-app-icon.png" alt="ADMABS" className="w-9 h-9 rounded-xl object-contain bg-white p-0.5 flex-shrink-0 shadow-lg" />
          {sideOpen && <div><p className="font-black text-white text-sm tracking-widest leading-none">ADMABS</p><p className="text-blue-400 text-xs mt-0.5">Business Platform</p></div>}
        </div>
        {sideOpen && (
          <div className="mx-2 mt-2 mb-1 p-2.5 rounded-xl border border-blue-800 flex items-center gap-2.5">
            <div className={`w-8 h-8 ${rc.color} rounded-lg flex items-center justify-center text-white text-xs font-black flex-shrink-0`}>{rc.initials}</div>
            <div className="min-w-0"><p className="text-white text-xs font-bold leading-tight truncate">{rc.label}</p><p className="text-blue-400 text-xs truncate">{assignmentLabel}</p></div>
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
                  <button key={n.id} onClick={() => setActive(n.id)} title={`${n.label} — ${NAV_HELP[n.id]||''}`} className={`w-full flex items-center gap-2.5 px-2 py-2.5 rounded-xl transition-all font-medium relative ${active === n.id ? 'bg-red-600 text-white shadow-sm' : 'text-blue-300 hover:bg-blue-800 hover:text-white'} ${!sideOpen ? 'justify-center' : ''}`}>
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
          <button onClick={async() => { try{await api.logout()}catch{} setToken(null); setUser(null); }} className={`w-full flex items-center gap-2 px-2 py-2 rounded-xl text-blue-300 hover:bg-blue-800 hover:text-white transition-colors ${!sideOpen ? 'justify-center' : ''}`}>
            <LogOut size={13} className="flex-shrink-0" />{sideOpen && <span className="text-xs">Sign out</span>}
          </button>
          <button onClick={() => setSideOpen(!sideOpen)} className={`w-full flex items-center gap-2 px-2 py-2 rounded-xl text-blue-300 hover:bg-blue-800 hover:text-white transition-colors ${!sideOpen ? 'justify-center' : ''}`}>
            <Menu size={13} className="flex-shrink-0" />{sideOpen && <span className="text-xs">Collapse</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0 shadow-sm">
          <div><h1 className="text-sm font-black text-gray-900">{activeLabel}</h1><p className="text-xs text-gray-400">{rc.label} · {assignmentLabel}</p></div>
          <div className="flex items-center gap-3">
            <div className="hidden lg:block text-right" title="Synchronized with the ADMABS server, not this computer's clock"><p className="text-xs font-black text-blue-900">{new Date(Date.now()+serverOffset).toLocaleTimeString('en-GH',{timeZone:'Africa/Accra'})}</p><p className="text-gray-400" style={{fontSize:9}}>GHANA SERVER TIME</p></div>
            {allowedModules.includes('approvals') && (
              <button onClick={() => setActive('approvals')} className="relative p-2 rounded-lg hover:bg-gray-100">
                <ClipboardList size={17} className="text-gray-500" />
                {pendingApprovals > 0 && <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-black">{pendingApprovals}</span>}
              </button>
            )}
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 ${rc.color} rounded-full flex items-center justify-center text-white text-xs font-black`}>{rc.initials}</div>
              <div className="hidden md:block text-left"><p className="text-xs font-black text-gray-800 leading-none">{user?.name || rc.label}</p><p className="text-xs text-blue-600 font-semibold mt-0.5 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> {rc.label}</p></div>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-5">{renderView()}</main>
      </div>
    </div>
  );
}
