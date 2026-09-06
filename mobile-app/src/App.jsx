import React, { useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api, setToken } from "./api.js";
const money = (n) =>
  `GH₵ ${Number(n || 0).toLocaleString("en-GH", { maximumFractionDigits: 2 })}`;
const CONFIG = {
  super_admin: {
    label: "Super Administrator",
    mods: [
      "dash",
      "pos",
      "market",
      "fuel",
      "inventory",
      "customers",
      "expenses",
      "reports",
      "approvals",
      "procurement",
      "finance",
      "reconcile",
      "staff",
      "company",
      "website",
      "payroll",
      "sms",
      "tools",
      "performance",
      "attendance",
    ],
  },
  ceo: {
    label: "CEO / Director",
    mods: [
      "dash",
      "pos",
      "market",
      "fuel",
      "inventory",
      "customers",
      "expenses",
      "reports",
      "approvals",
      "procurement",
      "finance",
      "reconcile",
      "staff",
      "payroll",
      "sms",
      "tools",
      "performance",
      "attendance",
    ],
  },
  gm: {
    label: "General Manager",
    mods: [
      "dash",
      "pos",
      "market",
      "fuel",
      "inventory",
      "customers",
      "expenses",
      "reports",
      "approvals",
      "procurement",
      "finance",
      "reconcile",
      "staff",
      "company",
      "payroll",
      "sms",
      "performance",
      "attendance",
    ],
  },
  finance: {
    label: "Finance Manager",
    mods: [
      "dash",
      "finance",
      "expenses",
      "reconcile",
      "reports",
      "approvals",
      "payroll",
      "performance",
    ],
  },
  accountant: {
    label: "Accountant",
    mods: [
      "dash",
      "finance",
      "expenses",
      "reconcile",
      "reports",
      "payroll",
      "performance",
    ],
  },
  branch: {
    label: "Branch Manager",
    mods: [
      "dash",
      "pos",
      "market",
      "fuel",
      "inventory",
      "customers",
      "expenses",
      "reports",
      "reconcile",
      "staff",
      "performance",
    ],
  },
  sub_manager: {
    label: "Outlet Manager",
    mods: [
      "dash",
      "pos",
      "market",
      "fuel",
      "inventory",
      "customers",
      "expenses",
      "reports",
      "reconcile",
      "staff",
      "performance",
    ],
  },
  staff: {
    label: "Sales Attendant",
    mods: ["pos", "market", "reports", "performance"],
  },
  cashier: {
    label: "Cashier",
    mods: ["pos", "market", "reports", "performance"],
  },
  fuel: {
    label: "Fuel Attendant",
    mods: ["fuel", "expenses", "reports", "performance"],
  },
  storekeeper: {
    label: "Storekeeper",
    mods: ["inventory", "procurement", "performance"],
  },
  procurement: {
    label: "Procurement Officer",
    mods: ["inventory", "procurement", "performance"],
  },
  technician: { label: "Technician", mods: ["performance"] },
  auditor: {
    label: "Auditor",
    mods: [
      "dash",
      "inventory",
      "expenses",
      "finance",
      "customers",
      "reports",
      "performance",
    ],
  },
  driver: { label: "Driver", mods: ["performance"] },
};
const PERMISSION_MODULES = {
  "staff.view": "staff",
  "staff.manage": "staff",
  "branches.manage": "company",
  "system.settings.manage": "company",
  "website.manage": "website",
  "reconciliation.create": "reconcile",
  "reconciliation.review": "reconcile",
  "reports.view": "reports",
  "inventory.create": "inventory",
  "inventory.update": "inventory",
  "inventory.search_all": "inventory",
  "customers.manage": "customers",
  "procurement.manage": "procurement",
  "expenses.manage": "expenses",
  "accounting.journal.create": "finance",
  "pos.sale.create": "pos",
  "payroll.manage": "payroll",
  "sms.manage": "sms",
  "data.manage": "tools",
  "performance.manage": "performance",
  "attendance.view": "attendance",
  "shifts.manage": "attendance",
};
const NAV = {
  dash: ["Dashboard", "📊"],
  pos: ["Tyre POS", "🛒"],
  market: ["Supermarket", "🛍️"],
  fuel: ["Fuel Station", "⛽"],
  inventory: ["Inventory", "📦"],
  procurement: ["Procurement", "🚚"],
  customers: ["Customers", "👥"],
  expenses: ["Expenses", "💸"],
  finance: ["Finance", "💰"],
  reconcile: ["Daily Reconciliation", "🧾"],
  reports: ["Reports", "📈"],
  approvals: ["Approvals", "✅"],
  staff: ["Staff Directory", "🧑‍💼"],
  company: ["Company & Branches", "🏢"],
  website: ["Website Manager", "🌐"],
  payroll: ["Payroll", "💵"],
  sms: ["SMS Centre", "✉️"],
  tools: ["Admin Tools", "🛠️"],
  performance: ["Performance & Rewards", "⭐"],
  attendance: ["Attendance", "⏱️"],
};
function Login({ onLogin }) {
  const [u, setU] = useState(""),
    [p, setP] = useState(""),
    [show, setShow] = useState(false),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(false);
  const go = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await api.login(u, p);
      setToken(r.token);
      onLogin(r.user);
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="login">
      <form className="loginbox" onSubmit={go}>
        <div className="hero-logo">A</div>
        <div className="center">
          <h1>ADMABS</h1>
          <p className="muted">MOBILE BUSINESS PLATFORM</p>
        </div>
        <div className="card">
          <label>USERNAME</label>
          <input
            className="field"
            value={u}
            onChange={(e) => setU(e.target.value)}
          />
          <label>PASSWORD</label>
          <div style={{ position: "relative" }}>
            <input
              className="field"
              style={{ paddingRight: 52 }}
              type={show ? "text" : "password"}
              value={p}
              onChange={(e) => setP(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Hide password" : "Show password"}
              style={{
                position: "absolute",
                right: 2,
                top: 5,
                bottom: 12,
                width: 46,
                border: 0,
                background: "transparent",
                color: "#bae6fd",
                fontSize: 18,
              }}
            >
              {show ? "🙈" : "👁️"}
            </button>
          </div>
          {err && <p className="error">⚠ {err}</p>}
          <button className="btn red" style={{ width: "100%" }} disabled={busy}>
            {busy ? "SIGNING IN…" : "SIGN IN →"}
          </button>
          <p className="muted center">
            Your live role, branch, outlet and permissions load automatically.
          </p>
        </div>
      </form>
    </div>
  );
}
function Modal({ title, onClose, children }) {
  return (
    <div className="modal" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <h2>{title}</h2>
          <button className="btn outline" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Dashboard() {
  const [d, setD] = useState(null),
    [err, setErr] = useState("");
  useEffect(() => {
    api
      .dashboard()
      .then(setD)
      .catch((e) => setErr(e.message));
  }, []);
  return (
    <>
      <h2>Company Dashboard</h2>
      <p className="muted">Live records within your authorized scope</p>
      {err && <p className="error">{err}</p>}
      <div className="grid" style={{ marginTop: 14 }}>
        {[
          ["Revenue", d?.revenue],
          ["Gross Profit", d?.grossProfit],
          ["Net Profit", d?.netProfit],
          ["Receivables", d?.receivables],
        ].map(([l, v]) => (
          <div className="card stat" key={l}>
            <small>{l.toUpperCase()}</small>
            <b>{money(v)}</b>
          </div>
        ))}
      </div>
      <div className="card">
        <h3>Revenue trend</h3>
        <ResponsiveContainer width="100%" height={190}>
          <AreaChart data={d?.revenueTrend || []}>
            <XAxis dataKey="m" tick={{ fill: "#6b87b0", fontSize: 9 }} />
            <YAxis hide />
            <Tooltip />
            <Area dataKey="t" stroke="#60a5fa" fill="#2563eb33" />
            <Area dataKey="f" stroke="#ef4444" fill="none" />
            <Area dataKey="s" stroke="#10b981" fill="none" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="card">
        <h3>Recent activity</h3>
        {(d?.recentTransactions || []).map((x) => (
          <div className="item row between" key={x.id}>
            <div>
              <p>
                <b>{x.id}</b>
              </p>
              <p className="muted">{x.item || x.type}</p>
            </div>
            <b className="money">{money(x.amt)}</b>
          </div>
        ))}
      </div>
    </>
  );
}
function MarketShift({ user, onChange }) {
  const [list, setList] = useState([]),
    [modal, setModal] = useState(""),
    [amount, setAmount] = useState(0),
    [err, setErr] = useState("");
  const load = () =>
    api
      .workShifts()
      .then((x) => {
        setList(x);
        onChange?.(x.find((s) => s.status === "open"));
      })
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  const open = list.find((s) => s.status === "open");
  const save = async () => {
    try {
      if (modal === "start")
        await api.startWork({
          outlet: user.outlets?.find((x) => x.division === "supermarket")?._id,
          openingFloat: Number(amount),
        });
      else await api.closeWork(open._id, { actualCash: Number(amount) });
      setModal("");
      load();
    } catch (x) {
      setErr(x.message);
    }
  };
  return (
    <>
      <div className="card row between">
        <div>
          <b>{open ? `${open.workShift} shift open` : "Shift not started"}</b>
          <p className="muted">
            {open
              ? open.number
              : "Uses assigned outlet schedule and server time"}
          </p>
        </div>
        <button
          className={`btn ${open ? "red" : "green"}`}
          onClick={() => setModal(open ? "close" : "start")}
        >
          {open ? "Close" : "Start"}
        </button>
      </div>
      {err && <p className="error">{err}</p>}
      {modal && (
        <Modal
          title={modal === "start" ? "Start shift" : "Close shift"}
          onClose={() => setModal("")}
        >
          <label>
            {modal === "start" ? "Opening float" : "Physical cash handed over"}
          </label>
          <input
            className="field"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <button className="btn" style={{ width: "100%" }} onClick={save}>
            Confirm using server time
          </button>
        </Modal>
      )}
    </>
  );
}
function POS({ user, market = false }) {
  const [products, setProducts] = useState([]),
    [cart, setCart] = useState([]),
    [search, setSearch] = useState(""),
    [method, setMethod] = useState("Cash"),
    [err, setErr] = useState(""),
    [done, setDone] = useState(null),
    [shift, setShift] = useState(null);
  const cats = market
    ? ["Grocery", "Beverages", "Snacks", "Household", "Dairy", "Bakery"]
    : ["Tyre", "Rim", "Battery", "Service"];
  const load = () =>
    api
      .products()
      .then((x) => setProducts(x.filter((p) => cats.includes(p.category))))
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  const shown = products.filter(
    (p) =>
      !search ||
      `${p.name} ${p.code} ${p.barcode || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const total = cart.reduce((s, x) => s + x.price * x.qty, 0) * 1.15;
  const add = (p) =>
    setCart((c) => {
      const x = c.find((y) => y._id === p._id);
      return x
        ? c.map((y) => (y._id === p._id ? { ...y, qty: y.qty + 1 } : y))
        : [...c, { ...p, qty: 1 }];
    });
  const charge = async () => {
    try {
      const sale = await api.createSale({
        items: cart.map((x) => ({
          product: x._id,
          name: x.name,
          category: x.category,
          price: x.price,
          qty: x.qty,
        })),
        paymentMethod: method,
        workShift: shift?.workShift,
      });
      setDone(sale);
      setCart([]);
      load();
    } catch (x) {
      setErr(x.message);
    }
  };
  return (
    <>
      {market && <MarketShift user={user} onChange={setShift} />}
      <h2>{market ? "Supermarket POS" : "Tyres, Rims & Batteries POS"}</h2>
      <input
        className="field"
        placeholder="Search name, barcode or code"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {err && <p className="error">{err}</p>}
      <div className="products">
        {shown.map((p) => (
          <button className="product" key={p._id} onClick={() => add(p)}>
            <b>{p.name}</b>
            <p className="muted">
              {p.code} · {p.qty} left
            </p>
            <span className="money">{money(p.price)}</span>
          </button>
        ))}
      </div>
      {cart.length > 0 && (
        <div className="card cart">
          <div className="row between">
            <b>{cart.reduce((s, x) => s + x.qty, 0)} item(s)</b>
            <b>{money(total)}</b>
          </div>
          <select
            className="field"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            <option>Cash</option>
            <option>Card</option>
            <option>Mobile Money</option>
            <option>Bank Transfer</option>
          </select>
          <button
            className="btn green"
            style={{ width: "100%" }}
            onClick={charge}
          >
            Complete Sale
          </button>
        </div>
      )}
      {done && (
        <Modal title="Transaction complete" onClose={() => setDone(null)}>
          <div className="center">
            <div className="hero-logo">A</div>
            <h2>ADMABS INVESTMENT LIMITED</h2>
            <p>{done.invoiceNumber}</p>
            <h1>{money(done.total)}</h1>
            <p className="muted">
              Receipt uses the company logo and central transaction record.
            </p>
            <button className="btn" onClick={() => window.print()}>
              Print / Share receipt
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function Fuel() {
  const [d, setD] = useState(null),
    [modal, setModal] = useState(null),
    [form, setForm] = useState({}),
    [err, setErr] = useState("");
  const load = () =>
    api
      .fuel()
      .then(setD)
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  const open = async () => {
    try {
      await api.openFuel(form);
      setModal(null);
      load();
    } catch (x) {
      setErr(x.message);
    }
  };
  const close = async () => {
    try {
      await api.closeFuel(modal._id, {
        closingMeter: Number(form.closingMeter),
        testLitres: Number(form.testLitres || 0),
        payments: {
          cash: Number(form.cash || 0),
          card: Number(form.card || 0),
          mobileMoney: Number(form.mobileMoney || 0),
          credit: Number(form.credit || 0),
        },
      });
      setModal(null);
      load();
    } catch (x) {
      setErr(x.message);
    }
  };
  return (
    <>
      <div className="row between">
        <div>
          <h2>Fuel Station</h2>
          <p className="muted">Pump custody and reconciliation</p>
        </div>
        <button
          className="btn red"
          onClick={() => {
            setForm({});
            setModal("open");
          }}
        >
          + Open Shift
        </button>
      </div>
      {err && <p className="error">{err}</p>}
      <div className="grid">
        {[
          ["Fuel on hand", `${d?.metrics?.litresOnHand || 0} L`],
          ["Sold today", `${d?.metrics?.litresSoldToday || 0} L`],
          ["Expected", money(d?.metrics?.expectedRevenueToday)],
          ["Open shifts", d?.metrics?.openShifts || 0],
        ].map((x) => (
          <div className="card stat" key={x[0]}>
            <small>{x[0]}</small>
            <b>{x[1]}</b>
          </div>
        ))}
      </div>
      <div className="card">
        <h3>Pump shifts</h3>
        {(d?.shifts || []).map((s) => (
          <div className="item row between" key={s._id}>
            <div>
              <p>
                <b>{s.number}</b> · {s.nozzleCode}
              </p>
              <p className="muted">
                {s.attendant?.name} · {s.workShift}
              </p>
            </div>
            {s.status === "open" ? (
              <button
                className="btn red"
                onClick={() => {
                  setForm({});
                  setModal(s);
                }}
              >
                Close
              </button>
            ) : (
              <span className="badge">{s.status}</span>
            )}
          </div>
        ))}
      </div>
      {modal === "open" && (
        <Modal title="Open pump shift" onClose={() => setModal(null)}>
          <label>Pump</label>
          <select
            className="field"
            value={form.pump || ""}
            onChange={(e) => setForm({ ...form, pump: e.target.value })}
          >
            <option value="">Select pump</option>
            {(d?.pumps || []).map((p) => (
              <option value={p._id} key={p._id}>
                {p.code} · {p.name}
              </option>
            ))}
          </select>
          <label>Nozzle code</label>
          <input
            className="field"
            value={form.nozzleCode || ""}
            onChange={(e) => setForm({ ...form, nozzleCode: e.target.value })}
          />
          <label>Opening meter</label>
          <input
            className="field"
            type="number"
            value={form.openingMeter || ""}
            onChange={(e) => setForm({ ...form, openingMeter: e.target.value })}
          />
          <button
            className="btn green"
            style={{ width: "100%" }}
            onClick={open}
          >
            Start scheduled shift
          </button>
        </Modal>
      )}
      {modal && modal !== "open" && (
        <Modal title={`Close ${modal.number}`} onClose={() => setModal(null)}>
          <label>
            Closing meter
            <input
              className="field"
              type="number"
              value={form.closingMeter || ""}
              onChange={(e) =>
                setForm({ ...form, closingMeter: e.target.value })
              }
            />
          </label>
          <label>
            Test litres
            <input
              className="field"
              type="number"
              value={form.testLitres || ""}
              onChange={(e) => setForm({ ...form, testLitres: e.target.value })}
            />
          </label>
          <label>
            Cash
            <input
              className="field"
              type="number"
              value={form.cash || ""}
              onChange={(e) => setForm({ ...form, cash: e.target.value })}
            />
          </label>
          <label>
            Card
            <input
              className="field"
              type="number"
              value={form.card || ""}
              onChange={(e) => setForm({ ...form, card: e.target.value })}
            />
          </label>
          <label>
            Mobile money
            <input
              className="field"
              type="number"
              value={form.mobileMoney || ""}
              onChange={(e) =>
                setForm({ ...form, mobileMoney: e.target.value })
              }
            />
          </label>
          <label>
            Credit
            <input
              className="field"
              type="number"
              value={form.credit || ""}
              onChange={(e) => setForm({ ...form, credit: e.target.value })}
            />
          </label>
          <button className="btn red" style={{ width: "100%" }} onClick={close}>
            Submit for manager approval
          </button>
        </Modal>
      )}
    </>
  );
}
function Inventory() {
  const [list, setList] = useState([]),
    [search, setSearch] = useState(""),
    [item, setItem] = useState(null),
    [qty, setQty] = useState(""),
    [err, setErr] = useState("");
  const load = () =>
    api
      .products({ q: search })
      .then(setList)
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  return (
    <>
      <h2>Outlet Inventory</h2>
      <div className="row">
        <input
          className="field"
          placeholder="Search products across permitted outlets"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn" onClick={load}>
          Find
        </button>
      </div>
      {err && <p className="error">{err}</p>}
      <div className="card">
        {list.map((p) => (
          <div className="item row between" key={p._id}>
            <div>
              <p>
                <b>{p.name}</b>
              </p>
              <p className="muted">
                {p.code} · {p.outlet?.name || "Assigned outlet"}
              </p>
            </div>
            <button className="btn outline" onClick={() => setItem(p)}>
              {p.qty} units
            </button>
          </div>
        ))}
      </div>
      {item && (
        <Modal title={`Receive ${item.name}`} onClose={() => setItem(null)}>
          <label>Quantity received</label>
          <input
            className="field"
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          <button
            className="btn green"
            style={{ width: "100%" }}
            onClick={() =>
              api
                .receiveStock(item._id, {
                  quantity: Number(qty),
                  reference: "Mobile stock entry",
                })
                .then(() => {
                  setItem(null);
                  load();
                })
                .catch((e) => setErr(e.message))
            }
          >
            Add Stock
          </button>
        </Modal>
      )}
    </>
  );
}
function SimpleRecords({ type }) {
  const customers = type === "customers",
    [list, setList] = useState([]),
    [form, setForm] = useState(null),
    [err, setErr] = useState("");
  const load = () =>
    customers
      ? api
          .customers()
          .then(setList)
          .catch((e) => setErr(e.message))
      : api
          .expenses()
          .then(setList)
          .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, [type]);
  const save = async () => {
    try {
      if (customers) await api.createCustomer(form);
      else await api.createExpense({ ...form, amount: Number(form.amount) });
      setForm(null);
      load();
    } catch (x) {
      setErr(x.message);
    }
  };
  return (
    <>
      <div className="row between">
        <h2>{customers ? "Customers" : "Expenses"}</h2>
        <button className="btn" onClick={() => setForm({})}>
          + Add
        </button>
      </div>
      {err && <p className="error">{err}</p>}
      <div className="card">
        {list.map((x) => (
          <div className="item row between" key={x._id}>
            <div>
              <p>
                <b>{customers ? x.name : x.description}</b>
              </p>
              <p className="muted">
                {customers
                  ? x.phone
                  : `${x.category || "Expense"} · ${x.status}`}
              </p>
            </div>
            {!customers && <b className="danger">{money(x.amount)}</b>}
          </div>
        ))}
      </div>
      {form && (
        <Modal
          title={customers ? "Add customer" : "Record expense"}
          onClose={() => setForm(null)}
        >
          {(customers
            ? [
                ["name", "Name"],
                ["phone", "Phone"],
                ["email", "Email"],
              ]
            : [
                ["description", "Description"],
                ["category", "Category"],
                ["amount", "Amount"],
              ]
          ).map(([k, l]) => (
            <label key={k}>
              {l}
              <input
                className="field"
                type={k === "amount" ? "number" : "text"}
                value={form[k] || ""}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              />
            </label>
          ))}
          <button
            className="btn green"
            style={{ width: "100%" }}
            onClick={save}
          >
            Save Record
          </button>
        </Modal>
      )}
    </>
  );
}
function Reports({ user }) {
  const now = new Date(),
    [f, setF] = useState({
      start: new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .slice(0, 10),
      end: now.toISOString().slice(0, 10),
    }),
    [d, setD] = useState(null),
    [err, setErr] = useState("");
  const load = () =>
    api
      .reports(f)
      .then(setD)
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  return (
    <>
      <h2>
        {["staff", "cashier", "fuel"].includes(user.role)
          ? "My Shift & Sales Report"
          : "Financial Analytics"}
      </h2>
      <div className="card">
        <div className="grid">
          <input
            className="field"
            type="date"
            value={f.start}
            onChange={(e) => setF({ ...f, start: e.target.value })}
          />
          <input
            className="field"
            type="date"
            value={f.end}
            onChange={(e) => setF({ ...f, end: e.target.value })}
          />
        </div>
        <button className="btn" style={{ width: "100%" }} onClick={load}>
          Generate Report
        </button>
      </div>
      {err && <p className="error">{err}</p>}
      <div className="grid">
        {[
          ["Transactions", d?.summary?.transactionCount],
          ["Revenue", money(d?.summary?.revenue)],
          ["Fuel shifts", d?.summary?.fuelShiftCount],
          ["Fuel litres", `${d?.summary?.fuelLitres || 0} L`],
        ].map((x) => (
          <div className="card stat" key={x[0]}>
            <small>{x[0]}</small>
            <b>{x[1] || 0}</b>
          </div>
        ))}
      </div>
      <button
        className="btn outline"
        style={{ width: "100%" }}
        onClick={() => window.print()}
      >
        Print / Save PDF
      </button>
    </>
  );
}
function Approvals() {
  const [list, setList] = useState([]),
    [err, setErr] = useState("");
  const load = () =>
    api
      .approvals()
      .then(setList)
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  return (
    <>
      <h2>Approvals</h2>
      {err && <p className="error">{err}</p>}
      <div className="card">
        {list.map((x) => (
          <div className="item" key={x._id}>
            <div className="row between">
              <div>
                <b>{x.title || x.type}</b>
                <p className="muted">{x.description}</p>
              </div>
              <span className="badge">{x.status}</span>
            </div>
            {x.status === "pending" && (
              <div className="row" style={{ marginTop: 9 }}>
                <button
                  className="btn green"
                  onClick={() =>
                    api.updateApproval(x._id, { status: "approved" }).then(load)
                  }
                >
                  Approve
                </button>
                <button
                  className="btn red"
                  onClick={() =>
                    api.updateApproval(x._id, { status: "rejected" }).then(load)
                  }
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

const today = () => new Date().toISOString().slice(0, 10);
function Procurement() {
  const [orders, setOrders] = useState([]),
    [suppliers, setSuppliers] = useState([]),
    [form, setForm] = useState(null),
    [err, setErr] = useState("");
  const load = () =>
    Promise.all([api.purchaseOrders(), api.suppliers()])
      .then(([o, s]) => {
        setOrders(o);
        setSuppliers(s);
      })
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  const save = () =>
    api
      .createPurchaseOrder({
        supplier: form.supplier,
        items: [
          {
            description: form.description,
            qty: Number(form.qty),
            unitCost: Number(form.unitCost),
          },
        ],
      })
      .then(() => {
        setForm(null);
        load();
      })
      .catch((e) => setErr(e.message));
  return (
    <>
      <div className="row between">
        <div>
          <h2>Procurement</h2>
          <p className="muted">Branch and outlet purchase orders</p>
        </div>
        <button className="btn" onClick={() => setForm({ qty: 1 })}>
          + PO
        </button>
      </div>
      {err && <p className="error">{err}</p>}
      <div className="card">
        {orders.map((o) => (
          <div className="item" key={o._id}>
            <div className="row between">
              <b>{o.poNumber}</b>
              <span className="badge">{o.status}</span>
            </div>
            <p className="muted">
              {o.supplier?.name || "Supplier"} · {money(o.amount)}
            </p>
            {["ceo", "gm", "finance"].includes(o.status) && null}
          </div>
        ))}
      </div>
      {form && (
        <Modal title="New purchase order" onClose={() => setForm(null)}>
          <label>
            Supplier
            <select
              className="field"
              value={form.supplier || ""}
              onChange={(e) => setForm({ ...form, supplier: e.target.value })}
            >
              <option value="">Select supplier</option>
              {suppliers.map((s) => (
                <option value={s._id} key={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Item
            <input
              className="field"
              value={form.description || ""}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </label>
          <div className="grid">
            <label>
              Quantity
              <input
                className="field"
                type="number"
                value={form.qty}
                onChange={(e) => setForm({ ...form, qty: e.target.value })}
              />
            </label>
            <label>
              Unit cost
              <input
                className="field"
                type="number"
                value={form.unitCost || ""}
                onChange={(e) => setForm({ ...form, unitCost: e.target.value })}
              />
            </label>
          </div>
          <button
            className="btn green"
            style={{ width: "100%" }}
            onClick={save}
          >
            Create PO
          </button>
        </Modal>
      )}
    </>
  );
}
function Finance() {
  const [list, setList] = useState([]),
    [form, setForm] = useState(null),
    [err, setErr] = useState("");
  const load = () =>
    api
      .journals()
      .then(setList)
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  const save = () =>
    api
      .createJournal({
        date: form.date,
        description: form.description,
        lines: [
          { account: form.debitAccount, debit: Number(form.amount), credit: 0 },
          {
            account: form.creditAccount,
            debit: 0,
            credit: Number(form.amount),
          },
        ],
      })
      .then(() => {
        setForm(null);
        load();
      })
      .catch((e) => setErr(e.message));
  return (
    <>
      <div className="row between">
        <div>
          <h2>Finance</h2>
          <p className="muted">Double-entry journals and audit records</p>
        </div>
        <button className="btn" onClick={() => setForm({ date: today() })}>
          + Journal
        </button>
      </div>
      {err && <p className="error">{err}</p>}
      <div className="card">
        {list.map((j) => (
          <div className="item" key={j._id}>
            <div className="row between">
              <b>{j.number}</b>
              <span>{new Date(j.date).toLocaleDateString()}</span>
            </div>
            <p className="muted">{j.description}</p>
          </div>
        ))}
      </div>
      {form && (
        <Modal title="Post journal" onClose={() => setForm(null)}>
          {[
            ["date", "Date", "date"],
            ["description", "Description", "text"],
            ["debitAccount", "Debit account", "text"],
            ["creditAccount", "Credit account", "text"],
            ["amount", "Amount", "number"],
          ].map(([k, l, t]) => (
            <label key={k}>
              {l}
              <input
                className="field"
                type={t}
                value={form[k] || ""}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              />
            </label>
          ))}
          <button
            className="btn green"
            style={{ width: "100%" }}
            onClick={save}
          >
            Post balanced journal
          </button>
        </Modal>
      )}
    </>
  );
}
function Reconciliation({ user }) {
  const [list, setList] = useState([]),
    [outlets, setOutlets] = useState([]),
    [form, setForm] = useState(null),
    [prepared, setPrepared] = useState(null),
    [err, setErr] = useState("");
  const load = () =>
    Promise.all([api.reconciliations(), api.outlets()])
      .then(([r, o]) => {
        setList(r);
        setOutlets(o);
      })
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  const prepare = () =>
    api
      .prepareReconciliation({
        branch: form.branch,
        outlet: form.outlet,
        date: form.businessDate,
      })
      .then(setPrepared)
      .catch((e) => setErr(e.message));
  const submit = () =>
    api
      .createReconciliation({
        ...form,
        counted: {
          cash: Number(form.cash || 0),
          card: Number(form.card || 0),
          mobileMoney: Number(form.mobileMoney || 0),
          bank: Number(form.bank || 0),
          credit: Number(form.credit || 0),
        },
        stockCountValue: Number(
          form.stockCountValue || prepared?.stockBookValue || 0,
        ),
      })
      .then(() => {
        setForm(null);
        setPrepared(null);
        load();
      })
      .catch((e) => setErr(e.message));
  const review = (id, status) =>
    api
      .reviewReconciliation(id, { status })
      .then(load)
      .catch((e) => setErr(e.message));
  return (
    <>
      <div className="row between">
        <div>
          <h2>Daily Reconciliation</h2>
          <p className="muted">Sales, cash handover and remaining stock</p>
        </div>
        <button
          className="btn"
          onClick={() =>
            setForm({
              businessDate: today(),
              branch: user.branch?._id || user.branches?.[0]?._id || "",
              outlet: user.outlets?.[0]?._id || "",
            })
          }
        >
          + Close Day
        </button>
      </div>
      {err && <p className="error">{err}</p>}
      <div className="card">
        {list.map((x) => (
          <div className="item" key={x._id}>
            <div className="row between">
              <b>{x.number}</b>
              <span className="badge">{x.status}</span>
            </div>
            <p className="muted">
              {x.branch?.name} · expected {money(x.expected?.total)} · variance{" "}
              {money(x.variance)}
            </p>
            {x.status === "submitted" && (
              <div className="row">
                <button
                  className="btn green"
                  onClick={() => review(x._id, "approved")}
                >
                  Approve
                </button>
                <button
                  className="btn red"
                  onClick={() => review(x._id, "queried")}
                >
                  Query
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {form && (
        <Modal
          title="Prepare daily close"
          onClose={() => {
            setForm(null);
            setPrepared(null);
          }}
        >
          <label>
            Outlet
            <select
              className="field"
              value={form.outlet}
              onChange={(e) => {
                const o = outlets.find((x) => x._id === e.target.value);
                setForm({
                  ...form,
                  outlet: e.target.value,
                  branch: o?.branch?._id || o?.branch || form.branch,
                });
              }}
            >
              <option value="">Branch total</option>
              {outlets.map((o) => (
                <option key={o._id} value={o._id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Business date
            <input
              className="field"
              type="date"
              value={form.businessDate}
              onChange={(e) =>
                setForm({ ...form, businessDate: e.target.value })
              }
            />
          </label>
          <button className="btn" style={{ width: "100%" }} onClick={prepare}>
            Load system totals
          </button>
          {prepared && (
            <>
              <div className="card">
                <b>Expected {money(prepared.expected?.total)}</b>
                <p className="muted">
                  {prepared.salesCount} sales · stock book{" "}
                  {money(prepared.stockBookValue)}
                </p>
              </div>
              {[
                "cash",
                "card",
                "mobileMoney",
                "bank",
                "credit",
                "stockCountValue",
              ].map((k) => (
                <label key={k}>
                  {k.replace(/([A-Z])/g, " $1")}
                  <input
                    className="field"
                    type="number"
                    value={form[k] || ""}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  />
                </label>
              ))}
              <label>
                Explanation
                <textarea
                  className="field"
                  value={form.explanation || ""}
                  onChange={(e) =>
                    setForm({ ...form, explanation: e.target.value })
                  }
                />
              </label>
              <button
                className="btn green"
                style={{ width: "100%" }}
                onClick={submit}
              >
                Submit handover
              </button>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
function Staff() {
  const [list, setList] = useState([]),
    [branches, setBranches] = useState([]),
    [outlets, setOutlets] = useState([]),
    [permissions, setPermissions] = useState([]),
    [form, setForm] = useState(null),
    [show, setShow] = useState(false),
    [err, setErr] = useState("");
  const load = () =>
    Promise.all([
      api.users(),
      api.branches(),
      api.outlets(),
      api.permissions().catch(() => []),
    ])
      .then(([u, b, o, p]) => {
        setList(u);
        setBranches(b);
        setOutlets(o);
        setPermissions(p);
      })
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  const save = () => {
    const action = form._id
      ? api.updateUser(form._id, form)
      : api.createUser(form);
    action
      .then(() => {
        setForm(null);
        setShow(false);
        load();
      })
      .catch((e) => setErr(e.message));
  };
  return (
    <>
      <div className="row between">
        <div>
          <h2>Staff Directory</h2>
          <p className="muted">Roles, branch, outlet and custom privileges</p>
        </div>
        <button
          className="btn"
          onClick={() =>
            setForm({
              role: "staff",
              permissions: [],
              outlets: [],
              active: true,
            })
          }
        >
          + Staff
        </button>
      </div>
      {err && <p className="error">{err}</p>}
      <div className="card">
        {list.map((u) => (
          <button
            className="item"
            style={{
              width: "100%",
              textAlign: "left",
              background: "transparent",
              border: 0,
              color: "inherit",
            }}
            key={u._id}
            onClick={() =>
              setForm({
                ...u,
                branch: u.branch?._id || u.branch,
                outlets: (u.outlets || []).map((x) => x._id || x),
                password: "",
              })
            }
          >
            <div className="row between">
              <b>{u.name}</b>
              <span className="badge">
                {u.active === false ? "disabled" : u.role}
              </span>
            </div>
            <p className="muted">
              {u.employeeNumber || u.username} ·{" "}
              {u.branch?.name || "Company-wide"}
            </p>
          </button>
        ))}
      </div>
      {form && (
        <Modal
          title={form._id ? "Edit staff access" : "Add staff"}
          onClose={() => setForm(null)}
        >
          {[
            ["name", "Full name"],
            ["username", "Username"],
            ["employeeNumber", "Employee number"],
            ["phone", "Phone"],
            ["jobTitle", "Job title"],
          ].map(([k, l]) => (
            <label key={k}>
              {l}
              <input
                className="field"
                value={form[k] || ""}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              />
            </label>
          ))}
          <label>
            Password
            <div style={{ position: "relative" }}>
              <input
                className="field"
                type={show ? "text" : "password"}
                value={form.password || ""}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <button
                type="button"
                className="btn outline"
                style={{ position: "absolute", right: 4, top: 4 }}
                onClick={() => setShow((v) => !v)}
              >
                {show ? "Hide" : "Show"}
              </button>
            </div>
          </label>
          <label>
            Role
            <select
              className="field"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              {Object.entries(CONFIG)
                .filter(([r]) => r !== "super_admin")
                .map(([r, c]) => (
                  <option value={r} key={r}>
                    {c.label}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Branch
            <select
              className="field"
              value={form.branch || ""}
              onChange={(e) =>
                setForm({ ...form, branch: e.target.value, outlets: [] })
              }
            >
              <option value="">Company-wide</option>
              {branches.map((b) => (
                <option value={b._id} key={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <p>
            <b>Assigned outlets</b>
          </p>
          {outlets
            .filter(
              (o) =>
                !form.branch || (o.branch?._id || o.branch) === form.branch,
            )
            .map((o) => (
              <label className="item" key={o._id}>
                <input
                  type="checkbox"
                  checked={(form.outlets || []).includes(o._id)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      outlets: e.target.checked
                        ? [...(form.outlets || []), o._id]
                        : (form.outlets || []).filter((x) => x !== o._id),
                    })
                  }
                />{" "}
                {o.name} · {o.division}
              </label>
            ))}
          {permissions.length > 0 && (
            <>
              <p>
                <b>Additional privileges</b>
              </p>
              {permissions.map((p) => (
                <label className="item" key={p}>
                  <input
                    type="checkbox"
                    checked={(form.permissions || []).includes(p)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        permissions: e.target.checked
                          ? [...(form.permissions || []), p]
                          : (form.permissions || []).filter((x) => x !== p),
                      })
                    }
                  />{" "}
                  {p}
                </label>
              ))}
            </>
          )}
          <button
            className="btn green"
            style={{ width: "100%" }}
            onClick={save}
          >
            Save staff access
          </button>
        </Modal>
      )}
    </>
  );
}
function Company() {
  const [branches, setBranches] = useState([]),
    [form, setForm] = useState(null),
    [err, setErr] = useState("");
  const load = () =>
    api
      .branches()
      .then(setBranches)
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  const save = () => {
    const a = form._id
      ? api.updateBranch(form._id, form)
      : api.createBranch(form);
    a.then(() => {
      setForm(null);
      load();
    }).catch((e) => setErr(e.message));
  };
  return (
    <>
      <div className="row between">
        <div>
          <h2>Company & Branches</h2>
          <p className="muted">
            Each selected service creates an independent outlet
          </p>
        </div>
        <button
          className="btn"
          onClick={() => setForm({ divisions: [], active: true })}
        >
          + Branch
        </button>
      </div>
      {err && <p className="error">{err}</p>}
      <div className="card">
        {branches.map((b) => (
          <button
            className="item"
            style={{
              width: "100%",
              textAlign: "left",
              background: "transparent",
              border: 0,
              color: "inherit",
            }}
            key={b._id}
            onClick={() => setForm(b)}
          >
            <div className="row between">
              <b>{b.name}</b>
              <span className="badge">{b.code}</span>
            </div>
            <p className="muted">{(b.divisions || []).join(" · ")}</p>
          </button>
        ))}
      </div>
      {form && (
        <Modal
          title={form._id ? "Edit branch" : "Create branch"}
          onClose={() => setForm(null)}
        >
          {[
            ["name", "Branch name"],
            ["code", "Code"],
            ["city", "City"],
            ["address", "Address"],
          ].map(([k, l]) => (
            <label key={k}>
              {l}
              <input
                className="field"
                value={form[k] || ""}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              />
            </label>
          ))}
          <p>
            <b>Independent outlets</b>
          </p>
          {["tyres", "supermarket", "fuel", "warehouse", "head_office"].map(
            (d) => (
              <label className="item" key={d}>
                <input
                  type="checkbox"
                  checked={(form.divisions || []).includes(d)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      divisions: e.target.checked
                        ? [...(form.divisions || []), d]
                        : (form.divisions || []).filter((x) => x !== d),
                    })
                  }
                />{" "}
                {d.replace("_", " ")}
              </label>
            ),
          )}
          <button
            className="btn green"
            style={{ width: "100%" }}
            onClick={save}
          >
            Save branch and outlets
          </button>
          {form._id && (
            <button
              className="btn red"
              style={{ width: "100%", marginTop: 8 }}
              onClick={() =>
                confirm("Delete this empty branch?") &&
                api
                  .deleteBranch(form._id)
                  .then(() => {
                    setForm(null);
                    load();
                  })
                  .catch((e) => setErr(e.message))
              }
            >
              Delete branch
            </button>
          )}
        </Modal>
      )}
    </>
  );
}
function Website() {
  const [form, setForm] = useState({}),
    [msg, setMsg] = useState("");
  useEffect(() => {
    api
      .siteContent()
      .then(setForm)
      .catch((e) => setMsg(e.message));
  }, []);
  const upload = (key, file) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => setForm((f) => ({ ...f, [key]: r.result }));
    r.readAsDataURL(file);
  };
  const save = () =>
    api
      .updateSiteContent(form)
      .then((x) => {
        setForm(x);
        setMsg("Website published");
      })
      .catch((e) => setMsg(e.message));
  return (
    <>
      <h2>Website Manager</h2>
      <p className="muted">Edit public website copy, logo and hero image</p>
      {msg && <p className="online">{msg}</p>}
      <div className="card">
        {[
          ["companyName", "Company name"],
          ["announcement", "Announcement"],
          ["heroEyebrow", "Hero label"],
          ["heroTitle", "Headline"],
          ["heroText", "Hero text"],
          ["aboutTitle", "About heading"],
          ["aboutText", "About text"],
          ["phone", "Phone"],
          ["email", "Email"],
          ["address", "Address"],
        ].map(([k, l]) => (
          <label key={k}>
            {l}
            <textarea
              className="field"
              rows={k.includes("Text") ? 3 : 1}
              value={form[k] || ""}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
            />
          </label>
        ))}
        <label>
          Company logo
          <input
            className="field"
            type="file"
            accept="image/*"
            onChange={(e) => upload("logoUrl", e.target.files[0])}
          />
        </label>
        <label>
          Hero image
          <input
            className="field"
            type="file"
            accept="image/*"
            onChange={(e) => upload("heroImageUrl", e.target.files[0])}
          />
        </label>
        <button className="btn red" style={{ width: "100%" }} onClick={save}>
          Publish website changes
        </button>
      </div>
    </>
  );
}
function Payroll() {
  const [employees, setEmployees] = useState([]),
    [runs, setRuns] = useState([]),
    [period, setPeriod] = useState(today().slice(0, 7)),
    [err, setErr] = useState("");
  const load = () =>
    Promise.all([api.payrollEmployees(), api.payrollRuns()])
      .then(([e, r]) => {
        setEmployees(e);
        setRuns(r);
      })
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  return (
    <>
      <h2>General Payroll</h2>
      <p className="muted">Salary setup, approval and payment</p>
      {err && <p className="error">{err}</p>}
      <div className="card row">
        <input
          className="field"
          type="month"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        />
        <button
          className="btn"
          onClick={() =>
            api
              .createPayrollRun({ period })
              .then(load)
              .catch((e) => setErr(e.message))
          }
        >
          Generate
        </button>
      </div>
      <div className="card">
        <h3>Payroll runs</h3>
        {runs.map((r) => (
          <div className="item" key={r._id}>
            <div className="row between">
              <b>{r.period}</b>
              <span className="badge">{r.status}</span>
            </div>
            <p className="muted">
              {r.lines?.length || 0} staff · net {money(r.netTotal)}
            </p>
            {r.status === "draft" && (
              <button
                className="btn green"
                onClick={() =>
                  api.updatePayrollRun(r._id, { status: "approved" }).then(load)
                }
              >
                Approve
              </button>
            )}
            {r.status === "approved" && (
              <button
                className="btn"
                onClick={() =>
                  api.updatePayrollRun(r._id, { status: "paid" }).then(load)
                }
              >
                Mark paid
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="card">
        <h3>Employees ({employees.length})</h3>
        {employees.map((e) => (
          <div className="item row between" key={e._id}>
            <div>
              <b>{e.name}</b>
              <p className="muted">{e.jobTitle || e.role}</p>
            </div>
            <input
              style={{ width: 110 }}
              className="field"
              type="number"
              defaultValue={e.basicSalary || 0}
              onBlur={(x) =>
                api
                  .updatePayrollEmployee(e._id, {
                    basicSalary: Number(x.target.value),
                  })
                  .catch((er) => setErr(er.message))
              }
            />
          </div>
        ))}
      </div>
    </>
  );
}
function Sms() {
  const [list, setList] = useState([]),
    [form, setForm] = useState({ audience: "both", message: "" }),
    [err, setErr] = useState("");
  const load = () =>
    api
      .smsCampaigns()
      .then(setList)
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  return (
    <>
      <h2>SMS Centre</h2>
      <p className="muted">Send notices to employees and customers</p>
      {err && <p className="error">{err}</p>}
      <div className="card">
        <label>
          Audience
          <select
            className="field"
            value={form.audience}
            onChange={(e) => setForm({ ...form, audience: e.target.value })}
          >
            <option value="employees">Employees</option>
            <option value="customers">Customers</option>
            <option value="both">Both</option>
          </select>
        </label>
        <label>
          Message
          <textarea
            className="field"
            rows="4"
            maxLength="480"
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
          />
        </label>
        <button
          className="btn"
          style={{ width: "100%" }}
          onClick={() =>
            api
              .createSmsCampaign(form)
              .then(() => {
                setForm({ ...form, message: "" });
                load();
              })
              .catch((e) => setErr(e.message))
          }
        >
          Queue SMS campaign
        </button>
      </div>
      <div className="card">
        {list.map((c) => (
          <div className="item" key={c._id}>
            <div className="row between">
              <b>{c.audience}</b>
              <span className="badge">{c.status}</span>
            </div>
            <p>{c.message}</p>
            <p className="muted">{c.recipientCount} recipients</p>
          </div>
        ))}
      </div>
    </>
  );
}
function AdminTools() {
  const [fx, setFx] = useState({ from: "GHS", to: "USD", amount: 1 }),
    [result, setResult] = useState(null),
    [backup, setBackup] = useState(""),
    [audit, setAudit] = useState(null),
    [msg, setMsg] = useState("");
  return (
    <>
      <h2>Admin Tools</h2>
      <p className="muted">Live currency, backup, restore and data audit</p>
      {msg && <p className="online">{msg}</p>}
      <div className="card">
        <h3>Currency converter</h3>
        <div className="grid">
          {["from", "to", "amount"].map((k) => (
            <input
              key={k}
              className="field"
              type={k === "amount" ? "number" : "text"}
              value={fx[k]}
              onChange={(e) => setFx({ ...fx, [k]: e.target.value })}
            />
          ))}
        </div>
        <button
          className="btn"
          onClick={() =>
            api
              .currencyConvert(fx)
              .then(setResult)
              .catch((e) => setMsg(e.message))
          }
        >
          Convert
        </button>
        {result && (
          <h2>
            {result.convertedAmount ?? result.result} {fx.to}
          </h2>
        )}
      </div>
      <div className="card">
        <button
          className="btn"
          onClick={() =>
            api
              .backupJson()
              .then((x) => {
                setBackup(JSON.stringify(x));
                setMsg("Backup loaded below");
              })
              .catch((e) => setMsg(e.message))
          }
        >
          Create JSON backup
        </button>
        <button
          className="btn outline"
          style={{ marginLeft: 8 }}
          onClick={() =>
            api
              .dataAudit()
              .then(setAudit)
              .catch((e) => setMsg(e.message))
          }
        >
          Run audit
        </button>
        <textarea
          className="field"
          rows="7"
          placeholder="Backup JSON for export or restore"
          value={backup}
          onChange={(e) => setBackup(e.target.value)}
        />
        <button
          className="btn red"
          onClick={() =>
            confirm("Restore this JSON backup?") &&
            api
              .restoreJson(JSON.parse(backup))
              .then(() => setMsg("Restore completed"))
              .catch((e) => setMsg(e.message))
          }
        >
          Restore JSON
        </button>
        {audit && (
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {JSON.stringify(audit, null, 2)}
          </pre>
        )}
      </div>
    </>
  );
}
function Performance({ user }) {
  const [data, setData] = useState({ metrics: [], rewards: [] }),
    [err, setErr] = useState("");
  useEffect(() => {
    api
      .performance()
      .then(setData)
      .catch((e) => setErr(e.message));
  }, []);
  return (
    <>
      <h2>Performance & Rewards</h2>
      <p className="muted">Sales, shifts, approvals and variance scores</p>
      {err && <p className="error">{err}</p>}
      <div className="card">
        {data.metrics.map((m) => (
          <div className="item" key={m.employee?._id}>
            <div className="row between">
              <b>{m.employee?.name}</b>
              <span className="badge">{m.score ?? "—"}/100</span>
            </div>
            <p className="muted">
              {m.rating} · {m.salesCount} sales · {m.fuelShiftCount} fuel shifts
            </p>
            <p>{money(m.revenue + m.fuelCollections)} handled</p>
          </div>
        ))}
      </div>
      <div className="card">
        <h3>Rewards</h3>
        {data.rewards.map((r) => (
          <div className="item" key={r._id}>
            <div className="row between">
              <b>{r.title}</b>
              <span className="badge">{r.status}</span>
            </div>
            <p className="muted">
              {r.employee?.name} · {r.points} points · {money(r.amount)}
            </p>
            {["super_admin", "ceo", "gm"].includes(user.role) &&
              r.status === "pending" && (
                <button
                  className="btn green"
                  onClick={() =>
                    api
                      .updateReward(r._id, { status: "approved" })
                      .then(() => api.performance().then(setData))
                  }
                >
                  Approve reward
                </button>
              )}
          </div>
        ))}
      </div>
    </>
  );
}
function Attendance({ user }) {
  const [d, setD] = useState({ sessions: [] }),
    [tab, setTab] = useState("live"),
    [schedules, setSchedules] = useState([]),
    [outlets, setOutlets] = useState([]),
    [form, setForm] = useState(null),
    [err, setErr] = useState("");
  const load = () =>
    Promise.all([api.activeSessions(), api.shiftSchedules(), api.outlets()])
      .then(([a, s, o]) => {
        setD(a);
        setSchedules(s);
        setOutlets(o);
      })
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, []);
  return (
    <>
      <h2>Attendance & Shifts</h2>
      <p className="muted">
        Ghana server time:{" "}
        {d.serverTime &&
          new Date(d.serverTime).toLocaleString("en-GH", {
            timeZone: "Africa/Accra",
          })}
      </p>
      <div className="chips">
        <button
          className={`chip ${tab === "live" ? "active" : ""}`}
          onClick={() => setTab("live")}
        >
          Logged in ({d.sessions.length})
        </button>
        <button
          className={`chip ${tab === "schedule" ? "active" : ""}`}
          onClick={() => setTab("schedule")}
        >
          Schedules
        </button>
      </div>
      {err && <p className="error">{err}</p>}
      {tab === "live" ? (
        <div className="card">
          {d.sessions.map((s) => (
            <div className="item" key={s._id}>
              <div className="row between">
                <b>{s.user?.name}</b>
                <span className="online">● ONLINE</span>
              </div>
              <p className="muted">
                {s.branchIds?.map((x) => x.name).join(", ") || "Company-wide"} ·{" "}
                {s.outletIds?.map((x) => x.name).join(", ") || "All outlets"}
              </p>
              <p className="muted">
                Since{" "}
                {new Date(s.loggedInAt).toLocaleTimeString("en-GH", {
                  timeZone: "Africa/Accra",
                })}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div>
          {(user.role === "super_admin" ||
            user.permissions?.includes("shifts.manage")) && (
            <button
              className="btn"
              onClick={() =>
                setForm({
                  name: "Day Shift",
                  workShift: "day",
                  startTime: "06:00",
                  endTime: "18:00",
                  outlet: "",
                })
              }
            >
              + Add outlet schedule
            </button>
          )}
          {schedules.map((s) => (
            <div className="card" key={s._id}>
              <div className="row between">
                <b>{s.name}</b>
                <span className="badge">{s.active ? "ACTIVE" : "OFF"}</span>
              </div>
              <h2>
                {s.startTime} – {s.endTime}
              </h2>
              <p className="muted">
                {s.outlet?.name} · {s.division} · {s.workShift}
              </p>
              {(user.role === "super_admin" ||
                user.permissions?.includes("shifts.manage")) && (
                <button
                  className="btn outline"
                  onClick={() =>
                    api
                      .updateShiftSchedule(s._id, { active: !s.active })
                      .then(load)
                      .catch((e) => setErr(e.message))
                  }
                >
                  {s.active ? "Disable" : "Enable"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {form && (
        <Modal title="Add shift schedule" onClose={() => setForm(null)}>
          <label>
            Outlet
            <select
              className="field"
              value={form.outlet}
              onChange={(e) => {
                const o = outlets.find((x) => x._id === e.target.value);
                setForm({
                  ...form,
                  outlet: e.target.value,
                  division: o?.division,
                });
              }}
            >
              <option value="">Select outlet</option>
              {outlets.map((o) => (
                <option key={o._id} value={o._id}>
                  {o.name}
                  {o.runs24Hours ? " · 24 hours" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Name
            <input
              className="field"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <div className="grid">
            <label>
              Start
              <input
                className="field"
                type="time"
                value={form.startTime}
                onChange={(e) =>
                  setForm({ ...form, startTime: e.target.value })
                }
              />
            </label>
            <label>
              End
              <input
                className="field"
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              />
            </label>
          </div>
          <label>
            Shift
            <select
              className="field"
              value={form.workShift}
              onChange={(e) =>
                setForm({
                  ...form,
                  workShift: e.target.value,
                  name:
                    e.target.value === "night" ? "Night Shift" : "Day Shift",
                })
              }
            >
              <option value="day">Day</option>
              <option value="night">Night</option>
            </select>
          </label>
          <button
            className="btn green"
            style={{ width: "100%" }}
            onClick={() =>
              api
                .createShiftSchedule(form)
                .then(() => {
                  setForm(null);
                  load();
                })
                .catch((e) => setErr(e.message))
            }
          >
            Save schedule
          </button>
        </Modal>
      )}
    </>
  );
}
export default function App() {
  const [user, setUser] = useState(null),
    [screen, setScreen] = useState("dash"),
    [drawer, setDrawer] = useState(false),
    [offset, setOffset] = useState(0),
    [, tick] = useState(0);
  useEffect(() => {
    if (!user) return;
    const sync = () =>
      api
        .heartbeat()
        .then((x) => setOffset(new Date(x.serverTime) - Date.now()))
        .catch(() => {});
    sync();
    const a = setInterval(sync, 45000),
      b = setInterval(() => tick((x) => x + 1), 1000);
    return () => {
      clearInterval(a);
      clearInterval(b);
    };
  }, [user]);
  if (!user)
    return (
      <Login
        onLogin={(u) => {
          setUser(u);
          setScreen(CONFIG[u.role]?.mods[0] || "dash");
        }}
      />
    );
  let mods = [
    ...(CONFIG[user.role]?.mods || ["dash"]),
    ...(user.permissions || [])
      .map((p) => PERMISSION_MODULES[p])
      .filter(Boolean),
  ];
  mods = [...new Set(mods)];
  const divisions = [...new Set((user.outlets || []).map((x) => x.division))];
  if (!["super_admin", "ceo", "gm"].includes(user.role) && divisions.length)
    mods = mods.filter(
      (x) =>
        !["pos", "market", "fuel"].includes(x) ||
        (x === "pos" && divisions.includes("tyres")) ||
        (x === "market" && divisions.includes("supermarket")) ||
        (x === "fuel" && divisions.includes("fuel")),
    );
  const content = {
    dash: <Dashboard />,
    pos: <POS user={user} />,
    market: <POS user={user} market />,
    fuel: <Fuel />,
    inventory: <Inventory />,
    procurement: <Procurement />,
    customers: <SimpleRecords type="customers" />,
    expenses: <SimpleRecords type="expenses" />,
    finance: <Finance />,
    reconcile: <Reconciliation user={user} />,
    reports: <Reports user={user} />,
    approvals: <Approvals />,
    staff: <Staff />,
    company: <Company />,
    website: <Website />,
    payroll: <Payroll />,
    sms: <Sms />,
    tools: <AdminTools />,
    performance: <Performance user={user} />,
    attendance: <Attendance user={user} />,
  }[screen] || <Dashboard />;
  const home = mods.slice(0, 4);
  const logout = async () => {
    try {
      await api.logout();
    } catch {}
    setToken(null);
    setUser(null);
  };
  return (
    <div className="app">
      <header className="top">
        <button className="btn outline" onClick={() => setDrawer(true)}>
          ☰
        </button>
        <div className="logo">A</div>
        <div className="grow">
          <p className="title">{NAV[screen]?.[0] || "ADMABS"}</p>
          <p className="muted">
            {CONFIG[user.role]?.label} ·{" "}
            {user.outlets?.map((x) => x.name).join(", ") || "Company access"}
          </p>
        </div>
        <div>
          <p className="online">● ONLINE</p>
          <p className="muted">
            {new Date(Date.now() + offset).toLocaleTimeString("en-GH", {
              timeZone: "Africa/Accra",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </header>
      <main className="page">{content}</main>
      <footer className="bottom">
        {home.map((id) => (
          <button
            key={id}
            className={screen === id ? "active" : ""}
            onClick={() => setScreen(id)}
          >
            <span>{NAV[id][1]}</span>
            {NAV[id][0]}
          </button>
        ))}
        <button onClick={() => setDrawer(true)}>
          <span>•••</span>More
        </button>
      </footer>
      {drawer && (
        <div className="drawer" onClick={() => setDrawer(false)}>
          <nav onClick={(e) => e.stopPropagation()}>
            <div className="row">
              <div className="logo">A</div>
              <div>
                <b>{user.name}</b>
                <p className="muted">{CONFIG[user.role]?.label}</p>
              </div>
            </div>
            <hr style={{ borderColor: "#2563eb22" }} />
            {mods.map((id) => (
              <button
                className={`nav ${screen === id ? "active" : ""}`}
                key={id}
                onClick={() => {
                  setScreen(id);
                  setDrawer(false);
                }}
              >
                <span>{NAV[id][1]}</span>
                {NAV[id][0]}
              </button>
            ))}
            <button className="nav danger" onClick={logout}>
              ↪ Sign out
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}
