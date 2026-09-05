import Sale from '../models/Sale.js';
import Expense from '../models/Expense.js';
import Product from '../models/Product.js';
import Branch from '../models/Branch.js';

const round = n => Math.round(Number(n || 0) * 100) / 100;
export default async function analyticsRoutes(fastify) {
  fastify.get('/api/analytics/financial', { preHandler: [fastify.authenticate, fastify.requirePermission('reports.view', 'ceo', 'gm', 'finance', 'accountant', 'staff', 'cashier')] }, async (request, reply) => {
    if (!['super_admin', 'ceo', 'gm'].includes(request.user.role) && request.query?.branch && !request.user.branchIds?.includes(String(request.query.branch))) return reply.code(403).send({ error: 'Branch is outside your assignment' });
    const end = request.query?.end ? new Date(`${request.query.end}T23:59:59.999Z`) : new Date();
    const start = request.query?.start ? new Date(`${request.query.start}T00:00:00.000Z`) : new Date(end.getFullYear(), end.getMonth() - 5, 1);
    const scope = fastify.scopeFilter(request);
    if (request.query?.branch) scope.branch = request.query.branch;
    if (request.query?.outlet) scope.outlet = request.query.outlet;
    const [sales, expenses, branches, products] = await Promise.all([
      Sale.find({ ...scope, status: 'posted', createdAt: { $gte: start, $lte: end } }).lean(),
      Expense.find({ ...fastify.scopeFilter(request, 'branchRef', 'outlet'), status: { $ne: 'rejected' }, createdAt: { $gte: start, $lte: end }, ...(request.query?.branch ? { branchRef: request.query.branch } : {}), ...(request.query?.outlet ? { outlet: request.query.outlet } : {}) }).lean(),
      Branch.find().select('name code').lean(), Product.find({ ...scope, active: true }).select('name code category qty cost price branch outlet').lean(),
    ]);
    const branchNames = new Map(branches.map(b => [String(b._id), b.name]));
    const filteredSales = request.query?.product ? sales.map(s => ({ ...s, items: s.items.filter(i => String(i.product) === request.query.product) })).filter(s => s.items.length) : sales;
    const buckets = new Map(); const branchMap = new Map(); const productMap = new Map();
    for (const sale of filteredSales) {
      const month = new Date(sale.createdAt).toISOString().slice(0, 7); if (!buckets.has(month)) buckets.set(month, { month, revenue: 0, cogs: 0, profit: 0 });
      const b = buckets.get(month); const branchName = branchNames.get(String(sale.branch)) || 'Unassigned';
      for (const i of sale.items) { const revenue = i.price * i.qty, cogs = (i.cost || 0) * i.qty; b.revenue += revenue; b.cogs += cogs; branchMap.set(branchName, (branchMap.get(branchName) || 0) + revenue); productMap.set(i.name, (productMap.get(i.name) || 0) + revenue); }
    }
    const monthly = [...buckets.values()].sort((a,b) => a.month.localeCompare(b.month)).map(x => ({ ...x, revenue: round(x.revenue), cogs: round(x.cogs), profit: round(x.revenue - x.cogs) }));
    const revenues = monthly.map(x => x.revenue); const recentAvg = revenues.slice(-3).reduce((s,n) => s+n,0) / Math.max(1, revenues.slice(-3).length);
    const growthRates = revenues.slice(1).map((n,i) => revenues[i] ? (n-revenues[i])/revenues[i] : 0); const growth = Math.max(-0.25, Math.min(0.25, growthRates.slice(-3).reduce((s,n)=>s+n,0)/Math.max(1,growthRates.slice(-3).length)));
    const forecast = []; let base = recentAvg; for (let i=1;i<=3;i++) { base *= 1+growth; const d = new Date(end.getFullYear(), end.getMonth()+i, 1); forecast.push({ month: d.toISOString().slice(0,7), forecast: round(base), low: round(base*0.85), high: round(base*1.15) }); }
    const revenue = round(monthly.reduce((s,x)=>s+x.revenue,0)), cogs = round(monthly.reduce((s,x)=>s+x.cogs,0)), expenseTotal = round(expenses.reduce((s,x)=>s+x.amount,0));
    return { filters: { start, end, branch: request.query?.branch, product: request.query?.product }, summary: { revenue, cogs, grossProfit: round(revenue-cogs), expenses: expenseTotal, netProfit: round(revenue-cogs-expenseTotal), inventoryValue: round(products.reduce((s,p)=>s+p.qty*p.cost,0)), forecastGrowthPercent: round(growth*100) }, monthly, forecast,
      byBranch: [...branchMap].map(([name,value])=>({name,value:round(value)})).sort((a,b)=>b.value-a.value), topProducts: [...productMap].map(([name,value])=>({name,value:round(value)})).sort((a,b)=>b.value-a.value).slice(0,10), products };
  });
}
