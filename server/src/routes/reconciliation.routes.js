import CashReconciliation from '../models/CashReconciliation.js';
import Sale from '../models/Sale.js';
import Product from '../models/Product.js';

const round = n => Math.round(Number(n || 0) * 100) / 100;
const methodKey = method => /card/i.test(method) ? 'card' : /mobile|momo|eco/i.test(method) ? 'mobileMoney' : /bank/i.test(method) ? 'bank' : /credit/i.test(method) ? 'credit' : 'cash';

export default async function reconciliationRoutes(fastify) {
  fastify.get('/api/reconciliations', { preHandler: [fastify.authenticate] }, async request =>
    CashReconciliation.find(fastify.scopeFilter(request)).populate('branch outlet submittedBy reviewedBy', 'name code').sort({ businessDate: -1 }).limit(100));

  fastify.get('/api/reconciliations/prepare', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const branch = request.query?.branch || request.user.branchIds?.[0];
    const outlet = request.query?.outlet || request.user.outletIds?.[0];
    if (!branch) return reply.code(400).send({ error: 'Select a branch' });
    if (!['super_admin', 'ceo', 'gm'].includes(request.user.role) && !request.user.branchIds?.includes(String(branch))) return reply.code(403).send({ error: 'Branch is outside your assignment' });
    const businessDate = request.query?.date ? new Date(request.query.date) : new Date();
    const start = new Date(businessDate); start.setHours(0, 0, 0, 0); const end = new Date(start); end.setDate(end.getDate() + 1);
    const filter = { branch, createdAt: { $gte: start, $lt: end }, status: 'posted', ...(outlet ? { outlet } : {}) };
    const [sales, products] = await Promise.all([Sale.find(filter).lean(), Product.find({ branch, active: true, ...(outlet ? { outlet } : {}) }).lean()]);
    const expected = { cash: 0, card: 0, mobileMoney: 0, bank: 0, credit: 0, total: 0 };
    sales.forEach(sale => (sale.payments?.length ? sale.payments : [{ method: sale.paymentMethod, amount: sale.total }]).forEach(p => { expected[methodKey(p.method)] += Number(p.amount || 0); expected.total += Number(p.amount || 0); }));
    Object.keys(expected).forEach(k => { expected[k] = round(expected[k]); });
    return { businessDate: start, branch, outlet, expected, salesCount: sales.length, saleIds: sales.map(sale => sale._id), stockBookValue: round(products.reduce((sum, p) => sum + p.qty * p.cost, 0)), skuCount: products.length };
  });

  fastify.post('/api/reconciliations', { preHandler: [fastify.authenticate, fastify.requirePermission('reconciliation.create', 'ceo', 'gm', 'branch', 'sub_manager')] }, async (request, reply) => {
    const prepared = await fastify.inject({ method: 'GET', url: `/api/reconciliations/prepare?branch=${request.body?.branch || ''}&outlet=${request.body?.outlet || ''}&date=${request.body?.businessDate || ''}`, headers: { authorization: request.headers.authorization } });
    if (prepared.statusCode !== 200) return reply.code(prepared.statusCode).send(prepared.json());
    const base = prepared.json();
    const counted = ['cash', 'card', 'mobileMoney', 'bank', 'credit'].reduce((o, k) => ({ ...o, [k]: round(request.body?.counted?.[k]) }), {});
    counted.total = round(Object.values(counted).reduce((s, n) => s + n, 0));
    try {
      const record = await CashReconciliation.create({ number: `REC-${Date.now()}`, businessDate: base.businessDate, branch: base.branch, outlet: base.outlet || undefined,
        expected: base.expected, counted, variance: round(counted.total - base.expected.total), stockBookValue: base.stockBookValue,
        sales: base.saleIds, salesCount: base.salesCount,
        stockCountValue: round(request.body?.stockCountValue ?? base.stockBookValue), stockVariance: round(Number(request.body?.stockCountValue ?? base.stockBookValue) - base.stockBookValue),
        explanation: request.body?.explanation, submittedBy: request.user.id });
      return reply.code(201).send(record);
    } catch (error) { return reply.code(400).send({ error: error.code === 11000 ? 'This branch/outlet has already been reconciled for the selected day' : error.message }); }
  });

  fastify.patch('/api/reconciliations/:id', { preHandler: [fastify.authenticate, fastify.requirePermission('reconciliation.review', 'ceo', 'gm', 'finance', 'accountant', 'branch', 'sub_manager')] }, async (request, reply) => {
    if (!['approved', 'queried'].includes(request.body?.status)) return reply.code(400).send({ error: 'Status must be approved or queried' });
    const item = await CashReconciliation.findOne({ _id: request.params.id, ...fastify.scopeFilter(request) });
    if (!item) return reply.code(404).send({ error: 'Reconciliation not found' });
    if (String(item.submittedBy) === request.user.id && !['super_admin', 'ceo', 'gm'].includes(request.user.role)) return reply.code(409).send({ error: 'A different manager must approve the cash handover and daily sales' });
    item.status = request.body.status; item.explanation = request.body.explanation || item.explanation; item.reviewedBy = request.user.id; item.reviewedAt = new Date(); await item.save();
    if (item.sales?.length) await Sale.updateMany({ _id: { $in: item.sales } }, request.body.status === 'approved' ? { dailyApprovalStatus: 'approved', dailyApprovedBy: request.user.id, dailyApprovedAt: new Date() } : { dailyApprovalStatus: 'queried', $unset: { dailyApprovedBy: 1, dailyApprovedAt: 1 } });
    return item;
  });
}
