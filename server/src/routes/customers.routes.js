import Customer from '../models/Customer.js';
import CustomerPayment from '../models/CustomerPayment.js';
import Sale from '../models/Sale.js';
import JournalEntry from '../models/JournalEntry.js';

const round = value => Math.round(Number(value || 0) * 100) / 100;
const creditOnSale = sale => round((sale.payments || []).filter(p => p.method === 'Customer Credit').reduce((sum, p) => sum + Number(p.amount || 0), 0));

export default async function customerRoutes(fastify) {
  fastify.get('/api/customers', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { type, credit, branch, outlet, q } = request.query || {};
    if (!['super_admin', 'ceo', 'gm'].includes(request.user.role)) {
      if (branch && !request.user.branchIds?.includes(String(branch))) return reply.code(403).send({ error: 'Branch is outside your assignment' });
      if (outlet && !request.user.outletIds?.includes(String(outlet))) return reply.code(403).send({ error: 'Outlet is outside your assignment' });
    }
    const filter = { active: { $ne: false }, ...fastify.scopeFilter(request) };
    if (type) filter.type = type;
    if (credit === 'true') filter.balance = { $gt: 0 };
    if (branch) filter.branch = branch;
    if (outlet) filter.outlet = outlet;
    if (q) filter.$or = [{ name: new RegExp(q, 'i') }, { phone: new RegExp(q, 'i') }, { email: new RegExp(q, 'i') }];
    return Customer.find(filter).populate('branch', 'name code').populate('outlet', 'name code division').sort({ name: 1 });
  });

  fastify.get('/api/customers/:id/statement', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const customer = await Customer.findOne({ _id: request.params.id, active: { $ne: false }, ...fastify.scopeFilter(request) }).populate('branch', 'name code').populate('outlet', 'name code division').lean();
    if (!customer) return reply.code(404).send({ error: 'Customer not found in your assigned location' });
    if (!['super_admin', 'ceo', 'gm'].includes(request.user.role)) {
      if (request.query?.branch && !request.user.branchIds?.includes(String(request.query.branch))) return reply.code(403).send({ error: 'Branch is outside your assignment' });
      if (request.query?.outlet && !request.user.outletIds?.includes(String(request.query.outlet))) return reply.code(403).send({ error: 'Outlet is outside your assignment' });
    }
    const start = request.query?.start ? new Date(`${request.query.start}T00:00:00.000Z`) : null;
    const end = request.query?.end ? new Date(`${request.query.end}T23:59:59.999Z`) : null;
    const scope = fastify.scopeFilter(request);
    if (request.query?.branch) scope.branch = request.query.branch;
    if (request.query?.outlet) scope.outlet = request.query.outlet;
    const dateFilter = start || end ? { createdAt: { ...(start ? { $gte: start } : {}), ...(end ? { $lte: end } : {}) } } : {};
    const [sales, payments, allocationPayments] = await Promise.all([
      Sale.find({ customer: customer._id, status: 'posted', ...scope, ...dateFilter }).populate('branch', 'name code').populate('outlet', 'name code division').sort({ createdAt: -1 }).lean(),
      CustomerPayment.find({ customer: customer._id, status: 'posted', ...scope, ...(start || end ? { receivedAt: { ...(start ? { $gte: start } : {}), ...(end ? { $lte: end } : {}) } } : {}) }).populate('branch', 'name code').populate('outlet', 'name code division').populate('receivedBy', 'name').sort({ receivedAt: -1 }).lean(),
      CustomerPayment.find({ customer: customer._id, status: 'posted', ...scope }).select('allocations').lean(),
    ]);
    const allocated = new Map();
    for (const payment of allocationPayments) for (const item of payment.allocations || []) allocated.set(String(item.sale), round((allocated.get(String(item.sale)) || 0) + item.amount));
    const purchases = sales.map(sale => {
      const credit = creditOnSale(sale); const paidLater = allocated.get(String(sale._id)) || 0;
      return { ...sale, paidAtSale: round(sale.total - credit), creditAmount: credit, paidLater, amountDue: round(Math.max(0, credit - paidLater)) };
    });
    return { customer, summary: { purchases: sales.length, purchaseTotal: round(sales.reduce((sum, s) => sum + s.total, 0)), paymentsReceived: round(payments.reduce((sum, p) => sum + p.amount, 0)), balance: round(customer.balance) }, purchases, payments };
  });

  fastify.post('/api/customers/:id/payments', { preHandler: [fastify.authenticate, fastify.requirePermission('customers.payment.receive', 'ceo', 'gm', 'finance', 'accountant', 'branch', 'sub_manager', 'cashier')] }, async (request, reply) => {
    const amount = round(request.body?.amount); const method = request.body?.method || 'Cash';
    if (!(amount > 0)) return reply.code(400).send({ error: 'Payment amount must be greater than zero' });
    if (!['Cash', 'Card', 'Mobile Money', 'Bank Transfer', 'Cheque'].includes(method)) return reply.code(400).send({ error: 'Select a valid payment method' });
    const customer = await Customer.findOne({ _id: request.params.id, active: { $ne: false }, ...fastify.scopeFilter(request) });
    if (!customer) return reply.code(404).send({ error: 'Customer not found in your assigned location' });
    if (amount > round(customer.balance) + 0.005) return reply.code(409).send({ error: `Payment cannot exceed the outstanding balance of ${round(customer.balance)}` });
    const sales = await Sale.find({ customer: customer._id, status: 'posted', ...fastify.scopeFilter(request) }).sort({ createdAt: 1 }).lean();
    const previous = await CustomerPayment.find({ customer: customer._id, status: 'posted' }).select('allocations').lean();
    const allocated = new Map(); for (const payment of previous) for (const item of payment.allocations || []) allocated.set(String(item.sale), round((allocated.get(String(item.sale)) || 0) + item.amount));
    let remaining = amount; const allocations = [];
    for (const sale of sales) { const due = round(Math.max(0, creditOnSale(sale) - (allocated.get(String(sale._id)) || 0))); if (!due || remaining <= 0) continue; const applied = round(Math.min(due, remaining)); allocations.push({ sale: sale._id, amount: applied }); remaining = round(remaining - applied); }
    const branch = request.body?.branch || customer.branch; const outlet = request.body?.outlet || customer.outlet;
    const updated = await Customer.findOneAndUpdate({ _id: customer._id, balance: { $gte: amount } }, { $inc: { balance: -amount } }, { new: true });
    if (!updated) return reply.code(409).send({ error: 'Customer balance changed; refresh the statement and try again' });
    let payment;
    try {
      payment = await CustomerPayment.create({ receiptNumber: `CR-${Date.now()}-${Math.floor(Math.random()*1000)}`, customer: customer._id, branch, outlet, amount, method, reference: request.body?.reference, notes: request.body?.notes, allocations, receivedBy: request.user.id });
      await JournalEntry.create({ number: `JE-${payment.receiptNumber}`, date: payment.receivedAt, description: `Customer payment ${payment.receiptNumber} — ${customer.name}`, source: 'payment', sourceId: payment._id, branch, outlet, createdBy: request.user.id, lines: [{ accountCode: '1000', accountName: method === 'Cash' ? 'Cash and Payment Clearing' : method, debit: amount }, { accountCode: '1100', accountName: 'Accounts Receivable', credit: amount }] });
    } catch (error) { await Customer.findByIdAndUpdate(customer._id, { $inc: { balance: amount } }); if (payment?._id) await CustomerPayment.findByIdAndDelete(payment._id); throw error; }
    return reply.code(201).send({ payment, balance: updated.balance });
  });

  fastify.post('/api/customers', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const body = { ...request.body };
    if (!['super_admin', 'ceo', 'gm'].includes(request.user.role)) { body.branch = request.user.branchIds?.[0]; body.outlet = request.user.outletIds?.[0]; }
    const customer = await Customer.create(body); return reply.code(201).send(customer);
  });

  fastify.patch('/api/customers/:id', { preHandler: [fastify.authenticate, fastify.requirePermission('customers.manage', 'ceo', 'gm', 'finance', 'accountant', 'branch', 'sub_manager')] }, async (request, reply) => {
    const safe = { ...request.body }; delete safe.balance; delete safe.visits; delete safe.loyaltyPoints;
    const customer = await Customer.findOneAndUpdate({ _id: request.params.id, ...fastify.scopeFilter(request) }, safe, { new: true, runValidators: true });
    if (!customer) return reply.code(404).send({ error: 'Customer not found' }); return customer;
  });

  fastify.delete('/api/customers/:id', { preHandler: [fastify.authenticate, fastify.requireRole('ceo', 'gm')] }, async (request, reply) => {
    const customer = await Customer.findByIdAndUpdate(request.params.id, { active: false }, { new: true });
    if (!customer) return reply.code(404).send({ error: 'Customer not found' }); return reply.code(204).send();
  });
}
