import Product from '../models/Product.js';

export default async function inventoryRoutes(fastify) {
  fastify.get('/api/store/products', async (request) => {
    const { category, q } = request.query || {};
    const filter = { active: true, category: { $in: ['Tyre', 'Rim', 'Battery'] } };
    if (category) filter.category = category;
    if (q) filter.$or = [{ name: new RegExp(q, 'i') }, { code: new RegExp(q, 'i') }, { 'attributes.brand': new RegExp(q, 'i') }];
    return Product.find(filter).select('code name category price qty icon attributes branch outlet').populate('branch', 'name code').lean();
  });
  fastify.get('/api/products', { preHandler: [fastify.authenticate] }, async (request) => {
    const { category, low } = request.query || {};
    const filter = { active: true };
    Object.assign(filter, fastify.scopeFilter(request));
    if (category) filter.category = category;
    let products = await Product.find(filter).sort({ name: 1 }).lean();
    if (low === 'true') products = products.filter((p) => p.qty <= p.reorderLevel);
    return products;
  });

  fastify.post(
    '/api/products',
    { preHandler: [fastify.authenticate, fastify.requirePermission('inventory.create', 'ceo', 'gm', 'branch', 'sub_manager', 'storekeeper')] },
    async (request, reply) => {
      const body = { ...request.body };
      if (!['ceo', 'gm'].includes(request.user.role)) {
        if (request.user.outletIds?.length && !request.user.outletIds.includes(String(body.outlet))) return reply.code(403).send({ error: 'Product must belong to an assigned outlet' });
        if (request.user.branchIds?.length && !request.user.branchIds.includes(String(body.branch))) return reply.code(403).send({ error: 'Product must belong to an assigned branch' });
      }
      const product = await Product.create(body);
      return reply.code(201).send(product);
    }
  );

  fastify.patch(
    '/api/products/:id',
    { preHandler: [fastify.authenticate, fastify.requirePermission('inventory.update', 'ceo', 'gm', 'branch', 'sub_manager', 'storekeeper')] },
    async (request, reply) => {
      const product = await Product.findOneAndUpdate({ _id: request.params.id, ...fastify.scopeFilter(request) }, request.body, { new: true, runValidators: true });
      if (!product) return reply.code(404).send({ error: 'Product not found' });
      return product;
    }
  );
}
