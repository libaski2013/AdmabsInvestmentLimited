import Product from '../models/Product.js';

export default async function inventoryRoutes(fastify) {
  fastify.get('/api/products', { preHandler: [fastify.authenticate] }, async (request) => {
    const { category, low } = request.query || {};
    const filter = { active: true };
    if (category) filter.category = category;
    let products = await Product.find(filter).sort({ name: 1 }).lean();
    if (low === 'true') products = products.filter((p) => p.qty <= p.reorderLevel);
    return products;
  });

  fastify.post(
    '/api/products',
    { preHandler: [fastify.authenticate, fastify.requireRole('ceo', 'gm', 'branch')] },
    async (request, reply) => {
      const product = await Product.create(request.body);
      return reply.code(201).send(product);
    }
  );

  fastify.patch(
    '/api/products/:id',
    { preHandler: [fastify.authenticate, fastify.requireRole('ceo', 'gm', 'branch')] },
    async (request, reply) => {
      const product = await Product.findByIdAndUpdate(request.params.id, request.body, { new: true });
      if (!product) return reply.code(404).send({ error: 'Product not found' });
      return product;
    }
  );
}
