import Approval from '../models/Approval.js';

export default async function approvalRoutes(fastify) {
  fastify.get('/api/approvals', { preHandler: [fastify.authenticate] }, async () => {
    return Approval.find().sort({ createdAt: -1 });
  });

  fastify.post('/api/approvals', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const approval = await Approval.create(request.body);
    return reply.code(201).send(approval);
  });

  fastify.patch(
    '/api/approvals/:id',
    { preHandler: [fastify.authenticate, fastify.requireRole('ceo', 'gm', 'finance')] },
    async (request, reply) => {
      const { status } = request.body || {};
      const approval = await Approval.findByIdAndUpdate(request.params.id, { status }, { new: true });
      if (!approval) return reply.code(404).send({ error: 'Approval not found' });
      return approval;
    }
  );
}
