import Sale from '../models/Sale.js';
import Product from '../models/Product.js';

async function nextInvoiceNumber() {
  const count = await Sale.countDocuments();
  return `INV-${String(2041 + count).padStart(4, '0')}`;
}

export default async function posRoutes(fastify) {
  fastify.get('/api/sales', { preHandler: [fastify.authenticate] }, async (request) => {
    const { limit } = request.query || {};
    return Sale.find()
      .sort({ createdAt: -1 })
      .limit(limit ? Number(limit) : 50);
  });

  fastify.post('/api/sales', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { items, paymentMethod, customer } = request.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return reply.code(400).send({ error: 'items are required' });
    }

    const productIds = items.filter((i) => i.product).map((i) => i.product);
    const products = await Product.find({ _id: { $in: productIds } }).lean();
    const costById = new Map(products.map((p) => [String(p._id), p.cost || 0]));
    const itemsWithCost = items.map((i) => ({
      ...i,
      cost: i.product ? costById.get(String(i.product)) || 0 : 0,
    }));

    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const tax = +(subtotal * 0.15).toFixed(2);
    const total = +(subtotal + tax).toFixed(2);

    const sale = await Sale.create({
      invoiceNumber: await nextInvoiceNumber(),
      cashier: request.user.id,
      customer: customer || undefined,
      items: itemsWithCost,
      subtotal,
      tax,
      total,
      paymentMethod: paymentMethod || 'Cash',
    });

    // Decrement stock for items that reference a real product.
    await Promise.all(
      items
        .filter((i) => i.product)
        .map((i) => Product.findByIdAndUpdate(i.product, { $inc: { qty: -i.qty } }))
    );

    return reply.code(201).send(sale);
  });
}
