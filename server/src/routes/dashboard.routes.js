import Sale from '../models/Sale.js';
import Product from '../models/Product.js';
import Customer from '../models/Customer.js';
import Expense from '../models/Expense.js';
import Approval from '../models/Approval.js';

const DIVISION_MAP = {
  Tyre: 'Tyres & Batteries',
  Battery: 'Battery',
  Service: 'Tyres & Batteries',
  Fuel: 'Fuel',
  Grocery: 'Supermarket',
  Beverages: 'Supermarket',
  Snacks: 'Supermarket',
  Household: 'Supermarket',
  Bakery: 'Supermarket',
  Dairy: 'Supermarket',
};

export const SUPERMARKET_CATEGORIES = ['Grocery', 'Beverages', 'Snacks', 'Household', 'Bakery', 'Dairy'];

function monthBounds(offsetMonths = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - offsetMonths, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - offsetMonths + 1, 1);
  return { start, end };
}

export default async function dashboardRoutes(fastify) {
  fastify.get('/api/dashboard', { preHandler: [fastify.authenticate] }, async (request) => {
    const { start: monthStart, end: monthEnd } = monthBounds(0);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const scope = fastify.scopeFilter(request);
    const [salesThisMonth, allSales, expensesThisMonth, customers, scopedProducts, pendingApprovals] =
      await Promise.all([
        Sale.find({ ...scope, createdAt: { $gte: monthStart, $lt: monthEnd }, status: 'posted' }),
        Sale.find(scope).sort({ createdAt: -1 }).limit(500),
        Expense.find({ ...fastify.scopeFilter(request, 'branchRef', 'outlet'), createdAt: { $gte: monthStart, $lt: monthEnd }, status: { $ne: 'rejected' } }),
        Customer.find(),
        Product.find({ ...scope, active: true }),
        Approval.countDocuments({ status: 'pending' }),
      ]);
    const lowStock = scopedProducts.filter(p => p.qty <= p.reorderLevel);

    const revenue = salesThisMonth.reduce((s, sale) => s + sale.total, 0);
    const todayRevenue = salesThisMonth
      .filter((s) => s.createdAt >= todayStart)
      .reduce((s, sale) => s + sale.total, 0);
    const cogs = salesThisMonth.reduce(
      (s, sale) => s + sale.items.reduce((si, i) => si + (i.cost || 0) * i.qty, 0),
      0
    );
    const grossProfit = revenue - cogs;
    const expensesTotal = expensesThisMonth.reduce((s, e) => s + e.amount, 0);
    const netProfit = grossProfit - expensesTotal;
    const receivables = customers.reduce((s, c) => s + (c.balance || 0), 0);
    const inventoryValue = scopedProducts.reduce((sum, p) => sum + (p.cost || 0) * (p.qty || 0), 0);
    const paymentTotals = {};
    const branchTotals = {};
    for (const sale of salesThisMonth) {
      for (const payment of sale.payments?.length ? sale.payments : [{ method: sale.paymentMethod, amount: sale.total }]) paymentTotals[payment.method] = (paymentTotals[payment.method] || 0) + payment.amount;
      const key = String(sale.branch || 'Unassigned');
      branchTotals[key] = (branchTotals[key] || 0) + sale.total;
    }

    const divisionTotals = {};
    for (const sale of salesThisMonth) {
      for (const item of sale.items) {
        const div = DIVISION_MAP[item.category] || 'Online';
        divisionTotals[div] = (divisionTotals[div] || 0) + item.price * item.qty;
      }
    }
    const revenueByDivision = Object.entries(divisionTotals).map(([n, v]) => ({
      n,
      v: Math.round(v),
    }));

    const trend = [];
    for (let i = 4; i >= 0; i--) {
      const { start, end } = monthBounds(i);
      const monthSales = allSales.filter((s) => s.createdAt >= start && s.createdAt < end);
      const byDiv = { t: 0, f: 0, s: 0, o: 0 };
      for (const sale of monthSales) {
        for (const item of sale.items) {
          const div = DIVISION_MAP[item.category] || 'Online';
          const key = div === 'Fuel' ? 'f' : div === 'Supermarket' ? 's' : div === 'Online' ? 'o' : 't';
          byDiv[key] += item.price * item.qty;
        }
      }
      trend.push({
        m: start.toLocaleString('en-US', { month: 'short' }),
        t: Math.round(byDiv.t / 1000),
        f: Math.round(byDiv.f / 1000),
        s: Math.round(byDiv.s / 1000),
        o: Math.round(byDiv.o / 1000),
      });
    }

    const alerts = lowStock.slice(0, 4).map((p) => ({
      i: '⚠️',
      m: `${p.name} — ${p.qty} unit${p.qty === 1 ? '' : 's'} left`,
    }));
    if (pendingApprovals > 0) {
      alerts.push({ i: '✅', m: `${pendingApprovals} approval(s) awaiting your review` });
    }

    const recentSales = await Sale.find().sort({ createdAt: -1 }).limit(4).lean();
    const recentTransactions = recentSales.map((s) => ({
      id: s.invoiceNumber,
      type: 'Sale',
      amt: s.total,
      mth: s.paymentMethod,
      time: new Date(s.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      st: s.status,
      item: s.items.map((i) => i.name).join(', '),
    }));

    return {
      revenue: Math.round(revenue),
      todayRevenue: Math.round(todayRevenue),
      grossProfit: Math.round(grossProfit),
      netProfit: Math.round(netProfit),
      receivables: Math.round(receivables),
      expenses: Math.round(expensesTotal),
      cogs: Math.round(cogs),
      grossMargin: revenue ? +(grossProfit / revenue * 100).toFixed(1) : 0,
      netMargin: revenue ? +(netProfit / revenue * 100).toFixed(1) : 0,
      inventoryValue: Math.round(inventoryValue),
      paymentMix: Object.entries(paymentTotals).map(([name, value]) => ({ name, value: Math.round(value) })),
      branchPerformance: Object.entries(branchTotals).map(([branch, value]) => ({ branch, value: Math.round(value) })).sort((a, b) => b.value - a.value),
      revenueByDivision,
      revenueTrend: trend,
      alerts,
      recentTransactions,
      lowStockCount: lowStock.length,
    };
  });
}
