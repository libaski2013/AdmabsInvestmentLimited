import Branch from '../models/Branch.js';

export default async function branchRoutes(fastify) {
  fastify.get('/api/branches', { preHandler: [fastify.authenticate] }, async () => {
    return Branch.find().sort({ name: 1 });
  });

  fastify.post(
    '/api/branches',
    { preHandler: [fastify.authenticate, fastify.requireRole('ceo', 'gm')] },
    async (request, reply) => {
      const branch = await Branch.create(request.body);
      return reply.code(201).send(branch);
    }
  );
}
