import PurchaseOrder from '../models/PurchaseOrder.js';
import Supplier from '../models/Supplier.js';

async function nextPoNumber() {
  const count = await PurchaseOrder.countDocuments();
  return `PO-${String(440 + count).padStart(4, '0')}`;
}

export default async function procurementRoutes(fastify) {
  fastify.get('/api/purchase-orders', { preHandler: [fastify.authenticate] }, async () => {
    return PurchaseOrder.find().populate('supplier', 'name type').sort({ createdAt: -1 });
  });

  fastify.post('/api/purchase-orders', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { supplier, items } = request.body || {};
    if (!supplier || !Array.isArray(items) || items.length === 0) {
      return reply.code(400).send({ error: 'supplier and items are required' });
    }
    const amount = items.reduce((s, l) => s + l.qty * l.unitCost, 0);
    const po = await PurchaseOrder.create({
      poNumber: await nextPoNumber(),
      supplier,
      items,
      amount,
    });
    return reply.code(201).send(po);
  });

  fastify.patch(
    '/api/purchase-orders/:id',
    { preHandler: [fastify.authenticate, fastify.requireRole('ceo', 'gm', 'finance')] },
    async (request, reply) => {
      const { status } = request.body || {};
      const po = await PurchaseOrder.findByIdAndUpdate(request.params.id, { status }, { new: true });
      if (!po) return reply.code(404).send({ error: 'Purchase order not found' });
      if (status === 'delivered') {
        await Supplier.findByIdAndUpdate(po.supplier, { $inc: { balance: po.amount, ordersCount: 1 } });
      }
      return po;
    }
  );
}
