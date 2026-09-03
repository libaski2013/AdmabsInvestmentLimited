import Supplier from '../models/Supplier.js';

export default async function supplierRoutes(fastify) {
  fastify.get('/api/suppliers', { preHandler: [fastify.authenticate] }, async () => {
    return Supplier.find().sort({ name: 1 });
  });

  fastify.post(
    '/api/suppliers',
    { preHandler: [fastify.authenticate, fastify.requireRole('ceo', 'gm')] },
    async (request, reply) => {
      const supplier = await Supplier.create(request.body);
      return reply.code(201).send(supplier);
    }
  );
}
