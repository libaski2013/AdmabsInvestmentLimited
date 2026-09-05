import Sale from '../models/Sale.js';
import Product from '../models/Product.js';
import JournalEntry from '../models/JournalEntry.js';
import Outlet from '../models/Outlet.js';

async function nextInvoiceNumber() {
  return `INV-${Date.now()}-${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;
}

export default async function posRoutes(fastify) {
  fastify.get('/api/sales', { preHandler: [fastify.authenticate] }, async (request) => {
    const { limit } = request.query || {};
    return Sale.find(fastify.scopeFilter(request))
      .sort({ createdAt: -1 })
      .limit(limit ? Number(limit) : 50);
  });

  fastify.post('/api/sales', { preHandler: [fastify.authenticate, fastify.requirePermission('pos.sale.create', 'ceo', 'gm', 'branch', 'sub_manager', 'staff', 'cashier', 'fuel')] }, async (request, reply) => {
    const { items, paymentMethod, payments, customer, branch, outlet, discount = 0, taxRate = 0.15, channel = 'pos', workShift } = request.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return reply.code(400).send({ error: 'items are required' });
    }

    const productIds = items.filter((i) => i.product).map((i) => i.product);
    const products = await Product.find({ _id: { $in: productIds }, ...fastify.scopeFilter(request) }).lean();
    if (products.length !== productIds.length) return reply.code(403).send({ error: 'One or more products are outside your assigned outlet' });
    const productById = new Map(products.map(p => [String(p._id), p]));
    for (const item of items) {
      const product = productById.get(String(item.product));
      if (!product || item.qty <= 0 || product.qty < item.qty) return reply.code(409).send({ error: `Insufficient stock for ${item.name || 'product'}` });
      if (Number(item.price) !== Number(product.price)) return reply.code(400).send({ error: `Price changed for ${product.name}; refresh the product list` });
    }
    const costById = new Map(products.map((p) => [String(p._id), p.cost || 0]));
    const itemsWithCost = items.map((i) => ({
      ...i,
      cost: i.product ? costById.get(String(i.product)) || 0 : 0,
    }));

    const subtotalBeforeDiscount = items.reduce((s, i) => s + i.price * i.qty, 0);
    const subtotal = Math.max(0, subtotalBeforeDiscount - Number(discount || 0));
    const tax = +(subtotal * Number(taxRate)).toFixed(2);
    const total = +(subtotal + tax).toFixed(2);
    const normalizedPayments = payments?.length ? payments : [{ method: paymentMethod || 'Cash', amount: total }];
    const paid = normalizedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    if (Math.abs(paid - total) > 0.01) return reply.code(400).send({ error: 'Payment total must equal the sale total' });
    const resolvedBranch = branch || products[0]?.branch;
    const resolvedOutlet = outlet || products[0]?.outlet;
    const shift = ['day', 'night'].includes(workShift) ? workShift : (new Date().getHours() >= 18 || new Date().getHours() < 6 ? 'night' : 'day');
    const outletRecord = resolvedOutlet ? await Outlet.findById(resolvedOutlet).select('runs24Hours').lean() : null;
    if (shift === 'night' && !outletRecord?.runs24Hours) return reply.code(409).send({ error: 'Night-shift sales are disabled for this outlet. Enable 24-hour operation in Company & Branches.' });

    const sale = await Sale.create({
      invoiceNumber: await nextInvoiceNumber(),
      cashier: request.user.id,
      customer: customer || undefined,
      branch: resolvedBranch,
      outlet: resolvedOutlet,
      items: itemsWithCost,
      subtotal,
      tax,
      total,
      paymentMethod: paymentMethod || 'Cash',
      payments: normalizedPayments,
      discount,
      taxRate,
      channel,
      workShift: shift,
    });

    // Decrement stock for items that reference a real product.
    const stockUpdates = await Promise.all(
      items
        .filter((i) => i.product)
        .map((i) => Product.findOneAndUpdate({ _id: i.product, qty: { $gte: i.qty } }, { $inc: { qty: -i.qty } }))
    );
    if (stockUpdates.some(result => !result)) {
      await Promise.all(stockUpdates.map((result, index) => result ? Product.findByIdAndUpdate(result._id, { $inc: { qty: items[index].qty } }) : null));
      sale.status = 'voided';
      sale.notes = 'Automatically voided: stock changed during checkout';
      await sale.save();
      return reply.code(409).send({ error: 'Stock changed during checkout. The sale was voided; please refresh and try again.' });
    }

    const cashAccount = normalizedPayments.some(p => p.method === 'Customer Credit') ? ['1100', 'Accounts Receivable'] : ['1000', 'Cash and Payment Clearing'];
    const cogs = itemsWithCost.reduce((sum, i) => sum + i.cost * i.qty, 0);
    await JournalEntry.create({
      number: `JE-${sale.invoiceNumber}`, date: sale.postedAt, description: `Sale ${sale.invoiceNumber}`,
      source: 'sale', sourceId: sale._id, branch: resolvedBranch, outlet: resolvedOutlet, createdBy: request.user.id,
      lines: [
        { accountCode: cashAccount[0], accountName: cashAccount[1], debit: total },
        { accountCode: '4000', accountName: 'Sales Revenue', credit: subtotal },
        ...(tax > 0 ? [{ accountCode: '2100', accountName: 'VAT Payable', credit: tax }] : []),
        ...(cogs > 0 ? [{ accountCode: '5000', accountName: 'Cost of Goods Sold', debit: cogs }, { accountCode: '1200', accountName: 'Inventory', credit: cogs }] : []),
      ],
    });

    return reply.code(201).send(sale);
  });
}
