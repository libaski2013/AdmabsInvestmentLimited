import Sale from '../models/Sale.js';
import Product from '../models/Product.js';
import Customer from '../models/Customer.js';
import Expense from '../models/Expense.js';
import Approval from '../models/Approval.js';
import PurchaseOrder from '../models/PurchaseOrder.js';

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
  fastify.get('/api/dashboard', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { start: monthStart, end: monthEnd } = monthBounds(0);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const scope = fastify.scopeFilter(request);
    if (!['super_admin', 'ceo', 'gm'].includes(request.user.role) && request.query?.branch && !request.user.branchIds?.includes(String(request.query.branch))) return reply.code(403).send({ error: 'Branch is outside your assignment' });
    if (!['super_admin', 'ceo', 'gm'].includes(request.user.role) && request.query?.outlet && !request.user.outletIds?.includes(String(request.query.outlet))) return reply.code(403).send({ error: 'Outlet is outside your assignment' });
    if (request.query?.branch) scope.branch = request.query.branch;
    if (request.query?.outlet) scope.outlet = request.query.outlet;
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

    const chartEnd = request.query?.end ? new Date(`${request.query.end}T23:59:59.999Z`) : new Date();
    const chartStart = request.query?.start ? new Date(`${request.query.start}T00:00:00.000Z`) : new Date(chartEnd.getFullYear(), chartEnd.getMonth() - 12, 1);
    const chartSales = await Sale.find({ ...scope, status: 'posted', createdAt: { $gte: chartStart, $lte: chartEnd } }).lean();
    const purchaseScope = fastify.scopeFilter(request);
    if (request.query?.branch) purchaseScope.branch = request.query.branch;
    if (request.query?.outlet) purchaseScope.outlet = request.query.outlet;
    const chartPurchases = await PurchaseOrder.find({ ...purchaseScope, status: { $in: ['approved', 'delivered'] }, createdAt: { $gte: chartStart, $lte: chartEnd } }).lean();
    const overviewMap = new Map();
    const cursor = new Date(chartStart.getFullYear(), chartStart.getMonth(), 1);
    const lastMonth = new Date(chartEnd.getFullYear(), chartEnd.getMonth(), 1);
    let guard = 0;
    while (cursor <= lastMonth && guard++ < 24) { const key = cursor.toISOString().slice(0,7); overviewMap.set(key, { month:key, m:cursor.toLocaleString('en-US',{month:'short',year:'numeric'}), sales:0, purchases:0, soldProductTax:0, orderTax:0, purchasedProductTax:0 }); cursor.setMonth(cursor.getMonth()+1); }
    for (const sale of chartSales) { const row=overviewMap.get(new Date(sale.createdAt).toISOString().slice(0,7)); if (!row) continue; row.sales += Number(sale.subtotal||0); row.orderTax += Number(sale.tax||0); }
    for (const purchase of chartPurchases) { const row=overviewMap.get(new Date(purchase.createdAt).toISOString().slice(0,7)); if (!row) continue; row.purchases += Number(purchase.amount||0); row.purchasedProductTax += Number(purchase.tax||0); }
    const overviewChart=[...overviewMap.values()].map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,typeof v==='number'?Math.round(v*100)/100:v])));

    const alerts = lowStock.slice(0, 4).map((p) => ({
      i: '⚠️',
      m: `${p.name} — ${p.qty} unit${p.qty === 1 ? '' : 's'} left`,
    }));
    if (pendingApprovals > 0) {
      alerts.push({ i: '✅', m: `${pendingApprovals} approval(s) awaiting your review` });
    }

    const recentSales = await Sale.find(scope).sort({ createdAt: -1 }).limit(4).lean();
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
      overviewChart,
      overviewFilters: { start: chartStart, end: chartEnd, branch: request.query?.branch, outlet: request.query?.outlet },
      alerts,
      recentTransactions,
      lowStockCount: lowStock.length,
    };
  });
}
